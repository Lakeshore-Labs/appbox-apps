-- name: ReadSemanticVersion :one
SELECT model, revision, state, document::text AS document
FROM semantic_version
WHERE model=sqlc.arg(model) AND revision=sqlc.arg(revision);
