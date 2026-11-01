package operations

import (
	"context"
	"database/sql"
	"errors"

	"github.com/Lakeshore-Labs/appbox/sdk"
)

// PostNotificationInput is one notification for one member.
type PostNotificationInput struct {
	// Recipient is the member who will see it, as an actor: user:<id>.
	Recipient string `json:"recipient"`
	// Message is what the notification says.
	Message string `json:"message"`
	// App is the name of the app posting it.
	App string `json:"app"`
	// Link is what opens when the member presses it: a path of this host such as /app/tasks/tasks/3, or an http(s) URL.
	Link string `json:"link"`
}

// PostNotification posts a notification into one member's inbox; every app calls this to tell a member something.
//appbox:role viewer
func (*App) PostNotification(ctx context.Context, in PostNotificationInput) (Notification, error) {
	return Query(ctx).PostNotification(ctx, PostNotificationParams{
		Recipient: in.Recipient,
		Message:   in.Message,
		SourceApp: in.App,
		Link:      in.Link,
	})
}

// Inbox answers the caller's own notifications, unread first, newest first.
func (App) Inbox(ctx context.Context) ([]Notification, error) {
	return Query(ctx).Inbox(ctx, InboxParams{Recipient: string(sdk.Actor(ctx))})
}

// UnreadCountOutput is how many of the caller's notifications are unread.
type UnreadCountOutput struct {
	Unread int64 `json:"unread"`
}

// UnreadCount answers how many of the caller's notifications are unread.
func (App) UnreadCount(ctx context.Context) (UnreadCountOutput, error) {
	n, err := Query(ctx).UnreadCount(ctx, UnreadCountParams{Recipient: string(sdk.Actor(ctx))})
	return UnreadCountOutput{Unread: n}, err
}

// MarkReadInput names one of the caller's notifications.
type MarkReadInput struct {
	ID int64 `json:"id"`
}

// MarkRead marks one of the caller's notifications read.
//appbox:role viewer
func (*App) MarkRead(ctx context.Context, in MarkReadInput) (Notification, error) {
	n, err := Query(ctx).MarkRead(ctx, MarkReadParams{ID: in.ID, Recipient: string(sdk.Actor(ctx))})
	if errors.Is(err, sql.ErrNoRows) {
		return n, errors.New("no such notification in your inbox")
	}
	return n, err
}

// MarkAllReadOutput is how many notifications were marked read.
type MarkAllReadOutput struct {
	Marked int64 `json:"marked"`
}

// MarkAllRead marks every unread notification of the caller read.
//appbox:role viewer
func (*App) MarkAllRead(ctx context.Context) (MarkAllReadOutput, error) {
	n, err := Query(ctx).MarkAllRead(ctx, MarkAllReadParams{Recipient: string(sdk.Actor(ctx))})
	return MarkAllReadOutput{Marked: n}, err
}

// ClearIfReadInput names one notification.
type ClearIfReadInput struct {
	NotificationID int64 `json:"notificationId"`
}

// ClearIfReadOutput says whether the notification is gone.
type ClearIfReadOutput struct {
	Gone bool `json:"gone"`
}

// ClearIfRead deletes a notification once it is read and older than 30 seconds, answering whether it is gone.
func (*App) ClearIfRead(ctx context.Context, in ClearIfReadInput) (ClearIfReadOutput, error) {
	gone, err := Query(ctx).ClearIfRead(ctx, ClearIfReadParams{ID: &in.NotificationID})
	return ClearIfReadOutput{Gone: gone != nil && *gone}, err
}
