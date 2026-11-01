package operations

import "context"

// ListBooksBy lists the books, those by an author when one is named.
//
// Beside the kind's listBooks, not in its place.
func (App) ListBooksBy(ctx context.Context, in struct {
	Author *string `json:"author"`
}) ([]Book, error) {
	return Query(ctx).BooksBy(ctx, BooksByParams{Author: in.Author})
}
