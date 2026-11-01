CREATE TABLE note (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day      date NOT NULL DEFAULT current_date,
  done     text NOT NULL,
  next     text NOT NULL,
  blocked  text,
  added_by appbox.actor NOT NULL
);
COMMENT ON TABLE note IS 'One person''s standup for one day.';
