CREATE TABLE bills (
  id          text PRIMARY KEY,
  source      text NOT NULL CHECK (source IN ('drinks', 'food')),
  source_id   text NOT NULL,
  table_no    integer NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'paid')),
  tip_minor   integer NOT NULL DEFAULT 0,
  -- card_last4 and processor_ref, as the payment terminal reports them
  payment     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bill_lines (
  id            text PRIMARY KEY,
  bill_id       text NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN ('food', 'drink')),
  quantity      integer NOT NULL CHECK (quantity > 0),
  unit_minor    integer NOT NULL,
  menu_item_id  text,
  sku           text,
  voided        boolean NOT NULL DEFAULT false,
  ordered_at    timestamptz NOT NULL
);
CREATE INDEX bill_lines_bill ON bill_lines (bill_id);

CREATE TABLE bill_adjustments (
  id           bigserial PRIMARY KEY,
  bill_id      text NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  line_id      text NOT NULL REFERENCES bill_lines(id),
  credit_minor integer NOT NULL,
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Every event bill has settled, so redelivered events are skipped.
CREATE TABLE processed_events (
  event_id     text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
