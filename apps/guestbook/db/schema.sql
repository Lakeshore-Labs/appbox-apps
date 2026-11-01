CREATE TABLE entry (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  note     text NOT NULL,
  added_by appbox.actor NOT NULL
);
COMMENT ON TABLE entry IS '@plural entries A note left in the guestbook.';
