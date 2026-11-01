package operations

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/Lakeshore-Labs/appbox/sdk"
)

// AddContactInput is what addContact takes; company is the id of the company they are at.
type AddContactInput struct {
	Name    string     `json:"name"`
	Email   *string    `json:"email,omitempty"`
	Phone   *string    `json:"phone,omitempty"`
	Company *CompanyId `json:"company,omitempty"`
	Tags    []string   `json:"tags,omitempty"`
}

// AddContact adds a person, refusing an email another contact already has.
func (*App) AddContact(ctx context.Context, in AddContactInput) (Contact, error) {
	if strings.TrimSpace(in.Name) == "" {
		return Contact{}, errors.New("A contact needs a name.")
	}
	var email *string
	if in.Email != nil && strings.TrimSpace(*in.Email) != "" {
		e := strings.TrimSpace(*in.Email)
		n, err := Query(ctx).CountContactsByEmail(ctx, CountContactsByEmailParams{Email: e})
		if err != nil {
			return Contact{}, err
		}
		if n > 0 {
			return Contact{}, fmt.Errorf("A contact with the email %s already exists.", e)
		}
		email = &e
	}
	tags := []string{}
	for _, t := range in.Tags {
		t = strings.ToLower(strings.TrimSpace(t))
		if t != "" && !slices.Contains(tags, t) {
			tags = append(tags, t)
		}
	}
	return Query(ctx).CreateContact(ctx, CreateContactParams{Name: strings.TrimSpace(in.Name), Email: email, Phone: in.Phone, CompanyID: in.Company, Tags: tags})
}

// SearchInput is what searchContacts takes.
type SearchInput struct {
	Q   *string `json:"q,omitempty"`
	Tag *string `json:"tag,omitempty"`
}

// SearchContacts finds the contacts you can see whose name, email or company holds the text, with the tag when one is given.
func (App) SearchContacts(ctx context.Context, in SearchInput) ([]Contact, error) {
	contacts, err := sdk.Call[[]Contact](ctx, "listContacts", struct{}{})
	if err != nil {
		return nil, err
	}
	companies, err := sdk.Call[[]Company](ctx, "listCompanies", struct{}{})
	if err != nil {
		return nil, err
	}
	companyName := map[int64]string{}
	for _, c := range companies {
		companyName[c.ID] = strings.ToLower(c.Name)
	}
	q := ""
	if in.Q != nil {
		q = strings.ToLower(strings.TrimSpace(*in.Q))
	}
	out := []Contact{}
	for _, c := range contacts {
		if in.Tag != nil && *in.Tag != "" && !slices.Contains(c.Tags, *in.Tag) {
			continue
		}
		if q != "" {
			hay := strings.ToLower(c.Name)
			if c.Email != nil {
				hay += "\n" + strings.ToLower(*c.Email)
			}
			if c.CompanyID != nil {
				hay += "\n" + companyName[*c.CompanyID]
			}
			if !strings.Contains(hay, q) {
				continue
			}
		}
		out = append(out, c)
	}
	return out, nil
}

// AddNoteInput is what addNoteContact takes.
type AddNoteInput struct {
	Body    string     `json:"body"`
	NotedAt *time.Time `json:"notedAt,omitempty"`
}

// AddNote writes an entry in the contact's log, signed by you.
//
//appbox:role viewer
func (c *Contact) AddNote(ctx context.Context, in AddNoteInput) error {
	if strings.TrimSpace(in.Body) == "" {
		return errors.New("Say what you talked about.")
	}
	note, err := Query(ctx).InsertNote(ctx, InsertNoteParams{ContactID: c.ID, Body: in.Body, NotedAt: in.NotedAt})
	if err != nil {
		return err
	}
	if c.LastNotedAt == nil || note.NotedAt.After(*c.LastNotedAt) {
		c.LastNotedAt = &note.NotedAt
	}
	return nil
}

// Nudge reminds you in the app to reach out to the contact.
//
//appbox:role viewer
func (c *Contact) Nudge(ctx context.Context) error {
	return Query(ctx).InsertNudge(ctx, InsertNudgeParams{ContactID: c.ID, Message: fmt.Sprintf("No note on %s for 2 minutes - time to reach out.", c.Name)})
}
