-- Run in pgAdmin Query Tool against your application database.
-- Safe/idempotent migration for enhanced listing fields.

BEGIN;

ALTER TABLE IF EXISTS listings
  ADD COLUMN IF NOT EXISTS additional_engines JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS listings
  ADD COLUMN IF NOT EXISTS generators JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS listings
  ADD COLUMN IF NOT EXISTS feature_bullets JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS listings
  ADD COLUMN IF NOT EXISTS additional_specs JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE listings
SET additional_engines = COALESCE(additional_engines, '[]'::jsonb),
    generators = COALESCE(generators, '[]'::jsonb),
   feature_bullets = COALESCE(feature_bullets, '[]'::jsonb),
   additional_specs = COALESCE(additional_specs, '{}'::jsonb)
WHERE additional_engines IS NULL
   OR generators IS NULL
  OR feature_bullets IS NULL
  OR additional_specs IS NULL;

COMMIT;
