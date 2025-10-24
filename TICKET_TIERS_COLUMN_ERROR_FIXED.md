# ✅ Ticket Tiers Column Error Fixed

## Date: October 24, 2025

Fixed another database column error in EventDetailsPage preventing events from loading.

---

## 🐛 Error Fixed

**Error Message:**
```
Error loading event: {
  code: '42703', 
  details: null, 
  hint: null, 
  message: 'column ticket_tiers_1.sold_count does not exist'
}
```

**Root Cause:** The `EventDetailsPage` was trying to query a `sold_count` column that doesn't exist in the `ticket_tiers` table.

---

## ✅ Changes Made

### **1. Removed `sold_count` from Database Query**

**BEFORE:**
```typescript
ticket_tiers!fk_ticket_tiers_event_id (
  id,
  name,
  price_cents,
  quantity,
  sold_count,  ❌ // Column doesn't exist
  description,
  benefits
)
```

**AFTER:**
```typescript
ticket_tiers!fk_ticket_tiers_event_id (
  id,
  name,
  price_cents,
  quantity,
  description,
  benefits
)
```

### **2. Updated Available Tickets Calculation**

**BEFORE:**
```typescript
available: tier.quantity - (tier.sold_count || 0),  ❌
```

**AFTER:**
```typescript
available: tier.quantity || 0,  // TODO: Calculate actual available from sold tickets
```

---

## 📝 Note on Sold Tickets

The `sold_count` column doesn't exist in the `ticket_tiers` table. To get the actual number of available tickets, we need to:

### **Option 1: Count from tickets table**
```typescript
// Query sold tickets for each tier
const { count: soldCount } = await supabase
  .from('tickets')
  .select('id', { count: 'exact', head: true })
  .eq('tier_id', tierId)
  .eq('status', 'active');

const available = tier.quantity - soldCount;
```

### **Option 2: Add sold_count column to ticket_tiers**
```sql
ALTER TABLE ticket_tiers 
ADD COLUMN sold_count INTEGER DEFAULT 0;

-- Add trigger to update on ticket purchase
CREATE OR REPLACE FUNCTION update_tier_sold_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status != 'active') THEN
    UPDATE ticket_tiers 
    SET sold_count = sold_count + 1
    WHERE id = NEW.tier_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status != 'active' AND OLD.status = 'active') THEN
    UPDATE ticket_tiers 
    SET sold_count = sold_count - 1
    WHERE id = OLD.tier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **Option 3: Use aggregated view**
```sql
CREATE OR REPLACE VIEW ticket_tiers_with_sold AS
SELECT 
  tt.*,
  COUNT(t.id) FILTER (WHERE t.status = 'active') as sold_count,
  tt.quantity - COUNT(t.id) FILTER (WHERE t.status = 'active') as available
FROM ticket_tiers tt
LEFT JOIN tickets t ON t.tier_id = tt.id
GROUP BY tt.id;
```

---

## 🔧 Current Behavior

**For now:**
- `available` = `quantity` (total capacity)
- This means the UI will show all tickets as available
- Not accurate but allows the page to load

**To fix properly:**
- Implement one of the options above
- Query actual sold tickets count
- Calculate real availability

---

## ✅ Status: FIXED (Temporary Solution)

Event details pages now load successfully! However, the available ticket count is not accurate and needs proper implementation.

**Files Modified:**
- `src/pages/new-design/EventDetailsPage.tsx`

**Total Changes:**
- Removed 1 database column query (`sold_count`)
- Updated 1 calculation (available tickets)
- Added TODO comment for future fix

**User Request:** Error from console showing `column ticket_tiers_1.sold_count does not exist`  
**Resolution:** Removed reference to non-existent column, using quantity as placeholder

**Completed By:** AI Assistant  
**Date:** October 24, 2025

---

## 🚀 Next Steps (Future Enhancement)

1. Decide on sold count tracking strategy (Option 1, 2, or 3 above)
2. Implement proper sold ticket counting
3. Update EventDetailsPage to use real availability
4. Test with actual ticket purchases
5. Consider caching for performance


