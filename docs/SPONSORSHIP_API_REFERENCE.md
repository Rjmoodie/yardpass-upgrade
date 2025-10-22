# 📚 Sponsorship System API Reference

## Quick Start Queries

### 1. Get Recommended Packages for a Sponsor

```sql
-- Using the optimized view
SELECT 
  package_id,
  title,
  tier,
  price_cents,
  score,
  total_views,
  tickets_sold,
  quality_score_100
FROM public.v_sponsor_recommended_packages
WHERE sponsor_id = 'your-sponsor-uuid'
LIMIT 50;
```

### 2. Get Recommended Sponsors for an Event

```sql
-- Using the optimized view
SELECT 
  sponsor_id,
  sponsor_name,
  industry,
  annual_budget_cents,
  score,
  overlap_metrics,
  status
FROM public.v_event_recommended_sponsors
WHERE event_id = 'your-event-uuid'
LIMIT 50;
```

### 3. Compute Match Score for Specific Pair

```sql
-- Get detailed score and breakdown
SELECT * 
FROM public.fn_compute_match_score(
  'event-uuid'::uuid, 
  'sponsor-uuid'::uuid
);
```

Example output:
```json
{
  "score": 0.7825,
  "breakdown": {
    "budget_fit": 0.850,
    "audience_overlap": {
      "categories": 1.000,
      "geo": 0.667,
      "combined": 0.867
    },
    "geo_overlap": 0.667,
    "engagement_quality": 0.720,
    "objectives_similarity": 0.815,
    "weights": {
      "budget": 0.25,
      "audience": 0.35,
      "geo": 0.15,
      "engagement": 0.15,
      "objectives": 0.10
    }
  }
}
```

### 4. Get All Marketplace Packages

```sql
-- Get all available sponsorship packages with metrics
SELECT 
  package_id,
  event_id,
  title,
  tier,
  price_cents,
  inventory,
  sold,
  expected_reach,
  quality_score_100,
  total_views,
  tickets_sold
FROM public.v_sponsorship_package_cards
WHERE inventory > sold  -- Only available packages
ORDER BY quality_score_100 DESC, price_cents ASC;
```

### 5. Filter Packages by Event Category

```sql
SELECT 
  vp.*,
  e.category,
  e.start_at,
  e.city
FROM public.v_sponsorship_package_cards vp
JOIN public.events e ON e.id = vp.event_id
WHERE e.category = 'music'
  AND e.start_at > now()
  AND vp.inventory > vp.sold
ORDER BY vp.quality_score_100 DESC;
```

### 6. Search Sponsors by Industry and Budget

```sql
SELECT 
  s.id,
  s.name,
  sp.industry,
  sp.company_size,
  sp.annual_budget_cents,
  sp.preferred_categories,
  sp.regions
FROM public.sponsors s
JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
WHERE sp.industry = 'technology'
  AND sp.annual_budget_cents >= 100000
ORDER BY sp.annual_budget_cents DESC;
```

### 7. Get High-Quality Matches Above Threshold

```sql
SELECT 
  m.event_id,
  m.sponsor_id,
  m.score,
  m.overlap_metrics->>'budget_fit' AS budget_fit,
  m.overlap_metrics->'audience_overlap'->>'combined' AS audience_fit,
  e.title AS event_title,
  s.name AS sponsor_name
FROM public.sponsorship_matches m
JOIN public.events e ON e.id = m.event_id
JOIN public.sponsors s ON s.id = m.sponsor_id
WHERE m.score >= 0.75  -- High-quality matches only
  AND m.status = 'pending'
ORDER BY m.score DESC;
```

## Edge Function Integration

### Process Match Queue

```typescript
// supabase/functions/process-matches/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Process batch of 100 matches
  const { data, error } = await supabaseClient
    .rpc('process_match_queue', { p_batch_size: 100 })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      processed: data,
      message: `Processed ${data} matches` 
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### Compute Single Match Score

```typescript
// Get match score for specific sponsor-event pair
const { data, error } = await supabase
  .rpc('fn_compute_match_score', {
    p_event_id: eventId,
    p_sponsor_id: sponsorId
  })

if (!error && data) {
  console.log('Match Score:', data.score)
  console.log('Breakdown:', data.breakdown)
}
```

### Upsert Match Score

```typescript
// Compute and persist match score
const { error } = await supabase
  .rpc('fn_upsert_match', {
    p_event_id: eventId,
    p_sponsor_id: sponsorId
  })

