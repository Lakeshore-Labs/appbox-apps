-- name: ForgetFile :exec
-- Drops the label of a file that is gone.
DELETE FROM upload WHERE file = sqlc.arg(file);
