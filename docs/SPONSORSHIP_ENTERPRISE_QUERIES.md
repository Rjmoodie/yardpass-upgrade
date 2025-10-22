# 🔍 Sponsorship Enterprise Queries

## Sample Queries for Production Use

### A) Top Sponsors for Event (Explainable AI)

Get ranked sponsors with explainability and feature breakdowns:

```sql
-- Inputs: :event_id
WITH base AS (
  SELECT
    sm.sponsor_id,
    sm.score,
    COALESCE(sm.explanations, '{}'::jsonb) AS explanations,
    sp.name,
    sp.website_url,
    sp.logo_url
  FROM public.sponsorship_matches sm
  JOIN public.sponsors sp ON sp.id = sm.sponsor_id
  WHERE sm.event_id = :event_id
    AND sm.status IN ('pending','suggested','accepted')
  ORDER BY sm.score DESC
  LIMIT 25
)
SELECT
  b.*,
  mf.features
FROM base b
LEFT JOIN LATERAL (
  SELECT features FROM public.match_features mf
  WHERE mf.event_id = :event_id AND mf.sponsor_id = b.sponsor_id
  ORDER BY mf.version DESC, mf.computed_at DESC
  LIMIT 1
) mf ON TRUE;
```

### B) Quick Stats Snapshot for Package (Package Page)

Get comprehensive package data with reach metrics:

```sql
-- Input: :package_id
SELECT
  p.id AS package_id,
  p.event_id,
  p.title,
  p.price_cents,
  p.inventory,
  p.sold,
  p.quality_score,
  p.audience_snapshot,
  p.availability,
  ers.attendee_count,
  ers.geo_top3,
  ers.age_buckets,
  ers.social_mentions,
  ers.sentiment_score,
  eqs.quality_score AS event_quality_score
FROM public.sponsorship_packages p
LEFT JOIN public.mv_event_reach_snapshot ers ON ers.event_id = p.event_id
LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = p.event_id
WHERE p.id = :package_id;
```

### C) Explain Specific Match (Why This Sponsor?)

Get detailed match explanation with features and breakdowns:

```sql
-- Inputs: :event_id, :sponsor_id
SELECT
  sm.event_id, 
  sm.sponsor_id, 
  sm.score, 
  sm.explanations,
  sm.reason_codes,
  mf.features,
  sp.name AS sponsor_name,
  e.title AS event_title
FROM public.sponsorship_matches sm
LEFT JOIN public.match_features mf
  ON mf.event_id = sm.event_id AND mf.sponsor_id = sm.sponsor_id
LEFT JOIN public.sponsors sp ON sp.id = sm.sponsor_id
LEFT JOIN public.events e ON e.id = sm.event_id
WHERE sm.event_id = :event_id AND sm.sponsor_id = :sponsor_id
ORDER BY mf.version DESC, mf.computed_at DESC
LIMIT 1;
```

### D) Deliverables Queue for Sponsor (What's Due Soon)

Get upcoming deliverables across all events for a sponsor:

```sql
-- Input: :sponsor_id
SELECT 
  d.*,
  e.title AS event_title,
  e.start_at AS event_start,
  EXTRACT(DAY FROM (d.due_at - now())) AS days_until_due
FROM public.deliverables d
JOIN public.events e ON e.id = d.event_id
WHERE d.sponsor_id = :sponsor_id
  AND d.status IN ('pending','needs_changes')
ORDER BY d.due_at NULLS LAST, d.created_at DESC;
```

### E) Proposal Inbox for Organizer

Get all proposal threads for events owned by an organization:

```sql
-- Input: :org_id
SELECT 
  pt.*, 
  sp.name AS sponsor_name,
  sp.logo_url AS sponsor_logo,
  e.title AS event_title,
  e.start_at,
  (
    SELECT COUNT(*) 
    FROM public.proposal_messages pm 
    WHERE pm.thread_id = pt.id
  ) AS message_count,
  (
    SELECT pm.created_at 
    FROM public.proposal_messages pm 
    WHERE pm.thread_id = pt.id 
    ORDER BY pm.created_at DESC 
    LIMIT 1
  ) AS last_message_at
FROM public.proposal_threads pt
JOIN public.events e ON e.id = pt.event_id
JOIN public.organizations o ON o.id = e.owner_context_id
JOIN public.sponsors sp ON sp.id = pt.sponsor_id
WHERE o.id = :org_id
ORDER BY pt.updated_at DESC;
```

### F) Package Variants Performance (A/B Testing)

Compare performance of different package variants:

