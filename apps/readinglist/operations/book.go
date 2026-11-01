package operations

import (
	"context"
	"errors"
	"iter"
	"time"

	"github.com/Lakeshore-Labs/appbox/sdk"
)

// ImportBooks adds every book or, if any one is refused, none.
//
// It is one transaction of its own; a book without a title is refused.
func (*App) ImportBooks(ctx context.Context, in struct {
	Books []NewBook `json:"books"`
}) ([]Book, error) {
	tx, err := sdk.DB(ctx).BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	q := New(tx)
	books := make([]Book, 0, len(in.Books))
	for _, nb := range in.Books {
		if nb.Title == "" {
			return nil, errors.New("a book has no title")
		}
		b, err := q.CreateBook(ctx, nb)
		if err != nil {
			return nil, err
		}
		books = append(books, b)
	}
	return books, tx.Commit()
}

// Finish marks the book finished now.
func (b *Book) Finish(context.Context) error {
	now := time.Now()
	b.Status, b.FinishedAt = "finished", &now
	return nil
}

// Review marks the book reviewed by the actor.
//
// The database gives the actor, so the book is answered as the query wrote it.
func (b *Book) Review(ctx context.Context) (Book, error) {
	return Query(ctx).ReviewBook(ctx, ReviewBookParams{ID: b.ID})
}

// Dashboard shows the member's books and goals.
func (App) Dashboard(context.Context) error { return nil }

// FeedBooks yields the number of books, counted afresh three times.
func (App) FeedBooks(ctx context.Context) iter.Seq2[int64, error] {
	return func(yield func(int64, error) bool) {
		for range 3 {
			n, err := Query(ctx).CountBooks(ctx)
			if !yield(n, err) || err != nil {
				return
			}
		}
	}
}
