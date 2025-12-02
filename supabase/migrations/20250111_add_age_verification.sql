-- ============================================================================
-- Migration: Add Age Verification & Region Tracking
-- Purpose: Support age gate compliance (COPPA/GDPR) and region-aware behavior
-- Author: AI Assistant
-- Date: 2025-01-11
-- ============================================================================

-- Add age verification fields to user_profiles
ALTER TABLE users.user_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS region TEXT; -- ISO country code or 'US' | 'EU' | etc.

-- Add constraint: date_of_birth must be in the past
ALTER TABLE users.user_profiles
  ADD CONSTRAINT check_date_of_birth_past
  CHECK (date_of_birth IS NULL OR date_of_birth < CURRENT_DATE);

-- Add index for region-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_region 
  ON users.user_profiles(region) 
  WHERE region IS NOT NULL;

-- Add index for age verification queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_age_verified 
  ON users.user_profiles(age_verified_at) 
  WHERE age_verified_at IS NOT NULL;

-- Function to calculate age from date_of_birth
CREATE OR REPLACE FUNCTION users.calculate_age(p_date_of_birth DATE)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_date_of_birth IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN EXTRACT(YEAR FROM AGE(p_date_of_birth))::INTEGER;
END;
$$;

COMMENT ON FUNCTION users.calculate_age IS 'Calculates age in years from date of birth';

-- Function to check if user meets minimum age requirement
CREATE OR REPLACE FUNCTION users.meets_minimum_age(
  p_user_id UUID,
  p_minimum_age INTEGER DEFAULT 13
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, users
AS $$
DECLARE
  v_date_of_birth DATE;
  v_age INTEGER;
BEGIN
  SELECT date_of_birth INTO v_date_of_birth
  FROM users.user_profiles
  WHERE user_id = p_user_id;
  
  IF v_date_of_birth IS NULL THEN
    RETURN FALSE; -- No age verification
  END IF;
  
  v_age := users.calculate_age(v_date_of_birth);
  
  RETURN v_age >= p_minimum_age;
END;
$$;

COMMENT ON FUNCTION users.meets_minimum_age IS 'Checks if user meets minimum age requirement (default 13 for COPPA)';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION users.calculate_age(DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION users.meets_minimum_age(UUID, INTEGER) TO authenticated, anon;

