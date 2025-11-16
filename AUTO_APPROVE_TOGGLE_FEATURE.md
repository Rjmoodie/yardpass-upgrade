# ⚡ Auto-Approve Toggle Feature

**Feature:** Let organizers enable/disable automatic refund approvals per event  
**Benefit:** Flexibility - some organizers want control, others want automation  
**Time to Add:** +20 minutes to existing plan

---

## 🎯 **How It Works**

### **Default Behavior:**
```
Auto-Approve: OFF (organizer must manually review all requests)
```

### **When Organizer Enables Auto-Approve:**
```
Customer submits refund request
  ↓
System checks auto-approve rules:
  ✅ More than 48h before event
  ✅ No redeemed tickets
  ✅ Order < 30 days old
  ✅ Customer < 3 refunds in 90 days
  ✅ Amount < $500
  ↓
IF all pass → Auto-approve + instant refund ✅
ELSE → Queue for manual review ⚠️
```

**Organizer sees:**
- Most refunds auto-processed (logged in history)
- Only edge cases in "Pending Requests" tab
- Less work, faster customer experience

---

## 🗄️ **Database Changes**

### **Add Column to refund_policies:**

```sql
-- Already updated in migration file:
ALTER TABLE ticketing.refund_policies
ADD COLUMN auto_approve_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ticketing.refund_policies.auto_approve_enabled IS 
  'When true, refund requests meeting safety criteria are auto-approved. When false, all requests require manual organizer review.';
```

---

## 🔧 **Auto-Approve Logic Function**

**File:** `supabase/migrations/20251111000011_auto_approve_logic.sql`

```sql
-- Check if refund request should be auto-approved
CREATE OR REPLACE FUNCTION ticketing.should_auto_approve_refund(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
DECLARE
  v_order RECORD;
  v_event RECORD;
  v_policy RECORD;
  v_recent_refunds INTEGER;
  v_hours_until_event NUMERIC;
  v_redeemed_count INTEGER;
BEGIN
  -- Get order
  SELECT * INTO v_order
  FROM ticketing.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('auto_approve', false, 'reason', 'Order not found');
  END IF;

  -- Get event
  SELECT * INTO v_event
  FROM events.events
  WHERE id = v_order.event_id;

  -- Get refund policy (check if auto-approve is enabled)
  SELECT * INTO v_policy
  FROM ticketing.refund_policies
  WHERE event_id = v_order.event_id;

  -- ✅ CHECK 1: Auto-approve must be enabled for this event
  IF v_policy.auto_approve_enabled IS NULL OR v_policy.auto_approve_enabled = false THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Auto-approve disabled for this event (requires manual review)'
    );
  END IF;

  -- ✅ CHECK 2: No redeemed tickets
  SELECT COUNT(*) INTO v_redeemed_count
  FROM ticketing.tickets
  WHERE order_id = p_order_id
    AND status = 'redeemed';

  IF v_redeemed_count > 0 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Tickets already redeemed - requires manual review'
    );
  END IF;

  -- ✅ CHECK 3: Event is more than 48h away
  v_hours_until_event := EXTRACT(EPOCH FROM (v_event.start_at - now())) / 3600;

  IF v_hours_until_event < 48 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('Event starts in %s hours - requires manual review (auto-approve threshold: 48h)', 
                       ROUND(v_hours_until_event::numeric, 1))
    );
  END IF;

  -- ✅ CHECK 4: Order is recent (< 30 days old)
  IF v_order.created_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Order older than 30 days - requires manual review'
    );
  END IF;

  -- ✅ CHECK 5: Customer refund history (fraud check)
  SELECT COUNT(*) INTO v_recent_refunds
  FROM ticketing.refund_log rl
  JOIN ticketing.orders o ON o.id = rl.order_id
  WHERE o.user_id = p_user_id
    AND rl.processed_at > now() - interval '90 days';

  IF v_recent_refunds >= 3 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('%s recent refunds in 90 days - requires manual review', v_recent_refunds)
    );
  END IF;

  -- ✅ CHECK 6: Order amount is reasonable (< $500)
  IF v_order.total_cents > 50000 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('High value order ($%s) - requires manual review', v_order.total_cents / 100.0)
    );
  END IF;

  -- ✅ ALL CHECKS PASSED - Safe to auto-approve
  RETURN jsonb_build_object(
    'auto_approve', true,
    'reason', 'Meets all auto-approval safety criteria',
    'checks_passed', jsonb_build_object(
      'auto_approve_enabled', true,
      'no_redeemed_tickets', true,
      'hours_until_event', v_hours_until_event,
      'order_age_days', EXTRACT(days FROM now() - v_order.created_at),
      'customer_recent_refunds', v_recent_refunds,
      'order_amount_usd', v_order.total_cents / 100.0
    )
  );
END;
$$;

COMMENT ON FUNCTION ticketing.should_auto_approve_refund IS 
  'Check if refund request meets safety criteria for auto-approval. Returns auto_approve boolean and reason.';

GRANT EXECUTE ON FUNCTION ticketing.should_auto_approve_refund TO authenticated, service_role;
```

