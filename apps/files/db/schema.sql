-- An upload: a file put in from this app, the platform's file by its id (its bytes, name, type
-- and size are the file service's, never copied here), with a short label of what it is. One
-- label per file.
CREATE TABLE upload (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file     appbox.file NOT NULL CONSTRAINT upload_file_once UNIQUE,
  label    text NOT NULL CONSTRAINT upload_label_given CHECK (btrim(label) <> ''),
  added_by appbox.actor NOT NULL
);
COMMENT ON TABLE upload IS 'A file put in from the Files app, with a short label of what it is.';
