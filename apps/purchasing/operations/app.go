package operations

import (
	"context"
	"errors"

	"github.com/Lakeshore-Labs/appbox/sdk"
)

type WhoamiOut struct {
	Member string `json:"member"`
}

// Whoami answers the caller as an actor, user:<id>, as an approver or backup is named.
//appbox:role viewer
func (a *App) Whoami(ctx context.Context) (WhoamiOut, error) {
	return WhoamiOut{Member: string(sdk.Actor(ctx))}, nil
}

// MyNotifications lists the caller's notifications, newest first.
//appbox:role viewer
func (a *App) MyNotifications(ctx context.Context) ([]Notification, error) {
	return Query(ctx).NotificationsFor(ctx, NotificationsForParams{Recipient: string(sdk.Actor(ctx))})
}

type ReadNotificationInput struct {
	ID int64 `json:"id"`
}

// ReadNotification marks one of the caller's notifications as read.
//appbox:role viewer
func (a *App) ReadNotification(ctx context.Context, in ReadNotificationInput) error {
	n, err := Query(ctx).MarkRead(ctx, MarkReadParams{ID: in.ID, Recipient: string(sdk.Actor(ctx))})
	if err != nil {
		return err
	}
	if n == 0 {
		return errors.New("no such notification of yours")
	}
	return nil
}
