CREATE TABLE repository (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner     text NOT NULL,
  name      text NOT NULL,
  branch    text NOT NULL DEFAULT 'main',
  path      text NOT NULL DEFAULT 'apps',
  head      text NOT NULL DEFAULT '',
  synced_at timestamptz,
  added_by  appbox.actor NOT NULL
);
COMMENT ON TABLE repository IS 'An app store: a GitHub repository, its branch and the directory whose subdirectories are apps, and the commit it last refreshed from.';

CREATE TABLE installed_app (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repository_id bigint NOT NULL REFERENCES repository,
  app           text NOT NULL,
  head          text NOT NULL,
  result        text NOT NULL,
  UNIQUE (repository_id, app)
);
COMMENT ON TABLE installed_app IS 'One app of a store as its last refresh left it: the commit it came from, and published or why not.';
