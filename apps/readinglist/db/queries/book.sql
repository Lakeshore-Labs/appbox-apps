-- name: ReviewBook :one
UPDATE book SET reviewed_by = appbox.current_actor() WHERE id = $1 RETURNING *;

-- name: CountBooks :one
SELECT count(*) FROM book;
