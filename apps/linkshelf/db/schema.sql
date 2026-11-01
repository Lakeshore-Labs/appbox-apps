CREATE TABLE link (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url      appbox.url NOT NULL,
  title    text NOT NULL,
  note     text,
  added_by appbox.actor NOT NULL
);
COMMENT ON TABLE link IS 'A link somebody saved.';
