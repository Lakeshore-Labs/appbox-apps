-- name: AllowTransition :exec
SELECT set_config('purchasing.transition', 'on', true);

-- name: ApproversAt :many
SELECT * FROM approver WHERE stage = $1;

-- name: CountLines :one
SELECT count(*) FROM order_line WHERE order_id = $1;

-- name: AddEvent :exec
INSERT INTO order_event (order_id, action, stage, actor, reason) VALUES ($1, $2, $3, $4, $5);

-- name: OrderHistory :many
SELECT * FROM order_event WHERE order_id = $1 ORDER BY at, id;

-- name: Notify :exec
INSERT INTO notification (recipient, message, order_id) VALUES ($1, $2, $3);

-- name: NotificationsFor :many
SELECT * FROM notification WHERE recipient = $1 ORDER BY created_at DESC, id DESC LIMIT 200;

-- name: MarkRead :execrows
UPDATE notification SET read = true WHERE id = $1 AND recipient = $2;
