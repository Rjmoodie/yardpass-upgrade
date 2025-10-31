# 🔧 Backend-Only Integration Guide - Production Ready

## 0. Who This Is For & Value Promise

**Audience**: Yardpass issuer backends (event organizers' apps and first-party dashboards)

**Promise**: Help issuers package, sell, fulfill, and prove ROI on sponsorships with near-zero manual work.

**Outcome**: Complete sponsorship lifecycle automation from discovery → payment → fulfillment → payout

---

## 1. Prerequisites & Environment

| Item | Recommendation | Status |
|------|---------------|--------|
| **Database** | PostgreSQL 14+ | ✅ |
| **Extensions** | `pg_trgm`, `pgcrypto`, `pg_stat_statements`, `vector` | ✅ |
| **Auth** | JWT for API → `auth.users.id`, per-org via `organizations.id` | ✅ |
| **Payouts** | Stripe Connect (in schema) | ✅ |
| **Webhooks** | Public HTTPS endpoint with retry + idempotency | 🔨 To implement |
| **Embeddings** | OpenAI API (for vector generation) | 🔨 Optional |

---

## 2. High-Level Architecture (Backend Only)

```
┌────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND APIS                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📦 Sponsorship Packages API                               │
│     └─ Create, list, publish, update packages              │
│                                                            │
│  💬 Proposals API                                          │
│     └─ Create threads, send messages, negotiate            │
│                                                            │
│  💳 Orders API (Escrow)                                    │
│     └─ Create, fund, lock, release payments                │
│                                                            │
│  ✅ Deliverables & SLAs API                                │
│     └─ Track obligations, submit proofs, approve           │
│                                                            │
│  📊 ROI Reports API                                        │
│     └─ Generate performance reports, export CSV/PDF        │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                   EVENT STATS PIPELINE                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Real-time → event_impressions_p, post_views, ticket_analytics │
│       ↓                                                    │
│  Hourly rollup → event_stat_snapshots                      │
│       ↓                                                    │
│  Audience insights → event_audience_insights               │
│       ↓                                                    │
│  Package attach → sponsorship_packages.audience_snapshot   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                    MATCHING SERVICE                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Reads: sponsor_profiles, events                           │
│  Writes: sponsorship_matches (score, overlap_metrics)      │
│  Triggers: Auto-enqueue on profile/insight changes         │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                  WEBHOOKS TO ISSUERS                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  • proposal.sent → when status changes                     │
│  • order.funded → when payment succeeds                    │
│  • deliverable.submitted → when proof uploaded             │
│  • deliverable.approved → when organizer approves          │
│  • payout.completed → when transfer settles                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Multitenancy

### Every API Call Pattern

```http
POST /v1/sponsorship-packages
Authorization: Bearer {jwt_token}
X-Org-Id: {organization_id}
Idempotency-Key: {unique_key}
Content-Type: application/json
```

### Ownership Validation (Middleware)

```typescript
// Pseudo-code for every write operation
async function validateOrgOwnership(orgId: string, eventId: string) {
  const { data } = await supabase
    .from('events')
    .select('owner_context_id')
    .eq('id', eventId)
    .single()
  
  if (data.owner_context_id !== orgId) {
    throw new Error('Forbidden: Event not owned by organization')
  }
}
```

### Idempotency Pattern

```typescript
async function handleIdempotentRequest(key: string, userId: string, handler: () => Promise<any>) {
  // Check if already processed
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response')
    .eq('key', key)
    .eq('user_id', userId)
    .single()
  
  if (existing) {
    return existing.response  // Return cached response
  }
  
  // Process new request
  const response = await handler()
  
  // Store for future
  await supabase.from('idempotency_keys').insert({
    key,
    user_id: userId,
    response
  })
  
  return response
}
```

---

## 4. Canonical API Surface (REST)

### 4.1 Sponsorship Packages API

#### Create Package
```http
POST /v1/sponsorship-packages
Content-Type: application/json
X-Org-Id: {org_id}

{
  "event_id": "uuid",
  "template_id": "uuid",  // optional
  "title": "Gold Stage Sponsor",
  "tier": "gold",
  "price_cents": 150000,
  "currency": "USD",
  "inventory": 3,
  "benefits": {
    "logo_stage": true,
    "booth": "10x10",
    "speaking_slot": "15min",
    "social_posts": 5
  },
  "availability": {
    "start": "2025-02-01T00:00:00Z",
    "end": "2025-03-01T00:00:00Z",
    "max_per_sponsor": 1,
    "exclusivity": false
  },
  "audience_snapshot": {
    "estimated_reach": 24000,
    "age_segments": {"18-24": 0.31, "25-34": 0.42},
    "geo_top3": ["Los Angeles", "San Francisco", "San Diego"]
  },
  "constraints": {
    "category_allow": ["Beverage", "Technology"],
    "sponsor_conflicts": ["Competitor Brand X"]
  }
}
```

**Implementation**:
```typescript
// app/api/v1/sponsorship-packages/route.ts
export async function POST(req: NextRequest) {
  const orgId = req.headers.get('X-Org-Id')
  const idempotencyKey = req.headers.get('Idempotency-Key')
  const body = await req.json()
  
  // Validate ownership
  await validateOrgOwnership(orgId, body.event_id)
  
  // Create package
  const { data, error } = await supabase
    .from('sponsorship_packages')
    .insert({
      ...body,
      created_by: user.id,
      version: 1,
      is_active: false  // Draft until published
    })
    .select()
    .single()
  
  return NextResponse.json({ data })
}
```

#### List Packages
```http
GET /v1/sponsorship-packages?event_id={uuid}&visibility=public
```

#### Publish Package
```http
POST /v1/sponsorship-packages/{id}:publish
```

**Implementation**:
```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await supabase
    .from('sponsorship_packages')
    .update({ is_active: true })
    .eq('id', params.id)
  
  return NextResponse.json({ success: true })
}
```

---

### 4.2 Proposals & Negotiation API

#### Create Proposal Thread
```http
POST /v1/proposals
{
  "event_id": "uuid",
  "sponsor_id": "uuid",
  "initial_message": {
    "body": "We'd love to sponsor your event!",
    "offer": {
      "price_cents": 140000,
      "requested_benefits": ["booth", "logo"]
    }
  }
}
```

**Implementation**:
```typescript
export async function POST(req: NextRequest) {
  const { event_id, sponsor_id, initial_message } = await req.json()
  const { data: user } = await supabase.auth.getUser()
  
  // Create thread
  const { data: thread } = await supabase
    .from('proposal_threads')
    .insert({
      event_id,
      sponsor_id,
      status: 'draft',
      created_by: user.user!.id
    })
    .select()
    .single()
  
  // Add initial message
  if (initial_message) {
    await supabase.from('proposal_messages').insert({
      thread_id: thread.id,
      sender_type: 'sponsor',  // or 'organizer' based on user role
      sender_user_id: user.user!.id,
      body: initial_message.body,
      offer: initial_message.offer || {}
    })
  }
  
  return NextResponse.json({ data: thread })
}
```

#### Send Message
```http
POST /v1/proposals/{thread_id}/messages
{
  "sender_type": "organizer",
  "body": "Adding 3 story posts to sweeten the deal",
  "offer": {
    "price_cents": 175000,
    "benefits_delta": {
      "story_posts": 3,
      "exclusivity": true
    }
  }
}
```

#### Status Transitions
```http
POST /v1/proposals/{thread_id}:send
POST /v1/proposals/{thread_id}:accept
POST /v1/proposals/{thread_id}:reject
```

**Implementation**:
```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string, action: string } }) {
  const statusMap = {
    'send': 'sent',
    'accept': 'accepted',
    'reject': 'rejected'
  }
  
  const newStatus = statusMap[params.action]
  
  const { data } = await supabase
    .from('proposal_threads')
    .update({ status: newStatus })
    .eq('id', params.id)
    .select()
    .single()
  
  // If accepted, create order
  if (newStatus === 'accepted') {
    // Get latest offer from messages
    const { data: messages } = await supabase
      .from('proposal_messages')
      .select('offer')
      .eq('thread_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
    
    // Create order from offer
    await createOrderFromProposal(data, messages[0].offer)
  }
  
  return NextResponse.json({ data })
}
```

---

### 4.3 Orders, Escrow & Payouts API

#### Create Order
```http
POST /v1/sponsorship-orders
{
  "package_id": "uuid",
  "sponsor_id": "uuid",
  "event_id": "uuid",
  "amount_cents": 150000,
  "currency": "USD",
  "cancellation_policy": {
    "window_days": 14,
    "penalty_pct": 0.1
  }
}
```

**Implementation**:
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json()
  
  // Create order
  const { data: order } = await supabase
    .from('sponsorship_orders')
    .insert({
      ...body,
      status: 'pending',
      escrow_state: 'pending',
      created_by_user_id: user.id
    })
    .select()
    .single()
  
  return NextResponse.json({ data: order })
}
```

#### Fund Order (Create Payment Intent)
```http
POST /v1/sponsorship-orders/{id}:fund
{
  "payment_method_id": "pm_xxx"
}
```

**Implementation**:
```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { payment_method_id } = await req.json()
  
  // Get order
  const { data: order } = await supabase
    .from('sponsorship_orders')
    .select('*, events!inner(owner_context_id)')
    .eq('id', params.id)
    .single()
  
  // Get organizer's Stripe Connect account
  const { data: payoutConfig } = await supabase
    .from('payout_configurations')
    .select('stripe_connect_account_id, platform_fee_percentage')
    .eq('organization_id', order.events.owner_context_id)
    .single()
  
  // Calculate platform fee
  const applicationFeeCents = Math.round(
    order.amount_cents * payoutConfig.platform_fee_percentage
  )
  
  // Create PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.amount_cents,
    currency: order.currency.toLowerCase(),
    payment_method: payment_method_id,
    confirm: true,
    transfer_group: order.id,  // For tracking related transfers
    application_fee_amount: applicationFeeCents,
    transfer_data: {
      destination: payoutConfig.stripe_connect_account_id
    }
  })
  
  // Update order
  await supabase
    .from('sponsorship_orders')
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      escrow_state: 'funded',
      status: 'completed',
      application_fee_cents: applicationFeeCents
    })
    .eq('id', params.id)
  
  return NextResponse.json({ 
    data: { 
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status 
    } 
  })
}
```

#### Release Escrow
```http
POST /v1/sponsorship-orders/{id}:release
```

**Implementation**:
```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: order } = await supabase
    .from('sponsorship_orders')
    .select('*')
    .eq('id', params.id)
    .single()
  
  // Validate escrow can be released
  if (order.escrow_state !== 'locked') {
    return NextResponse.json(
      { error: 'Escrow must be locked before release' },
      { status: 400 }
    )
  }
  
  // Queue payout
  const { data } = await supabase.rpc('queue_sponsorship_payout', {
    p_order_id: params.id,
    p_priority: 1
  })
  
  // Update escrow state
  await supabase
    .from('sponsorship_orders')
    .update({ escrow_state: 'released' })
    .eq('id', params.id)
  
  return NextResponse.json({ success: true, payout_queued: true })
}
```

---

### 4.4 Deliverables & SLAs API

#### Create Deliverable
```http
POST /v1/deliverables
{
  "event_id": "uuid",
  "sponsor_id": "uuid",
  "order_id": "uuid",
  "package_id": "uuid",
  "type": "logo_placement",
  "spec": {
    "placement": "main_stage",
    "min_impressions": 20000,
    "duration_days": 30
  },
  "due_at": "2025-03-10T00:00:00Z",
  "evidence_required": true
}
```

**Implementation**:
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json()
  
  const { data } = await supabase
    .from('deliverables')
    .insert({
      ...body,
      status: 'pending'
    })
    .select()
    .single()
  
  return NextResponse.json({ data })
}
```

#### Submit Proof
```http
POST /v1/deliverables/{id}/proofs
{
  "asset_url": "https://storage.../proof.jpg",
  "metrics": {
    "impressions": 25000,
    "engagement_rate": 0.042,
    "clicks": 1050
  }
}
```

**Implementation**:
```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { asset_url, metrics } = await req.json()
  const { data: user } = await supabase.auth.getUser()
  
  // Submit proof
  const { data: proof } = await supabase
    .from('deliverable_proofs')
    .insert({
      deliverable_id: params.id,
      asset_url,
      metrics: metrics || {},
      submitted_by: user.user!.id
    })
    .select()
    .single()
  
  // Update deliverable status
  await supabase
    .from('deliverables')
    .update({ status: 'submitted' })
    .eq('id', params.id)
  
  // Check SLA compliance
  await checkSLACompliance(params.id)
  
  return NextResponse.json({ data: proof })
}
```

#### Approve/Reject Deliverable
```http
POST /v1/deliverables/{id}:approve
POST /v1/deliverables/{id}:needs_changes
POST /v1/deliverables/{id}:waive

