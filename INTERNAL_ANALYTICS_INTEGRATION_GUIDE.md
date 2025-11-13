-- # 🔌 Internal Analytics Integration Guide

## How to Track Events Throughout Your App

---

## 📍 Where to Add Tracking

### 1. **Page Views** (Automatic)

**File:** `src/App.tsx` or `src/components/AnalyticsWrapper.tsx`

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/internalAnalyticsTracker';

export function AnalyticsWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  useEffect(() => {
    // Track page view on route change
    trackPageView({
      path: location.pathname,
      title: document.title
    });
  }, [location.pathname]);
  
  return <>{children}</>;
}
```

---

### 2. **Event Views** (Feed & Cards)

**File:** `src/components/feed/EventCard.tsx`

```typescript
import { trackEventView, trackEventImpression } from '@/lib/internalAnalyticsTracker';

// When event card appears in feed
useEffect(() => {
  if (isVisible) {
    trackEventImpression(event.id, {
      position: index,  // Position in feed
      source: 'feed'
    });
  }
}, [isVisible, event.id]);

// When user clicks on event
const handleEventClick = () => {
  trackEventView(event.id, {
    source: 'feed_card',
    position: index
  });
  
  navigate(`/e/${event.slug}`);
};
```

---

### 3. **Ticket CTA Clicks**

**File:** `src/components/EventDetail.tsx` or `TicketPurchaseModal.tsx`

```typescript
import { trackTicketCTA } from '@/lib/internalAnalyticsTracker';

const handleGetTicketsClick = () => {
  trackTicketCTA(event.id, event.owner_context_id, {
    tier_id: selectedTier?.id,
    tier_name: selectedTier?.name,
    price_cents: selectedTier?.price_cents,
    source: 'event_detail'
  });
  
  setModalOpen(true);
};
```

---

### 4. **Checkout Events**

**File:** `src/components/CheckoutFlow.tsx` or `TicketPurchaseModal.tsx`

```typescript
import { trackCheckoutStarted, trackPurchase } from '@/lib/internalAnalyticsTracker';

// When user clicks "Checkout" or "Buy Now"
const handleCheckoutStart = () => {
  trackCheckoutStarted(event.id, {
    tier_ids: selectedTiers.map(t => t.id),
    total_cents: calculateTotal(),
    quantity: totalQuantity
  });
  
  // Proceed to Stripe...
};

// After successful payment
const handlePaymentSuccess = (orderId: string, totalCents: number) => {
  trackPurchase(event.id, orderId, totalCents, {
    payment_method: 'stripe',
    tier_count: selectedTiers.length
  });
  
  navigate(`/tickets/success?order=${orderId}`);
};
```

---

### 5. **Post Interactions**

**File:** `src/components/feed/PostCard.tsx` or `VideoMedia.tsx`

```typescript
import { trackPostView, trackPostClick } from '@/lib/internalAnalyticsTracker';

// When post appears in feed
useEffect(() => {
  if (isVisible && !hasTrackedView) {
    trackPostView(post.id, post.event_id, {
      media_type: post.type,
      position: index,
      source: 'feed'
    });
    setHasTrackedView(true);
  }
}, [isVisible]);

// When user clicks on post elements
const handleTicketsClick = () => {
  trackPostClick(post.id, post.event_id, 'tickets', {
    source: 'post_overlay'
  });
  
  navigate(`/e/${eventSlug}#tickets`);
};

const handleCommentClick = () => {
  trackPostClick(post.id, post.event_id, 'comment');
  setShowComments(true);
};
```

---

### 6. **Identity Promotion** (User Login)

**File:** `src/components/auth/AuthExperience.tsx` or `SmartAuthModal.tsx`

```typescript
import { getSessionId, getAnonId } from '@/lib/internalAnalyticsTracker';
import { supabase } from '@/integrations/supabase/client';

