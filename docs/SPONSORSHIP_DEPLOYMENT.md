# Sponsorship System Deployment Guide

## Prerequisites

- Supabase project with CLI access
- Node.js 18+ and npm/pnpm
- Git repository access
- Stripe Connect account (for payments)

## Phase 1: Database Setup

### 1. Run Migrations

```bash
# Navigate to project root
cd yardpass-upgrade

# Apply foundation migration
npx supabase db push

# Or manually apply specific migrations
psql $DATABASE_URL -f supabase/migrations/20251021_0001_sponsorship_foundation.sql
psql $DATABASE_URL -f supabase/migrations/20251021_0002_sponsorship_views.sql
```

### 2. Verify Schema

```bash
# Check tables created
npx supabase db list

# Verify indexes
psql $DATABASE_URL -c "\di public.idx_sponsor*"
psql $DATABASE_URL -c "\di public.idx_sponsorship*"

# Check views
psql $DATABASE_URL -c "\dv public.v_*"
```

### 3. Set Up RLS Policies (Optional for MVP)

```sql
-- Enable RLS on new tables
ALTER TABLE public.sponsor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_audience_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_matches ENABLE ROW LEVEL SECURITY;

-- Sponsor profiles: sponsors can read/update their own
CREATE POLICY "Sponsors can view own profile"
  ON public.sponsor_profiles FOR SELECT
  USING (
    sponsor_id IN (
      SELECT id FROM public.sponsors WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Sponsors can update own profile"
  ON public.sponsor_profiles FOR UPDATE
  USING (
    sponsor_id IN (
      SELECT id FROM public.sponsors WHERE created_by = auth.uid()
    )
  );

-- Event insights: public read, service role write
CREATE POLICY "Public can view event insights"
  ON public.event_audience_insights FOR SELECT
  USING (true);

-- Sponsorship matches: sponsors/organizers can view relevant matches
CREATE POLICY "View relevant matches"
  ON public.sponsorship_matches FOR SELECT
  USING (
    sponsor_id IN (SELECT id FROM public.sponsors WHERE created_by = auth.uid())
    OR event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid())
  );
```

## Phase 2: Edge Functions Deployment

### 1. Deploy Functions

```bash
# Deploy sponsorship-recalc
npx supabase functions deploy sponsorship-recalc

# Deploy sponsorship-score-onchange
npx supabase functions deploy sponsorship-score-onchange
```

### 2. Set Environment Variables

```bash
# Set secrets for edge functions
npx supabase secrets set SUPABASE_URL=https://your-project.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Verify secrets
npx supabase secrets list
```

### 3. Test Functions

```bash
# Test sponsorship-recalc
curl -X POST https://your-project.supabase.co/functions/v1/sponsorship-recalc \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Expected response:
# {"success":true,"processed":0,"duration_ms":120,"timestamp":"2025-10-21T10:30:00Z"}

# Test sponsorship-score-onchange
curl -X POST https://your-project.supabase.co/functions/v1/sponsorship-score-onchange \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"test-uuid"}'

# Expected response:
# {"success":true,"queued":10,"operations":["event:test-uuid"],"duration_ms":250,"timestamp":"2025-10-21T10:30:00Z"}
```

### 4. Schedule Worker (Cron)

#### Option A: Supabase Cron (Recommended)

```sql
-- Create cron job to run every 5 minutes
SELECT cron.schedule(
  'sponsorship-recalc',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project.supabase.co/functions/v1/sponsorship-recalc',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Verify cron job
SELECT * FROM cron.job;
```

#### Option B: External Cron (GitHub Actions, Railway, etc.)

```yaml
# .github/workflows/sponsorship-recalc.yml
name: Sponsorship Recalc Worker

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:

jobs:
  recalc:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger recalc function
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/sponsorship-recalc \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

## Phase 3: Data Pipeline Setup

### 1. Create Insights Aggregation Job

```sql
-- Function to aggregate event insights
CREATE OR REPLACE FUNCTION public.aggregate_event_insights()
RETURNS void AS $$
BEGIN
  INSERT INTO public.event_audience_insights (
    event_id,
    attendee_count,
    avg_dwell_time_ms,
    engagement_score,
    ticket_conversion_rate,
    updated_at
  )
  SELECT
    e.id AS event_id,
    COUNT(DISTINCT t.owner_user_id) AS attendee_count,
    AVG(pv.dwell_ms) AS avg_dwell_time_ms,
    AVG(CASE
      WHEN pv.completed THEN 1.0
      ELSE pv.watch_percentage / 100.0
    END) AS engagement_score,
    COUNT(DISTINCT o.id)::numeric / NULLIF(COUNT(DISTINCT ei.user_id), 0) AS ticket_conversion_rate,
    now() AS updated_at
  FROM public.events e
  LEFT JOIN public.tickets t ON t.event_id = e.id
  LEFT JOIN public.post_views pv ON pv.event_id = e.id
  LEFT JOIN public.orders o ON o.event_id = e.id AND o.status IN ('paid', 'fulfilled')
  LEFT JOIN public.event_impressions ei ON ei.event_id = e.id
  WHERE e.start_at > now() - interval '6 months'
  GROUP BY e.id
  ON CONFLICT (event_id) DO UPDATE SET
    attendee_count = EXCLUDED.attendee_count,
    avg_dwell_time_ms = EXCLUDED.avg_dwell_time_ms,
    engagement_score = EXCLUDED.engagement_score,
    ticket_conversion_rate = EXCLUDED.ticket_conversion_rate,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Schedule hourly aggregation
