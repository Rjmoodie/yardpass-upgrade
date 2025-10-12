# Credit System Quick Reference

## 🎯 **TL;DR**

- **Org Credits:** Never expire, tracked in lots, shared by team
- **User Credits:** Personal wallet, separate from org
- **FIFO Deduction:** Oldest credits spent first
- **Attribution:** Always know who purchased
- **Fraud Protection:** 3DS + Stripe Radar enabled

---

## 💳 **Purchase Flows**

### **User Purchases Personal Credits**
```typescript
// Call edge function
supabase.functions.invoke('purchase-credits', {
  body: {
    package_id: 'uuid',  // or custom_credits: 5000
    promo_code: 'SAVE10' // optional
  },
  headers: {
    'Idempotency-Key': crypto.randomUUID()
  }
});

// Result:
// - Credits added to user's personal wallet
// - Invoice created with purchased_by_user_id = user.id
// - Credit lot created (expires_at: null)
// - User can spend on their campaigns
```

### **User Purchases Org Credits**
```typescript
// Call edge function
supabase.functions.invoke('purchase-org-credits', {
  body: {
    org_id: 'uuid',
    package_id: 'uuid',  // or custom_credits: 10000
    promo_code: 'SAVE10' // optional
  }
});

// Result:
// - Credits added to ORG shared wallet
// - Invoice created with:
//   - org_wallet_id = org's wallet
//   - purchased_by_user_id = current user (who paid)
// - Credit lot created (expires_at: null - never expires)
// - All org team members can spend
```

---

## 📊 **Query Examples**

### **Get User's Credit Lots**
```sql
SELECT * FROM get_credit_lot_breakdown(
  p_wallet_id := (SELECT id FROM wallets WHERE user_id = 'uuid')
);

-- Returns:
-- lot_id | remaining | purchased | unit_price | source | expires_at | created_at
-- uuid   | 5000      | 10000     | 1          | purchase | NULL     | 2025-01-13
-- uuid   | 3000      | 5000      | 1          | grant    | NULL     | 2025-01-10
```

### **Get Org's Credit Lots**
```sql
SELECT * FROM get_credit_lot_breakdown(
  p_org_wallet_id := (SELECT id FROM org_wallets WHERE org_id = 'uuid')
);
```

### **Check Available Credits**
```sql
SELECT get_available_credits(
  p_org_wallet_id := 'uuid'
);

-- Returns: 8000 (total non-expired credits)
```

### **Deduct Credits (FIFO)**
```sql
-- Note: p_amount is first parameter (required), wallet IDs are optional defaults
SELECT * FROM deduct_credits_fifo(
  p_amount := 500,
  p_org_wallet_id := 'uuid'
);

-- Returns:
-- lot_id | deducted
-- uuid   | 100
-- uuid   | 400
```

### **See Who Purchased Org Credits**
```sql
SELECT 
  i.id,
  i.amount_usd_cents,
  i.credits_purchased,
  i.created_at,
  up.display_name as purchased_by,
  i.status
FROM invoices i
JOIN user_profiles up ON up.user_id = i.purchased_by_user_id
WHERE i.org_wallet_id = 'uuid'
ORDER BY i.created_at DESC;
```

### **See Credit Deduction History**
```sql
SELECT 
  owt.created_at,
  owt.credits_delta,
  owt.description,
  owt.metadata->'lots_used' as lots_consumed
FROM org_wallet_transactions owt
WHERE owt.wallet_id = 'uuid'
  AND owt.transaction_type = 'spend'
ORDER BY owt.created_at DESC;
```

---

## 🎬 **Frontend Integration**

