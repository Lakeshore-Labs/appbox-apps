package operations

import (
	"cmp"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/Lakeshore-Labs/appbox/apps/repo/connections/builder"
	"github.com/Lakeshore-Labs/appbox/apps/repo/connections/github"
)

// Sync refreshes the store: every directory under the repository's path holding an app.yaml, at the branch's head, read from GitHub as the member, built and published through the Builder, the app installed when the Builder holds no draft of it, else written. One app's failure is kept as its result and the others go on.
//
// The Builder answers each write as it ended, so a sync lasts its builds.
//
//appbox:role editor
func (r *Repository) Sync(ctx context.Context) error {
	prefix := strings.Trim(r.Path, "/") + "/"
	tree, err := github.GetRepositoryTree(ctx, github.GetRepositoryTreeIn{Owner: r.Owner, Repo: r.Name, TreeSha: &r.Branch, Recursive: new(true), PathFilter: &prefix})
	if err != nil {
		return err
	}
	if tree.Truncated {
		return errors.New("GitHub truncated the tree; a smaller store")
	}
	apps := map[string][]string{} // each app's directory, with the files of it the Builder takes
	for _, e := range deref(tree.Tree) {
		dir, rel, nested := strings.Cut(strings.TrimPrefix(e.Path, prefix), "/")
		if _, ok := filetypeOf(rel); e.Type == "blob" && nested && ok {
			apps[dir] = append(apps[dir], rel)
		}
	}
	drafted, err := builder.ListDrafts(ctx, builder.ListDraftsIn{})
	if err != nil {
		return err
	}
	for _, dir := range slices.Sorted(maps.Keys(apps)) {
		if !slices.Contains(apps[dir], "app.yaml") {
			continue
		}
		name, result := dir, ""
		files, err := r.read(ctx, prefix+dir+"/", apps[dir], tree.Sha)
		if err == nil {
			name = cmp.Or(appName(files), dir)
			result, err = published(ctx, name, files, hasDraft(drafted, name))
		}
		if err != nil {
			result = "failed: " + err.Error()
		}
		if err := Query(ctx).RecordInstalled(ctx, RecordInstalledParams{RepositoryID: r.ID, App: name, Head: tree.Sha, Result: result}); err != nil {
			return err
		}
	}
	now := time.Now()
	r.Head, r.SyncedAt = tree.Sha, &now
	return nil
}

// Publish commits the app called App, its published source as the Builder exports it, to its directory in the store, on the store's branch, and takes that commit as the store's head. It refuses when the branch has moved since the last refresh, so a push is never overwritten; refresh, then publish again. A file removed from the app stays in the store.
//
//appbox:role editor
func (r *Repository) Publish(ctx context.Context, in struct{ App string }) error {
	tree, err := github.GetRepositoryTree(ctx, github.GetRepositoryTreeIn{Owner: r.Owner, Repo: r.Name, TreeSha: &r.Branch})
	if err != nil {
		return err
	}
	if tree.Sha != r.Head {
		return errors.New(r.Branch + " moved since the last refresh, to " + tree.Sha + "; refresh the store, then publish")
	}
	exported, err := builder.ExportApp(ctx, builder.ExportAppIn{App: in.App})
	if err != nil {
		return err
	}
	var files []file
	if err := into(exported.Result.Files, &files); err != nil {
		return err
	}
	push := github.PushFilesIn{Owner: r.Owner, Repo: r.Name, Branch: r.Branch, Message: in.App + ": published from the App Store"}
	for _, f := range files {
		at, ok := placeOf(f)
		if !ok {
			return errors.New(in.App + " holds a " + f.Filetype + " file the store has no place for: " + f.Name)
		}
		push.Files = append(push.Files, struct {
			Content string `json:"content"`
			Path    string `json:"path"`
		}{f.Content, strings.Trim(r.Path, "/") + "/" + in.App + "/" + at})
	}
	pushed, err := github.PushFiles(ctx, push)
	if err != nil {
		return err
	}
	var commit struct {
		Object struct{ Sha string } `json:"object"`
	}
	if err := into(pushed, &commit); err != nil {
		return err
	}
	if commit.Object.Sha == "" {
		return errors.New("GitHub answered no commit")
	}
	now := time.Now()
	r.Head, r.SyncedAt = commit.Object.Sha, &now
	return Query(ctx).RecordInstalled(ctx, RecordInstalledParams{RepositoryID: r.ID, App: in.App, Head: commit.Object.Sha, Result: "published to the store"})
}

// placeOf is where f sits in an app's directory, the filetypes table read the other way.
func placeOf(f file) (string, bool) {
	for at, filetype := range filetypes {
		if filetype == f.Filetype {
			return path.Join(path.Dir(at), f.Name), true
		}
	}
	return "", false
}

// read is the app's files at the paths under dir, at commit sha.
func (r *Repository) read(ctx context.Context, dir string, paths []string, sha string) ([]file, error) {
	files := make([]file, 0, len(paths))
	for _, rel := range paths {
		content, err := r.fileAt(ctx, dir+rel, sha)
		if err != nil {
			return nil, err
		}
		filetype, _ := filetypeOf(rel)
		files = append(files, file{Filetype: filetype, Name: path.Base(rel), Content: content})
	}
	return files, nil
}

// published writes files as the draft of the app called name, or installs them when it has none, and answers how the write ended.
func published(ctx context.Context, name string, files []file, drafted bool) (string, error) {
	if drafted {
		result, err := rewritten(ctx, name, files)
		return summary(result), err
	}
	in := builder.InstallAppIn{Name: name}
	if err := into(files, &in.Files); err != nil {
		return "", err
	}
	out, err := builder.InstallApp(ctx, in)
	return summary(out.Result), err
}

