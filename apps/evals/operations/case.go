package operations

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Lakeshore-Labs/appbox/apps/evals/connections/assistant"
)

// The platform's own assistant: it judges every run, and a case runs on it unless a model is named.
const defaultAssistant = "default"

type RunInput struct {
	// The gateway model to run on this once; the case's own model when absent.
	Model *string `json:"model,omitempty"`
}

// Run asks the assistant exactly what the case says on the case's app, keeps what came back, and has the assistant judge each check.
func (c *EvalCase) Run(ctx context.Context, in RunInput) (Run, error) {
	model := c.Model
	if in.Model != nil {
		model = in.Model
	}
	return runCase(ctx, c, model, "hand")
}

// RunNightly runs the case on its own model when it is set to run every night, and does nothing when it is not.
func (c *EvalCase) RunNightly(ctx context.Context) error {
	if !c.Nightly {
		return nil
	}
	_, err := runCase(ctx, c, c.Model, "nightly")
	return err
}

type NightSlot struct {
	At string `json:"at"`
}

// NextNight answers when the case's next nightly run falls, 02:00 UTC after now.
//
//appbox:role viewer
func (c *EvalCase) NextNight(ctx context.Context) (NightSlot, error) {
	now := time.Now().UTC()
	at := time.Date(now.Year(), now.Month(), now.Day(), 2, 0, 0, 0, time.UTC)
	if !at.After(now) {
		at = at.AddDate(0, 0, 1)
	}
	return NightSlot{At: at.Format(time.RFC3339)}, nil
}

// runCase asks, reads the chat's record back from the assistant, has it judged, and keeps the run;
// an assistant that fails is kept as a failed run, not refused, so the failure is on the record.
func runCase(ctx context.Context, c *EvalCase, model *string, trigger string) (Run, error) {
	if model != nil && strings.TrimSpace(*model) == "" {
		model = nil
	}
	started := time.Now()
	run := NewRun{CaseID: c.ID, Trigger: &trigger, Model: model, StartedAt: &started}
	fail := func(err error) (Run, error) {
		msg := err.Error()
		ended := time.Now()
		outcome := "failed"
		run.Error, run.EndedAt, run.Outcome = &msg, &ended, &outcome
		return Query(ctx).CreateRun(ctx, run)
	}

	id, err := assistantFor(ctx, model)
	run.Assistant = id
	if err != nil {
		return fail(err)
	}
	chat, err := assistant.OpenChat(ctx, assistant.OpenChatIn{App: &c.App, Assistant: id})
	if err != nil {
		return fail(err)
	}
	run.Chat = &chat.Result.Id
	runID := fmt.Sprintf("eval-%d-%d", c.ID, started.UnixNano())
	asked, err := assistant.Ask(ctx, assistant.AskIn{Assistant: id, Chat: chat.Result.Id, Message: c.Request, RunId: &runID})
	if err != nil {
		return fail(err)
	}
	outcome := string(asked.Result.Outcome)
	run.Turn, run.Outcome, run.Answer = &runID, &outcome, &asked.Result.Text
	if asked.Result.Outcome == assistant.AskOutResultOutcomeWaiting {
		asks := make([]string, len(asked.Result.Calls))
		for i, call := range asked.Result.Calls {
			asks[i] = call.Name
		}
		q := asked.Result.Text + "\n\n(The assistant stopped to ask: " + strings.Join(asks, ", ") + ")"
		run.Answer = &q
	}

	got, err := assistant.GetChat(ctx, assistant.GetChatIn{Chat: chat.Result.Id})
	if err != nil {
		return fail(err)
	}
	offered := map[string]bool{}
	for _, tool := range got.Result.Tools {
		offered[tool.Name] = true
	}
	turns, rounds, tools, calls := recorded(got.Result.Messages, offered)
	run.Turns, run.Rounds, run.Tools = &turns, &rounds, tools

	verdicts, judgeChat, err := judge(ctx, c, *run.Answer, calls)
	if judgeChat != "" {
		run.JudgeChat = &judgeChat
	}
	if err != nil {
		return fail(fmt.Errorf("judging the checks: %w", err))
	}
	var passed, failed int32
	for _, v := range verdicts {
		if v.Pass {
			passed++
		} else {
			failed++
		}
	}
	ended := time.Now()
	run.Passed, run.Failed, run.EndedAt = &passed, &failed, &ended
	kept, err := Query(ctx).CreateRun(ctx, run)
	if err != nil {
		return Run{}, err
	}
	for _, v := range verdicts {
		v.RunID = kept.ID
		if _, err := Query(ctx).CreateVerdict(ctx, v); err != nil {
			return Run{}, err
		}
	}
	return kept, nil
}

