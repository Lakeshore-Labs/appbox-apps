-- A picture: the platform's file by its id (its bytes are the file service's, never copied
-- here), what was asked for when the gateway made it, its title, and the question asked about
-- it with the answer. Who added it and when are kept with it.
CREATE TABLE picture (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file       appbox.file NOT NULL CONSTRAINT picture_file_once UNIQUE,
  prompt     text CONSTRAINT picture_prompt_given CHECK (prompt IS NULL OR btrim(prompt) <> ''),
  title      text,
  question   text,
  answer     text,
  added_by   appbox.actor NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE picture IS 'A picture in the gallery: one the gateway made from what was asked, or one put in, with its title and what was said about it.';

-- The gallery reads newest first.
CREATE INDEX picture_newest ON picture (created_at DESC, id DESC);
