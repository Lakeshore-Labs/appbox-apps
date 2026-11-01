package operations

import (
	"context"
	"database/sql"
	"errors"

	"github.com/Lakeshore-Labs/appbox/apps/readinglist/connections/catalog"
)

// AddBookByTitle adds the book with this title, its author looked up in the bound catalog.
//
// The lookup is Book Catalog's own, through its gate: a title the catalog has not is refused with
// the lookup's text; any other error is the operation's as it is, a call refused for want of a
// connection naming the connection.
func (*App) AddBookByTitle(ctx context.Context, in struct {
	Title string `json:"title"`
}) (Book, error) {
	found, err := catalog.Lookup(ctx, catalog.LookupIn{Title: in.Title})
	if errors.Is(err, sql.ErrNoRows) {
		return Book{}, errors.New(err.Error()) // the lookup's text, a refusal: no book of this app is missing
	}
	if err != nil {
		return Book{}, err
	}
	return Query(ctx).CreateBook(ctx, CreateBookParams{Title: in.Title, Author: found.Result.Author}) // a bound operation answers under result
}
