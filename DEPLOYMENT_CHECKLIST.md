# ✅ Sponsorship System Deployment Checklist

## Pre-Deployment

### 1. Database Backup
- [ ] Create full database backup
- [ ] Verify backup is restorable
- [ ] Document current schema version

### 2. Review Migrations
- [ ] Review all migration files for correctness
- [ ] Check for naming conflicts
- [ ] Verify foreign key relationships
- [ ] Confirm index strategies

## Deployment Order

### Phase 1: Foundation (✅ Deployed)
- [x] `20251021_0000_sponsorship_system_fixed.sql`
  - Core tables and schema
  - Basic views and functions

### Phase 2: Scale & Money Flow (✅ Deployed)
- [x] `20251021_0100_phase2_partitioning.sql`
- [x] `20251021_0101_phase2_quality_scores.sql` 
- [x] `20251021_0102_phase2_stripe_connect.sql`

### Phase 3: Intelligence (✅ Deployed)
- [x] `20251021_0200_phase3_pgvector.sql`
- [x] `20251021_0201_phase3_advanced_scoring.sql`
- [x] `20251021_0202_phase3_semantic_marketplace.sql`

### Phase 4: Optimization (✅ Deployed)
- [x] `20251022_0001_optimized_sponsorship_system.sql`
  - Optimized views and functions
  - Performance indexes
  - Vector search setup

### Phase 5: Cleanup & Constraints (⏳ Ready to Deploy)
- [ ] `20251022_0002_sponsorship_cleanup_and_constraints.sql`
  - Currency normalization
  - Unique constraints
  - CASCADE deletes
  - Data validation

### Phase 6: Enterprise Features (⏳ Ready to Deploy)
- [ ] `20251022_0003_sponsorship_enterprise_features.sql`
  - Public sponsor profiles
  - Proposal/negotiation system
  - Deliverables tracking
  - ML feature store
  - SLA management

## Deployment Commands

### Option 1: CLI Deployment (Recommended)
```bash
# Deploy cleanup and constraints
npx supabase db push --include-all

# Verify deployment
npx supabase db diff
```

### Option 2: Dashboard Deployment
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `20251022_0002_sponsorship_cleanup_and_constraints.sql`
3. Execute
4. Copy contents of `20251022_0003_sponsorship_enterprise_features.sql`
5. Execute

## Post-Deployment Validation

### 1. Schema Validation
```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%sponsor%'
ORDER BY table_name;

-- Expected tables (22+):
-- - sponsors
-- - sponsor_profiles
-- - sponsor_public_profiles
-- - sponsor_members
-- - sponsorship_packages
-- - sponsorship_matches
-- - sponsorship_orders
-- - sponsorship_payouts
-- - sponsorship_slas
-- - event_sponsorships
-- - package_templates
-- - package_variants
-- - proposal_threads
-- - proposal_messages
-- - deliverables
-- - deliverable_proofs
-- - match_features
-- - match_feedback
-- - audience_consents
-- - payout_configurations
-- - payout_queue
-- - fit_recalc_queue
```

### 2. Views Validation
```sql
-- Check all views exist
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname LIKE '%sponsor%'
ORDER BY viewname;

-- Expected views:
-- - v_sponsorship_package_cards
-- - v_sponsor_recommended_packages
-- - v_event_recommended_sponsors
-- - v_event_performance_summary
-- - v_event_quality_score
```

### 3. Materialized Views
```sql
-- Check MVs exist
SELECT matviewname 
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY matviewname;

-- Expected MVs:
-- - mv_event_quality_scores
-- - mv_event_reach_snapshot
-- - mv_sponsor_event_fit_scores (if exists)

-- Refresh MVs
SELECT refresh_sponsorship_mvs(true);
```

### 4. Functions Validation
```sql
-- Check all functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%sponsor%' OR routine_name LIKE '%match%' OR routine_name LIKE '%payout%')
ORDER BY routine_name;

-- Expected functions:
-- - fn_compute_match_score
-- - fn_upsert_match
-- - process_match_queue
-- - refresh_sponsorship_mvs
-- - calculate_platform_fee
-- - queue_sponsorship_payout
-- - process_payout_queue
-- - validate_sponsorship_data
```

### 5. Indexes Validation
```sql
-- Check critical indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (indexname LIKE '%sponsor%' OR indexname LIKE '%match%' OR indexname LIKE '%pkg%')
ORDER BY indexname;

-- Should include vector indexes if pgvector enabled:
-- - idx_events_desc_vec_hnsw
-- - idx_sponsor_objectives_vec_hnsw
```

### 6. Constraints Validation
```sql
-- Check constraints
SELECT 
  constraint_name, 
  constraint_type,
  table_name
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
AND table_name LIKE '%sponsor%'
ORDER BY table_name, constraint_type;

-- Should include:
-- - UNIQUE constraints (event-sponsor pairs, event-tier packages)
-- - CHECK constraints (scores 0-1, currencies, money >= 0)
-- - FOREIGN KEY constraints with appropriate CASCADE/RESTRICT
```

### 7. Data Integrity Test
```sql
-- Run validation function
SELECT * FROM validate_sponsorship_data();

-- All checks should return 'PASS'
```

### 8. Performance Test
```sql
-- Test scoring function
SELECT * FROM fn_compute_match_score(
  (SELECT id FROM events LIMIT 1),
  (SELECT id FROM sponsors LIMIT 1)
);

-- Should return: { score: numeric, breakdown: jsonb }

-- Test queue processing
SELECT process_match_queue(10);

-- Should return: number of processed items
```

