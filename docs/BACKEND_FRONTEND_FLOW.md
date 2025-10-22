# 🔄 Backend → Frontend Data Flow

## Complete Integration Map

### 1. Sponsor Discovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Supabase)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 View: v_sponsorship_package_cards                           │
│  ├─ Joins: sponsorship_packages                                 │
│  ├─ Joins: events                                               │
│  ├─ Joins: mv_event_reach_snapshot                              │
│  └─ Joins: mv_event_quality_scores                              │
│                                                                  │
│  ⚡ Returns: {                                                   │
│      package_id, title, price_cents, quality_score,             │
│      total_views, tickets_sold, event_title, ...                │
│    }                                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Next.js)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🪝 Hook: usePackageMarketplace(filters)                        │
│  ├─ File: src/hooks/usePackageMarketplace.ts                    │
│  ├─ Uses: @tanstack/react-query                                 │
│  └─ Returns: { data, isLoading, error }                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🎨 Component: <PackageCard package={pkg} />                    │
│  ├─ File: src/components/sponsorship/PackageCard.tsx            │
│  ├─ Displays: Title, Price, Quality, Metrics                    │
│  └─ Actions: "Learn More", "Buy Now"                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       PAGE LAYOUT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📄 Page: /marketplace                                          │
│  ├─ File: src/app/(sponsors)/marketplace/page.tsx               │
│  ├─ Layout: Grid of PackageCard components                      │
│  └─ Features: Filters, Search, Pagination                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Match Scoring Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTION                              │
│  User clicks "Check Match" for event + sponsor                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND API CALL                            │
│  POST /api/matches/compute                                      │
│  Body: { event_id, sponsor_id }                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTE                            │
│  File: app/api/matches/compute/route.ts                         │
│  Calls: supabase.rpc('fn_upsert_match', { ... })                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE RPC CALL                            │
│  Function: fn_upsert_match(event_id, sponsor_id)                │
│  ├─ Calls: fn_compute_match_score()                             │
│  └─ Upserts: sponsorship_matches table                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SCORING ALGORITHM                            │
│  Function: fn_compute_match_score()                             │
│  ├─ Reads: sponsor_profiles                                     │
│  ├─ Reads: event_audience_insights                              │
│  ├─ Reads: events (for vector embedding)                        │
│  ├─ Computes: 6-factor weighted score                           │
│  └─ Returns: { score: 0.XX, breakdown: {...} }                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RESPONSE TO FRONTEND                         │
│  Returns: { score, overlap_metrics: {...} }                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    UI UPDATE                                    │
│  Component: <MatchScoreExplanation />                           │
│  Displays: Overall score + detailed breakdown                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Proposal & Negotiation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  ORGANIZER: Creates proposal from event dashboard               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: POST /api/proposals                                  │
│  ├─ Creates: proposal_threads row                               │
│  └─ Creates: initial proposal_messages row                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE: Trigger fires                                        │
│  └─ Notification sent to sponsor                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  SPONSOR: Receives notification, opens chat                     │
│  Component: <ProposalChat threadId={id} userType="sponsor" />   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  REAL-TIME: Both parties see messages instantly                 │
│  Hook: useRealtimeProposal(threadId)                            │
│  ├─ Subscribes: postgres_changes on proposal_messages           │
│  └─ Invalidates: React Query cache on update                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  NEGOTIATION: Back-and-forth messages with offers               │
│  ├─ Each message can include: body + offer JSONB                │
│  └─ Offers include: price, benefits, terms, exclusivity         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ACCEPTANCE: Thread status → 'accepted'                         │
│  ├─ Creates: sponsorship_orders row                             │
│  └─ Creates: deliverables rows (if specified)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Payment & Payout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  SPONSOR: Accepts proposal → redirected to Stripe               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STRIPE: Payment processed                                      │
│  ├─ Creates: PaymentIntent                                      │
│  ├─ Creates: Charge                                             │
│  └─ Sends: Webhook to your backend                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND: Webhook handler                                       │
│  ├─ Updates: sponsorship_orders.status = 'completed'            │
│  ├─ Stores: stripe_payment_intent_id, stripe_charge_id          │
│  └─ Calls: queue_sponsorship_payout(order_id)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PAYOUT QUEUE: Order queued for processing                      │
│  Table: payout_queue                                            │
│  Status: 'pending' → scheduled_for: now()                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CRON JOB: process_payout_queue() runs every 5 minutes          │
│  ├─ Calculates: platform_fee_cents                              │
│  ├─ Creates: Stripe Transfer to organizer                       │
│  ├─ Updates: payout_queue.status = 'completed'                  │
│  └─ Creates: sponsorship_payouts record                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ORGANIZER: Receives funds in Stripe Connect account            │
│  Dashboard: Shows payout history and status                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. Deliverable Tracking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND: Order completed → Deliverables auto-created           │
│  Based on: sponsorship_packages.benefits                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  SPONSOR DASHBOARD: Shows deliverable queue                     │
│  Hook: useDeliverables(sponsorId)                               │
│  Query: SELECT FROM deliverables WHERE status = 'pending'       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  SPONSOR: Uploads proof (image/video/metrics)                   │
│  Action: submitProof.mutate({ assetUrl, metrics })              │
│  ├─ Inserts: deliverable_proofs row                             │
│  └─ Updates: deliverables.status = 'submitted'                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ORGANIZER: Receives notification, reviews proof                │
│  Page: /events/[id]/deliverables                                │
│  Shows: Proof assets + metrics + approve/reject buttons         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ORGANIZER: Approves or requests changes                        │
│  ├─ Approve: deliverable_proofs.approved_at = now()             │
│  │           deliverables.status = 'approved'                   │
│  └─ Reject:  deliverable_proofs.rejected_reason = 'text'        │
│              deliverables.status = 'needs_changes'              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  SLA CHECK: If tied to SLA                                      │
│  ├─ Query: sponsorship_slas WHERE deliverable_id = ?            │
│  └─ If breached: Apply breach_policy (penalty/makegood)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### Marketplace Page
```
<MarketplacePage>
  ├─ usePackageMarketplace() hook
  │   └─ Queries: v_sponsorship_package_cards
  │
  ├─ <FilterBar>
  │   ├─ Category select
  │   ├─ Price range sliders
  │   └─ Quality tier filter
  │
  └─ <PackageGrid>
      └─ <PackageCard> × N
          ├─ Quality badge
          ├─ Event info
          ├─ Metrics grid
          └─ CTA button
```

