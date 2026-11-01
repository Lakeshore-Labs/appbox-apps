CREATE TABLE supplier (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               text NOT NULL,
  contact_email      text NOT NULL,
  payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0)
);
COMMENT ON TABLE supplier IS 'A supplier we buy from.';

CREATE TABLE approver (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stage       text NOT NULL UNIQUE CHECK (stage IN ('manager', 'finance')),
  member      text NOT NULL,
  member_name text NOT NULL DEFAULT '',
  backup      text NOT NULL,
  backup_name text NOT NULL DEFAULT ''
);
COMMENT ON TABLE approver IS 'Who approves orders at a stage, and their backup.';

CREATE TABLE purchase_order (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES supplier,
  title       text NOT NULL,
  requester   appbox.actor NOT NULL,
  status      text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_manager', 'pending_finance', 'approved', 'rejected', 'closed', 'cancelled')),
  total       numeric(14, 2) NOT NULL DEFAULT 0,
  rejections  integer NOT NULL DEFAULT 0,
  escalated   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE purchase_order IS 'An order to one supplier.';

-- A purchase_order's rows under it go with it, as the caller may delete them.
CREATE FUNCTION rows_purchase_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('purchasing.deleting', 'on', true);
  DELETE FROM notification WHERE order_id = OLD.id;
  DELETE FROM order_event WHERE order_id = OLD.id;
  DELETE FROM order_line WHERE order_id = OLD.id;
  PERFORM set_config('purchasing.deleting', '', true);
  RETURN OLD;
END
$$;

CREATE TRIGGER rows_purchase_order BEFORE DELETE ON purchase_order
  FOR EACH ROW EXECUTE FUNCTION rows_purchase_order();

CREATE TABLE order_line (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    bigint NOT NULL REFERENCES purchase_order,
  description text NOT NULL,
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  numeric(14, 2) NOT NULL CHECK (unit_price >= 0)
);
COMMENT ON TABLE order_line IS 'One line of a purchase order.';

CREATE TABLE order_event (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES purchase_order,
  action   text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'closed', 'cancelled')),
  stage    text NOT NULL DEFAULT '',
  actor    text NOT NULL,
  reason   text NOT NULL DEFAULT '',
  at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE order_event IS '@plain Every submission, approval, rejection and cancellation of an order.';

CREATE TABLE notification (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient  text NOT NULL,
  message    text NOT NULL,
  order_id   bigint REFERENCES purchase_order,
  created_at timestamptz NOT NULL DEFAULT now(),
  read       boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE notification IS '@plain A message to one member about an order, read by that member alone.';

CREATE INDEX notification_recipient ON notification (recipient, created_at DESC);
CREATE INDEX order_event_order ON order_event (order_id, at);
CREATE INDEX order_line_order ON order_line (order_id);

-- Lines change only while their order is a draft.
CREATE FUNCTION order_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  s text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT status INTO s FROM purchase_order WHERE id = OLD.order_id;
    IF s IS NOT NULL AND s <> 'draft' THEN
      RAISE EXCEPTION 'order % is %; its lines can no longer change', OLD.order_id, s USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status INTO s FROM purchase_order WHERE id = NEW.order_id;
    IF s IS NOT NULL AND s <> 'draft' THEN
      RAISE EXCEPTION 'order % is %; its lines can no longer change', NEW.order_id, s USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END
$$;

CREATE TRIGGER order_line_guard BEFORE INSERT OR UPDATE OR DELETE ON order_line
  FOR EACH ROW EXECUTE FUNCTION order_line_guard();

-- An order's total is the sum of its lines.
CREATE FUNCTION order_line_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ids bigint[];
  prior text := current_setting('purchasing.transition', true);
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('purchasing.deleting', true) = 'on' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN
    ids := ARRAY[OLD.order_id];
  ELSIF TG_OP = 'UPDATE' THEN
    ids := ARRAY[OLD.order_id, NEW.order_id];
  ELSE
    ids := ARRAY[NEW.order_id];
  END IF;
  PERFORM set_config('purchasing.transition', 'on', true);
  UPDATE purchase_order o
     SET total = COALESCE((SELECT sum(l.quantity * l.unit_price) FROM order_line l WHERE l.order_id = o.id), 0)
   WHERE o.id = ANY (ids);
  PERFORM set_config('purchasing.transition', COALESCE(prior, ''), true);
  RETURN NULL;
END
$$;

CREATE TRIGGER order_line_total AFTER INSERT OR UPDATE OR DELETE ON order_line
  FOR EACH ROW EXECUTE FUNCTION order_line_total();

-- An order's status, total and approval state move only through its operations.
CREATE FUNCTION purchase_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.total := 0;
    NEW.rejections := 0;
    NEW.escalated := false;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'order % is %; only a draft can be deleted', OLD.id, OLD.status USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF COALESCE(current_setting('purchasing.transition', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.rejections IS DISTINCT FROM OLD.rejections OR NEW.escalated IS DISTINCT FROM OLD.escalated
     OR NEW.requester IS DISTINCT FROM OLD.requester OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'an order''s status and total change only by submitting, approving, rejecting or cancelling it' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'draft' AND (NEW.supplier_id IS DISTINCT FROM OLD.supplier_id OR NEW.title IS DISTINCT FROM OLD.title) THEN
    RAISE EXCEPTION 'order % is %; it can no longer change', OLD.id, OLD.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER purchase_order_guard BEFORE INSERT OR UPDATE OR DELETE ON purchase_order
  FOR EACH ROW EXECUTE FUNCTION purchase_order_guard();
