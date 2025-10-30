# 🧪 Conversion Tracking Testing Guide

## End-to-End Test Scenarios

### Scenario 1: Last-Click Attribution (7-Day Window)

**Steps:**
1. View a promoted ad in feed (impression logged)
2. Click the ad CTA (click logged)
3. Within 7 days, purchase a ticket
4. Verify conversion attribution

**Expected Result:**
```json
{
  "success": true,
  "conversionId": "...",
  "attributionModel": "last_click_7d",
  "clickId": "...",
  "impressionId": "..."
}
```

**Verification Query:**
```sql
SELECT 
  conv.id,
  conv.attribution_model,
  conv.value_cents,
  clk.created_at AS click_time,
  conv.occurred_at AS conversion_time,
  EXTRACT(EPOCH FROM (conv.occurred_at - clk.created_at))/3600 AS hours_since_click
FROM campaigns.ad_conversions conv
JOIN campaigns.ad_clicks clk ON clk.id = conv.click_id
ORDER BY conv.created_at DESC
LIMIT 1;
```

---

### Scenario 2: View-Through Attribution (1-Day Window)

**Steps:**
1. View a promoted ad in feed for 2+ seconds (viewable impression)
2. DO NOT click the ad
3. Within 24 hours, purchase a ticket
4. Verify conversion attribution

**Expected Result:**
```json
{
  "success": true,
  "conversionId": "...",
  "attributionModel": "view_through_1d",
  "clickId": null,
  "impressionId": "..."
}
```

**Verification Query:**
```sql
SELECT 
  conv.id,
  conv.attribution_model,
  conv.value_cents,
  imp.created_at AS impression_time,
  imp.viewable,
  imp.dwell_ms,
  conv.occurred_at AS conversion_time,
  EXTRACT(EPOCH FROM (conv.occurred_at - imp.created_at))/3600 AS hours_since_view
FROM campaigns.ad_conversions conv
JOIN campaigns.ad_impressions imp ON imp.id = conv.impression_id
WHERE conv.click_id IS NULL
ORDER BY conv.created_at DESC
LIMIT 1;
```

---

### Scenario 3: No Attribution (Outside Window)

**Steps:**
1. Click an ad
2. Wait 8+ days
3. Purchase a ticket
4. Verify NO attribution

**Expected Result:**
```json
{
  "success": false,
  "conversionId": null,
  "attributionModel": null,
  "clickId": null,
  "impressionId": null
}
```

---

### Scenario 4: Deduplication (Idempotency)

**Steps:**
1. Complete a ticket purchase (conversion tracked)
2. Retry the same conversion with same `request_id`
3. Verify only ONE conversion logged

**Test Code:**
```typescript
const requestId = crypto.randomUUID();

// First attempt
const result1 = await supabase.rpc('attribute_conversion', {
  p_user_id: userId,
  p_session_id: sessionId,
  p_kind: 'purchase',
  p_value_cents: 2500,
  p_ticket_id: ticketId,
  p_request_id: requestId, // Same request_id
});

// Duplicate attempt (network retry)
const result2 = await supabase.rpc('attribute_conversion', {
  p_user_id: userId,
  p_session_id: sessionId,
  p_kind: 'purchase',
  p_value_cents: 2500,
  p_ticket_id: ticketId,
  p_request_id: requestId, // Same request_id
});

console.log('First result:', result1.data);
console.log('Second result:', result2.data); // Should be null or same ID
```

**Verification Query:**
```sql
SELECT COUNT(*) AS conversion_count
FROM campaigns.ad_conversions
WHERE ticket_id = '<ticket_id>';

-- Should return 1, not 2
```

---

### Scenario 5: Multi-Touch Priority (Click > View)

**Steps:**
1. View an ad (impression logged)
2. Click the ad 3 hours later (click logged)
3. Purchase ticket same day
4. Verify click attribution (not view)

**Expected Result:**
```json
{
  "attributionModel": "last_click_7d", // ← Click wins over view
  "clickId": "...",
  "impressionId": "..."
}
```

---

### Scenario 6: Cross-Session Attribution

**Steps:**
1. View/click ad on mobile browser (session A)
2. Close browser (session ends)
3. Return 2 days later on same device (session B)
4. Purchase ticket as authenticated user
5. Verify attribution via `user_id`

