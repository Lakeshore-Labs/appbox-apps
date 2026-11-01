package operations

import (
	"context"
	"errors"
	"strings"

	"github.com/Lakeshore-Labs/appbox/apps/pictures/connections/file"
	"github.com/Lakeshore-Labs/appbox/apps/pictures/connections/llm"
	"github.com/Lakeshore-Labs/appbox/sdk"
)

type MakePictureInput struct {
	Prompt string `json:"prompt"`
}

// MakePicture makes a picture of what you describe through the platform's image model and keeps it in the gallery with what you asked.
func (*App) MakePicture(ctx context.Context, in MakePictureInput) (Picture, error) {
	prompt := strings.TrimSpace(in.Prompt)
	if prompt == "" {
		return Picture{}, errors.New("Say what you want to see.")
	}
	img, err := llm.GenerateImage(ctx, llm.GenerateImageIn{Prompt: prompt})
	if err != nil {
		return Picture{}, err
	}
	ct := img.Result.ContentType
	if ct == "" {
		ct = "image/png"
	}
	return keep(ctx, fileName(prompt, ct), ct, img.Result.Content, &prompt)
}

type PutPictureInput struct {
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Content     []byte `json:"content"`
}

// PutPicture puts a picture of your own into the gallery, kept by the platform's file service.
func (*App) PutPicture(ctx context.Context, in PutPictureInput) (Picture, error) {
	if !strings.HasPrefix(in.ContentType, "image/") {
		return Picture{}, errors.New("Only a picture can go in: a PNG, JPEG, WebP or GIF.")
	}
	if strings.TrimSpace(in.Name) == "" {
		return Picture{}, errors.New("The picture needs a file name.")
	}
	return keep(ctx, in.Name, in.ContentType, in.Content, nil)
}

// keep puts the bytes in the file service and the row here; a row refused deletes the file again.
func keep(ctx context.Context, name, contentType string, content []byte, prompt *string) (Picture, error) {
	f, err := file.CreateFile(ctx, file.CreateFileIn{App: "pictures", Name: name, ContentType: contentType, Content: &content})
	if err != nil {
		return Picture{}, err
	}
	p, err := Query(ctx).CreatePicture(ctx, CreatePictureParams{File: sdk.File(f.Result.Id), Prompt: prompt})
	if err != nil {
		_, _ = file.DeleteFile(ctx, file.DeleteFileIn{Id: f.Result.Id})
		return Picture{}, err
	}
	return p, nil
}

// fileName names a made picture after the first words of its prompt.
func fileName(prompt, contentType string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(prompt) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case b.Len() > 0 && !strings.HasSuffix(b.String(), "-"):
			b.WriteByte('-')
		}
		if b.Len() >= 40 {
			break
		}
	}
	base := strings.Trim(b.String(), "-")
	if base == "" {
		base = "picture"
	}
	ext := strings.TrimPrefix(contentType, "image/")
	if ext == "jpeg" {
		ext = "jpg"
	}
	return base + "." + ext
}

type RetitleInput struct {
	Title string `json:"title"`
}

// Retitle gives the picture a title; an empty one clears it.
func (p *Picture) Retitle(ctx context.Context, in RetitleInput) error {
	t := strings.TrimSpace(in.Title)
	if t == "" {
		p.Title = nil
	} else {
		p.Title = &t
	}
	return nil
}

type AskInput struct {
	Question string `json:"question"`
}

// Ask asks what is in the picture and keeps the answer with it.
func (p *Picture) Ask(ctx context.Context, in AskInput) error {
	if strings.TrimSpace(in.Question) == "" {
		return errors.New("Ask something about the picture.")
	}
	// The platform's gateway lists generateImage and no operation that reads a picture, so there
	// is nothing to send the question through yet.
	return errors.New("The platform's model gateway offers no operation that reads a picture yet, so it cannot answer this.")
}

// Remove deletes the picture from the gallery and its file from the platform's file service.
func (p *Picture) Remove(ctx context.Context) error {
	id, err := Query(ctx).ForgetPicture(ctx, ForgetPictureParams{ID: p.ID})
	if err != nil {
		return err
	}
	_, err = file.DeleteFile(ctx, file.DeleteFileIn{Id: string(id)})
	return err
}
