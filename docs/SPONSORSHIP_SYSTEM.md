# Sponsorship Intelligence System

## Overview

A data-driven sponsorship matching platform that connects event organizers with sponsors using behavioral analytics, demographic insights, and AI-powered recommendations.

## Architecture

### Phase 1: Foundation (Current)

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Collection Layer                     │
├─────────────────────────────────────────────────────────────┤
│  event_impressions → event_audience_insights                 │
│  ticket_analytics  → engagement_score, conversion_rate       │
│  post_views        → avg_dwell_time_ms, watch_percentage     │
│  orders            → ticket_conversion_rate                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Matching Engine Layer                      │
├─────────────────────────────────────────────────────────────┤
│  sponsor_profiles (targeting data)                           │
│  × event_audience_insights (performance data)                │
│  → sponsorship_matches (scored pairs)                        │
│                                                              │
│  Scoring Algorithm:                                          │
│  • 25% Budget Fit                                            │
│  • 35% Audience Overlap (categories + geo)                   │
│  • 15% Geographic Fit                                        │
│  • 15% Engagement Quality                                    │
│  • 10% Objectives Similarity                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Discovery & Commerce Layer                 │
├─────────────────────────────────────────────────────────────┤
│  Organizers → v_sponsor_recommendations (ranked matches)     │
│  Sponsors   → v_event_recommendations (ranked opportunities) │
│  Marketplace → v_sponsorship_package_cards (with stats)      │
│  Checkout   → sponsorship_orders (Stripe Connect escrow)     │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Tables

#### `sponsor_profiles`
Deep sponsor targeting profiles for intelligent matching.

```sql
{
  sponsor_id: UUID,
  industry: string,
  company_size: string,
  annual_budget_cents: number,
  brand_objectives: { keywords: [], goals: [] },
  target_audience: { age_buckets: [], interests: [] },
  preferred_categories: string[],
  regions: string[],
  reputation_score: number
}
```

#### `event_audience_insights`
Aggregated behavioral and demographic data.

```sql
{
  event_id: UUID,
  attendee_count: number,
  avg_dwell_time_ms: number,
  geo_distribution: { country: count },
  age_segments: { "18-24": 0.2 },
  engagement_score: number (0-1),
  ticket_conversion_rate: number (0-1),
  social_mentions: number,
  sentiment_score: number (-1 to 1)
}
```

#### `sponsorship_matches`
Precomputed sponsor-event fit scores with explainability.

```sql
{
  event_id: UUID,
  sponsor_id: UUID,
  score: number (0-1),
  overlap_metrics: {
    budget_fit: number,
    audience_overlap: { categories: number, geo: number },
    geo_fit: number,
    engagement_quality: number,
    objectives_similarity: number
  },
  status: 'pending' | 'suggested' | 'accepted' | 'rejected'
}
```

### Views

#### `v_event_performance_summary`
Real-time event metrics for package cards.

#### `v_sponsor_recommendations`
Top sponsor matches for organizers with explainability.

#### `v_event_recommendations`
Top event opportunities for sponsors with package availability.

#### `v_sponsorship_package_cards`
Enriched packages with live stats for marketplace UI.

## Edge Functions

### `sponsorship-recalc`
Scheduled worker that drains `fit_recalc_queue` and computes match scores.

**Endpoint:** `POST /functions/v1/sponsorship-recalc`

**Schedule:** Every 5 minutes (configurable)

**Response:**
```json
{
  "success": true,
  "processed": 150,
  "duration_ms": 2340,
  "timestamp": "2025-10-21T10:30:00Z"
}
```

### `sponsorship-score-onchange`
Queues recalculation when profiles or insights change.

**Endpoint:** `POST /functions/v1/sponsorship-score-onchange`

**Request:**
```json
{
  "sponsor_id": "uuid",           // Single sponsor
  "event_id": "uuid",              // Single event
  "sponsor_ids": ["uuid", ...],    // Bulk sponsors
  "event_ids": ["uuid", ...]       // Bulk events
}
```

**Response:**
```json
{
  "success": true,
  "queued": 250,
  "operations": ["sponsor:uuid", "bulk_events:10"],
  "duration_ms": 450,
  "timestamp": "2025-10-21T10:30:00Z"
}
```

## Data Flow

### 1. Event Insights Pipeline (Hourly)

```
event_impressions
event_video_counters    → Aggregate → event_audience_insights
orders
ticket_analytics
post_views
```

### 2. Matching Pipeline (Every 5 min)

```
fit_recalc_queue → sponsorship-recalc → sponsorship_matches
```

### 3. Incremental Updates (Real-time)

```
sponsor_profiles updated → sponsorship-score-onchange → fit_recalc_queue
event_audience_insights updated → sponsorship-score-onchange → fit_recalc_queue
```

## Scoring Algorithm

### Formula

```
score = 0.25 × budget_fit
      + 0.35 × audience_overlap
      + 0.15 × geo_fit
      + 0.15 × engagement_quality
      + 0.10 × objectives_similarity
```

### Components

**Budget Fit:**
```
budget_fit = clamp(annual_budget_cents / (annual_budget_cents + 100000))
```

**Audience Overlap:**
```
category_overlap = |preferred_categories ∩ event_categories| / |preferred_categories|
geo_overlap = |regions ∩ event_regions| / |regions|
audience_overlap = 0.6 × category_overlap + 0.4 × geo_overlap
```

**Engagement Quality:**
```
engagement_quality = 0.7 × engagement_score + 0.3 × ticket_conversion_rate
```

**Objectives Similarity:**
- Baseline: 0.5
- Future: NLP/embedding-based similarity

## Performance Optimizations

### Indexes