**Expected Result:**
Attribution should work because both sessions have the same `user_id`.

**Note:** For guest users, attribution only works within the same session (sessionStorage).

---

## Automated Test Suite

```typescript
// tests/conversionTracking.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { trackConversion, getOrCreateSessionId } from '@/lib/conversionTracking';
import { supabase } from '@/lib/supabaseClient';

describe('Conversion Tracking', () => {
  let testUserId: string;
  let testSessionId: string;
  let testCampaignId: string;

  beforeEach(async () => {
    testSessionId = crypto.randomUUID();
    
    // Create test user
    const { data: user } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'test123'
    });
    testUserId = user.user!.id;
    
    // Create test campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .insert({ name: 'Test Campaign', org_id: '...' })
      .select()
      .single();
    testCampaignId = campaign.id;
  });

  it('should track last-click attribution', async () => {
    // 1. Log impression
    await supabase.rpc('log_impression_and_charge', {
      p_campaign_id: testCampaignId,
      p_user_id: testUserId,
      p_session_id: testSessionId,
      // ... other params
    });

    // 2. Log click
    const { data: click } = await supabase.rpc('log_click_and_charge', {
      p_campaign_id: testCampaignId,
      p_user_id: testUserId,
      p_session_id: testSessionId,
      // ... other params
    });

    // 3. Track conversion
    const result = await trackConversion({
      userId: testUserId,
      sessionId: testSessionId,
      kind: 'purchase',
      valueCents: 2500,
      source: 'checkout'
    });

    expect(result.success).toBe(true);
    expect(result.attributionModel).toBe('last_click_7d');
    expect(result.clickId).toBeTruthy();
  });

  it('should track view-through attribution', async () => {
    // 1. Log viewable impression (no click)
    await supabase.rpc('log_impression_and_charge', {
      p_campaign_id: testCampaignId,
      p_user_id: testUserId,
      p_session_id: testSessionId,
      p_viewable: true,
      p_dwell_ms: 2000,
      // ... other params
    });

    // 2. Track conversion (no click)
    const result = await trackConversion({
      userId: testUserId,
      sessionId: testSessionId,
      kind: 'purchase',
      valueCents: 2500,
      source: 'checkout'
    });

    expect(result.success).toBe(true);
    expect(result.attributionModel).toBe('view_through_1d');
    expect(result.clickId).toBeNull();
    expect(result.impressionId).toBeTruthy();
  });

  it('should deduplicate conversions', async () => {
    const requestId = crypto.randomUUID();

    // Submit same conversion twice
    const result1 = await trackConversion({
      userId: testUserId,
      sessionId: testSessionId,
      kind: 'purchase',
      valueCents: 2500,
    });

    const result2 = await trackConversion({
      userId: testUserId,
      sessionId: testSessionId,
      kind: 'purchase',
      valueCents: 2500,
    });

    // Check database
    const { count } = await supabase
      .from('ad_conversions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUserId);

    expect(count).toBe(1); // Only one conversion logged
  });

  it('should handle no attribution gracefully', async () => {
    // Track conversion with no prior ad exposure
    const result = await trackConversion({
      userId: testUserId,
      sessionId: crypto.randomUUID(), // Different session
      kind: 'purchase',
      valueCents: 2500,
    });

    // Should not throw error, but return no attribution
    expect(result.success).toBe(false);
    expect(result.attributionModel).toBeNull();
  });
});
```

---

## Performance Testing

### Load Test: 1000 Concurrent Conversions

```typescript
// tests/conversionLoad.test.ts

import { trackConversion } from '@/lib/conversionTracking';

async function loadTest() {
  const promises = [];
  
  for (let i = 0; i < 1000; i++) {
    promises.push(
      trackConversion({
        userId: `user-${i}`,
        sessionId: `session-${i}`,
        kind: 'purchase',
        valueCents: 2500,
        source: 'checkout'
      })
    );
  }
  
  const start = Date.now();
  const results = await Promise.all(promises);
  const duration = Date.now() - start;
  
  console.log(`Processed ${results.length} conversions in ${duration}ms`);
  console.log(`Average: ${duration / results.length}ms per conversion`);
}
```

---

## SQL Health Checks

### 1. Check Attribution Distribution

