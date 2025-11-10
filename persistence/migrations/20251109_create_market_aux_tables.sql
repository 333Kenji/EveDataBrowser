BEGIN;

CREATE TABLE IF NOT EXISTS public.item_prices_fact (
  type_id bigint PRIMARY KEY,
  average numeric,
  adjusted numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_history_refresh_cache (
  type_id bigint NOT NULL,
  region_id bigint NOT NULL,
  cached_until timestamptz,
  last_checked_at timestamptz,
  PRIMARY KEY (type_id, region_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'market_history_refresh_cache'
      AND indexname = 'market_history_refresh_cache_cached_until_idx'
  ) THEN
    CREATE INDEX market_history_refresh_cache_cached_until_idx
      ON public.market_history_refresh_cache (cached_until);
  END IF;
END;
$$;

COMMIT;
