BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_eligible_types AS
SELECT DISTINCT st.type_id::bigint AS type_id
FROM sde_master.sde_types AS st
WHERE st.type_id IS NOT NULL
  AND st.published IS TRUE
  AND st.market_group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS market_eligible_types_pk
  ON public.market_eligible_types (type_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.market_eligible_types_union AS
SELECT type_id
FROM public.market_eligible_types
UNION
SELECT type_id
FROM public.item_prices_fact;

CREATE UNIQUE INDEX IF NOT EXISTS market_eligible_types_union_pk
  ON public.market_eligible_types_union (type_id);

COMMIT;
