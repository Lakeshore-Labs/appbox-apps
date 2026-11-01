-- name: ListArticlesWithCategory :many
SELECT a.id, a.category_id, a.title, a.summary, a.content, a.source, a.source_url, a.image_url, a.published_at, a.is_featured, a.is_breaking, a.added_by, c.name as category_name, c.slug as category_slug
FROM article a
LEFT JOIN category c ON a.category_id = c.id
ORDER BY a.published_at DESC;

-- name: GetBreakingNews :many
SELECT a.id, a.title, a.summary, a.published_at, c.name as category_name
FROM article a
LEFT JOIN category c ON a.category_id = c.id
WHERE a.is_breaking = true
ORDER BY a.published_at DESC
LIMIT 5;

-- name: CountOpenTasks :one
SELECT count(*) FROM task WHERE NOT done;