// After successful login
const handleLoginSuccess = async (user: User) => {
  const sessionId = getSessionId();
  const anonId = getAnonId();
  
  // Promote anonymous identity to link pre-login events
  await supabase.rpc('analytics.promote_anonymous_identity', {
    p_session_id: sessionId,
    p_anon_id: anonId,
    p_user_id: user.id
  }).catch(err => {
    console.warn('Identity promotion failed:', err);
  });
  
  // Continue with normal login flow...
};
```

---

## 📊 Tracking Events Reference

### Standard Event Names

Use these standardized event names for consistency:

| Event Name | When to Track | Required Props |
|------------|---------------|----------------|
| `page_view` | Every route change | `path`, `title` |
| `event_impression` | Event card appears in feed | `event_id`, `position` |
| `event_view` | User clicks on event | `event_id`, `source` |
| `ticket_cta_click` | "Get Tickets" clicked | `event_id`, `tier_id` |
| `checkout_started` | Checkout initiated | `event_id`, `total_cents` |
| `purchase` | Payment completed | `event_id`, `order_id`, `total_cents` |
| `post_view` | Post appears in feed | `post_id`, `event_id` |
| `post_click` | Post element clicked | `post_id`, `target` |
| `share_generated` | Share button clicked | `event_id`, `method` |
| `qr_code_viewed` | QR code modal opened | `event_id` or `ticket_id` |

---

## 🎛️ Props Schema

### Common Props Structure

```typescript
interface EventProps {
  // Navigation context
  source?: 'feed' | 'search' | 'profile' | 'direct' | 'share';
  position?: number;  // Position in list/feed
  
  // Event context
  tier_id?: string;
  tier_name?: string;
  price_cents?: number;
  quantity?: number;
  
  // Order context
  order_id?: string;
  total_cents?: number;
  payment_method?: string;
  
  // Content context
  media_type?: 'text' | 'image' | 'video';
  target?: 'tickets' | 'details' | 'organizer' | 'share' | 'comment';
  
  // Custom
  [key: string]: any;
}
```

---

## 🔗 Integration Points

### Critical Integration Locations

1. **App Initialization** (`src/main.tsx`):
   - Initialize session tracking
   - Set up identity resolution

2. **Router** (`src/App.tsx`):
   - Track page views on navigation
   - Parse and persist UTM parameters

3. **Auth Flow** (`src/components/auth/`):
   - Promote identity on login
   - Track auth events

4. **Feed** (`src/components/MainFeed.tsx`):
   - Track impressions as cards scroll into view
   - Track clicks on cards

5. **Event Details** (`src/pages/EventsPage.tsx`):
   - Track event views
   - Track ticket CTA clicks

6. **Checkout** (`src/components/TicketPurchaseModal.tsx`):
   - Track checkout start
   - Track purchase completion

7. **Posts** (`src/components/feed/`):
   - Track post views
   - Track post interactions

---

## 🚦 Migration Strategy

### Phase 1: Dual Tracking (Week 1)
Send to both PostHog AND internal database:

```typescript
import { trackPageView } from '@/lib/internalAnalyticsTracker';
import { useAnalytics } from '@/hooks/useAnalytics';

const { track: trackPostHog } = useAnalytics();

// Send to both
trackPostHog('page_view', props);
trackPageView(props);
```

### Phase 2: Internal Only (Week 2+)
Remove PostHog calls, keep only internal:

```typescript
import { trackPageView } from '@/lib/internalAnalyticsTracker';

// Internal only
trackPageView(props);
```

---

## 🎯 UTM Tracking Best Practices

### Automatic UTM Capture

```typescript
// In src/App.tsx or AnalyticsWrapper.tsx
import { parseUTM } from '@/lib/internalAnalyticsTracker';

useEffect(() => {
  const utm = parseUTM();
  
  // Store first-touch UTM
  if (Object.keys(utm).length > 0 && !sessionStorage.getItem('utm_first_touch')) {
    sessionStorage.setItem('utm_first_touch', JSON.stringify(utm));
  }
  
  // Always store last-touch UTM
  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem('utm_last_touch', JSON.stringify(utm));
  }
}, [location.search]);
```

### Include UTM in Tracking

```typescript
// All events automatically include UTM from URL
// Parsed in trackInternalEvent() helper
trackEventView(eventId);  // ✅ UTM auto-captured

