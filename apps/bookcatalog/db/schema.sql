CREATE TABLE book (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title  text NOT NULL UNIQUE,
  author text NOT NULL
);
COMMENT ON TABLE book IS 'A book in the catalog.';
