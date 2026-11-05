-- name: ModelList :many
SELECT id, name, current_revision, created_by, created_at::text AS created_at FROM semantic_model ORDER BY created_at DESC;

-- name: ModelFind :one
SELECT m.id, m.name, m.current_revision, v.document::text AS document, v.state FROM semantic_model m JOIN semantic_version v ON v.model=m.id AND v.revision=m.current_revision WHERE m.id=sqlc.arg(model);

-- name: ModelByRequest :one
SELECT id FROM semantic_model WHERE request_key=sqlc.arg(request_key);

-- name: ModelInsert :exec
INSERT INTO semantic_model(id,name,request_key,created_by) VALUES(sqlc.arg(id),sqlc.arg(name),sqlc.arg(request_key),sqlc.arg(actor));

-- name: VersionInsert :exec
INSERT INTO semantic_version(model,revision,document,state,created_by) VALUES(sqlc.arg(model),1,sqlc.arg(document)::text::jsonb,'draft',sqlc.arg(actor));

-- name: VersionFind :one
SELECT document::text AS document FROM semantic_version WHERE model=sqlc.arg(model) AND revision=sqlc.arg(revision);

-- name: ChangeList :many
SELECT id,model,base_revision,revision,title,reason,state,created_by,updated_at::text AS updated_at FROM semantic_change WHERE model=sqlc.arg(model) ORDER BY updated_at DESC;

-- name: ChangeFind :one
SELECT id,model,base_revision,revision,title,reason,document::text AS document,state,created_by,updated_at::text AS updated_at FROM semantic_change WHERE id=sqlc.arg(change);

-- name: ChangeByRequest :one
SELECT id,template FROM semantic_change WHERE request_key=sqlc.arg(request_key);

-- name: ChangeInsert :exec
INSERT INTO semantic_change(id,model,base_revision,title,reason,document,request_key,created_by,template) VALUES(sqlc.arg(id),sqlc.arg(model),sqlc.arg(base_revision),sqlc.arg(title),sqlc.arg(reason),sqlc.arg(document)::text::jsonb,sqlc.arg(request_key),sqlc.arg(actor),sqlc.arg(template));

-- name: ChangeSave :execrows
UPDATE semantic_change SET title=sqlc.arg(title),reason=sqlc.arg(reason),document=sqlc.arg(document)::text::jsonb,revision=revision+1,state='draft',updated_at=now() WHERE id=sqlc.arg(change) AND revision=sqlc.arg(expected_revision) AND state IN ('draft','changes_requested');

-- name: ChangeSubmit :execrows
UPDATE semantic_change SET state='in_review',revision=revision+1,updated_at=now() WHERE id=sqlc.arg(change) AND revision=sqlc.arg(expected_revision) AND state='draft';

-- name: ChangeReview :execrows
UPDATE semantic_change SET state=sqlc.arg(state),revision=revision+1,updated_at=now() WHERE id=sqlc.arg(change) AND revision=sqlc.arg(expected_revision) AND state='in_review' AND created_by<>sqlc.arg(actor);

-- name: EventInsert :exec
INSERT INTO semantic_event(id,model,change_ref,revision,action,actor,detail) VALUES(sqlc.arg(id),sqlc.arg(model),sqlc.arg(change_ref),sqlc.arg(revision),sqlc.arg(action),sqlc.arg(actor),sqlc.arg(detail));

-- name: EventList :many
SELECT id,change_ref,revision,action,actor,detail,created_at::text AS created_at FROM semantic_event WHERE model=sqlc.arg(model) ORDER BY created_at DESC LIMIT 200;

-- name: ChangeContributed :one
SELECT EXISTS(SELECT 1 FROM semantic_event WHERE change_ref=sqlc.arg(change) AND actor=sqlc.arg(actor) AND action IN ('proposal_created','proposal_saved','design_review_requested'))::boolean;

-- name: ChangeSnapshot :exec
INSERT INTO semantic_change_revision(change_ref,revision,model,base_revision,title,reason,document,state,created_by,changed_by,captured_at)
SELECT id,revision,model,base_revision,title,reason,document,state,created_by,COALESCE((SELECT actor FROM semantic_event WHERE change_ref=semantic_change.id AND revision=semantic_change.revision ORDER BY created_at DESC LIMIT 1),sqlc.arg(actor)),updated_at FROM semantic_change WHERE id=sqlc.arg(change) ON CONFLICT(change_ref,revision) DO NOTHING;

-- name: ChangeRevisionFind :one
SELECT change_ref AS id,model,base_revision,revision,title,reason,document::text AS document,state,created_by,captured_at::text AS updated_at FROM semantic_change_revision WHERE change_ref=sqlc.arg(change) AND revision=sqlc.arg(revision);
