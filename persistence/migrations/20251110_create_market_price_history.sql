BEGIN;

CREATE TABLE IF NOT EXISTS public.market_price_history (
  type_id bigint NOT NULL,
  region_id bigint NOT NULL,
  ts_bucket_start timestamptz NOT NULL,
  open_price numeric,
  high_price numeric,
  low_price numeric,
  close_price numeric,
  volume bigint,
  order_count bigint,
  last_ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type_id, region_id, ts_bucket_start)
);

CREATE INDEX IF NOT EXISTS market_price_history_region_idx
  ON public.market_price_history (region_id);

CREATE INDEX IF NOT EXISTS market_price_history_date_idx
  ON public.market_price_history (ts_bucket_start);

COMMIT;