SELECT cron.schedule(
  'aggregate-event-insights',
  '0 * * * *',  -- Every hour
  $$SELECT public.aggregate_event_insights();$$
);
```

### 2. Create Trigger for Auto-Queuing

```sql
-- Trigger to auto-queue recalc on profile update
CREATE OR REPLACE FUNCTION public.queue_sponsor_recalc()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function to queue recalc (async via pg_net)
  PERFORM
    net.http_post(
      url:='https://your-project.supabase.co/functions/v1/sponsorship-score-onchange',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:=jsonb_build_object('sponsor_id', NEW.sponsor_id)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_queue_sponsor_recalc
  AFTER INSERT OR UPDATE ON public.sponsor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_sponsor_recalc();

-- Similar trigger for event insights
CREATE OR REPLACE FUNCTION public.queue_event_recalc()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url:='https://your-project.supabase.co/functions/v1/sponsorship-score-onchange',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:=jsonb_build_object('event_id', NEW.event_id)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_queue_event_recalc
  AFTER INSERT OR UPDATE ON public.event_audience_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_event_recalc();
```

## Phase 4: Frontend Integration

### 1. Install Types

```bash
# Types already created in src/types/db-sponsorship.ts
# No additional installation needed
```

### 2. Create API Hooks

```typescript
// src/hooks/useSponsorRecommendations.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SponsorRecommendation } from '@/types/db-sponsorship';

export function useSponsorRecommendations(eventId: string) {
  return useQuery({
    queryKey: ['sponsor-recommendations', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sponsor_recommendations')
        .select('*')
        .eq('event_id', eventId)
        .gte('score', 0.5)
        .order('score', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SponsorRecommendation[];
    },
  });
}
```

### 3. Create UI Components

```typescript
// src/components/sponsorship/SponsorMatchCard.tsx
import { SponsorRecommendation } from '@/types/db-sponsorship';
import { Card } from '@/components/ui/Card';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { Badge } from '@/components/ui/Badge';

export function SponsorMatchCard({ match }: { match: SponsorRecommendation }) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <img
          src={match.sponsor_logo || '/placeholder-sponsor.png'}
          alt={match.sponsor_name}
          className="w-16 h-16 rounded-md object-cover"
        />
        <div className="flex-1">
          <h3 className="font-semibold text-neutral-800">{match.sponsor_name}</h3>
          <p className="text-sm text-neutral-600">
            {match.industry} · {match.company_size}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-brand-600">
            {Math.round(match.score * 100)}%
          </div>
          <p className="text-xs text-neutral-500">Match Score</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Badge tone="brand">
          {Math.round(match.category_match * 100)}% category fit
        </Badge>
        <Badge tone="neutral">
          {Math.round(match.geo_match * 100)}% geo fit
        </Badge>
        <Badge tone="success">
          {Math.round(match.engagement_fit * 100)}% engagement fit
        </Badge>
      </div>

      <div className="mt-4 flex gap-2">
        <PremiumButton variant="primary" size="sm">
          Contact Sponsor
        </PremiumButton>
        <PremiumButton variant="secondary" size="sm">
          View Profile
        </PremiumButton>
      </div>
    </Card>
  );
}
```

## Phase 5: Testing & Validation

### 1. Seed Test Data

```sql
-- Insert test sponsor profile
INSERT INTO public.sponsor_profiles (
  sponsor_id,
  industry,
  company_size,
  annual_budget_cents,
  preferred_categories,
  regions
) VALUES (
  (SELECT id FROM public.sponsors LIMIT 1),
  'technology',
  'mid',
  5000000,
  ARRAY['music', 'tech', 'art'],
  ARRAY['US', 'CA']
);