```sql
-- GIN indexes for array/JSONB lookups
CREATE INDEX ON sponsor_profiles USING gin (preferred_categories);
CREATE INDEX ON sponsor_profiles USING gin (regions);

-- Sorting indexes
CREATE INDEX ON sponsorship_matches (event_id, score DESC);
CREATE INDEX ON sponsorship_matches (sponsor_id, score DESC);
CREATE INDEX ON event_audience_insights (engagement_score DESC);
```

### Partitioning (Future)

```sql
-- Partition high-volume tables by month
ALTER TABLE event_impressions PARTITION BY RANGE (created_at);
ALTER TABLE ticket_analytics PARTITION BY RANGE (created_at);
```

### Materialized Views

```sql
-- Refresh nightly for static scoring
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sponsor_event_fit_scores;
```

## API Usage Examples

### Fetch Sponsor Recommendations for Event

```typescript
const { data } = await supabase
  .from('v_sponsor_recommendations')
  .select('*')
  .eq('event_id', eventId)
  .gte('score', 0.6)
  .order('score', { ascending: false })
  .limit(10);
```

### Fetch Event Recommendations for Sponsor

```typescript
const { data } = await supabase
  .from('v_event_recommendations')
  .select('*')
  .eq('sponsor_id', sponsorId)
  .gte('score', 0.5)
  .gt('available_packages', 0)
  .order('score', { ascending: false })
  .limit(20);
```

### Fetch Package Cards for Marketplace

```typescript
const { data } = await supabase
  .from('v_sponsorship_package_cards')
  .select('*')
  .eq('is_active', true)
  .gte('available_inventory', 1)
  .gte('quality_score', 70)
  .order('quality_score', { ascending: false })
  .range(0, 19);
```

### Update Sponsor Profile (triggers recalc)

```typescript
// Update profile
await supabase
  .from('sponsor_profiles')
  .update({
    preferred_categories: ['music', 'food', 'art'],
    regions: ['US', 'CA', 'MX'],
    annual_budget_cents: 5000000
  })
  .eq('sponsor_id', sponsorId);

// Queue recalculation
await supabase.functions.invoke('sponsorship-score-onchange', {
  body: { sponsor_id: sponsorId }
});
```

## Payment Flow

### Stripe Connect Integration

```typescript
// 1. Create payment intent with transfer group
const paymentIntent = await stripe.paymentIntents.create({
  amount: package.price_cents,
  currency: package.currency,
  application_fee_amount: applicationFeeCents,
  transfer_group: `sponsorship_${orderId}`,
  metadata: {
    order_id: orderId,
    package_id: packageId,
    event_id: eventId
  }
});

// 2. Create order
await supabase.from('sponsorship_orders').insert({
  package_id: packageId,
  sponsor_id: sponsorId,
  event_id: eventId,
  amount_cents: package.price_cents,
  status: 'pending',
  stripe_payment_intent_id: paymentIntent.id,
  transfer_group: `sponsorship_${orderId}`,
  application_fee_cents: applicationFeeCents
});

// 3. On payment success webhook
await supabase
  .from('sponsorship_orders')
  .update({ status: 'paid' })
  .eq('stripe_payment_intent_id', paymentIntent.id);

// 4. After deliverables completed
await stripe.transfers.create({
  amount: package.price_cents - applicationFeeCents,
  currency: package.currency,
  destination: organizerConnectId,
  transfer_group: `sponsorship_${orderId}`
});
```

## Roadmap

### Phase 2: ML Enhancement (Q2 2025)
- [ ] Vector embeddings for objectives similarity
- [ ] LightGBM ranker for score refinement
- [ ] A/B testing framework for score weights

### Phase 3: Advanced Analytics (Q3 2025)
- [ ] Real-time ROI tracking dashboards
- [ ] Predictive audience modeling
- [ ] Sentiment analysis for social mentions

### Phase 4: Automation (Q4 2025)
- [ ] Auto-generated sponsorship proposals
- [ ] Smart pricing recommendations
- [ ] Automated deliverable tracking

## Monitoring

### Key Metrics

```sql
-- Match quality
SELECT AVG(score), COUNT(*)
FROM sponsorship_matches
WHERE status = 'accepted'
GROUP BY DATE_TRUNC('week', updated_at);

-- Conversion funnel
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE viewed_at IS NOT NULL) AS viewed,
  COUNT(*) FILTER (WHERE contacted_at IS NOT NULL) AS contacted,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted
FROM sponsorship_matches
WHERE updated_at > now() - interval '30 days';

-- Queue health
SELECT COUNT(*), MAX(queued_at)
FROM fit_recalc_queue
WHERE processed_at IS NULL;
```

## Troubleshooting

### Queue Not Processing

```sql
-- Check queue size
SELECT COUNT(*) FROM fit_recalc_queue WHERE processed_at IS NULL;

-- Manually trigger worker
curl -X POST https://your-project.supabase.co/functions/v1/sponsorship-recalc \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Low Match Scores

```sql
-- Inspect overlap metrics
SELECT
  event_id,
  sponsor_id,
  score,
  overlap_metrics->'audience_overlap' AS audience_fit,
  overlap_metrics->>'budget_fit' AS budget_fit,
  overlap_metrics->>'engagement_quality' AS engagement_fit
FROM sponsorship_matches
WHERE score < 0.3
LIMIT 10;
```

### Missing Insights

```sql
-- Events without insights
SELECT e.id, e.title
FROM events e
LEFT JOIN event_audience_insights eai ON eai.event_id = e.id
WHERE eai.event_id IS NULL
  AND e.start_at > now() - interval '6 months';
```

## Support

For questions or issues:
- GitHub Issues: [liventix-upgrade/issues](https://github.com/liventix/liventix-upgrade/issues)
- Email: dev@liventix.com
- Docs: [docs.liventix.com/sponsorships](https://docs.liventix.com/sponsorships)