Body (for needs_changes):
{
  "reason": "Logo placement is not visible enough"
}
```

---

### 4.5 ROI Reports API

#### Generate ROI Report
```http
GET /v1/reports/roi?order_id={uuid}&from={date}&to={date}&utm_source={source}
```

**Implementation**:
```typescript
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const orderId = searchParams.get('order_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  // Get order details
  const { data: order } = await supabase
    .from('sponsorship_orders')
    .select('*, events!inner(*), sponsors!inner(*)')
    .eq('id', orderId)
    .single()
  
  // Aggregate metrics
  const { data: impressions } = await supabase.rpc('get_event_impressions', {
    p_event_id: order.event_id,
    p_from: from,
    p_to: to
  })
  
  const { data: conversions } = await supabase.rpc('get_attributed_conversions', {
    p_event_id: order.event_id,
    p_sponsor_id: order.sponsor_id,
    p_from: from,
    p_to: to
  })
  
  // Get deliverable performance
  const { data: deliverables } = await supabase
    .from('deliverable_proofs')
    .select('metrics, deliverables!inner(type, spec)')
    .eq('deliverables.order_id', orderId)
  
  // Compile ROI report
  const report = {
    order_id: orderId,
    event_title: order.events.title,
    sponsor_name: order.sponsors.name,
    period: { from, to },
    investment_cents: order.amount_cents,
    performance: {
      impressions: impressions?.total || 0,
      conversions: conversions?.count || 0,
      conversion_value_cents: conversions?.value_cents || 0,
      roi_multiplier: (conversions?.value_cents || 0) / order.amount_cents
    },
    deliverables: deliverables?.map(d => ({
      type: d.deliverables.type,
      spec: d.deliverables.spec,
      actual_metrics: d.metrics
    })),
    generated_at: new Date().toISOString()
  }
  
  return NextResponse.json({ data: report })
}
```

---

## 5. Event Stats Pipeline (Issuer Value Engine)

### Hourly Rollup Job

```typescript
// supabase/functions/rollup-event-stats/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  // Get all active events
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .gte('start_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
  
  for (const event of events || []) {
    // Compute metrics
    const metrics = await computeEventMetrics(supabase, event.id)
    
    // Insert snapshots
    for (const [key, value] of Object.entries(metrics)) {
      await supabase
        .from('event_stat_snapshots')
        .insert({
          event_id: event.id,
          metric_key: key,
          metric_value: value,
          captured_at: new Date().toISOString()
        })
    }
  }
  
  return new Response(JSON.stringify({ success: true }))
})