// recorded is what the run keeps of the chat's record, its messages as AG-UI's: the asks, the
// model's rounds, the operations called in order, those among the chat's offered, no tool of the
// assistant's own, and the calls for the judge, each with its arguments and the result its tool
// message holds, or its error.
func recorded(messages []map[string]any, offered map[string]bool) (turns, rounds int32, tools []string, calls string) {
	results := map[string]map[string]any{}
	for _, m := range messages {
		if id, _ := m["toolCallId"].(string); m["role"] == "tool" && id != "" {
			results[id] = m
		}
	}
	var b strings.Builder
	tools = []string{}
	for _, m := range messages {
		switch m["role"] {
		case "user":
			turns++
		case "assistant":
			rounds++
			list, _ := m["toolCalls"].([]any)
			for _, c := range list {
				call, _ := c.(map[string]any)
				fn, _ := call["function"].(map[string]any)
				name, _ := fn["name"].(string)
				if !offered[name] {
					continue
				}
				id, _ := call["id"].(string)
				tools = append(tools, name)
				text := "(no result)"
				if r, ok := results[id]; ok {
					text = clip(r["content"], 600)
					if e, _ := r["error"].(string); e != "" {
						text = "failed: " + clip(e, 600)
					}
				}
				fmt.Fprintf(&b, "- %s(%s): %s\n", name, clip(fn["arguments"], 600), text)
			}
		}
	}
	return turns, rounds, tools, b.String()
}

// assistantFor answers the platform assistant a run asks: the default one, or for a named model
// the one this app keeps on it, made the first time from the default's instructions and operations
// so that two runs differ by their model alone.
func assistantFor(ctx context.Context, model *string) (string, error) {
	if model == nil {
		return defaultAssistant, nil
	}
	var b strings.Builder
	b.WriteString("evals-")
	for _, r := range strings.ToLower(*model) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	id := b.String()
	if a, err := assistant.GetAssistant(ctx, assistant.GetAssistantIn{Id: id}); err == nil {
		if a.Result.Model != nil && *a.Result.Model == *model {
			return id, nil
		}
		_, err := assistant.UpdateAssistant(ctx, assistant.UpdateAssistantIn{Id: id, Model: model})
		return id, err
	}
	base, err := assistant.GetAssistant(ctx, assistant.GetAssistantIn{Id: defaultAssistant})
	if err != nil {
		return id, err
	}
	_, err = assistant.CreateAssistant(ctx, assistant.CreateAssistantIn{
		Id:           id,
		Name:         "Assistant on " + *model,
		Instructions: base.Result.Instructions,
		Model:        model,
		Operations:   &base.Result.Operations,
	})
	return id, err
}

// judge has the default assistant judge each check of the case against what came back, in a chat
// of its own on the case's app, so it may read that app to see whether the job was done.
func judge(ctx context.Context, c *EvalCase, answer, calls string) ([]NewVerdict, string, error) {
	chat, err := assistant.OpenChat(ctx, assistant.OpenChatIn{App: &c.App, Assistant: defaultAssistant})
	if err != nil {
		return nil, "", err
	}
	if calls == "" {
		calls = "(none)\n"
	}
	var checks strings.Builder
	for i, check := range c.Checks {
		fmt.Fprintf(&checks, "%d. %s\n", i+1, check)
	}
	prompt := fmt.Sprintf(`You are judging how well an assistant did a job for a person. Change nothing. You may read the %q app's data through its operations to see whether the job was really done.

The person said, on the %q app:
%s

The assistant answered:
%s

The operations it called, in order, with their arguments and result:
%s
Judge each check below on its own, pass or fail.
%s
Reply with only a JSON array, one object per check in the order given: {"check": <its number>, "pass": true or false, "reason": "<one sentence saying why>"}.`,
		c.App, c.App, c.Request, answer, calls, checks.String())
	got, err := assistant.Ask(ctx, assistant.AskIn{Assistant: defaultAssistant, Chat: chat.Result.Id, Message: prompt})
	if err != nil {
		return nil, chat.Result.Id, err
	}
	if got.Result.Outcome != assistant.AskOutResultOutcomeAnswered {
		return nil, chat.Result.Id, fmt.Errorf("the judge's turn ended %s", got.Result.Outcome)
	}

	text := got.Result.Text
	var judged []struct {
		Check  int    `json:"check"`
		Pass   bool   `json:"pass"`
		Reason string `json:"reason"`
	}
	start, end := strings.Index(text, "["), strings.LastIndex(text, "]")
	if start < 0 || end < start || json.Unmarshal([]byte(text[start:end+1]), &judged) != nil {
		return nil, chat.Result.Id, fmt.Errorf("the judge did not answer a list of verdicts: %s", text)
	}
	verdicts := make([]NewVerdict, len(c.Checks))
	for i, check := range c.Checks {
		verdicts[i] = NewVerdict{Position: int32(i + 1), CheckText: check, Pass: false, Reason: "The judge gave no verdict on this check."}
	}
	for _, j := range judged {
		if j.Check < 1 || j.Check > len(c.Checks) {
			continue
		}
		v := &verdicts[j.Check-1]
		v.Pass, v.Reason = j.Pass, strings.TrimSpace(j.Reason)
		if v.Reason == "" {
			v.Reason = "No reason given."
		}
	}
	return verdicts, chat.Result.Id, nil
}

// clip writes v, a string as it is and anything else as JSON, cut to n bytes, for the judge's prompt.
func clip(v any, n int) string {
	b, err := []byte(""), error(nil)
	if s, ok := v.(string); ok {
		b = []byte(s)
	} else {
		b, err = json.Marshal(v)
	}
	if err != nil || string(b) == "null" {
		return ""
	}
	if len(b) > n {
		return string(b[:n]) + "…"
	}
	return string(b)
}
