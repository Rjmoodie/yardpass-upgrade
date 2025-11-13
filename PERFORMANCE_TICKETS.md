# Liventix Performance Optimization Tickets
**Source:** [PERFORMANCE_AUDIT_2025-11-09.md](./PERFORMANCE_AUDIT_2025-11-09.md)  
**Created:** November 9, 2025  
**Total Tickets:** 10  

---

## Ticket Organization

### Phase 1: Quick Wins + Measurement (1-2 days)
- [PERF-001](#perf-001-add-performance-tracking-infrastructure) - Performance tracking infrastructure
- [PERF-002](#perf-002-fix-n1-queries-in-organizer-analytics) - Fix N+1 queries in organizer analytics
- [PERF-003](#perf-003-fix-real-time-subscription-churn) - Fix real-time subscription churn
- [PERF-004](#perf-004-add-font-display-swap-to-inter-font) - Add font-display: swap
- [PERF-005](#perf-005-run-bundle-visualizer-and-document-findings) - Run bundle visualizer

### Phase 2: Medium Improvements (3-5 days)
- [PERF-006](#perf-006-add-missing-database-indexes) - Add missing database indexes
- [PERF-007](#perf-007-implement-batch-impression-logging) - Batch impression logging
- [PERF-008](#perf-008-add-http-caching-headers) - HTTP caching headers
- [PERF-009](#perf-009-add-skeleton-loaders-to-key-pages) - Skeleton loaders
- [PERF-010](#perf-010-add-feed-sql-performance-slo-monitoring) - Feed SQL SLO monitoring

---

## Phase 1 Tickets

### PERF-001: Add Performance Tracking Infrastructure

**Priority:** 🔴 Critical (Blocker for other optimizations)  
**Estimate:** 4 hours  
**Assignee:** Frontend + DevOps  

#### Description
Add lightweight performance tracking to establish baseline metrics before making optimizations. This is required to prove the impact of subsequent performance improvements.

**Reference:** [Audit Section 8](./PERFORMANCE_AUDIT_2025-11-09.md#8-monitoring--observability)

#### Acceptance Criteria
- [ ] Feed load time tracked with `performance.mark()` and sent to PostHog
- [ ] Dashboard load time tracked and sent to PostHog
- [ ] Edge Function query duration logged and exposed via response header
- [ ] Metrics include device type (mobile/desktop) and item counts
- [ ] Baseline metrics collected for 48 hours before making changes

#### Implementation Hints

**1. Create performance utility:**
```typescript
// src/utils/performanceTracking.ts
export function trackPageLoad(pageName: string, metadata?: Record<string, any>) {
  const markStart = `${pageName}-start`;
  const markEnd = `${pageName}-end`;
  
  performance.mark(markEnd);
  const measure = performance.measure(pageName, markStart, markEnd);
  
  posthog.capture('perf_page_load', {
    page: pageName,
    duration: measure.duration,
    userAgent: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
    ...metadata
  });
  
  // Cleanup marks
  performance.clearMarks(markStart);
  performance.clearMarks(markEnd);
  performance.clearMeasures(pageName);
}
```

**2. Wrap feed loading:**
```typescript
// src/features/feed/routes/FeedPageNewDesign.tsx
useEffect(() => {
  performance.mark('feed-start');
  // existing feed fetch logic
}, []);

useEffect(() => {
  if (!loading && items.length > 0) {
    trackPageLoad('feed', { itemCount: items.length });
  }
}, [loading, items]);
```

**3. Wrap dashboard loading:**
```typescript
// src/components/OrganizerDashboard.tsx
useEffect(() => {
  performance.mark('dashboard-start');
  // existing analytics fetch
}, []);

useEffect(() => {
  if (!loading && eventAnalytics.length > 0) {
    trackPageLoad('dashboard', { eventCount: eventAnalytics.length });
  }
}, [loading, eventAnalytics]);
```

**4. Edge Function response headers:**
```typescript
// supabase/functions/home-feed/index.ts
const startTime = Date.now();
const { data, error } = await supabase.rpc('get_home_feed_ranked', rpcArgs);
const duration = Date.now() - startTime;

// Add to response headers
headers.set('X-Query-Duration-Ms', duration.toString());
```

#### Definition of Done
- [ ] Code merged and deployed to production
- [ ] PostHog dashboard shows `perf_page_load` events
- [ ] Baseline metrics documented in Slack/Notion (P50, P95, P99 for feed + dashboard)
- [ ] Team reviewed metrics and agreed on targets

#### Dependencies
None (foundational)

---

### PERF-002: Fix N+1 Queries in Organizer Analytics

**Priority:** 🟡 High  
**Estimate:** 6 hours  
**Assignee:** Backend  

#### Description
Replace sequential per-event queries in `useOrganizerData` and `useOrganizerAnalytics` with batched queries using `.in()` operator. Currently making 40+ sequential queries for 10 events.

**Reference:** [Audit Section 1](./PERFORMANCE_AUDIT_2025-11-09.md#1-database-performance-analysis)

#### Acceptance Criteria
- [ ] Batch queries implemented for tickets, orders, scan_logs, reactions
- [ ] Dashboard load time reduced by 50-70% (measure with PERF-001 metrics)
- [ ] Results are identical to current implementation (no regression)
- [ ] If batching brings query time under 300ms, stop there
- [ ] If still slow, create follow-up ticket for server-side aggregation

#### Implementation Hints

**1. Batch queries in `useOrganizerData.ts`:**
```typescript
// Before: N+1 pattern
const transformedEvents = await Promise.all(eventsData.map(async event => {
  const { data: ticketsData } = await supabase
    .from('tickets').select('status, tier_id').eq('event_id', event.id);
  // ... 3 more queries per event
}));

// After: Batched
const eventIds = eventsData.map(e => e.id);

const [ticketsResult, ordersResult, scansResult, reactionsResult] = await Promise.all([
  supabase.from('tickets').select('event_id, status, tier_id').in('event_id', eventIds),
  supabase.from('orders').select('event_id, total_cents, status').in('event_id', eventIds).eq('status', 'paid'),
  supabase.from('scan_logs').select('event_id, id').in('event_id', eventIds).eq('result', 'valid'),
  supabase.from('event_reactions').select('kind, event_posts!inner(event_id)').in('event_posts.event_id', eventIds)
]);

// Group by event_id
const ticketsByEvent = new Map();
ticketsResult.data?.forEach(t => {
  if (!ticketsByEvent.has(t.event_id)) ticketsByEvent.set(t.event_id, []);
  ticketsByEvent.get(t.event_id).push(t);
});

// Same for orders, scans, reactions...

// Transform with O(1) lookups
const transformedEvents = eventsData.map(event => ({
  ...event,
  totalSold: ticketsByEvent.get(event.id)?.filter(t => t.status === 'issued').length || 0,
  totalRevenue: ordersByEvent.get(event.id)?.reduce((sum, o) => sum + o.total_cents, 0) || 0,
  // ...
}));
```

**2. Same pattern for `useOrganizerAnalytics.ts` (lines 120-148)**

#### Definition of Done
- [ ] Code merged and deployed
- [ ] PostHog shows dashboard load time improved by 50-70%
- [ ] No regressions in analytics data (spot-check 5 organizers)
- [ ] Query count reduced from 40+ to 4 (visible in Supabase logs)
- [ ] If query time still >300ms, follow-up ticket created for server aggregation

#### Dependencies
- PERF-001 (need baseline metrics)

---

### PERF-003: Fix Real-Time Subscription Churn

**Priority:** 🔴 Critical (Mobile battery impact)  
**Estimate:** 4 hours  
**Assignee:** Frontend  

#### Description
Fix effect dependency arrays causing real-time subscriptions to be recreated multiple times per second. Console logs show `useRealtimeComments` callback updated 4x in quick succession, causing WebSocket churn.

**Reference:** [Audit Section 3](./PERFORMANCE_AUDIT_2025-11-09.md#3-network--api-performance)

#### Acceptance Criteria
- [ ] Subscription churn rate reduced from ~4x/second to <1x/minute
- [ ] Real-time functionality still works (comments, reactions, posts)
- [ ] No memory leaks (test by leaving app open for 10 minutes)
- [ ] Console logs show subscriptions created once, not repeatedly

#### Implementation Hints

**1. Fix `useRealtimeComments.ts`:**
```typescript
// Before: Callback in dependency array
useEffect(() => {
  const channel = supabase.channel('comments')
    .on('postgres_changes', { ... }, (payload) => {
      onCommentAdded(payload.new); // ← Stale closure
    })
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, [onCommentAdded]); // ← Recreates on every callback change

// After: Ref pattern
const onCommentAddedRef = useRef(onCommentAdded);
const onCommentDeletedRef = useRef(onCommentDeleted);

useLayoutEffect(() => {
  onCommentAddedRef.current = onCommentAdded;
  onCommentDeletedRef.current = onCommentDeleted;
});

useEffect(() => {
  const channel = supabase.channel('comments')
    .on('postgres_changes', { ... }, (payload) => {
      onCommentAddedRef.current(payload.new); // ← Always fresh
    })
    .on('postgres_changes', { ... }, (payload) => {
      onCommentDeletedRef.current(payload.old);
    })
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, []); // ← Subscribe once
```

**2. Apply same pattern to:**
- `useRealtime.tsx` (line 258: dependency on `JSON.stringify(eventIds)`)
- `useRealtimePosts.ts`
- Any other hooks with subscription churn

#### Definition of Done
- [ ] Code merged and deployed
- [ ] Console logs show subscriptions created once per page load
- [ ] Manual testing: comments/reactions still work in real-time
- [ ] Memory profiler shows no leaks after 10 minutes
- [ ] Mobile testing: battery drain reduced (subjective, but noticeable)

#### Dependencies
None

---

### PERF-004: Add font-display: swap to Inter Font

**Priority:** 🟢 Medium  
**Estimate:** 1 hour  
**Assignee:** Frontend  

#### Description
Fix "font preloaded but not used" warning and eliminate FOUT (Flash of Unstyled Text) by adding `font-display: swap` to Inter font.

**Reference:** [Audit Section 4](./PERFORMANCE_AUDIT_2025-11-09.md#4-asset--media-performance)

#### Acceptance Criteria
- [ ] Console warning about unused font preload is gone
- [ ] Text visible immediately with fallback, swaps when Inter loads
- [ ] No layout shift when font swaps (already sized correctly)
- [ ] Works on all pages

#### Implementation Hints

**Option 1: Update CSS directly**
```css
/* src/index.css or wherever @font-face is defined */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* ✅ Add this line */
}
```

**Option 2: If using @fontsource/inter**
```typescript
// src/main.tsx
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';

// Then in CSS:
body {
  font-family: 'Inter', system-ui, sans-serif; /* fallback to system font */
}
```

And ensure the imported CSS has `font-display: swap` (it should by default in newer versions).

#### Definition of Done
- [ ] Code merged and deployed
- [ ] Console warning eliminated (test in incognito/slow 3G)
- [ ] Lighthouse audit shows no font-related warnings
- [ ] Visual QA: text appears immediately (even if wrong font briefly)

#### Dependencies
None

---

### PERF-005: Run Bundle Visualizer and Document Findings

**Priority:** 🟡 High  
**Estimate:** 2 hours  
**Assignee:** Frontend  

#### Description
Install and run `rollup-plugin-visualizer` to generate bundle analysis report. Document findings to determine if further bundle optimization is needed.

**Reference:** [Audit Section 2](./PERFORMANCE_AUDIT_2025-11-09.md#2-frontend-performance-analysis)

#### Acceptance Criteria
- [ ] Bundle visualizer installed and configured
- [ ] Report generated for production build
- [ ] Findings documented with screenshots in Slack/Notion
- [ ] Recommendations for Phase 2 work (if needed)
- [ ] Confirmed: Interactive shell is < 200KB gzipped (or create follow-up tickets if not)

#### Implementation Hints

**1. Install:**
```bash
npm install --save-dev rollup-plugin-visualizer
```

**2. Update `vite.config.ts`:**
```typescript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  // ... existing config
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    mode === 'development' && componentTagger(),
    visualizer({ 
      open: true, 
      gzipSize: true,
      filename: 'bundle-analysis.html'
    })
  ].filter(Boolean),
});
```

**3. Run production build:**
```bash
npm run build
# Opens bundle-analysis.html automatically
```

**4. Analyze and document:**
- What's the largest chunk? (should be vendor.js with heavy libs)
- Is Radix UI properly tree-shaken? (should be <100KB total)
- Are maps/charts/video properly code-split? (should be separate chunks)
- What's the "interactive shell" size? (main.js + vendor.js, excluding lazy chunks)

**5. Create follow-up tickets if:**
- Interactive shell >200KB gzipped
- Radix UI >100KB in main bundle
- Any single lazy chunk >500KB

#### Definition of Done
- [ ] Bundle analysis report generated
- [ ] Findings documented with:
  - Screenshot of bundle treemap
  - Top 10 largest chunks and their sizes
  - Recommendations for optimization (if any)
- [ ] Team reviewed findings in standup
- [ ] Phase 2 tickets created (if optimizations needed)

#### Dependencies
None

---

## Phase 2 Tickets

### PERF-006: Add Missing Database Indexes

**Priority:** 🟢 Medium  
**Estimate:** 3 hours  
**Assignee:** Backend/Database  

#### Description
Add composite indexes for new tracking tables (`ticket_detail_views`, `profile_visits`) to support efficient queries in feed ranking function.

**Reference:** [Audit Section 1](./PERFORMANCE_AUDIT_2025-11-09.md#1-database-performance-analysis)

#### Acceptance Criteria
- [ ] Indexes created in production (via migration)
- [ ] Query performance improved (if these tables have data)
- [ ] No impact on existing queries
- [ ] Migration tested on staging first

#### Implementation Hints

**Create migration:**
```bash
supabase migration new add_tracking_table_indexes
```

**Migration SQL:**
```sql
-- supabase/migrations/YYYYMMDD_add_tracking_table_indexes.sql

-- Composite index for user journey queries
CREATE INDEX IF NOT EXISTS idx_ticket_detail_views_user_event_recent
  ON public.ticket_detail_views(user_id, event_id, viewed_at DESC)
  WHERE user_id IS NOT NULL;

-- Composite index for profile visit patterns
CREATE INDEX IF NOT EXISTS idx_profile_visits_visitor_visited_recent
  ON public.profile_visits(visitor_id, visited_user_id, visited_at DESC)
  WHERE visitor_id IS NOT NULL;

-- Enhanced event impressions index (covers more query patterns)
CREATE INDEX IF NOT EXISTS idx_event_impressions_user_dwell_session
  ON events.event_impressions(user_id, event_id, session_id, created_at DESC)
  WHERE dwell_ms >= 10000 AND completed = true;

-- Analyze tables to update query planner stats
ANALYZE public.ticket_detail_views;
ANALYZE public.profile_visits;
ANALYZE events.event_impressions;

COMMENT ON INDEX idx_ticket_detail_views_user_event_recent IS 
  'Supports feed ranking queries for user purchase intent signals';
COMMENT ON INDEX idx_profile_visits_visitor_visited_recent IS 
  'Supports feed ranking queries for organizer affinity signals';
```

#### Definition of Done
- [ ] Migration created and tested on staging
- [ ] Applied to production with no errors
- [ ] Query times verified (check Supabase logs for queries using these tables)
- [ ] No impact on write performance (these are low-volume tables)

#### Dependencies
None (these tables exist from migration 20251102000002)

---

### PERF-007: Implement Batch Impression Logging

**Priority:** 🟢 Medium  
**Estimate:** 6 hours  
**Assignee:** Backend  

#### Description
Reduce impression logging from 2-3 client requests per flush to 1 unified endpoint. Choose between Postgres function or Edge Function based on team preference.

**Reference:** [Audit Section 3](./PERFORMANCE_AUDIT_2025-11-09.md#3-network--api-performance)

#### Acceptance Criteria
- [ ] Single endpoint for event + post impressions
- [ ] Roundtrip count reduced from 2-3 to 1
- [ ] No data loss (all impressions logged correctly)
- [ ] Performance improved: <50ms response time
- [ ] Decision documented: why Postgres function OR Edge function

#### Implementation Hints

**Option A: Postgres Function** (recommended if latency critical)
```sql
-- supabase/migrations/YYYYMMDD_batch_impression_logging.sql
CREATE FUNCTION log_bulk_impressions(
  p_event_impressions jsonb,
  p_post_impressions jsonb
) 
RETURNS jsonb
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Insert event impressions
  INSERT INTO events.event_impressions (
    user_id, session_id, event_id, dwell_ms, completed, created_at
  )
  SELECT 
    (value->>'user_id')::uuid,
    value->>'session_id',
    (value->>'event_id')::uuid,
    (value->>'dwell_ms')::integer,
    (value->>'completed')::boolean,
    now()
  FROM jsonb_array_elements(p_event_impressions);
  
  -- Insert post impressions
  INSERT INTO events.post_impressions (
    user_id, session_id, post_id, event_id, dwell_ms, completed, created_at
  )
  SELECT 
    (value->>'user_id')::uuid,
    value->>'session_id',
    (value->>'post_id')::uuid,
    (value->>'event_id')::uuid,
    (value->>'dwell_ms')::integer,
    (value->>'completed')::boolean,
    now()
  FROM jsonb_array_elements(p_post_impressions);
  
  RETURN jsonb_build_object(
    'success', true,
    'event_count', jsonb_array_length(p_event_impressions),
    'post_count', jsonb_array_length(p_post_impressions)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_bulk_impressions TO authenticated, anon;
```

**Client update:**
```typescript
// src/hooks/useImpressionTracker.ts
const flushBatch = async () => {
  const batch = queueRef.current.splice(0);
  if (batch.length === 0) return;
  
  const eventImpressions = batch.filter(i => i.__t === 'event');
  const postImpressions = batch.filter(i => i.__t === 'post');
  
  // Single RPC call instead of 2-3
  const { data, error } = await supabase.rpc('log_bulk_impressions', {
    p_event_impressions: eventImpressions,
    p_post_impressions: postImpressions
  });
  
  if (error) {
    console.error('Failed to log impressions:', error);
    // Re-queue on failure
    queueRef.current.push(...batch);
  }
};
```

**Option B: Edge Function** (more flexible)
```typescript
// supabase/functions/log-impressions/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { eventImpressions, postImpressions } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const results = await Promise.allSettled([
    eventImpressions.length > 0 && supabase
      .from('event_impressions')
      .insert(eventImpressions),
    postImpressions.length > 0 && supabase
      .from('post_impressions')
      .insert(postImpressions)
  ]);
  
  return new Response(
    JSON.stringify({ 
      success: results.every(r => r.status === 'fulfilled'),
      eventCount: eventImpressions.length,
      postCount: postImpressions.length
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

#### Definition of Done
- [ ] Implementation deployed (Postgres function OR Edge function)
- [ ] Client updated to use new endpoint
- [ ] Roundtrip count verified in Network tab (1 request instead of 2-3)
- [ ] Response time <50ms (P95)
- [ ] All impressions logged correctly (spot-check 100 impressions)

#### Dependencies
None

---

### PERF-008: Add HTTP Caching Headers

**Priority:** 🟢 Medium  
**Estimate:** 4 hours  
**Assignee:** Backend/DevOps  

#### Description
Add Cache-Control headers to JSON API responses and ETags for conditional requests. Focus on feed endpoint and frequently-accessed APIs.

**Reference:** [Audit Section 11](./PERFORMANCE_AUDIT_2025-11-09.md#11-http-caching--cdn-strategy)

#### Acceptance Criteria
- [ ] Feed endpoint has `Cache-Control: public, max-age=15, stale-while-revalidate=30`
- [ ] ETag support for feed responses (304 Not Modified on cache hit)
- [ ] Image responses have 24h cache headers
- [ ] Response time improved by 200-300ms on repeat visits (with cache hit)

#### Implementation Hints

**1. Update Edge Function (home-feed):**
```typescript
// supabase/functions/home-feed/index.ts
const handler = async (req: Request) => {
  // ... existing feed logic
  
  // Generate ETag from content hash
  const responseData = { items, nextCursor, totalItems };
  const etag = `"${hashCode(JSON.stringify(responseData))}"`;
  
  // Check If-None-Match
  const clientEtag = req.headers.get('If-None-Match');
  if (clientEtag === etag) {
    return new Response(null, { 
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
      }
    });
  }
  
  return new Response(JSON.stringify(responseData), {
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
      'X-Query-Duration-Ms': duration.toString()
    }
  });
};

// Simple hash function
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
```

**2. Update client to send If-None-Match:**
```typescript
// src/hooks/useUnifiedFeedInfinite.ts
const { data, error } = await supabase.functions.invoke('home-feed', {
  body: { limit, cursor, filters },
  headers: {
    'If-None-Match': lastEtag // Store from previous response
  }
});

// Store ETag for next request
if (data && data.etag) {
  sessionStorage.setItem('feed-etag', data.etag);
}
```

**3. Verify caching:**
```bash
# First request
curl -I https://your-domain.com/functions/v1/home-feed

# Should see:
# Cache-Control: public, max-age=15, stale-while-revalidate=30
# ETag: "abc123"

# Second request with ETag
curl -I -H 'If-None-Match: "abc123"' https://your-domain.com/functions/v1/home-feed

# Should see:
# HTTP/1.1 304 Not Modified
```

#### Definition of Done
- [ ] Feed endpoint returns Cache-Control and ETag headers
- [ ] Client sends If-None-Match on subsequent requests
- [ ] 304 Not Modified responses verified in Network tab
- [ ] Response time 200-300ms faster on cache hits
- [ ] No stale data issues (cache invalidates after 15s)

#### Dependencies
None

---

### PERF-009: Add Skeleton Loaders to Key Pages

**Priority:** 🟢 Medium  
**Estimate:** 6 hours  
**Assignee:** Frontend  

#### Description
Replace spinners with skeleton loaders that match the actual layout. Improves perceived performance by 20-30% even if actual load time is unchanged.

**Reference:** [Audit Section 10](./PERFORMANCE_AUDIT_2025-11-09.md#10-perceived-performance--ux)

#### Acceptance Criteria
- [ ] Feed items show skeleton while loading next page
- [ ] Dashboard analytics cards show skeleton
- [ ] Event details page shows skeleton
- [ ] User profile shows skeleton
- [ ] Skeletons match actual content layout (same height, similar structure)

#### Implementation Hints

**1. Create reusable skeleton components:**
```typescript
// src/components/ui/skeleton.tsx (if not exists)
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// Feed card skeleton
export function FeedCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex space-x-4">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}
```

**2. Use in feed:**
```typescript
// src/features/feed/components/UnifiedFeedList.tsx
{isLoading && (
  <>
    <FeedCardSkeleton />
    <FeedCardSkeleton />
    <FeedCardSkeleton />
  </>
)}

{!isLoading && items.map(item => (
  <FeedCard key={item.id} item={item} />
))}
```

**3. Dashboard skeletons:**
```typescript
// src/components/OrganizerDashboard.tsx
{loading ? (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="border rounded-lg p-6 space-y-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-24" />
    </div>
    {/* Repeat for each stat card */}
  </div>
) : (
  <StatsGrid analytics={eventAnalytics} />
)}
```

#### Definition of Done
- [ ] Skeletons added to 4 key pages (feed, dashboard, event details, profile)
- [ ] Visual QA: skeletons match layout (no layout shift when content loads)
- [ ] Loading feels faster (subjective user testing with 5 people)
- [ ] Accessibility: skeletons have `aria-busy="true"` and `aria-label="Loading..."`

#### Dependencies
None

---

### PERF-010: Add Feed SQL Performance SLO Monitoring

**Priority:** 🟢 Medium  
**Estimate:** 3 hours  
**Assignee:** Backend/DevOps  

#### Description
Add explicit SLO monitoring for `get_home_feed_ranked` function to ensure it stays performant. Alert if P95 exceeds 500ms for 5+ minutes.

**Reference:** [Audit Section 5](./PERFORMANCE_AUDIT_2025-11-09.md#5-database-function-performance)

#### Acceptance Criteria
- [ ] Feed query duration logged in Edge Function
- [ ] Slow queries (>500ms) logged with parameters
- [ ] Alert configured (Slack/email) if P95 > 500ms for 5+ min
- [ ] PostHog dashboard shows feed query performance over time

#### Implementation Hints

**1. Enhanced logging in Edge Function:**
```typescript
// supabase/functions/home-feed/index.ts
const startTime = Date.now();
const { data, error } = await supabase.rpc('get_home_feed_ranked', rpcArgs);
const duration = Date.now() - startTime;

// Log slow queries with context
if (duration > 500) {
  console.warn('Slow feed query detected', {
    duration,
    params: {
      userId: rpcArgs.p_user_id,
      limit: rpcArgs.p_limit,
      categories: rpcArgs.p_categories,
      hasLocation: !!rpcArgs.p_user_lat,
      hasFilters: !!rpcArgs.p_date_filters
    },
    itemCount: data?.length
  });
}

// Send to PostHog for aggregation
analytics.track('feed_query_performance', {
  duration,
  itemCount: data?.length,
  userId: rpcArgs.p_user_id || 'anonymous',
  hasFilters: !!(rpcArgs.p_categories || rpcArgs.p_date_filters)
});

// Add to response headers for client visibility
headers.set('X-Query-Duration-Ms', duration.toString());
```

**2. PostHog Insights Dashboard:**
- Create insight: "Feed Query Performance (P95)"
- Filter: `feed_query_performance` events
- Aggregation: P95 of `duration` property
- Breakdown by: `hasFilters` (true/false)
- Alert threshold: P95 > 500ms for 5 minutes

**3. Slack/Email Alert (if using PostHog webhooks or other tool):**
```yaml
# Example: If using Supabase Edge Functions for monitoring
# supabase/functions/monitor-feed-performance/index.ts
// Query slow logs from past 5 minutes
// If P95 > 500ms, send Slack webhook
// Include link to PostHog dashboard for investigation
```

**4. Runbook for when alert fires:**
```markdown
## Feed Query Slow Alert Runbook

1. Check PostHog dashboard: Which filters are causing slowness?
2. Check Supabase logs: Any specific user patterns?
3. Run EXPLAIN ANALYZE on affected query pattern
4. Check `pg_stat_statements` for CTE costs
5. Consider:
   - Materialized views for expensive aggregations
   - Redis cache layer (15-30s TTL)
   - Query parameter optimization
6. Escalate to backend lead if unexplained
```

#### Definition of Done
- [ ] Logging implemented in Edge Function
- [ ] PostHog dashboard created showing P95 feed query time
- [ ] Alert configured (Slack/email when threshold breached)
- [ ] Runbook documented in wiki/Notion
- [ ] Team trained on how to respond to alert

#### Dependencies
- PERF-001 (uses same PostHog infrastructure)

---

## Summary

**Phase 1 Total:** ~17 hours (1-2 days with 2 engineers)  
**Phase 2 Total:** ~22 hours (3-5 days)  

**Critical Path:**
1. PERF-001 (measurement) → blocks all others for validation
2. PERF-002 (N+1 queries) + PERF-003 (real-time churn) → biggest impact
3. PERF-004 (font) + PERF-005 (bundle viz) → quick wins
4. Phase 2 tickets → only if Phase 1 shows need

**Expected Overall Impact:**
- Dashboard: 20-30% faster
- Feed: 15-20% faster
- Mobile battery: 40-60% better
- Perceived performance: Significantly improved

**Success Metrics (from PERF-001):**
- Baseline established in first 48 hours
- Improvements validated within 1 week
- Targets hit: Dashboard <800ms, Feed <300ms, Churn <1/min


