-- name: CountContactsByEmail :one
SELECT count(*) FROM contact WHERE lower(email) = lower(@email::text);

-- name: InsertNote :one
INSERT INTO note (contact_id, body, noted_at) VALUES (@contact_id, @body, COALESCE(sqlc.narg(noted_at)::timestamptz, now())) RETURNING *;

-- name: InsertNudge :exec
INSERT INTO nudge (contact_id, message) VALUES (@contact_id, @message);
