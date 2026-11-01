package operations

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/Lakeshore-Labs/appbox/sdk"
)

const (
	autoApproveLimit   = 1000.0
	financeReviewAbove = 10000.0
	maxRejections      = 3
)

var stageNames = map[string]string{"manager": "manager", "finance": "finance director"}

func (o *PurchaseOrder) amount() (float64, error) {
	return strconv.ParseFloat(fmt.Sprint(o.Total), 64)
}

func (o *PurchaseOrder) requesterID() string {
	r := string(o.Requester)
	if i := strings.LastIndex(r, ":"); i >= 0 {
		return r[i+1:]
	}
	return r
}

func (o *PurchaseOrder) label() string {
	return fmt.Sprintf("PO #%d \"%s\" ($%s)", o.ID, o.Title, fmt.Sprint(o.Total))
}

func (o *PurchaseOrder) notify(ctx context.Context, who, message string) error {
	id := o.ID
	return Query(ctx).Notify(ctx, NotifyParams{Recipient: who, Message: message, OrderID: &id})
}

func (o *PurchaseOrder) record(ctx context.Context, action, stage, actor, reason string) error {
	return Query(ctx).AddEvent(ctx, AddEventParams{OrderID: o.ID, Action: action, Stage: stage, Actor: actor, Reason: reason})
}

// approverFor answers who approves at a stage, refused when nobody is set up for it.
func approverFor(ctx context.Context, stage string) (Approver, error) {
	all, err := Query(ctx).ApproversAt(ctx, ApproversAtParams{Stage: stage})
	if err != nil {
		return Approver{}, err
	}
	if len(all) == 0 {
		return Approver{}, fmt.Errorf("no %s approver is set up; add one under Approvers", stageNames[stage])
	}
	return all[0], nil
}

// pendingStage answers the stage an order waits at, refused when it waits on nobody.
func (o *PurchaseOrder) pendingStage() (string, error) {
	switch o.Status {
	case "pending_manager":
		return "manager", nil
	case "pending_finance":
		return "finance", nil
	}
	return "", fmt.Errorf("order %d is %s, not waiting on an approver", o.ID, o.Status)
}

// await puts the order in front of a stage's approver and tells them.
func (o *PurchaseOrder) await(ctx context.Context, stage string) error {
	a, err := approverFor(ctx, stage)
	if err != nil {
		return err
	}
	o.Status = "pending_" + stage
	o.Escalated = false
	return o.notify(ctx, a.Member, fmt.Sprintf("%s is waiting for your approval as %s.", o.label(), stageNames[stage]))
}

// approve finally approves the order and tells the requester.
func (o *PurchaseOrder) approve(ctx context.Context) error {
	o.Status = "approved"
	o.Escalated = false
	return o.notify(ctx, o.requesterID(), fmt.Sprintf("%s is approved.", o.label()))
}

// act checks that the caller approves at the order's current stage, or is that approver's backup.
func (o *PurchaseOrder) act(ctx context.Context) (string, error) {
	stage, err := o.pendingStage()
	if err != nil {
		return "", err
	}
	a, err := approverFor(ctx, stage)
	if err != nil {
		return "", err
	}
	if me := string(sdk.Actor(ctx)); me != a.Member && me != a.Backup {
		return "", fmt.Errorf("order %d waits on the %s; only they or their backup can act on it", o.ID, stageNames[stage])
	}
	return stage, Query(ctx).AllowTransition(ctx)
}

// Submit sends a draft, or a rejected order again, for approval; a total up to $1,000 is approved at once.
func (o *PurchaseOrder) Submit(ctx context.Context) error {
	if o.Status != "draft" && o.Status != "rejected" {
		return fmt.Errorf("order %d is %s; only a draft or a rejected order can be submitted", o.ID, o.Status)
	}
	q := Query(ctx)
	lines, err := q.CountLines(ctx, CountLinesParams{OrderID: o.ID})
	if err != nil {
		return err
	}
	if lines == 0 {
		return errors.New("add at least one line before submitting")
	}
	total, err := o.amount()
	if err != nil {
		return err
	}
	if err := q.AllowTransition(ctx); err != nil {
		return err
	}
	if err := o.record(ctx, "submitted", "", string(sdk.Actor(ctx)), ""); err != nil {
		return err
	}
	if total <= autoApproveLimit {
		if err := o.record(ctx, "approved", "automatic", "system", ""); err != nil {
			return err
		}
		return o.approve(ctx)
	}
	if total > financeReviewAbove {
		if _, err := approverFor(ctx, "finance"); err != nil {
			return err
		}
	}
	return o.await(ctx, "manager")
}

