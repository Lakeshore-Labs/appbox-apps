-- name: ForgetPicture :one
-- Drops the picture's row and answers its file, which the caller then deletes.
DELETE FROM picture WHERE id = sqlc.arg(id) RETURNING file;
