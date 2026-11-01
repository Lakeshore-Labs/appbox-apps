package operations

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/Lakeshore-Labs/appbox/apps/files/connections/file"
	"github.com/Lakeshore-Labs/appbox/apps/files/connections/organization"
	"github.com/Lakeshore-Labs/appbox/sdk"
)

// FileEntry is one file the platform's file service holds, as this app shows it: the file
// service's fields, who put it there by email, and its label when it was put in from here.
type FileEntry struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	ContentType    string    `json:"contentType"`
	Size           int64     `json:"size"`
	App            string    `json:"app"`
	CreatedBy      string    `json:"createdBy"`
	CreatedByEmail *string   `json:"createdByEmail"`
	CreatedAt      time.Time `json:"createdAt"`
	Label          *string   `json:"label"`
}

type SearchFilesInput struct {
	App *string `json:"app,omitempty"`
	Q   *string `json:"q,omitempty"`
}

type SearchFilesResult struct {
	Files []FileEntry `json:"files"`
	// Apps are the apps that hold any file you can see, to narrow the list by.
	Apps []string `json:"apps"`
}

// SearchFiles lists every file your apps hold, newest first, narrowed to one app and to names holding the text when given.
func (App) SearchFiles(ctx context.Context, in SearchFilesInput) (SearchFilesResult, error) {
	all, err := file.ListFiles(ctx, file.ListFilesIn{})
	if err != nil {
		return SearchFilesResult{}, err
	}
	uploads, err := Query(ctx).ListUploads(ctx)
	if err != nil {
		return SearchFilesResult{}, err
	}
	labels := map[string]string{}
	for _, u := range uploads {
		labels[string(u.File)] = u.Label
	}
	// Who put a file there is shown by email; a member list refused leaves the user's id.
	emails := map[string]string{}
	if members, err := organization.ListMembers(ctx, organization.ListMembersIn{}); err == nil {
		for _, m := range members.Result {
			emails[m.User] = m.Email
		}
	}
	q := ""
	if in.Q != nil {
		q = strings.ToLower(strings.TrimSpace(*in.Q))
	}
	out := SearchFilesResult{Files: []FileEntry{}, Apps: []string{}}
	seen := map[string]bool{}
	for _, f := range all.Result {
		if !seen[f.App] {
			seen[f.App] = true
			out.Apps = append(out.Apps, f.App)
		}
		if in.App != nil && *in.App != "" && f.App != *in.App {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(f.Name), q) {
			continue
		}
		e := FileEntry{ID: f.Id, Name: f.Name, ContentType: f.ContentType, Size: f.Size, App: f.App, CreatedBy: f.CreatedBy, CreatedAt: f.CreatedAt}
		if l, ok := labels[f.Id]; ok {
			e.Label = &l
		}
		if m, ok := emails[f.CreatedBy]; ok {
			e.CreatedByEmail = &m
		}
		out.Files = append(out.Files, e)
	}
	sort.Strings(out.Apps)
	sort.SliceStable(out.Files, func(i, j int) bool { return out.Files[i].CreatedAt.After(out.Files[j].CreatedAt) })
	return out, nil
}

type PutFileInput struct {
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Content     []byte `json:"content"`
	Label       string `json:"label"`
}

// PutFile puts a file in as this app's own, kept by the platform's file service, with a short label of what it is.
func (*App) PutFile(ctx context.Context, in PutFileInput) (Upload, error) {
	label := strings.TrimSpace(in.Label)
	if label == "" {
		return Upload{}, errors.New("Give the file a short label of what it is.")
	}
	if strings.TrimSpace(in.Name) == "" {
		return Upload{}, errors.New("The file needs a name.")
	}
	if in.ContentType == "" {
		in.ContentType = "application/octet-stream"
	}
	f, err := file.CreateFile(ctx, file.CreateFileIn{App: "files", Name: in.Name, ContentType: in.ContentType, Content: &in.Content})
	if err != nil {
		return Upload{}, err
	}
	u, err := Query(ctx).CreateUpload(ctx, CreateUploadParams{File: sdk.File(f.Result.Id), Label: label})
	if err != nil {
		// A file without its label is not left behind.
		_, _ = file.DeleteFile(ctx, file.DeleteFileIn{Id: f.Result.Id})
		return Upload{}, err
	}
	return u, nil
}

type RemoveFileInput struct {
	ID string `json:"id"`
}

// RemoveFile deletes the file from the platform's file service, and its label when it was put in here.
func (*App) RemoveFile(ctx context.Context, in RemoveFileInput) error {
	if _, err := file.DeleteFile(ctx, file.DeleteFileIn{Id: in.ID}); err != nil {
		return err
	}
	return Query(ctx).ForgetFile(ctx, ForgetFileParams{File: in.ID})
}
