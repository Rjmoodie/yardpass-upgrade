# 🚀 Deploy send-role-invite Edge Function

**Status:** Code ready, needs deployment  
**Security Fixes Included:** Authorization, Rate Limiting, Audit Logging

---

## 🎯 Quick Deploy Options

### **Option 1: CLI Deployment (Fastest)**

```bash
# Step 1: Login to Supabase (one-time)
supabase login

# Step 2: Deploy function
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
supabase functions deploy send-role-invite

# Done! ✅
```

---

### **Option 2: Dashboard Deployment (No CLI)**

**Steps:**

1. **Go to Supabase Dashboard:**
   - Visit https://supabase.com/dashboard
   - Select your Liventix project

2. **Navigate to Edge Functions:**
   - Click "Edge Functions" in sidebar
   - Find "send-role-invite" in the list

3. **Update Function Code:**
   - Click on "send-role-invite"
   - Click "Edit Function" or "Deploy"
   - Copy contents of: `supabase/functions/send-role-invite/index.ts`
   - Paste into editor
   - Click "Deploy"

4. **Verify Deployment:**
   - Check logs for any errors
   - Test invite sending

---

### **Option 3: Git-Based Deployment (CI/CD)**

If you have GitHub Actions or similar CI/CD:

```bash
# Commit the changes
git add supabase/functions/send-role-invite/
git add supabase/functions/_shared/crypto.ts
git commit -m "security: Add authorization and rate limiting to role invites"
git push

# Let your CI/CD pipeline deploy automatically
```

---

## 🧪 Test After Deployment

### **Test 1: Unauthorized Attempt (Should FAIL)**

```typescript
// Test in browser console or Postman:
const { data, error } = await supabase.functions.invoke('send-role-invite', {
  body: {
    event_id: 'EVENT_YOU_DONT_OWN',
    role: 'scanner',
    email: 'test@example.com'
  }
});

console.log(error);
// Expected: { message: "Unauthorized: Only event managers can send invites" }
```

### **Test 2: Authorized Attempt (Should SUCCEED)**

```typescript
// As event owner:
const { data, error } = await supabase.functions.invoke('send-role-invite', {
  body: {
    event_id: 'YOUR_EVENT_ID',
    role: 'scanner',
    email: 'helper@example.com'
  }
});

console.log(data);
// Expected: { success: true, token: "..." }
```

### **Test 3: Check Audit Log**

```sql
-- In Supabase SQL Editor:
SELECT * FROM public.audit_log
WHERE action = 'role_invite_sent'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Shows your test invites with full metadata
```

---

## 📊 Security Improvements Recap

### **What Changed in Edge Function:**

```typescript
// BEFORE (Vulnerable):
async function handler(req) {
  const { event_id, role, email } = await req.json();
  
  // ❌ No authorization check
  // ❌ No rate limiting
  // ❌ No audit logging
  
  await supabase.from('role_invites').insert({...});
  sendEmail();
}

// AFTER (Secure):
async function handler(req) {
  const { event_id, role, email } = await req.json();
  
  // ✅ Check authorization
  const { data: isManager } = await supabase.rpc('is_event_manager', { p_event_id: event_id });
  if (!isManager) return 403;
  
  // ✅ Rate limiting
  if (recentInvites >= 50) return 429;
  if (eventInvites >= 20) return 429;
  
  // ✅ Audit logging
  await supabase.from('audit_log').insert({
    action: 'role_invite_sent',
    metadata: { event_id, role, email }
  });
  
  await supabase.from('role_invites').insert({...});
  sendEmail();
}
```

---

## 🎊 Success Criteria

After deployment, you should see:

✅ **Unauthorized users get 403 error**  
✅ **Authorized users can send invites**  
✅ **Rate limiting kicks in at 20/hour per event**  
✅ **Audit log entries for each invite**  
✅ **No more token exposure to anonymous users**  

---

## 🐛 Troubleshooting

### **Issue: "is_event_manager function not found"**

**Solution:**
```sql
-- Check if function exists:
SELECT proname FROM pg_proc WHERE proname = 'is_event_manager';

-- If missing, it should have been created in:
-- supabase/migrations/20250201090000_add_event_roles_system.sql

-- Check if that migration was applied:
SELECT * FROM supabase_migrations.schema_migrations
WHERE version = '20250201090000';
```

### **Issue: "audit_log table not found"**

**Solution:**
Already verified it exists! But if you see this:
```sql
-- Check:
SELECT * FROM information_schema.tables WHERE table_name = 'audit_log';

-- If missing, re-run migration:
-- 20251109110000_secure_role_invites.sql
```

### **Issue: Rate limiting not working**

**Solution:**
```typescript
// Check Edge Function logs in Supabase Dashboard
// Look for: "Rate limit exceeded" messages
// If not appearing, Edge Function may not be deployed
```

---

## 📞 Support

**Deployment failing?**
- Check Supabase CLI version: `supabase --version`
- Try Dashboard deployment instead
- Check function logs for errors

**Tests failing?**
- Run verification script again
- Check Supabase logs
- Verify you're testing with correct event IDs

**Need help?**
- Review `ROLE_INVITE_SYSTEM_AUDIT_V2.md` for details
- Check `SECURITY_FIXES_DEPLOYMENT.md` for overview

---

**Status:** 🟢 **Database secure, ready for Edge Function deployment!**

Deploy the function and you're done! 🚀

