-- name: BookByTitle :one
SELECT * FROM book WHERE title = $1;