// Or manually override:
trackEventView(eventId, {
  utm_override: {
    source: 'email',
    campaign: 'spring_2025'
  }
});
```

---

## 📈 Revenue Attribution

### Proper Purchase Tracking

```typescript
// After Stripe confirms payment
const handleStripeSuccess = async (session: Stripe.Checkout.Session) => {
  const orderId = session.metadata.order_id;
  
  // 1. Create order in database
  const { data: order } = await supabase
    .from('ticketing.orders')
    .insert({
      user_id: user.id,
      event_id: eventId,
      total_cents: session.amount_total,
      status: 'paid'
    })
    .select()
    .single();
  
  // 2. Track purchase event (links to analytics.events)
  await trackPurchase(eventId, order.id, order.total_cents, {
    payment_method: 'stripe',
    stripe_session_id: session.id
  });
  
  // 3. Also call conversion attribution for ad tracking
  await supabase.rpc('attribute_conversion', {
    p_user_id: user.id,
    p_session_id: getSessionId(),
    p_kind: 'purchase',
    p_value_cents: order.total_cents,
    p_ticket_id: null,
    p_conversion_source: 'checkout'
  });
};
```

---

## 🧪 Testing Your Integration

### Test in Browser Console

```javascript
// Import tracker (if exposed globally)
import { trackEventView } from '@/lib/internalAnalyticsTracker';

// Track test event
trackEventView('test-event-id', {
  source: 'console_test',
  test: true
});

// Check it was inserted
supabase
  .from('analytics.events')
  .select('*')
  .order('ts', { ascending: false })
  .limit(5)
  .then(({ data }) => console.log('Recent events:', data));
```

### Verify Data Flow

```sql
-- In Supabase SQL Editor
-- Check recent events
SELECT 
  event_name,
  COUNT(*) AS count,
  MAX(ts) AS latest
FROM analytics.events
WHERE ts >= NOW() - INTERVAL '1 hour'
GROUP BY event_name
ORDER BY count DESC;

-- Check funnel progression for a session
SELECT 
  session_id,
  event_name,
  ts,
  event_id,
  props
FROM analytics.events
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY ts;
```

---

## ⚡ Performance Tips

### 1. Batch Events on High-Traffic Pages

```typescript
import { trackInternalEventBatched } from '@/lib/internalAnalyticsTracker';

// On scroll events (debounced)
const handleScroll = debounce(() => {
  trackInternalEventBatched({
    eventName: 'scroll',
    props: { depth: scrollDepth }
  });
}, 1000);
```

### 2. Use Impressions Wisely

```typescript
// Track once per session, not every render
const hasTracked = useRef(false);

useEffect(() => {
  if (isVisible && !hasTracked.current) {
    trackEventImpression(event.id);
    hasTracked.current = true;
  }
}, [isVisible]);
```

### 3. Async Fire-and-Forget

```typescript
// Don't await tracking calls in user flows
const handleClick = () => {
  trackTicketCTA(eventId);  // ✅ Don't await
  navigate('/checkout');     // ✅ User flow continues immediately
};
```

---

## 🔐 Privacy & Compliance

### Respect Do Not Track

```typescript
import { trackPageView } from '@/lib/internalAnalyticsTracker';

// Check DNT header
const respectDNT = () => {
  const dnt = navigator.doNotTrack || 
              (window as any).doNotTrack || 
              (navigator as any).msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
};

// Conditional tracking
if (!respectDNT()) {
  trackPageView();
}
```

### PII Minimization

```typescript
// ❌ Don't include PII in props
trackPurchase(eventId, orderId, totalCents, {
  user_email: 'user@example.com'  // ❌ NO
});

// ✅ Use IDs only
trackPurchase(eventId, orderId, totalCents, {
  user_id: userId  // ✅ YES (already in separate column)
});
```

---

## 📊 Dashboard Integration

### Using the New Hook

```typescript
import { useInternalAudienceAnalytics } from '@/hooks/useInternalAudienceAnalytics';

export function AudienceDashboard({ orgId }: { orgId: string }) {
  const { data, loading, error, fetchAnalytics } = useInternalAudienceAnalytics();
  
  useEffect(() => {
    fetchAnalytics({
      orgId,
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
      useCache: true
    });
  }, [orgId]);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  
  return (
    <div>
      {data?.funnel_steps.map(step => (
        <FunnelStepCard key={step.stage} step={step} />
      ))}
    </div>
  );
}
```

---

## 🎨 Advanced Features

### Leaky Step Analysis

```typescript
import { useLeakyStepsAnalysis } from '@/hooks/useInternalAudienceAnalytics';

