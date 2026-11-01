-- One notification for one member: what it says, the app it came from, what to open, when it
-- was posted and when its recipient read it (null while unread).
CREATE TABLE notification (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient  text NOT NULL CONSTRAINT notification_recipient_given CHECK (btrim(recipient) <> ''),
  message    text NOT NULL CONSTRAINT notification_message_given CHECK (btrim(message) <> ''),
  source_app text NOT NULL CONSTRAINT notification_source_app_given CHECK (btrim(source_app) <> ''),
  -- A path of the organization's own host, /app/tasks/tasks/3, or an http(s) URL: never a
  -- javascript: or other URL a press would run, nor //host or /\host, which a browser reads as
  -- another host, nor a control or space character, which a browser drops first, /<tab>/host.
  link       text NOT NULL CONSTRAINT notification_link_safe CHECK (link ~ '^(/($|[^/\\])|https?://)' AND link !~ '[[:cntrl:][:space:]]'),
  posted_at  timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  posted_by  appbox.actor NOT NULL
);
COMMENT ON TABLE notification IS 'One message to one member of the organization, posted by an app.';

-- A member's inbox: unread first, newest first.
CREATE INDEX notification_inbox ON notification (recipient, (read_at IS NOT NULL), posted_at DESC);