```sql
-- Input: :package_id
SELECT
  pv.id,
  pv.label,
  pv.price_cents,
  pv.inventory,
  COUNT(so.id) AS orders_count,
  SUM(so.amount_cents) AS total_revenue,
  AVG(so.amount_cents) AS avg_order_value,
  ROUND(COUNT(so.id)::numeric / NULLIF(pv.inventory, 0) * 100, 2) AS conversion_rate
FROM public.package_variants pv
LEFT JOIN public.sponsorship_orders so 
  ON so.package_id = pv.package_id 
  AND so.status = 'paid'
WHERE pv.package_id = :package_id
  AND pv.is_active = true
GROUP BY pv.id, pv.label, pv.price_cents, pv.inventory
ORDER BY total_revenue DESC;
```

### G) Sponsor Discovery (Public Marketplace)

Browse verified sponsors with case studies:

```sql
-- Optional filters: :industry, :budget_min, :budget_max
SELECT
  sp.id,
  sp.name,
  sp.logo_url,
  spp.slug,
  spp.headline,
  spp.badges,
  spp.is_verified,
  spf.industry,
  spf.company_size,
  spf.annual_budget_cents,
  spf.case_studies,
  COUNT(DISTINCT sm.event_id) FILTER (WHERE sm.score > 0.7) AS high_quality_matches
FROM public.sponsors sp
JOIN public.sponsor_public_profiles spp ON spp.sponsor_id = sp.id
LEFT JOIN public.sponsor_profiles spf ON spf.sponsor_id = sp.id
LEFT JOIN public.sponsorship_matches sm ON sm.sponsor_id = sp.id
WHERE spp.is_verified = true
  AND spf.public_visibility = 'full'
  AND (:industry IS NULL OR spf.industry = :industry)
  AND (:budget_min IS NULL OR spf.annual_budget_cents >= :budget_min)
  AND (:budget_max IS NULL OR spf.annual_budget_cents <= :budget_max)
GROUP BY sp.id, sp.name, sp.logo_url, spp.slug, spp.headline, spp.badges, 
         spp.is_verified, spf.industry, spf.company_size, spf.annual_budget_cents, spf.case_studies
ORDER BY high_quality_matches DESC, spp.updated_at DESC
LIMIT 50;
```

### H) SLA Monitoring Dashboard

Track SLA compliance across active sponsorships:

```sql
-- Input: :org_id (organizer checking their events)
SELECT
  e.title AS event_title,
  s.name AS sponsor_name,
  sla.metric,
  sla.target,
  d.status AS deliverable_status,
  d.due_at,
  CASE 
    WHEN d.status = 'approved' THEN 'Met'
    WHEN d.due_at < now() AND d.status NOT IN ('approved', 'waived') THEN 'Breached'
    ELSE 'In Progress'
  END AS sla_status,
  sla.breach_policy
FROM public.sponsorship_slas sla
JOIN public.events e ON e.id = sla.event_id
JOIN public.sponsors s ON s.id = sla.sponsor_id
LEFT JOIN public.deliverables d ON d.id = sla.deliverable_id
WHERE e.owner_context_id = :org_id
  AND e.start_at >= now() - interval '90 days'
ORDER BY 
  CASE 
    WHEN d.due_at < now() AND d.status NOT IN ('approved', 'waived') THEN 1
    ELSE 2
  END,
  d.due_at NULLS LAST;
```

### I) Match Feedback Analysis

Analyze human feedback to improve matching algorithm:

```sql
-- Aggregate feedback patterns
SELECT
  mf.label,
  unnest(mf.reason_codes) AS reason_code,
  COUNT(*) AS feedback_count,
  AVG(sm.score) AS avg_match_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sm.score) AS median_score
FROM public.match_feedback mf
JOIN public.sponsorship_matches sm 
  ON sm.event_id = mf.event_id 
  AND sm.sponsor_id = mf.sponsor_id
WHERE mf.created_at >= now() - interval '30 days'
GROUP BY mf.label, reason_code
ORDER BY feedback_count DESC;
```

### J) Audience Consent Audit

Track audience data sharing for compliance:

```sql
-- Input: :event_id
SELECT
  ac.segment_key,
  ac.scope,
  ac.consent_basis,
  ac.expires_at,
  CASE 
    WHEN ac.expires_at IS NULL THEN 'No Expiration'
    WHEN ac.expires_at < now() THEN 'Expired'
    ELSE 'Active'
  END AS status,
  COUNT(DISTINCT so.sponsor_id) AS sponsors_with_access
FROM public.audience_consents ac
LEFT JOIN public.sponsorship_orders so 
  ON so.event_id = ac.event_id 
  AND so.status = 'paid'
WHERE ac.event_id = :event_id
GROUP BY ac.id, ac.segment_key, ac.scope, ac.consent_basis, ac.expires_at
ORDER BY ac.segment_key;
```

### K) Deliverable Proof Validation

Review submitted proofs awaiting approval:

```sql
-- Input: :event_id
SELECT
  d.type AS deliverable_type,
  d.spec,
  s.name AS sponsor_name,
  dp.asset_url,
  dp.metrics,
  dp.submitted_at,
  dp.submitted_by,
  u.display_name AS submitted_by_name
FROM public.deliverable_proofs dp
JOIN public.deliverables d ON d.id = dp.deliverable_id
JOIN public.sponsors s ON s.id = d.sponsor_id
LEFT JOIN public.user_profiles u ON u.user_id = dp.submitted_by
WHERE d.event_id = :event_id
  AND dp.approved_at IS NULL
  AND dp.rejected_reason IS NULL
ORDER BY dp.submitted_at DESC;
```

### L) Package Template Reuse Analytics

See which templates drive the most revenue:

```sql
-- Input: :org_id
SELECT
  pt.title AS template_name,
  COUNT(DISTINCT sp.id) AS packages_created,
  COUNT(DISTINCT so.id) AS total_orders,
  SUM(so.amount_cents) AS total_revenue,
  AVG(so.amount_cents) AS avg_order_value,
  MAX(sp.created_at) AS last_used
FROM public.package_templates pt
JOIN public.sponsorship_packages sp ON sp.template_id = pt.id
LEFT JOIN public.sponsorship_orders so ON so.package_id = sp.id AND so.status = 'paid'
WHERE pt.org_id = :org_id
GROUP BY pt.id, pt.title
ORDER BY total_revenue DESC NULLS LAST;
```

### M) Proposal Conversion Funnel

Track proposal success rates:

```sql
-- Input: :org_id, :date_from, :date_to
SELECT
  pt.status,
  COUNT(*) AS count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) AS percentage,
  AVG(EXTRACT(EPOCH FROM (pt.updated_at - pt.created_at)) / 3600) AS avg_hours_to_status
FROM public.proposal_threads pt
JOIN public.events e ON e.id = pt.event_id
WHERE e.owner_context_id = :org_id
  AND pt.created_at BETWEEN :date_from AND :date_to
GROUP BY pt.status
ORDER BY 
  CASE pt.status
    WHEN 'accepted' THEN 1
    WHEN 'counter' THEN 2
    WHEN 'sent' THEN 3
    WHEN 'draft' THEN 4
    WHEN 'rejected' THEN 5
    WHEN 'expired' THEN 6
  END;
```

## Edge Function Integration

### Process Match Features

```typescript
// supabase/functions/compute-match-features/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const { event_id, sponsor_id } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Compute features
  const features = {
    budget_fit: 0.85,
    audience_overlap: 0.72,
    category_match: 1.0,
    geo_overlap: 0.68,
    // ... more features
  }

  // Store in feature store
  const { data, error } = await supabase
    .from('match_features')
    .insert({
      event_id,
      sponsor_id,
      features,
      version: 1
    })

  return new Response(JSON.stringify({ success: !error, data }))
})
```

### Refresh Materialized Views

```typescript
// supabase/functions/refresh-mvs-cron/index.ts
Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabase
    .rpc('refresh_sponsorship_mvs', { concurrent: true })

  return new Response(
    JSON.stringify({ 
      success: !error,
      message: 'Materialized views refreshed' 
    })
  )
})
```

## React/Next.js Hooks

### Use Proposal Inbox

```typescript
export function useProposalInbox(orgId: string) {
  return useQuery({
    queryKey: ['proposal-inbox', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_threads')
        .select(`
          *,
          events!inner(title, start_at),
          sponsors!inner(name, logo_url)
        `)
        .eq('events.owner_context_id', orgId)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      return data
    }
  })
}
```

### Use Deliverables Queue

```typescript
export function useDeliverables Queue(sponsorId: string) {
  return useQuery({
    queryKey: ['deliverables-queue', sponsorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliverables')
        .select(`
          *,
          events!inner(title, start_at)
        `)
        .eq('sponsor_id', sponsorId)
        .in('status', ['pending', 'needs_changes'])
        .order('due_at', { ascending: true, nullsFirst: false })
      
      if (error) throw error
      return data
    }
  })
}
```

---

## Performance Tips

1. **Use Prepared Statements** for frequently run queries
2. **Leverage Materialized Views** for dashboard data
3. **Index JSONB Fields** that are frequently filtered
4. **Batch Feature Computation** during off-peak hours
5. **Cache Sponsor Profiles** at CDN level for public pages

## Monitoring

Track query performance:

```sql
-- Slow query log
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%sponsorship%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

For more information, see:
- **API Reference**: `docs/SPONSORSHIP_API_REFERENCE.md`
- **System Architecture**: `docs/SPONSORSHIP_SYSTEM_EXPANSION.md`
- **Complete Guide**: `SPONSORSHIP_COMPLETE.md`