if (!error) {
  console.log('Match score computed and saved')
}
```

## React/Next.js Integration

### Get Sponsor Recommendations Hook

```typescript
// hooks/useSponsorRecommendations.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useSponsorRecommendations(sponsorId: string) {
  return useQuery({
    queryKey: ['sponsor-recommendations', sponsorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sponsor_recommended_packages')
        .select('*')
        .eq('sponsor_id', sponsorId)
        .limit(50)
      
      if (error) throw error
      return data
    },
    enabled: !!sponsorId
  })
}
```

### Get Event Sponsor Matches Hook

```typescript
// hooks/useEventSponsorMatches.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEventSponsorMatches(eventId: string) {
  return useQuery({
    queryKey: ['event-sponsor-matches', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_event_recommended_sponsors')
        .select('*')
        .eq('event_id', eventId)
        .limit(50)
      
      if (error) throw error
      return data
    },
    enabled: !!eventId
  })
}
```

### Marketplace Package Grid

```typescript
// components/MarketplaceGrid.tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function MarketplaceGrid({ category }: { category?: string }) {
  const { data: packages } = useQuery({
    queryKey: ['marketplace-packages', category],
    queryFn: async () => {
      let query = supabase
        .from('v_sponsorship_package_cards')
        .select('*, events!inner(category, start_at, city)')
        .gt('inventory', supabase.raw('sold'))
        .order('quality_score_100', { ascending: false })
      
      if (category) {
        query = query.eq('events.category', category)
      }
      
      const { data, error } = await query.limit(50)
      if (error) throw error
      return data
    }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {packages?.map(pkg => (
        <PackageCard key={pkg.package_id} package={pkg} />
      ))}
    </div>
  )
}
```

## Scheduled Jobs

### Cron Job Configuration

```sql
-- Schedule match queue processing every 5 minutes
SELECT cron.schedule(
  'process-match-queue',
  '*/5 * * * *',
  $$SELECT public.process_match_queue(100);$$
);

-- Schedule cleanup of processed queue items (daily at 2 AM)
SELECT cron.schedule(
  'cleanup-match-queue',
  '0 2 * * *',
  $$DELETE FROM public.fit_recalc_queue WHERE processed_at < now() - interval '7 days';$$
);
```

## Performance Tips

### 1. Use Prepared Statements

```sql
PREPARE sponsor_feed (uuid) AS
  SELECT * FROM public.v_sponsor_recommended_packages
  WHERE sponsor_id = $1
  LIMIT 50;

EXECUTE sponsor_feed('sponsor-uuid');
```

### 2. Batch Score Computation

```sql
-- Compute scores for multiple pairs efficiently
SELECT 
  event_id,
  sponsor_id,
  (SELECT score FROM public.fn_compute_match_score(event_id, sponsor_id)) as score
FROM (
  SELECT e.id as event_id, s.id as sponsor_id
  FROM public.events e
  CROSS JOIN public.sponsors s
  WHERE e.start_at > now()
  LIMIT 100
) pairs;
```

### 3. Materialized View Refresh

```sql
-- Refresh materialized views for better performance
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
```

## Monitoring Queries

### Check Queue Health

```sql
SELECT 
  COUNT(*) as total_pending,
  MIN(queued_at) as oldest_pending,
  MAX(queued_at) as newest_pending
FROM public.fit_recalc_queue
WHERE processed_at IS NULL;
```

### Match Score Distribution

```sql
SELECT 
  CASE 
    WHEN score >= 0.8 THEN 'Excellent (0.8+)'
    WHEN score >= 0.6 THEN 'Good (0.6-0.8)'
    WHEN score >= 0.4 THEN 'Fair (0.4-0.6)'
    ELSE 'Poor (<0.4)'
  END as score_range,
  COUNT(*) as count,
  ROUND(AVG(score), 3) as avg_score
FROM public.sponsorship_matches
GROUP BY score_range
ORDER BY avg_score DESC;
```

### Top Performing Events

```sql
SELECT 
  e.title,
  COUNT(DISTINCT m.sponsor_id) as sponsor_matches,
  AVG(m.score) as avg_match_score,
  MAX(m.score) as best_match_score
FROM public.events e
JOIN public.sponsorship_matches m ON m.event_id = e.id
WHERE m.score >= 0.5
GROUP BY e.id, e.title
ORDER BY sponsor_matches DESC, avg_match_score DESC
LIMIT 20;
```

---

## Need Help?

- **Documentation**: See `docs/SPONSORSHIP_SYSTEM_EXPANSION.md` for architecture details
- **Troubleshooting**: Check `DEPLOYMENT_READY.md` for common issues
- **SQL Recipes**: See `docs/SPONSORSHIP_SQL_RECIPES.md` for more examples