## Configuration

### 1. Enable pg_cron (if available)
```sql
-- Check if pg_cron is available
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Schedule jobs (if enabled)
SELECT cron.schedule(
  'refresh-sponsorship-mvs',
  '0 * * * *',  -- Every hour
  'SELECT refresh_sponsorship_mvs(true);'
);

SELECT cron.schedule(
  'process-match-queue',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT process_match_queue(100);'
);

SELECT cron.schedule(
  'process-payout-queue',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT process_payout_queue();'
);
```

### 2. Set Up Edge Functions
- [ ] Deploy `sponsorship-recalc` Edge Function
- [ ] Deploy `sponsorship-score-onchange` Edge Function
- [ ] Deploy `sponsorship-payouts` Edge Function
- [ ] Configure cron triggers

### 3. Configure Environment Variables
```env
# Add to .env.local or Supabase Dashboard
STRIPE_SECRET_KEY=sk_...
STRIPE_CONNECT_CLIENT_ID=ca_...
OPENAI_API_KEY=sk-...  # For embedding generation
```

## Data Migration

### 1. Generate Initial Embeddings
```typescript
// Run once to generate embeddings for existing data
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(...)
const openai = new OpenAI(...)

// For events
const { data: events } = await supabase.from('events').select('id, title, description')
for (const event of events) {
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: `${event.title}. ${event.description}`
  })
  await supabase
    .from('events')
    .update({ description_embedding: embedding.data[0].embedding })
    .eq('id', event.id)
}

// For sponsors
// Similar process for sponsor_profiles.objectives_embedding
```

### 2. Populate Event Audience Insights
```sql
-- Create initial insights from existing data
INSERT INTO event_audience_insights (event_id, attendee_count, engagement_score)
SELECT 
  e.id,
  COUNT(DISTINCT t.owner_user_id),
  COALESCE(AVG(pi.dwell_ms) / 10000.0, 0.5)
FROM events e
LEFT JOIN tickets t ON t.event_id = e.id
LEFT JOIN post_impressions pi ON pi.post_id IN (
  SELECT id FROM event_posts WHERE event_id = e.id
)
GROUP BY e.id
ON CONFLICT (event_id) DO NOTHING;
```

### 3. Run Initial Match Scoring
```sql
-- Process all event-sponsor pairs
SELECT process_match_queue(1000);

-- Or insert all pairs into queue first
INSERT INTO fit_recalc_queue (event_id, sponsor_id, reason)
SELECT e.id, s.id, 'initial_load'
FROM events e
CROSS JOIN sponsors s
WHERE e.sponsorable = true
ON CONFLICT DO NOTHING;
```

## Monitoring Setup

### 1. Set Up Alerting
- [ ] Configure alerts for queue backlog
- [ ] Set up payout failure notifications
- [ ] Monitor match score quality distribution
- [ ] Track API response times

### 2. Dashboard Metrics
```sql
-- Create monitoring queries
-- Queue health
SELECT COUNT(*) as pending FROM fit_recalc_queue WHERE processed_at IS NULL;

-- Match quality distribution
SELECT 
  CASE 
    WHEN score >= 0.8 THEN 'Excellent'
    WHEN score >= 0.6 THEN 'Good'
    WHEN score >= 0.4 THEN 'Fair'
    ELSE 'Poor'
  END as quality,
  COUNT(*) as count
FROM sponsorship_matches
GROUP BY quality;

-- Revenue metrics
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as orders,
  SUM(amount_cents) / 100.0 as revenue
FROM sponsorship_orders
WHERE status = 'paid'
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

## Rollback Plan

### If Issues Arise
```sql
-- 1. Stop all cron jobs
SELECT cron.unschedule('refresh-sponsorship-mvs');
SELECT cron.unschedule('process-match-queue');
SELECT cron.unschedule('process-payout-queue');

-- 2. Restore from backup
-- Use your backup restoration procedure

-- 3. Re-deploy previous stable version
```

## Success Criteria

- [ ] All migrations applied successfully
- [ ] All validation checks pass
- [ ] Sample queries return expected results
- [ ] Edge functions deploy and run
- [ ] MVs refresh without errors
- [ ] Queue processing completes
- [ ] No orphaned data (validation passes)
- [ ] Performance tests meet targets (<100ms for scoring)
- [ ] RLS policies working correctly

## Documentation

- [ ] Update API documentation with new endpoints
- [ ] Create user guides for new features
- [ ] Document Edge Function deployment
- [ ] Update TypeScript types
- [ ] Create runbook for operations team

## Sign-Off

- [ ] Database Admin Review
- [ ] Backend Lead Review
- [ ] Product Owner Approval
- [ ] QA Testing Complete
- [ ] Production Deployment Scheduled

---

## Quick Commands Reference

```bash
# Deploy all migrations
npx supabase db push --include-all

# Check migration status
npx supabase migration list

# Test connection
npx supabase db ping

# View schema diff
npx supabase db diff

# Reset local database (CAREFUL!)
npx supabase db reset

# Link to project
npx supabase link --project-ref your-project-id

# Deploy Edge Functions
npx supabase functions deploy sponsorship-recalc
npx supabase functions deploy sponsorship-score-onchange
npx supabase functions deploy sponsorship-payouts
```

---

**Date**: _____________  
**Deployed By**: _____________  
**Verified By**: _____________  
**Production URL**: _____________