package operations

import "context"

// Found is a book's title and author.
type Found struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

// Lookup answers the author of the book with this title.
//
// A bound app calls it by its tool's name, not its address.
func (App) Lookup(ctx context.Context, in struct {
	Title string `json:"title"`
}) (Found, error) {
	b, err := Query(ctx).BookByTitle(ctx, BookByTitleParams{Title: in.Title})
	return Found{Title: b.Title, Author: b.Author}, err
}
