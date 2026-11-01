-- name: RecordInstalled :exec
INSERT INTO installed_app (repository_id, app, head, result) VALUES ($1, $2, $3, $4)
ON CONFLICT (repository_id, app) DO UPDATE SET head = EXCLUDED.head, result = EXCLUDED.result;
