package operations

import (
	"context"
	"errors"
	"time"

	"github.com/Lakeshore-Labs/appbox/apps/reminders/connections/contacts"
	"github.com/Lakeshore-Labs/appbox/apps/reminders/connections/notifications"
)

// The prototype's clock: a day is a minute, so a week is seven minutes.
const day = time.Minute

// Snooze puts the reminder off for 10 minutes from now.
func (r *Reminder) Snooze(ctx context.Context) error {
	if r.DoneAt != nil {
		return errors.New("This reminder is already done.")
	}
	r.DueAt = time.Now().Add(10 * time.Minute)
	return nil
}

// Complete marks the reminder done; one that repeats moves to its next time instead.
func (r *Reminder) Complete(ctx context.Context) error {
	if r.DoneAt != nil {
		return errors.New("This reminder is already done.")
	}
	now := time.Now()
	step := map[string]time.Duration{"daily": day, "weekly": 7 * day}[r.Repeat]
	if step == 0 {
		r.DoneAt = &now
		return nil
	}
	for !r.DueAt.After(now) {
		r.DueAt = r.DueAt.Add(step)
	}
	return nil
}

// Notify tells the reminder's owner through Notifications that it is due, with the note and the person's name.
func (r *Reminder) Notify(ctx context.Context) error {
	msg := "Reminder due: " + r.Note
	if r.ContactID != nil {
		// A contact deleted or unshared since still lets the reminder through, without the name.
		if c, err := contacts.GetContact(ctx, contacts.GetContactIn{Id: *r.ContactID}); err == nil {
			msg += " (" + c.Result.Name + ")"
		}
	}
	_, err := notifications.PostNotification(ctx, notifications.PostNotificationIn{
		Recipient: string(r.AddedBy),
		Message:   msg,
		App:       "reminders",
		Link:      "/app/reminders/",
	})
	return err
}