---

## 🎨 **Organizer UI: Auto-Approve Toggle**

### **Location: Event Settings or Refunds Dashboard**

**Option A: In Event Settings** (When creating/editing event)
```typescript
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Refund Settings</h3>
  
  {/* Toggle */}
  <div className="flex items-center justify-between p-4 border rounded-lg">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Switch
          checked={autoApproveEnabled}
          onCheckedChange={handleToggleAutoApprove}
        />
        <label className="font-medium">Enable Auto-Approve</label>
      </div>
      <p className="text-sm text-muted-foreground">
        Automatically approve safe refund requests (>48h before event, no redeemed tickets, etc.)
      </p>
    </div>
    <Badge variant={autoApproveEnabled ? "success" : "neutral"}>
      {autoApproveEnabled ? 'ON' : 'OFF'}
    </Badge>
  </div>

  {/* Explanation */}
  {autoApproveEnabled && (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-sm font-semibold text-blue-900 mb-2">
        ✅ Auto-Approve Rules (You'll still review edge cases)
      </p>
      <ul className="text-xs text-blue-800 space-y-1">
        <li>• More than 48 hours before event</li>
        <li>• No redeemed tickets</li>
        <li>• Order placed within last 30 days</li>
        <li>• Customer has &lt;3 refunds in 90 days</li>
        <li>• Order amount under $500</li>
      </ul>
      <p className="text-xs text-blue-700 mt-2">
        ⚠️ Requests not meeting these criteria will still require your review.
      </p>
    </div>
  )}

  {/* Stats (if auto-approve is enabled) */}
  {autoApproveEnabled && stats && (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {stats.autoApprovedCount}
          </div>
          <div className="text-xs text-muted-foreground">
            Auto-approved (last 30 days)
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-orange-600">
            {stats.manualReviewCount}
          </div>
          <div className="text-xs text-muted-foreground">
            Manual review needed
          </div>
        </CardContent>
      </Card>
    </div>
  )}
</div>
```

**Option B: Quick Toggle in Refunds Dashboard** (Header of Pending Requests tab)
```typescript
<div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-semibold">Pending Requests</h3>
  
  <div className="flex items-center gap-3">
    <span className="text-sm text-muted-foreground">Auto-Approve:</span>
    <Switch
      checked={autoApproveEnabled}
      onCheckedChange={handleToggle}
    />
    <Tooltip content="Automatically approve safe refund requests">
      <HelpCircle className="h-4 w-4 text-muted-foreground" />
    </Tooltip>
  </div>
</div>
```

---

## 🔧 **Updated Backend Function**

**File:** `supabase/functions/submit-refund-request/index.ts`

**Add auto-approve check:**