-- Insert test event insights
INSERT INTO public.event_audience_insights (
  event_id,
  attendee_count,
  engagement_score,
  ticket_conversion_rate,
  geo_distribution
) VALUES (
  (SELECT id FROM public.events WHERE visibility = 'public' LIMIT 1),
  250,
  0.75,
  0.12,
  '{"US": 180, "CA": 50, "MX": 20}'::jsonb
);
```

### 2. Trigger Initial Calculation

```bash
# Queue all possible matches
curl -X POST https://your-project.supabase.co/functions/v1/sponsorship-score-onchange \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sponsor_ids": ["uuid1", "uuid2"],
    "event_ids": ["uuid3", "uuid4"]
  }'

# Run worker
curl -X POST https://your-project.supabase.co/functions/v1/sponsorship-recalc \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### 3. Validate Results

```sql
-- Check match scores
SELECT
  sm.event_id,
  e.title,
  sm.sponsor_id,
  s.name,
  sm.score,
  sm.overlap_metrics
FROM public.sponsorship_matches sm
JOIN public.events e ON e.id = sm.event_id
JOIN public.sponsors s ON s.id = sm.sponsor_id
ORDER BY sm.score DESC
LIMIT 20;

-- Check views
SELECT * FROM public.v_sponsor_recommendations LIMIT 10;
SELECT * FROM public.v_event_recommendations LIMIT 10;
SELECT * FROM public.v_sponsorship_package_cards LIMIT 10;
```

## Phase 6: Monitoring & Alerts

### 1. Set Up Monitoring Queries

```sql
-- Create monitoring view
CREATE VIEW public.v_sponsorship_health AS
SELECT
  (SELECT COUNT(*) FROM public.sponsor_profiles) AS sponsor_profiles_count,
  (SELECT COUNT(*) FROM public.event_audience_insights) AS insights_count,
  (SELECT COUNT(*) FROM public.sponsorship_matches) AS matches_count,
  (SELECT COUNT(*) FROM public.fit_recalc_queue WHERE processed_at IS NULL) AS queue_pending,
  (SELECT MAX(updated_at) FROM public.sponsorship_matches) AS last_match_update,
  (SELECT AVG(score) FROM public.sponsorship_matches WHERE status = 'pending') AS avg_match_score;
```

### 2. Set Up Alerts (Optional)

```sql
-- Alert if queue is backing up
CREATE OR REPLACE FUNCTION public.check_queue_health()
RETURNS void AS $$
DECLARE
  pending_count integer;
BEGIN
  SELECT COUNT(*) INTO pending_count
  FROM public.fit_recalc_queue
  WHERE processed_at IS NULL;

  IF pending_count > 10000 THEN
    -- Send alert (implement with pg_net or external service)
    RAISE WARNING 'Queue backup detected: % pending items', pending_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule hourly check
SELECT cron.schedule(
  'check-queue-health',
  '0 * * * *',
  $$SELECT public.check_queue_health();$$
);
```

## Rollback Plan

### If Issues Occur

```bash
# 1. Disable cron jobs
SELECT cron.unschedule('sponsorship-recalc');
SELECT cron.unschedule('aggregate-event-insights');

# 2. Rollback migrations (if needed)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS public.sponsorship_matches CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS public.sponsor_profiles CASCADE;"
# etc...

# 3. Undeploy functions
npx supabase functions delete sponsorship-recalc
npx supabase functions delete sponsorship-score-onchange
```

## Performance Tuning

### After 1 Week

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM public.v_sponsor_recommendations
WHERE event_id = 'test-uuid'
ORDER BY score DESC
LIMIT 10;

-- Add indexes if needed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom
  ON public.sponsorship_matches (custom_column);

-- Refresh statistics
ANALYZE public.sponsor_profiles;
ANALYZE public.event_audience_insights;
ANALYZE public.sponsorship_matches;
```

### After 1 Month

```sql
-- Consider partitioning if queue is large
ALTER TABLE public.fit_recalc_queue
  ADD COLUMN created_month date GENERATED ALWAYS AS (DATE_TRUNC('month', queued_at)) STORED;

-- Vacuum and reindex
VACUUM ANALYZE public.sponsorship_matches;
REINDEX TABLE public.sponsorship_matches;
```

## Success Criteria

- [ ] All migrations applied successfully
- [ ] Edge functions deployed and responding
- [ ] Cron jobs scheduled and running
- [ ] Match scores being computed (check `sponsorship_matches` table)
- [ ] Views returning data
- [ ] Frontend components rendering recommendations
- [ ] No errors in Supabase logs
- [ ] Queue processing within 5 minutes

## Support

Issues? Contact:
- Slack: #sponsorship-platform
- Email: dev@yardpass.com
- Docs: https://docs.yardpass.com/sponsorship-deployment

