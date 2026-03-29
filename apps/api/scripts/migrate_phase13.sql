-- Phase 13 migration: Add pipeline storage columns to crisis_events
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Pipeline result storage (Phase 13-04)
ALTER TABLE crisis_events
  ADD COLUMN IF NOT EXISTS discovered_sources jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS all_plans jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audit_log jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pipeline_duration_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pipeline_run_id text DEFAULT '';

-- 2. Hex URL storage (Phase 13-05)
ALTER TABLE crisis_events
  ADD COLUMN IF NOT EXISTS hex_assess_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hex_plans_url text DEFAULT '';

-- 3. Plan acceptance metadata (Phase 13-03)
ALTER TABLE crisis_events
  ADD COLUMN IF NOT EXISTS accepted_plan_name text DEFAULT '';

-- 4. Expand inventory source_type check to include plan acceptance types (Phase 13-03)
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_source_type_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_source_type_check
  CHECK (source_type IN ('donated', 'purchased', 'usda_commodity', 'planned', 'transfer'));