### Event Sponsor Dashboard
```
<EventSponsorsPage eventId={id}>
  ├─ useEventSponsorMatches(eventId) hook
  │   └─ Queries: v_event_recommended_sponsors
  │
  ├─ <MatchList>
  │   └─ <SponsorMatchCard> × N
  │       ├─ <SponsorInfo />
  │       ├─ <MatchScoreExplanation score breakdown />
  │       └─ <ActionButtons>
  │           ├─ "Start Proposal"
  │           └─ "View Profile"
  │
  └─ <CreateProposalModal>
      ├─ Form: Initial message
      ├─ Form: Offer terms
      └─ Submit → POST /api/proposals
```

### Proposal Chat
```
<ProposalChatPage threadId={id}>
  ├─ useProposalThread(threadId) hook
  │   ├─ Queries: proposal_threads
  │   └─ Queries: proposal_messages
  │
  ├─ useRealtimeProposal(threadId) hook
  │   └─ Subscribes: postgres_changes
  │
  ├─ <ChatHeader>
  │   ├─ Event title
  │   ├─ Sponsor name
  │   └─ Status badge
  │
  ├─ <MessageList>
  │   └─ <Message> × N
  │       ├─ Body text
  │       ├─ Offer details (if present)
  │       └─ Timestamp
  │
  └─ <MessageComposer>
      ├─ Textarea: Message
      ├─ <OfferBuilder>
      │   ├─ Price input
      │   ├─ Exclusivity toggle
      │   └─ Benefits checklist
      └─ Submit button
```

---

## Data Flow Patterns

### Pattern 1: View → Hook → Component → Page

**Best for**: Read-only data, listings, dashboards

