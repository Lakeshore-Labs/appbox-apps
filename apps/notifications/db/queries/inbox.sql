-- name: PostNotification :one
INSERT INTO notification (recipient, message, source_app, link)
VALUES (@recipient, @message, @source_app, @link)
RETURNING *;

-- name: Inbox :many
SELECT * FROM notification
WHERE recipient = @recipient
ORDER BY read_at IS NOT NULL, posted_at DESC, id DESC;

-- name: UnreadCount :one
SELECT count(*) FROM notification WHERE recipient = @recipient AND read_at IS NULL;

-- name: MarkRead :one
UPDATE notification SET read_at = coalesce(read_at, now())
WHERE id = @id AND recipient = @recipient
RETURNING *;

-- name: MarkAllRead :one
WITH marked AS (
  UPDATE notification SET read_at = now()
  WHERE recipient = @recipient AND read_at IS NULL
  RETURNING 1
)
SELECT count(*) FROM marked;

-- name: ClearIfRead :one
WITH cleared AS (
  DELETE FROM notification
  WHERE id = @id AND read_at IS NOT NULL AND posted_at < now() - interval '30 seconds'
  RETURNING 1
)
SELECT (SELECT count(*) FROM cleared) > 0
    OR NOT EXISTS (SELECT 1 FROM notification WHERE id = @id) AS gone;
