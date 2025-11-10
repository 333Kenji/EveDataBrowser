BEGIN;

CREATE SCHEMA IF NOT EXISTS stage_csv;

DROP TABLE IF EXISTS stage_csv.inv_categories;
CREATE TABLE stage_csv.inv_categories (
  category_id bigint,
  category_name text,
  icon_id text,
  published integer
);
COPY stage_csv.inv_categories FROM '/tmp/sde/invCategories.csv' WITH (FORMAT csv, HEADER true, NULL 'None');

DROP TABLE IF EXISTS stage_csv.inv_groups;
CREATE TABLE stage_csv.inv_groups (
  group_id bigint,
  category_id bigint,
  group_name text,
  icon_id text,
  use_base_price integer,
  anchored integer,
  anchorable integer,
  fittable_non_singleton integer,
  published integer
);
COPY stage_csv.inv_groups FROM '/tmp/sde/invGroups.csv' WITH (FORMAT csv, HEADER true, NULL 'None');

DROP TABLE IF EXISTS stage_csv.inv_market_groups;
CREATE TABLE stage_csv.inv_market_groups (
  market_group_id bigint,
  parent_group_id bigint,
  market_group_name text,
  description text,
  icon_id text,
  has_types integer
);
COPY stage_csv.inv_market_groups FROM '/tmp/sde/invMarketGroups.csv' WITH (FORMAT csv, HEADER true, NULL 'None');

DROP TABLE IF EXISTS stage_csv.inv_types;
CREATE TABLE stage_csv.inv_types (
  type_id bigint,
  group_id bigint,
  type_name text,
  description text,
  mass double precision,
  volume double precision,
  capacity double precision,
  portion_size bigint,
  race_id bigint,
  base_price double precision,
  published integer,
  market_group_id bigint,
  icon_id text,
  sound_id text,
  graphic_id bigint
);
COPY stage_csv.inv_types FROM '/tmp/sde/invTypes.csv' WITH (FORMAT csv, HEADER true, NULL 'None');

TRUNCATE sde_master.sde_categories CASCADE;
INSERT INTO sde_master.sde_categories (key, category_id, name, published)
SELECT
  category_id,
  category_id,
  jsonb_build_object('en', category_name),
  (published = 1)
FROM stage_csv.inv_categories;

TRUNCATE sde_master.sde_groups CASCADE;
INSERT INTO sde_master.sde_groups (key, group_id, category_id, name, published)
SELECT
  group_id,
  group_id,
  category_id,
  jsonb_build_object('en', group_name),
  (published = 1)
FROM stage_csv.inv_groups;

TRUNCATE sde_master.sde_market_groups CASCADE;
INSERT INTO sde_master.sde_market_groups (key, market_group_id, name, parent_group_id)
SELECT
  market_group_id,
  market_group_id,
  jsonb_build_object('en', market_group_name),
  parent_group_id
FROM stage_csv.inv_market_groups;

TRUNCATE sde_master.sde_types CASCADE;
INSERT INTO sde_master.sde_types (
  key,
  type_id,
  name,
  description,
  published,
  group_id,
  category_id,
  market_group_id,
  meta_group_id,
  faction_id,
  race_id,
  mass,
  volume,
  base_price
)
SELECT
  type_id,
  type_id,
  jsonb_build_object('en', type_name),
  description,
  (published = 1),
  group_id,
  g.category_id,
  market_group_id,
  NULL,
  NULL,
  race_id,
  mass,
  volume,
  base_price
FROM stage_csv.inv_types AS t
LEFT JOIN stage_csv.inv_groups AS g
  ON g.group_id = t.group_id;

TRUNCATE sde_master.master_products;
INSERT INTO sde_master.master_products (
  product_type_id,
  product_name,
  product_group_id,
  product_group_name,
  product_category_id,
  product_category_name,
  product_market_group_id,
  product_market_group_name,
  product_meta_group_id,
  product_meta_group_name,
  product_faction_id,
  product_faction_name,
  blueprint_type_id,
  blueprint_name,
  blueprint_group_id,
  blueprint_group_name,
  blueprint_category_id,
  blueprint_category_name,
  product_quantity,
  manufacturing_time,
  max_production_limit,
  activity,
  created_at,
  updated_at
)
SELECT
  t.type_id,
  t.type_name,
  t.group_id,
  COALESCE(g.group_name, 'Unknown'),
  g.category_id,
  c.category_name,
  t.market_group_id,
  mg.market_group_name,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  COALESCE(t.portion_size, 1),
  NULL,
  NULL,
  'published',
  NOW(),
  NOW()
FROM stage_csv.inv_types AS t
LEFT JOIN stage_csv.inv_groups AS g
  ON g.group_id = t.group_id
LEFT JOIN stage_csv.inv_categories AS c
  ON c.category_id = g.category_id
LEFT JOIN stage_csv.inv_market_groups AS mg
  ON mg.market_group_id = t.market_group_id
WHERE t.published = 1 AND t.market_group_id IS NOT NULL;

COMMIT;