export function LeakyStepsPanel({ orgId }: { orgId: string }) {
  const { data, loading, fetchLeakySteps } = useLeakyStepsAnalysis();
  
  useEffect(() => {
    fetchLeakySteps(
      orgId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );
  }, [orgId]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drop-Off Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {data?.map((leak: any) => (
          <div key={leak.step} className="mb-4">
            <div className="font-semibold">{leak.step}</div>
            <div className="text-sm text-muted-foreground">
              {leak.drop_users} users dropped
            </div>
            <div className="text-xs">
              Causes: {leak.top_causes.join(', ')}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### Creative Diagnostics

```typescript
import { useCreativeDiagnostics } from '@/hooks/useInternalAudienceAnalytics';

export function EventPerformanceInsights({ orgId }: { orgId: string }) {
  const { data, loading, fetchDiagnostics } = useCreativeDiagnostics();
  
  useEffect(() => {
    fetchDiagnostics(orgId, from, to);
  }, [orgId]);
  
  return (
    <div className="space-y-4">
      {data?.map((event: any) => (
        <Card key={event.event_id}>
          <CardContent className="pt-6">
            <h4 className="font-semibold">{event.title}</h4>
            <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
              <div>
                <div className="text-muted-foreground">Impressions</div>
                <div className="font-bold">{event.impressions}</div>
              </div>
              <div>
                <div className="text-muted-foreground">CTR</div>
                <div className="font-bold">{event.ctr}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Media</div>
                <div className="font-bold">{event.media_count}</div>
              </div>
            </div>
            {event.recommendation !== 'Performing well' && (
              <Alert className="mt-3">
                <AlertDescription>
                  💡 {event.recommendation}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## 🔄 Gradual Rollout

### Feature Flag Usage

```typescript
import { isFeatureEnabled } from '@/lib/featureFlags';

// In AnalyticsHub or Dashboard component
const useInternalAnalytics = isFeatureEnabled('useInternalAudienceAnalytics');

const fetchData = async () => {
  if (useInternalAnalytics) {
    // Use new internal system
    const { data } = await supabase.rpc('get_audience_funnel_cached', {...});
  } else {
    // Fallback to PostHog
    const { data } = await supabase.functions.invoke('analytics-posthog-funnel', {...});
  }
};
```

### Admin Toggle Panel

```typescript
import { getAllFlags, setFeatureFlag } from '@/lib/featureFlags';

export function FeatureFlagPanel() {
  const [flags, setFlags] = useState(getAllFlags());
  
  const toggle = (key: keyof FeatureFlags) => {
    setFeatureFlag(key, !flags[key]);
    setFlags(getAllFlags());
  };
  
  return (
    <div>
      {Object.entries(flags).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between p-2">
          <span>{key}</span>
          <Switch checked={value} onCheckedChange={() => toggle(key as any)} />
        </div>
      ))}
    </div>
  );
}
```

---

## 📦 Complete Integration Checklist

### Backend ✅
- [ ] Migrations deployed
- [ ] Tables created
- [ ] RPC functions working
- [ ] Materialized views populated
- [ ] Audit logging active

### Tracking ✅
- [ ] Page views tracked on navigation
- [ ] Event impressions tracked in feed
- [ ] Event views tracked on clicks
- [ ] Ticket CTA clicks tracked
- [ ] Checkout events tracked
- [ ] Purchase events tracked
- [ ] Post interactions tracked
- [ ] Identity promotion on login

### Dashboard ✅
- [ ] Analytics Hub updated
- [ ] Audience tab uses internal RPC
- [ ] Funnel displays correctly
- [ ] Channels display correctly
- [ ] Devices display correctly
- [ ] Export functions work
- [ ] No PostHog errors in console

### Performance ✅
- [ ] Queries complete in <200ms
- [ ] Cached queries in <50ms
- [ ] No database timeouts
- [ ] MVs refresh successfully

### Quality ✅
- [ ] Bot traffic filtered
- [ ] Internal traffic excluded
- [ ] Revenue reconciles with orders
- [ ] Conversion counts match tickets
- [ ] No duplicate events

---

## 🎉 Success Metrics

After full integration, you should see:

- ✅ **100% data ownership** - All analytics in your database
- ✅ **Real-time insights** - No external API delays
- ✅ **Revenue accuracy** - Tied to actual orders & refunds
- ✅ **Fast dashboards** - Sub-200ms query times
- ✅ **Zero external costs** - No PostHog fees
- ✅ **Full attribution** - Pre-login to purchase journey
- ✅ **Actionable insights** - Leaky steps, creative diagnostics
- ✅ **Privacy compliant** - Full control over data

---

**Ready to integrate? Start tracking events! 📊**

