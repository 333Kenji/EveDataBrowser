BEGIN;

CREATE TABLE IF NOT EXISTS public.structure_orders (
  structure_id bigint NOT NULL,
  order_id bigint NOT NULL,
  type_id bigint NOT NULL,
  is_buy_order boolean NOT NULL,
  price numeric NOT NULL,
  volume_remain bigint NOT NULL,
  issued_at timestamptz NOT NULL,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (structure_id, order_id)
);

CREATE INDEX IF NOT EXISTS structure_orders_type_idx
  ON public.structure_orders (type_id);

COMMIT;