```typescript
// After eligibility check, before creating request:

// Check if auto-approve is enabled for this event
const { data: autoApproveCheck } = await supabaseService
  .rpc('should_auto_approve_refund', {
    p_order_id: order.id,
    p_user_id: user.id
  });

const shouldAutoApprove = autoApproveCheck?.auto_approve === true;

console.log(`[submit-refund-request] Auto-approve check:`, {
  enabled: shouldAutoApprove,
  reason: autoApproveCheck?.reason
});

// Create request with appropriate status
const requestStatus = shouldAutoApprove ? 'approved' : 'pending';

const { data: request, error: insertErr } = await supabaseService
  .from("refund_requests")
  .insert({
    order_id,
    user_id: user.id,
    reason,
    details,
    status: requestStatus,
    metadata: {
      event_title: order.events?.title,
      auto_approve_check: autoApproveCheck,
      auto_approved: shouldAutoApprove
    }
  })
  .select()
  .single();

// If auto-approved, process refund immediately
if (shouldAutoApprove) {
  console.log(`[submit-refund-request] Auto-approving request ${request.id}`);

  // Process refund via existing function
  const { data: refundData, error: refundErr } = await supabaseService.functions.invoke('process-refund', {
    body: {
      order_id: order.id,
      reason: `Auto-approved: ${reason}${details ? ' - ' + details : ''}`
    }
  });

  if (refundErr) {
    // Auto-approve failed - revert to pending for manual review
    await supabaseService
      .from("refund_requests")
      .update({ 
        status: 'pending',
        metadata: {
          ...request.metadata,
          auto_approve_failed: true,
          auto_approve_error: refundErr.message
        }
      })
      .eq("id", request.id);

    // Still return success but as pending
    return new Response(
      JSON.stringify({
        status: 'pending',
        request_id: request.id,
        message: 'Auto-approve failed, organizer will review manually.'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update request status to processed
  await supabaseService
    .from("refund_requests")
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      reviewed_by: null,  // System auto-approved
      organizer_response: 'Automatically approved'
    })
    .eq("id", request.id);

  // Return immediate success
  return new Response(
    JSON.stringify({
      status: 'auto_approved',
      request_id: request.id,
      refund: refundData?.refund,
      message: 'Your refund has been automatically approved! You'll receive confirmation via email.'
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Manual review needed
return new Response(
  JSON.stringify({
    status: 'pending',
    request_id: request.id,
    message: 'Refund request submitted. The organizer will review and respond within 24 hours.'
  }),
  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

## 🎨 **Organizer UI: Settings Panel**

### **Component:** `RefundSettingsPanel.tsx` (NEW)

**Location:** Either in Event Settings or in Refunds Dashboard

```typescript
export function RefundSettingsPanel({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<RefundPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [eventId]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('refund_policies')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    setSettings(data || {
      event_id: eventId,
      allow_refunds: true,
      refund_window_hours: 24,
      auto_approve_enabled: false
    });
  };

  const handleToggleAutoApprove = async (enabled: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('refund_policies')
        .upsert({
          event_id: eventId,
          auto_approve_enabled: enabled,
          allow_refunds: settings?.allow_refunds ?? true,
          refund_window_hours: settings?.refund_window_hours ?? 24,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, auto_approve_enabled: enabled } : null);

      toast({
        title: enabled ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled',
        description: enabled 
          ? 'Safe refund requests will be approved automatically'
          : 'All refund requests will require your manual review'
      });

      await fetchSettings();
    } catch (err: any) {
      toast({
        title: 'Failed to update settings',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund Automation</CardTitle>
        <CardDescription>
          Configure how refund requests are handled for this event
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Auto-Approve Toggle */}
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <label className="font-medium">Auto-Approve Safe Refunds</label>
              <Badge variant={settings?.auto_approve_enabled ? "success" : "neutral"}>
                {settings?.auto_approve_enabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatically approve refund requests that meet safety criteria. 
              Edge cases still require your review.
            </p>
          </div>
          <Switch
            checked={settings?.auto_approve_enabled || false}
            onCheckedChange={handleToggleAutoApprove}
            disabled={saving}
          />
        </div>

        {/* Auto-Approve Rules (shown when enabled) */}
        {settings?.auto_approve_enabled && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-semibold text-green-900">
                Auto-Approve Criteria (All must pass)
              </p>
            </div>
            <ul className="text-xs text-green-800 space-y-1.5 ml-7">
              <li>✅ More than 48 hours before event starts</li>
              <li>✅ No tickets have been scanned/redeemed</li>
              <li>✅ Order placed within last 30 days</li>
              <li>✅ Customer has fewer than 3 refunds in 90 days</li>
              <li>✅ Order amount is under $500</li>
            </ul>
          </div>
        )}

        {/* Manual Review Info (shown when disabled) */}
        {!settings?.auto_approve_enabled && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              ℹ️ <strong>Manual Review Mode:</strong> All refund requests will appear in your 
              "Pending Requests" tab for review. You'll need to approve or decline each one.
            </p>
          </div>
        )}

        {/* Additional Settings */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm">Refund Window</label>
              <p className="text-xs text-muted-foreground">
                Hours before event when refunds are no longer allowed
              </p>
            </div>
            <Input
              type="number"
              min="1"
              max="168"
              value={settings?.refund_window_hours || 24}
              onChange={(e) => {
                const hours = parseInt(e.target.value);
                handleUpdatePolicy({ refund_window_hours: hours });
              }}
              className="w-20 text-right"
            />
            <span className="text-sm text-muted-foreground">hours</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-sm">Allow Refunds</label>
              <p className="text-xs text-muted-foreground">
                Enable or disable refunds entirely for this event
              </p>
            </div>
            <Switch
              checked={settings?.allow_refunds ?? true}
              onCheckedChange={(enabled) => handleUpdatePolicy({ allow_refunds: enabled })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 📊 **Customer Experience Based on Toggle**

### **Auto-Approve OFF (Default):**
```
Customer clicks "Request Refund"
  ↓
Fills form, submits
  ↓
Toast: "Request sent to organizer. You'll hear back within 24 hours."
  ↓
Status: "Pending Review" (badge on ticket)
  ↓
Wait for organizer...
  ↓
Email: "Your refund has been approved!" (when organizer clicks Approve)
  ↓
Money returns in 5-10 days
```

### **Auto-Approve ON:**
```
Customer clicks "Request Refund"
  ↓
Fills form, submits
  ↓
System checks safety rules...
  ↓
IF safe → Toast: "Refund approved! $276 will be refunded in 5-10 days." ✅
IF risky → Toast: "Request sent to organizer for review." ⚠️
  ↓
Status: "Refunded" (if auto-approved) or "Pending Review" (if manual)
```

---

## 🎯 **Organizer Benefits of Toggle**

### **Auto-Approve OFF (Full Control):**
**Best for:**
- High-value events ($500+ tickets)
- Exclusive events (VIP experiences)
- Events with special policies
- Organizers who want personal touch

**Experience:**
- See every refund request
- Review reason before approving
- Can add personalized response
- Full control over workflow

### **Auto-Approve ON (Automation):**
**Best for:**
- High-volume events (100+ tickets)
- Standard pricing events (<$500 tickets)
- Busy organizers
- Professional operations

**Experience:**
- 80-90% auto-processed (zero work)
- Only see edge cases in queue
- Faster customer experience
- Less manual work

---

## 📊 **Dashboard Shows Both**

### **Pending Requests Tab:**

**When Auto-Approve OFF:**
```
Pending Requests (12 pending)
├── All requests shown here
└── Organizer reviews each one
```

**When Auto-Approve ON:**
```
Pending Requests (2 pending)
├── Only edge cases shown
├── Most auto-processed (in history tab)
└── Badge shows: "10 auto-approved today"
```

---

## 🔧 **Implementation Updates**

### **Files to Create/Update:**

**NEW:**
1. `migrations/20251111000011_auto_approve_logic.sql` - Function
2. `src/components/organizer/RefundSettingsPanel.tsx` - Toggle UI
3. Update `submit-refund-request` - Check auto-approve

**UPDATE:**
4. `refund_policies` table - Add `auto_approve_enabled` column ✅ (already done)
5. `OrganizerRefundsPage.tsx` - Add settings panel

---

## ⏱️ **Updated Time Estimate**

| Task | Time |
|------|------|
| Database (refund_requests table + RLS) | 20 min |
| Auto-approve logic function | 15 min |
| submit-refund-request Edge Function | 30 min |
| review-refund-request Edge Function | 25 min |
| Customer UI (request modal, status) | 30 min |
| Organizer UI (3 tabs + settings toggle) | 90 min |
| Integration + testing | 30 min |
| **TOTAL** | **~4 hours** |

*Added +30 min for settings panel and auto-approve logic*

---

## ✅ **Summary: What You Get**

### **For Customers:**
- ✅ "Request Refund" button on tickets
- ✅ Simple form with reason
- ✅ Instant approval (if auto-approve ON + meets criteria)
- ✅ Or pending review (if auto-approve OFF or edge case)

### **For Organizers:**
- ✅ **Toggle per event:** Auto-approve ON/OFF
- ✅ See pending requests (only edge cases if auto-approve ON)
- ✅ Approve/Decline with one click
- ✅ Complete refund history (including auto-approved)
- ✅ Stats showing auto vs manual refunds

### **For System:**
- ✅ Flexible workflow
- ✅ Fraud protection (even with auto-approve)
- ✅ Complete audit trail
- ✅ Professional UX

---

## 🚀 **Ready to Implement?**

**This plan gives you:**
- ✅ Request/approval queue (as you wanted)
- ✅ Auto-approve toggle (organizer controls)
- ✅ Best of both worlds (automation + control)
- ✅ ~4 hours total implementation

**Approve and I'll build the complete system with the toggle?** 🔨