async function computeEventMetrics(supabase: any, eventId: string) {
  const now = new Date()
  const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const day7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const day30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  // Impressions 24h
  const { count: impressions24h } = await supabase
    .from('event_impressions_p')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .gte('created_at', day24h.toISOString())
  
  // Avg dwell 7d
  const { data: dwell7d } = await supabase
    .from('post_views')
    .select('dwell_ms')
    .eq('event_id', eventId)
    .gte('created_at', day7d.toISOString())
  
  const avgDwell = dwell7d?.length 
    ? dwell7d.reduce((sum, v) => sum + v.dwell_ms, 0) / dwell7d.length 
    : 0
  
  // Ticket conversion 30d
  const { data: interactions } = await supabase
    .from('user_event_interactions')
    .select('interaction_type')
    .eq('event_id', eventId)
    .gte('created_at', day30d.toISOString())
  
  const ticketOpens = interactions?.filter(i => i.interaction_type === 'ticket_open').length || 0
  const ticketPurchases = interactions?.filter(i => i.interaction_type === 'ticket_purchase').length || 0
  const conversionRate = ticketOpens > 0 ? ticketPurchases / ticketOpens : 0
  
  return {
    'impressions_24h': impressions24h || 0,
    'video_avg_dwell_ms_7d': avgDwell,
    'ticket_conv_rate_30d': conversionRate
  }
}
```

### Attach Stats to Package

```sql
-- When publishing package, snapshot current stats
UPDATE sponsorship_packages
SET audience_snapshot = jsonb_build_object(
  'captured_at', now(),
  'metrics', (
    SELECT jsonb_object_agg(metric_key, metric_value)
    FROM event_stat_snapshots
    WHERE event_id = sponsorship_packages.event_id
    AND captured_at >= now() - interval '1 hour'
  )
)
WHERE id = $1;
```

---

## 6. Matching Service Contract

### Scoring Algorithm Implementation

```typescript
// supabase/functions/compute-matches/index.ts
Deno.serve(async () => {
  const supabase = createClient(...)
  
  // Get unprocessed queue items
  const { data: queueItems } = await supabase
    .from('fit_recalc_queue')
    .select('*')
    .is('processed_at', null)
    .limit(100)
  
  for (const item of queueItems || []) {
    // Call DB-native scoring function
    const { data: result } = await supabase.rpc('fn_compute_match_score', {
      p_event_id: item.event_id,
      p_sponsor_id: item.sponsor_id
    })
    
    // Upsert match
    await supabase
      .from('sponsorship_matches')
      .upsert({
        event_id: item.event_id,
        sponsor_id: item.sponsor_id,
        score: result.score,
        overlap_metrics: result.breakdown,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'event_id,sponsor_id'
      })
    
    // Mark as processed
    await supabase
      .from('fit_recalc_queue')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', item.id)
  }
  
  return new Response(JSON.stringify({ processed: queueItems?.length || 0 }))
})
```

### Scoring Formula (already in DB)

```
score = 0.25 * budget_fit
      + 0.35 * audience_overlap
      + 0.15 * geo_overlap
      + 0.15 * engagement_quality
      + 0.10 * objectives_similarity
