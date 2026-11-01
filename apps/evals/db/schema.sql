-- A case: a request in plain words, the app it is said on, and the checks that say it went
-- well, also in plain words. model is the gateway model it runs on unless a run names another;
-- null runs it on the platform assistant as it stands. nightly runs it every night.
CREATE TABLE eval_case (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      text NOT NULL CONSTRAINT case_title_given CHECK (btrim(title) <> ''),
  request    text NOT NULL CONSTRAINT case_request_given CHECK (btrim(request) <> ''),
  app        text NOT NULL CONSTRAINT case_app_named CHECK (app ~ '^[a-z0-9]+$'),
  checks     text[] NOT NULL CONSTRAINT case_has_checks CHECK (cardinality(checks) > 0),
  model      text,
  nightly    boolean NOT NULL DEFAULT false,
  added_by   appbox.actor NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE eval_case IS '@plural cases A job for the assistant: a request in plain words, the app it is said on, and the checks that say it went well.';

-- An eval_case's rows under it go with it, as the caller may delete them.
CREATE FUNCTION rows_eval_case() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM run WHERE case_id = OLD.id;
  RETURN OLD;
END
$$;

CREATE TRIGGER rows_eval_case BEFORE DELETE ON eval_case
  FOR EACH ROW EXECUTE FUNCTION rows_eval_case();

-- A run: one asking of the case's request of the assistant on the case's app. The answer and
-- the chat's record are the assistant's, kept there under chat, the ask's run id under turn, and
-- read from it; what is kept here is what a list compares: the answer's text, the outcome, the
-- number of asks and model rounds, the names of the operations called, and how the checks were judged.
CREATE TABLE run (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id     bigint NOT NULL REFERENCES eval_case,
  trigger     text NOT NULL DEFAULT 'hand' CONSTRAINT run_trigger_known CHECK (trigger IN ('hand', 'nightly')),
  model       text,
  assistant   text NOT NULL,
  chat        text,
  turn        text,
  outcome     text,
  answer      text,
  error       text,
  turns       integer NOT NULL DEFAULT 0,
  rounds      integer NOT NULL DEFAULT 0,
  tools       text[] NOT NULL DEFAULT '{}',
  judge_chat  text,
  passed      integer NOT NULL DEFAULT 0,
  failed      integer NOT NULL DEFAULT 0,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  added_by    appbox.actor NOT NULL
);
COMMENT ON TABLE run IS 'One asking of a case''s request of the assistant: what came back, its turns, the operations it called, and how its checks were judged.';

-- A run's rows under it go with it, as the caller may delete them.
CREATE FUNCTION rows_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM verdict WHERE run_id = OLD.id;
  RETURN OLD;
END
$$;

CREATE TRIGGER rows_run BEFORE DELETE ON run
  FOR EACH ROW EXECUTE FUNCTION rows_run();

CREATE INDEX run_by_case ON run (case_id, started_at DESC);

CREATE TABLE verdict (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id    bigint NOT NULL REFERENCES run,
  position  integer NOT NULL,
  check_text text NOT NULL,
  pass      boolean NOT NULL,
  reason    text NOT NULL,
  CONSTRAINT verdict_once UNIQUE (run_id, position)
);
COMMENT ON TABLE verdict IS 'One check of a run judged, pass or fail, with a sentence saying why.';