```typescript
// 1. Backend: Create optimized view
CREATE VIEW v_my_data AS SELECT ...;

// 2. Frontend: Create hook
export function useMyData() {
  return useQuery({
    queryKey: ['my-data'],
    queryFn: async () => {
      const { data } = await supabase.from('v_my_data').select('*')
      return data
    }
  })
}

// 3. Component: Consume hook
export function MyComponent() {
  const { data, isLoading } = useMyData()
  return <div>{/* Render data */}</div>
}

// 4. Page: Use component
export default function MyPage() {
  return <MyComponent />
}
```

### Pattern 2: RPC → Hook → Component

**Best for**: Complex calculations, mutations

```typescript
// 1. Backend: Create function
CREATE FUNCTION fn_my_action(...) RETURNS ...;

// 2. Frontend: Create mutation hook
export function useMyAction() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params) => {
      const { data } = await supabase.rpc('fn_my_action', params)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['related-data'] })
    }
  })
}

// 3. Component: Use mutation
export function MyComponent() {
  const myAction = useMyAction()
  
  return (
    <button onClick={() => myAction.mutate({ ... })}>
      Do Action
    </button>
  )
}
```

### Pattern 3: Real-time Subscription

**Best for**: Live updates, chat, notifications

```typescript
// 1. Hook: Subscribe to changes
export function useRealtimeData(id: string) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const channel = supabase
      .channel(`data:${id}`)
      .on('postgres_changes', { ... }, () => {
        queryClient.invalidateQueries({ queryKey: ['data', id] })
      })
      .subscribe()
    
    return () => supabase.removeChannel(channel)
  }, [id])
}

// 2. Component: Use subscription
export function LiveComponent({ id }) {
  const { data } = useMyData(id)
  useRealtimeData(id)  // Auto-updates on changes
  
  return <div>{/* Always fresh data */}</div>
}
```

---

## State Management

### React Query Configuration

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})
```

### Provider Setup

```typescript
// src/app/layout.tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

---

## Error Handling

### Global Error Handler

```typescript
// src/lib/error-handler.ts
export function handleSupabaseError(error: any) {
  // Log to monitoring service
  console.error('Supabase error:', error)
  
  // User-friendly messages
  const friendlyMessages: Record<string, string> = {
    '23505': 'This item already exists',
    '23503': 'Related item not found',
    '42501': 'You don\'t have permission to do this',
    'PGRST116': 'Not found'
  }
  
  return {
    message: friendlyMessages[error.code] || 'Something went wrong',
    code: error.code,
    details: error.message
  }
}
```

---

## Testing

### API Route Test

```typescript
// __tests__/api/packages.test.ts
import { GET } from '@/app/api/packages/route'

describe('GET /api/packages', () => {
  it('returns marketplace packages', async () => {
    const req = new NextRequest('http://localhost:3000/api/packages')
    const res = await GET(req)
    const json = await res.json()
    
    expect(json.data).toBeInstanceOf(Array)
    expect(json.data[0]).toHaveProperty('package_id')
    expect(json.data[0]).toHaveProperty('price_cents')
  })
})
```

### Hook Test

```typescript
// __tests__/hooks/usePackageMarketplace.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { usePackageMarketplace } from '@/hooks/usePackageMarketplace'

describe('usePackageMarketplace', () => {
  it('fetches packages', async () => {
    const { result } = renderHook(() => usePackageMarketplace())
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    expect(result.current.data).toBeInstanceOf(Array)
  })
})
```

---

## Performance Optimization

### 1. Prefetch Data

```typescript
// Prefetch on hover for faster navigation
function PackageCard({ package }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: ['package-details', package.id],
      queryFn: () => fetchPackageDetails(package.id)
    })
  }
  
  return <div onMouseEnter={handleMouseEnter}>...</div>
}
```

### 2. Virtualization for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function MarketplaceList({ packages }) {
  const parentRef = useRef(null)
  
  const virtualizer = useVirtualizer({
    count: packages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200
  })
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div key={virtualRow.index}>
            <PackageCard package={packages[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

**Your backend and frontend are now fully connected!** 🎨🔌