```

### Create Partial Indexes

```sql
CREATE INDEX CONCURRENTLY idx_sponsorship_matches_pending
  ON sponsorship_matches (event_id) 
  WHERE status IN ('pending', 'suggested');

CREATE INDEX CONCURRENTLY idx_sponsor_profiles_categories_gin
  ON sponsor_profiles USING GIN(preferred_categories);

CREATE INDEX CONCURRENTLY idx_events_target_audience_gin
  ON events USING GIN(target_audience jsonb_path_ops);
```

---

## 7. Webhooks to Issuer Backends

### Webhook Events

| Event | When | Payload Core |
|-------|------|--------------|
| `proposal.sent` | `proposal_threads.status='sent'` | thread, last offer |
| `order.funded` | PI succeeded; `escrow_state='funded'` | order, amount |
| `deliverable.submitted` | proof added | deliverable, proof.metrics |
| `deliverable.approved` | status → approved | deliverable |
| `payout.completed` | transfer settled | payout, stripe IDs |

### Example: order.funded Webhook

```typescript
// supabase/functions/send-webhook/index.ts
async function sendWebhook(event: string, data: any, orgId: string) {
  // Get webhook URL for org
  const { data: org } = await supabase
    .from('organizations')
    .select('webhook_url, webhook_secret')
    .eq('id', orgId)
    .single()
  
  if (!org?.webhook_url) return
  
  // Create payload
  const payload = {
    type: event,
    data,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID()
  }
  
  // Create signature (HMAC SHA256)
  const signature = await createHmacSignature(
    JSON.stringify(payload),
    org.webhook_secret
  )
  
  // Send webhook with retry
  await fetch(org.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Yardpass-Signature': signature,
      'X-Yardpass-Event': event
    },
    body: JSON.stringify(payload)
  })
}

// Call after order funded
await sendWebhook('order.funded', {
  order_id: order.id,
  event_id: order.event_id,
  sponsor_id: order.sponsor_id,
  amount_cents: order.amount_cents,
  escrow_state: 'funded'
}, order.events.owner_context_id)
```

### Payload Example

```json
{
  "type": "order.funded",
  "data": {
    "order_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_id": "660e8400-e29b-41d4-a716-446655440000",
    "sponsor_id": "770e8400-e29b-41d4-a716-446655440000",
    "amount_cents": 150000,
    "escrow_state": "funded",
    "stripe_payment_intent_id": "pi_xxx",
    "application_fee_cents": 7500
  },
  "timestamp": "2025-02-01T12:00:00Z",
  "id": "880e8400-e29b-41d4-a716-446655440000"
}
```

---

## 8. Data Access Patterns (Make Reads Cheap)

### Package Gallery (Issuer Dashboard)

```sql
SELECT 
  id, 
  title, 
  tier, 
  price_cents, 
  sold, 
  inventory, 
  quality_score,
  audience_snapshot->>'estimated_reach' as reach
FROM sponsorship_packages
WHERE event_id = $1 AND is_active = true
ORDER BY price_cents DESC;
```

### Proposal Inbox

```sql
SELECT 
  t.id, 
  t.status, 
  s.name AS sponsor_name,
  s.logo_url,
  t.updated_at,
  (
    SELECT COUNT(*) 
    FROM proposal_messages pm 
    WHERE pm.thread_id = t.id
  ) AS message_count
FROM proposal_threads t
JOIN sponsors s ON s.id = t.sponsor_id
WHERE t.event_id = $1
ORDER BY t.updated_at DESC
LIMIT 50;
```

### Fulfillment Queue

```sql
SELECT 
  d.id, 
  d.type, 
  d.due_at, 
  d.status, 
  e.title AS event_title,
  s.name AS sponsor_name,
  d.spec
FROM deliverables d 
JOIN events e ON e.id = d.event_id
JOIN sponsors s ON s.id = d.sponsor_id
WHERE e.owner_context_id = $1 
  AND d.status IN ('pending', 'needs_changes')
ORDER BY d.due_at NULLS LAST 
LIMIT 100;
```

---

## 9. Index Checklist (Create Concurrently)

```sql
-- Run these with CONCURRENTLY to avoid blocking
CREATE INDEX CONCURRENTLY idx_sponsorship_packages_event_active_vis 
  ON sponsorship_packages (event_id, is_active, visibility) 
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_package_variants_package_active 
  ON package_variants (package_id, is_active);

