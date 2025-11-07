-- Sets up the sde_master schema and ingest_batches helpers
BEGIN;

CREATE SCHEMA IF NOT EXISTS sde_master;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sde_master.ingest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_path TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS ingest_batches_status_started_idx
  ON sde_master.ingest_batches (status, started_at DESC);

CREATE OR REPLACE FUNCTION sde_master.start_ingest_batch(manifest_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  batch_id UUID;
BEGIN
  INSERT INTO sde_master.ingest_batches (manifest_path, status)
  VALUES (manifest_path, 'running')
  RETURNING id INTO batch_id;
  RETURN batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION sde_master.complete_ingest_batch(batch_id UUID, outcome TEXT, note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF outcome NOT IN ('complete', 'failed') THEN
    RAISE EXCEPTION 'Outcome must be complete or failed';
  END IF;

  UPDATE sde_master.ingest_batches
  SET status = outcome,
      completed_at = NOW(),
      notes = COALESCE(note, notes)
  WHERE id = batch_id;
END;
$$;

COMMIT;
