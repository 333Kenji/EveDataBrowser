-- Normalizes manufacturing products (published only) and populates sde_master.products
BEGIN;

CREATE SCHEMA IF NOT EXISTS sde_master;

DROP VIEW IF EXISTS sde_master.manufacturing_products_v;
DROP VIEW IF EXISTS sde_master.products_enriched_v;

CREATE OR REPLACE VIEW sde_master.manufacturing_products_v AS
SELECT
  (bp.payload ->> '_key')::bigint AS blueprint_key,
  (bp.payload ->> 'blueprintTypeID')::bigint AS blueprint_type_id,
  (product ->> 'typeID')::bigint AS product_type_id,
  (product ->> 'quantity')::bigint AS product_quantity,
  NULLIF((bp.payload -> 'activities' -> 'manufacturing' ->> 'time'), '')::bigint AS manufacturing_time,
  (bp.payload ->> 'maxProductionLimit')::bigint AS max_production_limit
FROM stage_sde_blueprints.raw AS bp
CROSS JOIN LATERAL jsonb_array_elements(bp.payload -> 'activities' -> 'manufacturing' -> 'products') AS product
WHERE bp.payload -> 'activities' ? 'manufacturing'
  AND EXISTS (
    SELECT 1 FROM sde_types AS st_product
    WHERE st_product.key = (product ->> 'typeID')::bigint
      AND st_product.published IS TRUE
  );

DROP TABLE IF EXISTS sde_master.products;

CREATE TABLE sde_master.products (
  product_type_id bigint PRIMARY KEY,
  blueprint_key bigint NOT NULL,
  blueprint_type_id bigint NOT NULL,
  product_quantity bigint NOT NULL,
  manufacturing_time bigint,
  max_production_limit bigint,
  activity text NOT NULL DEFAULT 'manufacturing',
  product_group_id bigint,
  product_category_id bigint,
  product_market_group_id bigint,
  product_meta_group_id bigint,
  product_faction_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sde_master.products
  DROP CONSTRAINT IF EXISTS sde_master_products_blueprint_fk;

CREATE INDEX sde_master_products_blueprint_type_idx
  ON sde_master.products (blueprint_type_id);

CREATE INDEX sde_master_products_activity_idx
  ON sde_master.products (activity);

TRUNCATE TABLE sde_master.products;

INSERT INTO sde_master.products (
  product_type_id,
  blueprint_key,
  blueprint_type_id,
  product_quantity,
  manufacturing_time,
  max_production_limit,
  activity,
  product_group_id,
  product_category_id,
  product_market_group_id,
  product_meta_group_id,
  product_faction_id,
  created_at,
  updated_at
)
SELECT DISTINCT ON (mp.product_type_id)
  mp.product_type_id,
  mp.blueprint_key,
  mp.blueprint_type_id,
  mp.product_quantity,
  mp.manufacturing_time,
  mp.max_production_limit,
  'manufacturing' AS activity,
  st_product.group_id,
  sg.category_id,
  st_product.market_group_id,
  st_product.meta_group_id,
  st_product.faction_id,
  NOW(),
  NOW()
FROM sde_master.manufacturing_products_v AS mp
JOIN sde_types AS st_product
  ON st_product.key = mp.product_type_id
LEFT JOIN sde_groups AS sg
  ON sg.key = st_product.group_id
WHERE st_product.published IS TRUE
ORDER BY mp.product_type_id, mp.blueprint_key;

COMMIT;