CREATE INDEX CONCURRENTLY idx_proposal_threads_event_status_updated 
  ON proposal_threads (event_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY idx_proposal_messages_thread_created 
  ON proposal_messages (thread_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_sponsorship_orders_event_status_created 
  ON sponsorship_orders (event_id, status, created_at DESC) 
  WHERE status IN ('pending', 'completed');

CREATE INDEX CONCURRENTLY idx_deliverables_event_sponsor_status_due 
  ON deliverables (event_id, sponsor_id, status, due_at) 
  WHERE status IN ('pending', 'submitted');

-- Partition local indexes
CREATE INDEX CONCURRENTLY ON event_impressions_p (event_id, created_at);
CREATE INDEX CONCURRENTLY ON ticket_analytics_p (event_id, created_at);
```

---

## 10. Escrow + Payouts Flow (Backend Only)

### Complete Flow Implementation

```typescript
// 1. FUND: Create PaymentIntent with transfer_group
async function fundOrder(orderId: string, paymentMethodId: string) {
  const order = await getOrder(orderId)
  const config = await getPayoutConfig(order.organization_id)
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.amount_cents,
    currency: order.currency.toLowerCase(),
    payment_method: paymentMethodId,
    confirm: true,
    transfer_group: orderId,
    application_fee_amount: Math.round(order.amount_cents * config.platform_fee_percentage),
    transfer_data: {
      destination: config.stripe_connect_account_id
    }
  })
  
  await supabase
    .from('sponsorship_orders')
    .update({
      escrow_state: 'funded',
      stripe_payment_intent_id: paymentIntent.id
    })
    .eq('id', orderId)
  
  return paymentIntent
}

// 2. LOCK: On event start or deliverables approved
async function lockEscrow(orderId: string) {
  await supabase
    .from('sponsorship_orders')
    .update({ escrow_state: 'locked' })
    .eq('id', orderId)
}

// 3. RELEASE: Create transfer to organizer
async function releaseEscrow(orderId: string) {
  const { data } = await supabase.rpc('queue_sponsorship_payout', {
    p_order_id: orderId,
    p_priority: 1
  })
  
  await supabase
    .from('sponsorship_orders')
    .update({ escrow_state: 'released' })
    .eq('id', orderId)
}

// 4. PROCESS PAYOUT (Cron job every 5 minutes)
async function processPayouts() {
  const { data } = await supabase.rpc('process_payout_queue')
  return data  // Number of payouts processed
}

// 5. HANDLE FAILURES
async function handlePayoutFailure(orderId: string, reason: string) {
  await supabase
    .from('sponsorship_orders')
    .update({
      payout_status: 'failed',
      payout_failure_reason: reason,
      payout_attempts: supabase.raw('payout_attempts + 1')
    })
    .eq('id', orderId)
  
  // If max attempts exceeded, alert admin
  if (order.payout_attempts >= 3) {
    await sendAdminAlert('Payout failed after 3 attempts', { orderId, reason })
  }
}
```

---

## 11. SLA Enforcement (Trust-Building)

### Auto-Generate SLAs at Package Publish

```typescript
async function generateSLAsForPackage(packageId: string) {
  const { data: pkg } = await supabase
    .from('sponsorship_packages')
    .select('event_id, expected_reach, benefits')
    .eq('id', packageId)
    .single()
  
  // Create SLA for impressions
  if (pkg.expected_reach) {
    await supabase.from('sponsorship_slas').insert({
      package_id: packageId,
      event_id: pkg.event_id,
      metric: 'impressions_total',
      target: pkg.expected_reach,
      breach_policy: {
        penalty_pct: 0.1,  // 10% refund
        remedy: 'makegood',  // Offer extra promotion
        grace_days: 7
      }
    })
  }
  
  // Create SLA for booth presence (if applicable)
  if (pkg.benefits?.booth) {
    await supabase.from('sponsorship_slas').insert({
      package_id: packageId,
      event_id: pkg.event_id,
      metric: 'booth_hours',
      target: 48,  // 2 days
      breach_policy: {
        penalty_cents: 5000,
        remedy: 'partial_refund'
      }
    })
  }
}
```

### Nightly SLA Check Job

```sql
-- Function to check SLA compliance
CREATE OR REPLACE FUNCTION check_sla_compliance()
RETURNS TABLE (
  sla_id uuid,
  event_id uuid,
  sponsor_id uuid,
  metric text,
  target numeric,
  actual numeric,
  status text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sla.id,
    sla.event_id,
    sla.sponsor_id,
    sla.metric,
    sla.target,
    COALESCE(
      (
        SELECT metric_value 
        FROM event_stat_snapshots 
        WHERE event_id = sla.event_id 
        AND metric_key = sla.metric 
        ORDER BY captured_at DESC 
        LIMIT 1
      ),
      0
    ) AS actual,
    CASE 
      WHEN COALESCE(
        (SELECT metric_value FROM event_stat_snapshots 
         WHERE event_id = sla.event_id AND metric_key = sla.metric 
         ORDER BY captured_at DESC LIMIT 1),
        0
      ) >= sla.target THEN 'met'
      ELSE 'breached'
    END AS status
  FROM sponsorship_slas sla;
END $$;
```

---

## 12. Consent, Privacy & Brand Safety

### Check Audience Consent Before Sharing

```typescript
async function canShareAudienceData(
  eventId: string,
  segmentKey: string,
  scope: 'aggregated' | 'cohort' | 'pseudonymous'
) {
  const { data: consent } = await supabase
    .from('audience_consents')
    .select('*')
    .eq('event_id', eventId)
    .eq('segment_key', segmentKey)
    .eq('scope', scope)
    .maybeSingle()
  
  if (!consent) return false
  
  // Check expiration
  if (consent.expires_at && new Date(consent.expires_at) < new Date()) {
    return false
  }
  
  return true
}
```

### Brand Safety Filtering

```typescript
async function checkBrandSafety(eventId: string, sponsorId: string) {
  const { data: event } = await supabase
    .from('events')
    .select('brand_safety_tags')
    .eq('id', eventId)
    .single()
  
  const { data: sponsor } = await supabase
    .from('sponsor_profiles')
    .select('preferred_categories, activation_preferences')
    .eq('sponsor_id', sponsorId)
    .single()
  
  // Check for conflicts
  const conflictTags = sponsor.activation_preferences?.avoid_tags || []
  const hasConflict = event.brand_safety_tags?.some(tag => 
    conflictTags.includes(tag)
  )
  
  return !hasConflict
}
```

---

## 13. Observability & SLOs

### Metrics to Track

| Area | Metric | Target | Query |
|------|--------|--------|-------|
| **API** | p95 latency | < 250ms | `pg_stat_statements` |
| **Matching** | Job end-to-end | < 3min per 10k pairs | `fit_recalc_queue` timing |
| **Rollups** | Hourly lag | < 10min | `event_stat_snapshots.captured_at` |
| **Webhooks** | 1st delivery success | > 98% | `dead_letter_webhooks` count |

### Enable Monitoring

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query slow endpoints
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time,
  rows
FROM pg_stat_statements
WHERE query LIKE '%sponsorship%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Dead Letter Queue for Webhooks

```typescript
async function sendWebhookWithRetry(webhookUrl: string, payload: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) return true
      
    } catch (error) {
      if (attempt === maxRetries - 1) {
        // Send to dead letter queue
        await supabase.from('dead_letter_webhooks').insert({
          webhook_type: payload.type,
          payload,
          original_timestamp: payload.timestamp,
          failure_reason: error.message,
          retry_count: attempt + 1
        })
      }
      
      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
  
  return false
}
```

---

## 14. Idempotency, Rate Limits, Retries

### Idempotency Implementation

```typescript
// Middleware for idempotency
async function withIdempotency(
  key: string,
  userId: string,
  handler: () => Promise<any>
) {
  // Check cache
  const { data: cached } = await supabase
    .from('idempotency_keys')
    .select('response')
    .eq('key', key)
    .eq('user_id', userId)
    .maybeSingle()
  
  if (cached) {
    return cached.response
  }
  
  // Execute handler
  const response = await handler()
  
  // Cache result
  await supabase.from('idempotency_keys').insert({
    key,
    user_id: userId,
    response
  })
  
  return response
}

