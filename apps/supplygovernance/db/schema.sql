CREATE TABLE semantic_model (
 id text NOT NULL UNIQUE,
 name text NOT NULL CHECK (length(trim(name)) > 0),
 current_revision bigint NOT NULL DEFAULT 1,
 request_key text NOT NULL UNIQUE,
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE semantic_version (
 model text NOT NULL REFERENCES semantic_model(id),
 revision bigint NOT NULL,
 document jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('draft', 'active', 'retired')),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(model, revision)
);
CREATE TABLE semantic_change (
 id text NOT NULL UNIQUE,
 model text NOT NULL REFERENCES semantic_model(id),
 base_revision bigint NOT NULL,
 revision bigint NOT NULL DEFAULT 1,
 title text NOT NULL,
 reason text NOT NULL DEFAULT '',
 document jsonb NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','design_accepted','changes_requested')),
 template text NOT NULL DEFAULT 'blank',
 request_key text NOT NULL UNIQUE,
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(model, base_revision) REFERENCES semantic_version(model, revision)
);
CREATE TABLE semantic_event (
 id text NOT NULL UNIQUE,
 model text NOT NULL REFERENCES semantic_model(id),
 change_ref text NOT NULL DEFAULT '',
 revision bigint NOT NULL,
 action text NOT NULL,
 actor text NOT NULL,
 detail text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX semantic_changes_by_model ON semantic_change(model, updated_at DESC);
CREATE INDEX semantic_events_by_model ON semantic_event(model, created_at DESC);

CREATE TABLE semantic_change_revision (
 change_ref text NOT NULL REFERENCES semantic_change(id),
 revision bigint NOT NULL,
 model text NOT NULL,
 base_revision bigint NOT NULL,
 title text NOT NULL,
 reason text NOT NULL,
 document jsonb NOT NULL,
 state text NOT NULL,
 created_by text NOT NULL,
 changed_by text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(change_ref, revision)
);
