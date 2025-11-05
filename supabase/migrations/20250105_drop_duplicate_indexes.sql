-- 20250105_drop_duplicate_indexes.sql
-- Clean up duplicate indexes flagged by Supabase's Performance Advisor
-- Keeps the most descriptive/canonical version of each index

-- ==============================================================================
-- kv_store_d42c04e8
-- 3 identical btree(key text_pattern_ops) indexes; keep one
-- ==============================================================================
DROP INDEX IF EXISTS public.kv_store_d42c04e8_key_idx1;
DROP INDEX IF EXISTS public.kv_store_d42c04e8_key_idx2;
-- Keep: kv_store_d42c04e8_key_idx

-- ==============================================================================
-- sponsor_profiles
-- Multiple exact duplicates on the same columns
-- ==============================================================================

-- industry + company_size (three duplicates)
DROP INDEX IF EXISTS public.idx_sp_profile_industry_size;
DROP INDEX IF EXISTS public.idx_sprof_industry_size;
-- Keep: idx_sponsor_profiles_industry_size

-- preferred_categories GIN (two duplicates of the same partial index)
DROP INDEX IF EXISTS public.idx_sp_profile_categories;
DROP INDEX IF EXISTS public.idx_sprof_categories;
-- Keep: idx_sponsor_profiles_pref_categories

-- regions GIN (three identical partial indexes)
DROP INDEX IF EXISTS public.idx_sp_profile_regions;
DROP INDEX IF EXISTS public.idx_sprof_regions;
-- Keep: idx_sponsor_profiles_regions

-- ==============================================================================
-- sponsor_public_profiles
-- Two identical partial indexes on (is_verified, updated_at DESC)
-- ==============================================================================
DROP INDEX IF EXISTS public.idx_sponsor_public_profiles_verified;
-- Keep: idx_sponsor_public_profiles_verified_updated

-- ==============================================================================
-- match_features
-- Same columns, same order
-- ==============================================================================
DROP INDEX IF EXISTS public.idx_match_features_event_sponsor_ver;
-- Keep: idx_match_features_event_sponsor_version

-- ==============================================================================
-- sponsorship_matches
-- Several "idx_match_*" duplicates of newer "idx_sponsorship_matches_*"
-- ==============================================================================

-- event_id, score DESC, filtered on score >= 0.5
DROP INDEX IF EXISTS public.idx_match_event_score;
-- Keep: idx_sponsorship_matches_event_score_v2

-- status, updated_at DESC
DROP INDEX IF EXISTS public.idx_match_status_updated;
DROP INDEX IF EXISTS public.idx_match_status_utime;
-- Keep: idx_sponsorship_matches_status_updated

-- ==============================================================================
-- proposal_messages
-- Two identical thread_id + created_at DESC indexes
-- ==============================================================================
DROP INDEX IF EXISTS public.idx_prop_msgs_thread_time;
-- Keep: idx_proposal_messages_thread_time

-- ==============================================================================
-- RESULT: Cleaner index structure, better query planner performance
-- ==============================================================================

COMMENT ON SCHEMA public IS 'Duplicate indexes removed for performance optimization';