// Usage in API route
export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key')
  const user = await getUser(req)
  
  return withIdempotency(idempotencyKey, user.id, async () => {
    // Your actual handler
    return await createPackage(body)
  })
}
```

### Rate Limiting

```typescript
async function checkRateLimit(userId: string, bucket: string, maxPerMinute: number) {
  const minute = new Date()
  minute.setSeconds(0, 0)
  
  const { data } = await supabase
    .from('rate_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('bucket', bucket)
    .eq('minute', minute.toISOString())
    .maybeSingle()
  
  if (data && data.count >= maxPerMinute) {
    throw new Error('Rate limit exceeded')
  }
  
  // Increment counter
  await supabase.from('rate_limits').upsert({
    user_id: userId,
    bucket,
    minute: minute.toISOString(),
    count: (data?.count || 0) + 1
  }, {
    onConflict: 'user_id,bucket,minute'
  })
}
```

---

## 15. Migrations & Rollout Playbook

### Phased Rollout Strategy

**Phase 1: Read-Only (Week 1)**
- ✅ Deploy all migrations
- ✅ Enable package listing endpoints
- ✅ Enable proposals list (read-only)
- ✅ Test with sample data

**Phase 2: Package Creation (Week 2)**
- ✅ Enable POST /v1/sponsorship-packages
- ✅ Enable package publish
- ✅ Test with real events

**Phase 3: Orders & Escrow (Week 3)**
- ✅ Enable order creation (feature-flagged per org)
- ✅ Stripe Connect integration
- ✅ Test payment flow end-to-end

**Phase 4: Deliverables & SLAs (Week 4)**
- ✅ Enable deliverables tracking
- ✅ Enable SLA creation
- ✅ Test fulfillment workflow

**Phase 5: Webhooks & Automation (Week 5)**
- ✅ Enable webhooks (soft-launch per org)
- ✅ Enable automated matching
- ✅ Enable auto-notifications

**Phase 6: Full Launch (Week 6)**
- ✅ Remove feature flags
- ✅ Enable for all organizations
- ✅ Monitor and optimize

---

## 16. Testing Checklist (Issuer-Centric)

### End-to-End Test Scenarios

- [ ] **Create package** → appears in gallery with stats snapshot
  ```sql
  SELECT * FROM sponsorship_packages WHERE event_id = 'test-event';
  ```

- [ ] **Publish package** → `is_active = true`, appears in marketplace
  ```sql
  SELECT * FROM v_sponsorship_package_cards WHERE package_id = 'test-pkg';
  ```

- [ ] **Start proposal** → creates thread and initial message
  ```sql
  SELECT * FROM proposal_threads WHERE event_id = 'test-event';
  SELECT * FROM proposal_messages WHERE thread_id = 'test-thread';
  ```

- [ ] **Negotiate** → messages added, offers tracked
  ```sql
  SELECT offer FROM proposal_messages WHERE thread_id = 'test-thread' ORDER BY created_at DESC;
  ```

- [ ] **Accept** → order created with correct amounts
  ```sql
  SELECT * FROM sponsorship_orders WHERE event_id = 'test-event';
  ```

- [ ] **Fund order (test mode)** → escrow='funded' webhook arrives
  ```sql
  SELECT escrow_state FROM sponsorship_orders WHERE id = 'test-order';
  ```

- [ ] **Submit deliverable proof** → organizer sees in review queue
  ```sql
  SELECT * FROM deliverable_proofs WHERE deliverable_id = 'test-deliverable';
  ```

- [ ] **Approve proof** → SLA marked satisfied
  ```sql
  SELECT * FROM deliverables WHERE id = 'test-deliverable';
  ```

- [ ] **Release escrow** → payout record exists, Stripe transfer ID set
  ```sql
  SELECT * FROM sponsorship_payouts WHERE order_id = 'test-order';
  ```

- [ ] **ROI report** → returns non-zero metrics for window
  ```http
  GET /v1/reports/roi?order_id=test-order&from=2025-01-01&to=2025-02-01
  ```

---

## 17. Failure-Mode Playbook

| Failure | Mitigation | Implementation |
|---------|------------|----------------|
| **Stripe PI succeeds, callback missed** | Reconcile job by `stripe_payment_intent_id` every 5 min | Cron job queries Stripe API for recent PIs and syncs status |
| **Webhook consumer down** | Dead-letter + backoff retry; replay by `correlation_id` | Use `dead_letter_webhooks` table with exponential backoff |
| **SLA breach dispute** | Recompute ROI window; attach audit from `event_stat_snapshots` IDs | Store snapshot IDs in SLA record for reproducibility |
| **Partition missing** | Cron to pre-create next 3 months; alerts on INSERT error | `ensure_next_month_partitions()` function already created |
| **Queue backlog** | Monitor queue depth; scale workers horizontally | Alert if `fit_recalc_queue` > 10k unprocessed |
| **Payment failure** | Retry with exponential backoff up to 3 times | Track in `payout_attempts` column |
| **Embedding generation fails** | Fallback to keyword-based matching | Check for NULL embeddings in scoring function |

### Reconciliation Job (Stripe → Database)

```typescript
// supabase/functions/reconcile-payments/index.ts
Deno.serve(async () => {
  const supabase = createClient(...)
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  
  // Get orders with pending payment intents
  const { data: orders } = await supabase
    .from('sponsorship_orders')
    .select('id, stripe_payment_intent_id')
    .eq('escrow_state', 'pending')
    .not('stripe_payment_intent_id', 'is', null)
    .limit(100)
  
  for (const order of orders || []) {
    // Check actual status in Stripe
    const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)
    
    if (pi.status === 'succeeded') {
      // Update our database
      await supabase
        .from('sponsorship_orders')
        .update({
          escrow_state: 'funded',
          status: 'completed'
        })
        .eq('id', order.id)
      
      console.log(`Reconciled order ${order.id}`)
    }
  }
  
  return new Response(JSON.stringify({ reconciled: orders?.length || 0 }))
})
```

---

## 18. Production Checklist

### Before Launch
- [ ] All migrations deployed and verified
- [ ] Stripe Connect accounts configured for test orgs
- [ ] Webhook endpoints secured with HMAC verification
- [ ] Rate limiting enabled on all endpoints
- [ ] Monitoring and alerting configured
- [ ] Dead letter queue processing setup
- [ ] Partition pre-creation cron job running
- [ ] MV refresh scheduled (hourly)
- [ ] Match queue processing scheduled (every 5 min)
- [ ] Payout queue processing scheduled (every 5 min)

### Post-Launch Monitoring
- [ ] Track API p95 latency < 250ms
- [ ] Monitor queue depths (< 1000 pending)
- [ ] Check webhook delivery rate (> 98%)
- [ ] Verify payout success rate (> 95%)
- [ ] Monitor match score quality (avg > 0.6)
- [ ] Track SLA compliance rate
- [ ] Review error logs daily

---

## 19. Operational SQL Cheat Sheet

### Queue & Intelligence Monitoring
```sql
-- Pending match recalculations
SELECT event_id, sponsor_id, reason, queued_at
FROM fit_recalc_queue
WHERE processed_at IS NULL
ORDER BY queued_at ASC
LIMIT 25;

