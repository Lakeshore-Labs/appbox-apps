CREATE TABLE project (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL
);
COMMENT ON TABLE project IS 'A piece of work and its tasks.';

CREATE TABLE task (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES project,
  title      text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  added_by   appbox.actor NOT NULL
);
COMMENT ON TABLE task IS 'One thing to do in a project.';

-- Categories for Vietnam News
CREATE TABLE category (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);
COMMENT ON TABLE category IS 'News category such as Business, Tech, Culture, Society, Travel.';

-- News articles
CREATE TABLE article (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  bigint REFERENCES category,
  title        text NOT NULL,
  summary      text NOT NULL,
  content      text NOT NULL,
  source       text NOT NULL DEFAULT 'Vietnam News Agency',
  source_url   text,
  image_url    text,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_featured  boolean NOT NULL DEFAULT false,
  is_breaking  boolean NOT NULL DEFAULT false,
  added_by     appbox.actor NOT NULL
);
COMMENT ON TABLE article IS 'Vietnam news articles and daily reports.';

-- Daily briefing summary
CREATE TABLE daily_briefing (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       text NOT NULL,
  brief_date  text NOT NULL,
  summary     text NOT NULL,
  highlights  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  added_by    appbox.actor NOT NULL
);
COMMENT ON TABLE daily_briefing IS 'Daily morning news briefings for Vietnam.';