// Approve approves the order at the stage it waits at; over $10,000 a manager's approval passes it to the finance director.
func (o *PurchaseOrder) Approve(ctx context.Context) error {
	stage, err := o.act(ctx)
	if err != nil {
		return err
	}
	if err := o.record(ctx, "approved", stage, string(sdk.Actor(ctx)), ""); err != nil {
		return err
	}
	total, err := o.amount()
	if err != nil {
		return err
	}
	if stage == "manager" && total > financeReviewAbove {
		return o.await(ctx, "finance")
	}
	return o.approve(ctx)
}

type RejectInput struct {
	Reason string `json:"reason"`
}

// Reject rejects the order with a reason and tells the requester; the third rejection closes it for good.
func (o *PurchaseOrder) Reject(ctx context.Context, in RejectInput) error {
	reason := strings.TrimSpace(in.Reason)
	if reason == "" {
		return errors.New("a rejection needs a reason")
	}
	stage, err := o.act(ctx)
	if err != nil {
		return err
	}
	me := string(sdk.Actor(ctx))
	if err := o.record(ctx, "rejected", stage, me, reason); err != nil {
		return err
	}
	o.Rejections++
	o.Escalated = false
	if o.Rejections >= maxRejections {
		o.Status = "closed"
		if err := o.record(ctx, "closed", "", "system", fmt.Sprintf("rejected %d times", o.Rejections)); err != nil {
			return err
		}
		return o.notify(ctx, o.requesterID(), fmt.Sprintf("%s was rejected by the %s (%s): %s. It has been rejected %d times and is closed for good.", o.label(), stageNames[stage], me, reason, o.Rejections))
	}
	o.Status = "rejected"
	return o.notify(ctx, o.requesterID(), fmt.Sprintf("%s was rejected by the %s (%s): %s. You can resubmit it (rejection %d of %d).", o.label(), stageNames[stage], me, reason, o.Rejections, maxRejections))
}

// Cancel cancels the order; only its requester can, and only before it is finally approved.
func (o *PurchaseOrder) Cancel(ctx context.Context) error {
	switch o.Status {
	case "draft", "pending_manager", "pending_finance", "rejected":
	default:
		return fmt.Errorf("order %d is %s and can no longer be cancelled", o.ID, o.Status)
	}
	me := string(sdk.Actor(ctx))
	if me != o.requesterID() {
		return errors.New("only the order's requester can cancel it")
	}
	if err := Query(ctx).AllowTransition(ctx); err != nil {
		return err
	}
	if err := o.record(ctx, "cancelled", "", me, ""); err != nil {
		return err
	}
	o.Status = "cancelled"
	o.Escalated = false
	return nil
}

// Remind notifies the approver the order waits on, and their backup once it has been escalated.
func (o *PurchaseOrder) Remind(ctx context.Context) error {
	stage, err := o.pendingStage()
	if err != nil {
		return nil
	}
	a, err := approverFor(ctx, stage)
	if err != nil {
		return nil
	}
	if err := o.notify(ctx, a.Member, fmt.Sprintf("Reminder: %s is still waiting for your approval as %s.", o.label(), stageNames[stage])); err != nil {
		return err
	}
	if !o.Escalated {
		return nil
	}
	return o.notify(ctx, a.Backup, fmt.Sprintf("Reminder: %s is still waiting on the %s, whom you back up.", o.label(), stageNames[stage]))
}

// Escalate notifies the backup of the approver the order waits on.
func (o *PurchaseOrder) Escalate(ctx context.Context) error {
	stage, err := o.pendingStage()
	if err != nil {
		return nil
	}
	a, err := approverFor(ctx, stage)
	if err != nil {
		return nil
	}
	if err := Query(ctx).AllowTransition(ctx); err != nil {
		return err
	}
	o.Escalated = true
	return o.notify(ctx, a.Backup, fmt.Sprintf("%s has waited 5 minutes on the %s (%s); as their backup you can approve or reject it.", o.label(), stageNames[stage], a.Member))
}

// History lists the order's submissions, approvals, rejections and cancellation, oldest first.
//appbox:role viewer
func (o *PurchaseOrder) History(ctx context.Context) ([]OrderEvent, error) {
	return Query(ctx).OrderHistory(ctx, OrderHistoryParams{OrderID: o.ID})
}
