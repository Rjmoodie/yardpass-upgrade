# Sponsorship System - Quick Start Guide

## 🚀 Deployment Order

### Phase 1: Foundation (Required)
```bash
# 1. Core schema
psql $DB_URL -f supabase/migrations/20251021_0001_sponsorship_foundation.sql
psql $DB_URL -f supabase/migrations/20251021_0002_sponsorship_views.sql

# 2. Deploy functions
npx supabase functions deploy sponsorship-recalc
npx supabase functions deploy sponsorship-score-onchange

# 3. Schedule worker
# Run in Supabase SQL Editor:
SELECT cron.schedule('sponsorship-recalc', '*/5 * * * *', $$...$$);
```

**Estimated Time:** 30 minutes  
**Status:** ✅ COMPLETE

---

### Phase 2A: Partitioning (Recommended for > 1M rows)
```bash
# 1. Partition tables (low-traffic window)
psql $DB_URL -f supabase/migrations/20251021_0101_partition_facts.sql

# 2. Validate (wait 24-48 hours)
psql $DB_URL -c "SELECT * FROM event_impressions_old LIMIT 1;"

# 3. Cleanup
psql $DB_URL -f supabase/migrations/20251021_0102_partition_cleanup.sql
```

**Estimated Time:** 1 hour (includes validation wait)  
**Status:** ✅ COMPLETE

---

### Phase 2B: Quality Scores (Recommended)
```bash
# Deploy quality scoring
psql $DB_URL -f supabase/migrations/20251021_0110_quality_score_view.sql
psql $DB_URL -f supabase/migrations/20251021_0111_package_cards_plus_quality.sql
```

**Estimated Time:** 5 minutes  
**Status:** ✅ COMPLETE

---

### Phase 2C: Payouts (Required for Stripe Connect)
```bash
# Deploy payout function
npx supabase functions deploy sponsorship-payouts

# Test
curl -X POST $SUPABASE_URL/functions/v1/sponsorship-payouts \
  -H "Authorization: Bearer $KEY" \
  -d '{"order_id":"...","stripe_transfer_id":"tr_..."}'
```

**Estimated Time:** 15 minutes  
**Status:** ✅ COMPLETE

---

### Phase 3A: Embeddings (Optional, High Value)
```bash
# 1. Enable pgvector
psql $DB_URL -f supabase/migrations/20251021_0201_pgvector_and_embeddings.sql

# 2. Generate embeddings (external service)
# Use: OpenAI, Cohere, or self-hosted sentence-transformers
# Process: embedding_generation_queue table

# 3. Verify coverage
psql $DB_URL -c "SELECT * FROM check_embedding_coverage();"
```

**Estimated Time:** 2 hours (includes embedding generation)  
**Status:** ✅ COMPLETE

---

### Phase 3B: Auto-Triggers (Recommended with Phase 3A)
```bash
# Enable auto-recalc triggers
psql $DB_URL -f supabase/migrations/20251021_0202_recalc_triggers.sql

# Verify queue
psql $DB_URL -c "SELECT * FROM v_recalc_queue_health;"
```

**Estimated Time:** 5 minutes  
**Status:** ✅ COMPLETE

---

### Phase 3C: Enhanced Scoring (Required with Phase 3A)
```bash
# Deploy enhanced scoring function
psql $DB_URL -f supabase/migrations/20251021_0203_scoring_function.sql

# Update edge worker (see PHASE2_PHASE3_COMPLETE.md)
npx supabase functions deploy sponsorship-recalc
```

**Estimated Time:** 15 minutes  
**Status:** ✅ COMPLETE

---

### Phase 3D: Semantic Views (Optional)
```bash
# Deploy semantic search views
psql $DB_URL -f supabase/migrations/20251021_0204_semantic_shortlist_view.sql

# Test
psql $DB_URL -c "SELECT * FROM find_similar_sponsors_for_event('...', 10);"
```

**Estimated Time:** 10 minutes  
**Status:** ✅ COMPLETE

---

## 📊 Health Checks

### Daily
```sql
-- Queue health
SELECT * FROM v_recalc_queue_health;

-- Embedding coverage (if using Phase 3)
SELECT * FROM check_embedding_coverage();

-- Quality score distribution
SELECT * FROM v_quality_score_distribution;
```

### Weekly
```sql
-- Score distribution
SELECT * FROM fn_analyze_score_distribution();

-- Partition health
SELECT schemaname, tablename, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE tablename LIKE '%_p_%';
```

### Monthly
```sql
-- Match conversion rates
SELECT
  CASE
    WHEN score >= 0.8 THEN '0.8-1.0'
    WHEN score >= 0.6 THEN '0.6-0.8'
    ELSE '<0.6'
  END AS score_bucket,
  COUNT(*) AS matches,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'accepted') / COUNT(*), 2) AS conversion_pct
FROM sponsorship_matches
GROUP BY score_bucket;
```

---

## 🆘 Troubleshooting

### Queue Backing Up
```sql
-- Check pending count
SELECT COUNT(*) FROM fit_recalc_queue WHERE processed_at IS NULL;

-- Manually trigger worker
curl -X POST $SUPABASE_URL/functions/v1/sponsorship-recalc \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

### Low Match Scores
```sql
-- Check data availability
SELECT
  (SELECT COUNT(*) FROM sponsor_profiles) AS sponsors,
  (SELECT COUNT(*) FROM event_audience_insights) AS insights,
  (SELECT COUNT(*) FROM sponsor_profiles WHERE objectives_embedding IS NOT NULL) AS sponsors_with_embeddings,
  (SELECT COUNT(*) FROM events WHERE description_embedding IS NOT NULL) AS events_with_embeddings;

-- Recompute a specific match
SELECT * FROM fn_compute_match_score('EVENT_ID', 'SPONSOR_ID');
```

### Partition Issues
```sql
-- Check partition structure
SELECT * FROM pg_partition_tree('event_impressions');

-- Create missing partition manually
CREATE TABLE event_impressions_p_202510
PARTITION OF event_impressions
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

---

## 📞 Support

- **Docs**: `docs/SPONSORSHIP_*.md`
- **Phase 1**: `PHASE1_COMPLETE.md`
- **Phase 2 & 3**: `PHASE2_PHASE3_COMPLETE.md`
- **GitHub**: [issues](https://github.com/liventix/liventix-upgrade/issues)
- **Email**: dev@liventix.com