```sql
SELECT 
  attribution_model,
  COUNT(*) AS count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 1) AS percentage
FROM campaigns.ad_conversions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY attribution_model
ORDER BY count DESC;
```

**Expected Output:**
```
attribution_model  | count | percentage
-------------------+-------+-----------
last_click_7d      |   145 |      72.5
view_through_1d    |    55 |      27.5
```

### 2. Check Conversion Value Totals

```sql
SELECT 
  DATE(occurred_at) AS day,
  COUNT(*) AS conversions,
  SUM(value_cents) / 100.0 AS revenue_dollars,
  AVG(value_cents) / 100.0 AS avg_order_value
FROM campaigns.ad_conversions
WHERE occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(occurred_at)
ORDER BY day DESC;
```

### 3. Check Attribution Latency

```sql
-- How long after ad exposure do conversions happen?
SELECT 
  CASE 
    WHEN attribution_model = 'last_click_7d' THEN
      EXTRACT(EPOCH FROM (conv.occurred_at - clk.created_at)) / 3600
    WHEN attribution_model = 'view_through_1d' THEN
      EXTRACT(EPOCH FROM (conv.occurred_at - imp.created_at)) / 3600
  END AS hours_to_conversion,
  attribution_model
FROM campaigns.ad_conversions conv
LEFT JOIN campaigns.ad_clicks clk ON clk.id = conv.click_id
LEFT JOIN campaigns.ad_impressions imp ON imp.id = conv.impression_id
WHERE conv.created_at >= NOW() - INTERVAL '30 days'
ORDER BY hours_to_conversion;
```

### 4. Verify Deduplication

```sql
-- Check for duplicate conversions (should be 0)
SELECT 
  request_id,
  COUNT(*) AS duplicate_count
FROM campaigns.ad_conversions
WHERE request_id IS NOT NULL
GROUP BY request_id
HAVING COUNT(*) > 1;
```

---

## Dashboard Verification

After conversion tracking is live, verify these metrics appear correctly:

### Campaign Analytics Dashboard

Navigate to: `/campaign-analytics?id=<campaign_id>`

**Check:**
- ✅ Conversions count shows > 0
- ✅ Revenue displays correct $ value
- ✅ ROAS calculates correctly (revenue / spend)
- ✅ CVR shows percentage (conversions / clicks)
- ✅ Attribution pie chart shows click vs view split

---

## Common Issues & Fixes

### Issue: All conversions show `attribution_model: 'none'`

**Cause:** Session ID mismatch between impression/click and conversion

**Fix:**
```typescript
// Ensure you're using the SAME session ID
const sessionId = getOrCreateSessionId();

// Log it for debugging
console.log('Session ID:', sessionId);

// Pass to all tracking calls
logAdImpression({ /* ... */, sessionId });
logAdClick({ /* ... */, sessionId });
trackConversion({ /* ... */, sessionId });
```

### Issue: Conversions counted twice

**Cause:** Missing `request_id` or not handling retries

**Fix:**
```typescript
// Always generate a request_id
const requestId = crypto.randomUUID();

// Store it if you need to retry
sessionStorage.setItem('last_conversion_request', requestId);
```

### Issue: View-through not working

**Cause:** Impressions not marked as viewable

**Fix:**
```typescript
// Ensure impressions meet viewability standards
logAdImpression({
  // ...
  dwellMs: 2000, // ≥ 1000ms required
  pctVisible: 80, // ≥ 50% required
  viewable: true // Must be true for view-through
});
```

---

## Success Criteria

Your conversion tracking is working correctly when:

- ✅ 70-80% of conversions have last-click attribution
- ✅ 20-30% have view-through attribution
- ✅ 0% duplicate conversions (request_id working)
- ✅ ROAS > 1.0 for profitable campaigns
- ✅ Conversion latency < 3 days average
- ✅ Dashboard metrics match SQL queries

---

## Next Steps

Once testing is complete:

1. **Deploy to production**: Apply migrations
2. **Monitor metrics**: Watch for anomalies
3. **Optimize campaigns**: Use ROAS/CPA to allocate budget
4. **A/B test creatives**: Compare CVR across different ads
5. **Scale**: Increase ad spend on high-ROAS campaigns

---

**Questions?** Open the `CONVERSION_TRACKING_INTEGRATION.md` for implementation details.


