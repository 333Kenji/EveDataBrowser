BEGIN;

-- Ensure each market history bucket is only stored once per type, region, and date.
DO $$
BEGIN
  ALTER TABLE public.market_price_history
    ADD CONSTRAINT market_price_history_type_region_bucket_key
    UNIQUE (type_id, region_id, ts_bucket_start);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Guarantee a single snapshot row per type and region for the latest statistics surface.
DO $$
BEGIN
  ALTER TABLE public.market_latest_stats
    ADD CONSTRAINT market_latest_stats_type_region_key
    UNIQUE (type_id, region_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

COMMIT;
