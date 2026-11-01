-- A reminder: what to do, when it is due, and optionally who it is about, a contact of the
-- Contacts app by its id (the person is Contacts', never copied here). It repeats every day or
-- every week, or not at all; one that does not repeat is finished once marked done. Its owner
-- is the member who added it.
CREATE TABLE reminder (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  note       text NOT NULL CONSTRAINT reminder_note_given CHECK (btrim(note) <> ''),
  due_at     timestamptz NOT NULL,
  contact_id bigint,
  repeat     text NOT NULL DEFAULT 'never' CONSTRAINT reminder_repeat_known CHECK (repeat IN ('never', 'daily', 'weekly')),
  done_at    timestamptz,
  added_by   appbox.actor NOT NULL
);
COMMENT ON TABLE reminder IS 'A short note of what to do, when it is due, and optionally the contact it is about.';