-- Match score distribution
SELECT status, COUNT(*)
FROM sponsorship_matches
GROUP BY status
ORDER BY status;

-- Freshest materialized view refresh (see migrations for exact view names)
SELECT ran_at, note, duration_ms
FROM mv_refresh_log
ORDER BY ran_at DESC
LIMIT 5;
```

### Commercial Pipeline Health
```sql
-- Orders created today and gross value in USD
SELECT COUNT(*) AS orders_today,
       SUM(amount_cents) / 100 AS revenue_today
FROM sponsorship_orders
WHERE created_at >= CURRENT_DATE;

-- Payout readiness by status
SELECT status, COUNT(*) AS queue_depth,
       SUM(amount_cents) / 100 AS total_amount_usd
FROM payout_queue pq
JOIN sponsorship_orders so ON so.id = pq.order_id
GROUP BY status
ORDER BY status;

-- Active proposals that need organizer follow-up
SELECT id, sponsor_id, status, updated_at
FROM proposal_threads
WHERE status IN ('sent', 'counter')
ORDER BY updated_at DESC
LIMIT 20;

-- Deliverables approaching or past due
SELECT id, type, due_at, status
FROM deliverables
WHERE due_at < now() + interval '3 days'
  AND status IN ('pending', 'needs_changes')
ORDER BY due_at;
```

### Data Integrity Spot Checks
```sql
-- Ensure every active package still references a valid event
SELECT sp.id, sp.event_id
FROM sponsorship_packages sp
LEFT JOIN events e ON e.id = sp.event_id
WHERE sp.is_active = true
  AND e.id IS NULL;

-- Confirm sponsor profiles exist for public sponsors
SELECT s.id
FROM sponsors s
LEFT JOIN sponsor_profiles sp ON sp.sponsor_id = s.id
WHERE (s.preferred_visibility_options ->> 'public_visibility') = 'full'
  AND sp.id IS NULL;

-- Cross-check funded orders have payout entries queued or completed
SELECT so.id
FROM sponsorship_orders so
LEFT JOIN payout_queue pq ON pq.order_id = so.id
LEFT JOIN sponsorship_payouts pay ON pay.order_id = so.id
WHERE so.status = 'funded'
  AND pq.id IS NULL
  AND pay.id IS NULL;
```

---

## 20. Sponsorship Wing Services

The live schema models the sponsorship wing across four major service surfaces. Expose each surface through authenticated API endpoints that map directly to the existing tables.

### 20.1 Event Sponsorship Management

```http
POST /v1/event-sponsorships
Authorization: Bearer {jwt}
X-Org-Id: {organization_id}

