-- name: BooksBy :many
SELECT * FROM book WHERE sqlc.narg('author')::text IS NULL OR author = sqlc.narg('author') ORDER BY id;