### **Show Credit Lot Breakdown**
```typescript
// In wallet UI component
const { data: lots } = await supabase
  .rpc('get_credit_lot_breakdown', {
    p_org_wallet_id: orgWalletId
  });

// Display in UI:
<div className="space-y-2">
  <h3>Credit Lots</h3>
  {lots?.map(lot => (
    <div key={lot.lot_id} className="flex justify-between">
      <span>{lot.remaining.toLocaleString()} credits</span>
      <span className="text-muted">
        from {lot.source} on {new Date(lot.created_at).toLocaleDateString()}
      </span>
      <span className="text-xs">
        {lot.expires_at 
          ? `Expires ${new Date(lot.expires_at).toLocaleDateString()}`
          : 'Never expires'
        }
      </span>
    </div>
  ))}
</div>
```

### **Show Purchase Attribution**
```typescript
// In org wallet admin view
const { data: purchases } = await supabase
  .from('invoices')
  .select(`
    id,
    amount_usd_cents,
    credits_purchased,
    created_at,
    status,
    user_profiles!invoices_purchased_by_user_id_fkey(display_name)
  `)
  .eq('org_wallet_id', orgWalletId)
  .order('created_at', { ascending: false });

// Display:
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Purchased By</th>
      <th>Credits</th>
      <th>Amount</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {purchases?.map(p => (
      <tr key={p.id}>
        <td>{new Date(p.created_at).toLocaleDateString()}</td>
        <td>{p.user_profiles?.display_name || 'Unknown'}</td>
        <td>{p.credits_purchased.toLocaleString()}</td>
        <td>${(p.amount_usd_cents / 100).toFixed(2)}</td>
        <td>{p.status}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### **Open Customer Portal**
```typescript
const handleOpenPortal = async () => {
  const { data, error } = await supabase.functions.invoke('customer-portal', {
    body: { 
      return_url: window.location.href 
    }
  });

  if (error) {
    toast({ 
      title: 'Error', 
      description: error.message, 
      variant: 'destructive' 
    });
    return;
  }

  if (data?.url) {
    window.location.href = data.url;
  }
};

// Add button in UI:
<Button onClick={handleOpenPortal}>
  View Invoices & Receipts
</Button>
```

---

## 🔍 **Troubleshooting**

### **Credits Not Appearing After Purchase**

1. Check invoice status:
```sql
SELECT * FROM invoices 
WHERE id = 'invoice-id' 
OR stripe_invoice_id = 'session-id';
```

2. Check if lot was created:
```sql
SELECT * FROM credit_lots 
WHERE invoice_id = 'invoice-id';
```

3. Check webhook logs:
```sql
-- Check if webhook was received
SELECT * FROM edge_function_logs 
WHERE function_name = 'wallet-stripe-webhook'
ORDER BY created_at DESC 
LIMIT 10;
```

### **FIFO Deduction Failing**

1. Check available credits:
```sql
SELECT get_available_credits(p_org_wallet_id := 'uuid');
```

2. Check lot status:
```sql
SELECT * FROM credit_lots 
WHERE org_wallet_id = 'uuid' 
  AND quantity_remaining > 0;
```

3. Check for frozen wallet:
```sql
SELECT status FROM org_wallets WHERE id = 'uuid';
-- If 'frozen', investigate dispute
```

---

## 🎓 **Best Practices**

1. **Always use idempotency keys** for purchases
2. **Check balance before spending** (frontend validation)
3. **Show lot breakdown** in admin interfaces
4. **Monitor depletion rates** to predict when to top up
5. **Track who purchases** org credits for accountability
6. **Test with Stripe test cards** before production

---

## 📞 **Quick Support**

**Issue:** Credits missing after payment
**Check:** Webhook logs → Invoice status → Lot creation

**Issue:** Insufficient credits error
**Check:** Available credits → Lot breakdown → Frozen status

**Issue:** Purchase attribution wrong
**Check:** Invoice.purchased_by_user_id → User profile

**Issue:** Customer portal not working
**Check:** stripe_customer_id in user_profiles → Portal session creation

---

## 🚀 **Performance Tips**

1. **Index usage:** All lot queries use indexes
2. **SKIP LOCKED:** Prevents deadlocks in concurrent spending
3. **Atomic operations:** Row locks prevent race conditions
4. **Idempotency:** Prevents duplicate processing

---

**Your credit system is now enterprise-ready!** 🎉

