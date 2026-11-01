-- The reading list's kinds, as they stand. A publish plans the change from the schema the app
-- is running.
CREATE TABLE book (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       text NOT NULL,
  author      text NOT NULL,
  status      text NOT NULL DEFAULT 'to-read' CHECK (status IN ('to-read', 'reading', 'finished')),
  finished_at timestamptz,
  added_by    appbox.actor NOT NULL,
  reviewed_by appbox.actor DEFAULT NULL
);

CREATE TABLE goal (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year   integer NOT NULL UNIQUE,
  target integer NOT NULL CHECK (target > 0)
);
COMMENT ON TABLE goal IS 'How many books to finish in a year.';

CREATE TABLE tag (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  added_by appbox.actor NOT NULL
);

CREATE TABLE note (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id  bigint NOT NULL REFERENCES book,
  body     text NOT NULL,
  added_by appbox.actor NOT NULL
);

CREATE TABLE book_tag (
  book_id bigint REFERENCES book,
  tag_id  bigint REFERENCES tag,
  PRIMARY KEY (book_id, tag_id)
);

CREATE TABLE book_detail (
  book_id bigint PRIMARY KEY REFERENCES book,
  isbn    text NOT NULL
);