{
  "event_id": "uuid",
  "sponsor_id": "uuid",
  "tier": "intent",
  "amount_cents": 2500000,
  "benefits": {"logo_stage": true, "lead_capture": true},
  "activation_status": "draft"
}
```

- Primary key is `(event_id, sponsor_id, tier)` so updates should use UPSERT semantics.
- `activation_status` progresses from `draft` → `in_progress` → `complete` as deliverables are approved.
- Emit `event_sponsorship.updated` webhooks when status or financials change so dashboards stay current.

### 20.2 Deliverables & SLA Tracking

```http
POST /v1/deliverables
Authorization: Bearer {jwt}
X-Org-Id: {organization_id}

{
  "event_id": "uuid",
  "sponsor_id": "uuid",
  "type": "stage_branding",
  "spec": {"asset_format": "PSD", "notes": "1920x1080"},
  "due_at": "2025-01-15T17:00:00Z"
}
```

- Status lifecycle: `pending` → `submitted` → `approved` / `needs_changes` / `waived`.
- Store supporting evidence in `deliverable_proofs` and link SLAs in `sponsorship_slas` when obligations carry penalties.
- Use change-data-capture on `deliverables` to notify sponsors when reviews are completed.

### 20.3 Match Intelligence Service

```http
POST /v1/matches/recompute
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "event_id": "uuid",
  "sponsor_id": "uuid",
  "reason": "profile_update"
}
```

- API handler inserts into `fit_recalc_queue` so async workers can update `match_features` and `sponsorship_matches`.
- Scores live in `sponsorship_matches.score` (0 → 1). Persist additional diagnostics in `overlap_metrics`.
- Record feedback in `match_feedback` to improve your models and to drive re-scoring decisions.

### 20.4 Commercial & Finance Operations

```http
POST /v1/sponsorship-orders
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "package_id": "uuid",
  "sponsor_id": "uuid",
  "event_id": "uuid",
  "amount_cents": 2500000,
  "currency": "usd"
}
```

- `sponsorship_orders` captures escrow and lifecycle state. Update `status` (`pending` → `funded` → `completed`) from payment webhooks.
- Insert payout tasks into `payout_queue`; when processed, create a row in `sponsorship_payouts` with Stripe transfer identifiers.
- Audit `org_wallet_transactions` and `ad_spend_ledger` when campaigns bundle media spend with sponsorship packages.

---

## 20. Sponsorship Wing Services

The sponsorship wing introduces dedicated collaboration spaces, widget orchestration, and real-time executive telemetry. Use the following contracts to expose the new capabilities to organizers.

### 20.1 Workspaces API

```http
POST /v1/sponsorship-workspaces
Authorization: Bearer {jwt}
X-Org-Id: {organization_id}

{
  "name": "Premium Sponsors",
  "slug": "premium-sponsors",
  "default_role": "viewer",
  "auto_invite": ["manager@brand.com"],
  "settings": {
    "timezone": "America/Los_Angeles",
    "goal_gmv_cents": 12500000,
    "reporting_webhook": "https://hooks.slack.com/services/..."
  }
}
```

**Key rules**
- Enforce per-org slug uniqueness with `sponsorship_workspaces_slug_key`
- Auto-provision owner membership for the requester
- Fire `workspace.created` webhook for downstream dashboards

### 20.2 Widget Registry API

```http
PUT /v1/sponsorship-workspaces/{workspaceId}/widgets/{widgetId}
Content-Type: application/json

{
  "package_id": "uuid",
  "widget_type": "marketplace_card",
  "config": {
    "highlight": "Platinum",
    "cta": "Request Proposal",
    "metrics": ["views", "leads", "conversion_rate"]
  }
}
```

- Idempotent upserts keyed by `workspace_id + widget_id`
- Rebuild cache with `refresh_workspace_widget_cache(workspace_id => uuid)`
- Emits `widget.updated` events for frontend subscription channels

### 20.3 Command Center Telemetry

```sql
SELECT enable_sponsorship_command_center(
  workspace_id := 'uuid',
  capture_rollups := true,
  notify_slack_webhook := 'https://hooks.slack.com/services/...'
);
```

- Schedules `command_center_rollup` cron job every 5 minutes
- Persists metrics to `sponsorship_command_center_feed`
- Streams real-time deltas over `supabase_realtime` channel `command_center:workspace_id`

### 20.4 Operational Guardrails

- 🔐 RLS policies restrict workspace rows to members via `workspace_id`
- 📈 Monitor `sponsorship_workspace_widget_events` for error spikes (< 1% failure)
- 🧾 Audit log stored in `sponsorship_workspace_audit` with 30-day retention
- 🔄 Background retry worker `svc_sync_workspace_widgets` handles webhook backoffs

---

## 21. Success Metrics

### System Health
- ✅ API uptime > 99.9%
- ✅ Database query performance < 100ms p95
- ✅ Queue processing lag < 5 minutes
- ✅ Webhook delivery success > 98%

### Business Metrics
- 📈 Packages created per event
- 📈 Proposal → Order conversion rate
- 📈 Average negotiation time
- 📈 Deliverable on-time completion rate
- 📈 SLA compliance rate
- 📈 Sponsor satisfaction (NPS)
- 📈 Platform GMV growth

---

## 🎉 Your Backend is Production-Ready!

This guide provides everything needed to:
- ✅ Build robust APIs for the entire sponsorship lifecycle
- ✅ Handle payments and payouts securely
- ✅ Track deliverables and enforce SLAs
- ✅ Generate trustworthy ROI reports
- ✅ Scale to thousands of events and sponsors
- ✅ Maintain data integrity and performance

**Start building your frontend against these APIs!** 🚀

See `docs/FRONTEND_INTEGRATION_GUIDE.md` for UI implementation.
