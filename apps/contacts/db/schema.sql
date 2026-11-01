-- Every member of the app sees the companies.
CREATE TABLE company (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name    text NOT NULL,
  website text
);
COMMENT ON TABLE company IS '@plural companies A company people work at.';

-- A company's rows under it go with it, as the caller may delete them.
CREATE FUNCTION rows_company() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contact SET company_id = NULL WHERE company_id = OLD.id;
  RETURN OLD;
END
$$;

CREATE TRIGGER rows_company BEFORE DELETE ON company
  FOR EACH ROW EXECUTE FUNCTION rows_company();

-- A person. Its owner is the member who added it; others see it only when shared.
CREATE TABLE contact (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  email         text,
  phone         text,
  company_id    bigint REFERENCES company,
  tags          text[] NOT NULL DEFAULT '{}',
  last_noted_at timestamptz,
  added_by      appbox.actor NOT NULL
);
COMMENT ON TABLE contact IS 'A person - who they are and how to reach them.';

-- A contact's rows under it go with it, as the caller may delete them.
CREATE FUNCTION rows_contact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM nudge WHERE contact_id = OLD.id;
  DELETE FROM note WHERE contact_id = OLD.id;
  RETURN OLD;
END
$$;

CREATE TRIGGER rows_contact BEFORE DELETE ON contact
  FOR EACH ROW EXECUTE FUNCTION rows_contact();

-- One email is one person: no two contacts share an address, whatever its case.
CREATE UNIQUE INDEX contact_email_key ON contact (lower(email));

-- The log under a contact: when, what was talked about, and who on the team wrote it.
CREATE TABLE note (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id bigint NOT NULL REFERENCES contact,
  noted_at   timestamptz NOT NULL DEFAULT now(),
  body       text NOT NULL,
  added_by   appbox.actor NOT NULL
);
COMMENT ON TABLE note IS 'One entry in a contact''s log.';

-- A reminder to reach out to a contact that has gone quiet.
CREATE TABLE nudge (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id bigint NOT NULL REFERENCES contact,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE nudge IS 'A reminder to reach out to a contact with no recent note.';
