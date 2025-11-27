# 🧹 Push Device Cleanup Strategy - Explained

## ❓ Why Clean Up Device Tokens?

### **Valid Reasons:**
1. **Storage Optimization** - Tokens accumulate over time as users install/uninstall, switch devices, or refresh tokens
2. **Performance** - Fewer rows to query when sending notifications (only query active tokens)
3. **Security/Privacy** - Don't keep tokens indefinitely for users who may have deleted the app
4. **Cost** - Push services may charge per token (though usually not significant)

---

## 🎯 Cleanup Strategy

### **Invalid Devices** ❌ → **Remove after 90 days**
- **Why:** These tokens are **rejected by push services** (APNs/FCM)
- **Example:** Token was rejected with error "InvalidToken"
- **Action:** Safe to remove immediately, but wait 90 days in case of temporary issues

### **Inactive Devices** 🔄 → **Remove after 180 days (with conditions)**
- **Why:** These are **replaced tokens** (e.g., when user gets a new token)
- **Important:** Old tokens might still work for a while
- **Condition:** Only remove if user has an **active token** for the same platform
- **Reason:** If user switches back to old device, we want to keep that token

**Example Scenarios:**

1. **User refreshes token on same device:**
   - Old token → `status: 'inactive'`
   - New token → `status: 'active'`
   - ✅ After 180 days, remove old token (user has active one)

2. **User switches to new device:**
   - Old device token → `status: 'inactive'`
   - New device token → `status: 'active'`
   - ✅ After 180 days, remove old device token (user has active one)

3. **User uninstalls app (no active token):**
   - Old token → `status: 'inactive'`
   - No active token exists
   - ❌ **Keep the token** (user might reinstall and we can re-engage)

---

## 🤔 Why Not Remove Inactive Devices Immediately?

### **Token Refresh Behavior:**
- iOS/Android tokens can refresh periodically
- Old tokens might still work for **days or weeks** after refresh
- We might want to send to both old and new token during transition

### **Device Switching:**
- User might switch between devices
- User might come back to an old device after months
- Keeping old tokens allows re-engagement

### **Grace Period:**
- 180 days gives plenty of time for user to return
- If they don't return in 6 months, they're probably gone
- But we still keep it if it's their only token (re-engagement opportunity)

---

## 📊 Cleanup Function Behavior

```sql
-- Invalid devices: Remove after 90 days
DELETE FROM user_devices
WHERE status = 'invalid'
  AND updated_at < NOW() - INTERVAL '90 days';

-- Inactive devices: Remove after 180 days, but only if:
--   - User has an active token for the same platform
--   - Token is older than 180 days
DELETE FROM user_devices
WHERE status = 'inactive'
  AND updated_at < NOW() - INTERVAL '180 days'
  AND EXISTS (
    SELECT 1 FROM user_devices active
    WHERE active.user_id = user_devices.user_id
      AND active.platform = user_devices.platform
      AND active.status = 'active'
  );
```

---

## 🔄 Alternative Strategy: Keep Forever?

### **Pros:**
- Never lose a token
- Can re-engage users anytime
- No cleanup maintenance

### **Cons:**
- Database grows indefinitely
- Query performance degrades
- Storage costs increase
- May violate privacy best practices (keeping data forever)

---

## 💡 Recommendation

**Current Strategy (90/180 days) is good because:**
1. ✅ Removes broken tokens quickly (90 days)
2. ✅ Removes replaced tokens after 6 months (180 days)
3. ✅ Preserves tokens for re-engagement (if no active token exists)
4. ✅ Balances storage vs. functionality

**You could adjust:**
- Make cleanup periods configurable
- Only clean up invalid devices (never clean inactive)
- Extend inactive cleanup to 365 days

**What would you prefer?** 🤔