// file is one file of an app as the Builder's writes take it.
type file struct {
	Filetype string `json:"filetype"`
	Name     string `json:"name"`
	Content  string `json:"content"`
}

// into is v as out, through the JSON the Builder's generated inputs share.
func into(v, out any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}

// filetypes is each Builder filetype by where its files sit in a checkout, as the platform's generate.Paths places them.
// ponytail: an app cannot import the platform, so this is the one place its table is written twice; it goes when the Builder answers a path's filetype.
var filetypes = map[string]string{
	"app.yaml": "app", "db/schema.sql": "schema", "db/queries/*.sql": "query", "operations/*.go": "operation",
	"web/src/pages/*.tsx": "page", "web/src/components/*.tsx": "component", "workflows/*.yaml": "workflow",
	"theme.css": "theme", "icon.svg": "icon", "api/connections/*.json": "connection",
}

// filetypeOf is the Builder filetype of the authored file at rel in a checkout; none for a file that is not authored: elsewhere, generated, a test or a dotfile.
func filetypeOf(rel string) (string, bool) {
	base := path.Base(rel)
	if strings.HasPrefix(base, ".") || strings.Contains(base, "_test.") || strings.Contains(base, ".gen.") {
		return "", false
	}
	for at, filetype := range filetypes {
		if ok, _ := path.Match(at, rel); ok {
			return filetype, true
		}
	}
	return "", false
}

// fileAt is the text of the file at p in the repository at commit sha, as get_file_contents answers it: its content's resource, text, base64 or, for an empty file, neither.
func (r *Repository) fileAt(ctx context.Context, p, sha string) (string, error) {
	out, err := github.GetFileContents(ctx, github.GetFileContentsIn{Owner: r.Owner, Repo: r.Name, Path: &p, Sha: &sha})
	if err != nil {
		return "", fmt.Errorf("%s: %w", p, err)
	}
	b, _ := json.Marshal(out)
	var v struct {
		Content []struct {
			Resource *struct {
				Text *string `json:"text"`
				Blob *string `json:"blob"`
			} `json:"resource"`
		} `json:"content"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return "", fmt.Errorf("%s: %w", p, err)
	}
	for _, c := range v.Content {
		if c.Resource == nil {
			continue
		}
		if c.Resource.Text != nil {
			return *c.Resource.Text, nil
		}
		if c.Resource.Blob != nil { // what GitHub's server does not type as text, such as CSS and SVG
			b, err := base64.StdEncoding.DecodeString(*c.Resource.Blob)
			if err != nil {
				return "", fmt.Errorf("%s: %w", p, err)
			}
			return string(b), nil
		}
		return "", nil // an empty file: a resource with neither
	}
	return "", errors.New(p + ": GitHub answered no text for the file")
}

// appName is the app's name as its app.yaml among files gives it; empty without one.
func appName(files []file) string {
	for _, f := range files {
		if f.Filetype != "app" {
			continue
		}
		for line := range strings.Lines(f.Content) {
			if name, ok := strings.CutPrefix(strings.TrimSpace(line), "name:"); ok {
				return strings.TrimSpace(name)
			}
		}
	}
	return ""
}

// hasDraft is whether the Builder lists a draft called name.
func hasDraft(listed builder.ListDraftsOut, name string) bool {
	for _, a := range listed.Result {
		if a.Name == name {
			return true
		}
	}
	return false
}

// rewritten writes files as the draft of app, removing each authored file of the draft they do
// not name; a binding is bindConnection's to write, so it is neither written nor removed.
func rewritten(ctx context.Context, app string, files []file) (any, error) {
	listed, err := builder.ListFiles(ctx, builder.ListFilesIn{App: app})
	if err != nil {
		return nil, err
	}
	keep := map[string]bool{}
	written, gone := []file{}, []file{}
	for _, f := range files {
		keep[f.Filetype+"/"+f.Name] = true
		if f.Filetype != "connection" {
			written = append(written, f)
		}
	}
	for _, f := range listed.Result {
		filetype := string(f.Filetype)
		if !keep[filetype+"/"+f.Name] && filetype != "generated" && filetype != "connection" {
			gone = append(gone, file{Filetype: filetype, Name: f.Name})
		}
	}
	in := builder.WriteFilesIn{App: app}
	if err := into(written, &in.Files); err != nil {
		return nil, err
	}
	if err := into(gone, &in.Delete); err != nil {
		return nil, err
	}
	out, err := builder.WriteFiles(ctx, in)
	if err != nil {
		return nil, err
	}
	return out.Result, nil
}

// summary is a write's result in one text: the build published, or failed with its error and each diagnostic.
func summary(result any) string {
	b, _ := json.Marshal(result)
	var v struct {
		Build       *string `json:"build"`
		State       string  `json:"state"`
		Error       *string `json:"error"`
		Diagnostics []struct {
			Source, Filetype, Name, Message string
			Line, Column                    int
		} `json:"diagnostics"`
	}
	_ = json.Unmarshal(b, &v)
	if v.Build != nil {
		return "published " + *v.Build
	}
	lines := []string{v.State}
	if v.Error != nil {
		lines = append(lines, *v.Error)
	}
	for _, d := range v.Diagnostics {
		lines = append(lines, fmt.Sprintf("%s %s/%s:%d:%d: %s", d.Source, d.Filetype, d.Name, d.Line, d.Column, d.Message))
	}
	return strings.Join(lines, "\n")
}

func deref[T any](p *[]T) []T {
	if p == nil {
		return nil
	}
	return *p
}
