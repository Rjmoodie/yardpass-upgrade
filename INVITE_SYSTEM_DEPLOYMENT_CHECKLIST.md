# 🚀 Organization Invite System - Deployment Checklist

## ✅ **COMPLETED:**

### **1. Frontend Components**
- ✅ `OrganizationTeamPanel.tsx` - Updated with Pending Invites section
- ✅ `OrgInvitePage.tsx` - Acceptance page exists and ready
- ✅ Role dropdown matches database constraints
- ✅ Real-time listeners configured

### **2. Database Structure**
- ✅ `organizations.org_invitations` table exists
- ✅ Tracking columns added (`email_status`, `email_sent_at`, `metadata`)
- ✅ `public.org_invitations` view created
- ✅ `public.org_invite_status_log` view created
- ✅ `accept_org_invitation()` function exists

### **3. Edge Function**
- ✅ `send-org-invite` - Updated with:
  - ✅ New email template with Liventix logo
  - ✅ Tagline: "Liventix - Live Event Tickets"
  - ✅ Blue gradient branding
  - ✅ Email tracking (status, sent_at, metadata)
  - ✅ Detailed logging for debugging

### **4. Migrations Created**
- ✅ `20251121000000_create_org_invitations_view.sql`
- ✅ `20251121000001_add_invite_tracking.sql`
- ✅ `20251121000002_invite_status_view.sql`
- ✅ `20251121000003_fix_org_invitations_rls.sql` (not needed - superseded)
- ✅ `20251121000004_cleanup_org_invitations_policies.sql` (READY TO RUN)

---

## ⏳ **PENDING ACTIONS:**

### **Priority 1: Critical (Required for system to work)**

#### ☐ **1. Run Database Migration**
**File:** `supabase/migrations/20251121000004_cleanup_org_invitations_policies.sql`

**Why:** Fixes RLS policy duplicates and security issues

**How:**
1. Open Supabase Dashboard → SQL Editor
2. Copy/paste the entire migration file
3. Click "Run"

**Expected Result:** 
- Drops 8 old policies
- Creates 5 clean policies
- No more 403 errors

---

#### ☐ **2. Deploy Edge Function**
**Command:**
```bash
npx supabase functions deploy send-org-invite --env-file .env --no-verify-jwt
```

**Why:** Updates email template and tracking logic

**Expected Result:**
- New branded email template
- Email status tracking works
- Logs appear in Supabase Edge Functions logs

---

#### ☐ **3. Test End-to-End Flow**

**Step 1: Create Invite**
1. Navigate to Dashboard → Teams
2. Enter email: `test@example.com`
3. Select role: Viewer
4. Click "Create Invite"

**Expected:**
- ✅ "Invitation sent successfully" toast
- ✅ "Pending Invites" section appears
- ✅ Shows invite with status badge (Sent/Failed/Pending)
- ✅ No console errors

**Step 2: Check Email**
- ✅ Email received (if using real email)
- ✅ Liventix logo visible
- ✅ Blue gradient header
- ✅ Footer says "Liventix - Live Event Tickets"
- ✅ Accept button works

**Step 3: Accept Invite**
1. Click "Accept Invitation" in email
2. Lands on `/invite/org?token=...`
3. Shows org name, role, accept button
4. Click "Accept Invitation"
5. Redirects to dashboard

**Expected:**
- ✅ Invite status changes to "Accepted"
- ✅ User appears in "Team Members"
- ✅ "Pending Invites" section updates in real-time

---

### **Priority 2: Verification (Good to check)**

#### ☐ **4. Verify Email Tracking**

**Check in Supabase:**
```sql
SELECT * FROM org_invite_status_log 
ORDER BY invite_created_at DESC 
LIMIT 10;
```

**Should show:**
- ✅ `email_status`: 'sent', 'failed', or 'error'
- ✅ `email_sent_at`: timestamp
- ✅ `email_provider_id`: Resend email ID (if sent)
- ✅ `email_error_message`: error details (if failed)
- ✅ `display_status`: user-friendly status

---

#### ☐ **5. Check Edge Function Logs**

**In Supabase Dashboard:**
1. Edge Functions → `send-org-invite` → Logs

**Look for:**
```
[INVITE-CREATED] { invite_id: '...', org_id: '...', email: '...' }
[INVITE-EMAIL] Preparing to send: { ... }
[INVITE-EMAIL-SUCCESS] { email_id: '...', to: '...' }
[INVITE-COMPLETE] { email_sent: true, email_id: '...' }
```

**Or if failed:**
```
[INVITE-EMAIL-FAILED] { error: '...', status_code: 403 }
```

---

#### ☐ **6. Verify RLS Policies Work**

**Test as non-admin:**
1. Create a test user with "Editor" or "Viewer" role
2. Try to create an invite (should FAIL - only admins/owners)
3. Try to view invites for their org (should SUCCEED)
4. Try to view invites for OTHER orgs (should FAIL)

**Expected:**
- ✅ Editors/Viewers can VIEW invites for their org
- ✅ Editors/Viewers CANNOT create invites
- ✅ Only Admins/Owners can create invites

---

#### ☐ **7. Test Expired Invite Handling**

**Manual Test:**
1. Create invite in database with past expiry:
```sql
UPDATE organizations.org_invitations 
SET expires_at = now() - interval '1 hour'
WHERE id = 'some-invite-id';
```

2. Try to accept it via link

**Expected:**
- ✅ Shows "Invitation has expired" error
- ✅ Cannot accept
- ✅ Status shows as "Expired" in Teams panel

---

### **Priority 3: Optional (Nice to have)**

#### ☐ **8. Set Up Email Domain Verification**

**If using custom domain:**
1. Verify `liventix.tech` in Resend dashboard
2. Add DNS records (SPF, DKIM, DMARC)
3. Update Edge Function to use verified domain

**Current:** Uses `hello@liventix.tech`

---

#### ☐ **9. Add Invite Resend Feature**

**Enhancement:** Add "Resend" button in Pending Invites section

**Location:** `OrganizationTeamPanel.tsx`

**Benefit:** Allows resending failed invites

---

#### ☐ **10. Add Invite Revoke Feature**

**Enhancement:** Add "Revoke" button in Pending Invites section

**Benefit:** Cancel invites before they're accepted

---

## 🐛 **Known Issues to Monitor:**

### **1. Email Delivery**
- **Issue:** Domain not verified
- **Impact:** Emails may go to spam or fail
- **Solution:** Verify domain in Resend

### **2. Expired Invites**
- **Issue:** 2 expired pending invites in database
- **Impact:** Clutter in UI
- **Solution:** Add cleanup job or manual deletion

### **3. Real-time Updates**
- **Issue:** May not update instantly if connection drops
- **Impact:** User needs to refresh
- **Solution:** Add reconnection logic (already handled by Supabase)

---

## 📊 **Current State (From Audit):**

- **Total RLS Policies:** 8 (needs cleanup to 5)
- **Pending Invites:** 8
- **Accepted Invites:** 0
- **Expired Pending:** 2
- **Views Created:** ✅ Both views exist
- **Tracking Columns:** ✅ All exist

---

## 🎯 **Next Immediate Steps:**

1. **RUN:** Migration `20251121000004_cleanup_org_invitations_policies.sql`
2. **DEPLOY:** Edge Function `send-org-invite`
3. **TEST:** Create invite → Check email → Accept invite
4. **VERIFY:** Check logs and database

---

## ✅ **Success Criteria:**

- [ ] Can create invites from Teams page
- [ ] "Pending Invites" section appears
- [ ] Email arrives with new branding
- [ ] Can accept invite from email link
- [ ] Member appears in team after acceptance
- [ ] Real-time updates work
- [ ] No 403 errors in console
- [ ] Email tracking data appears in database

---

## 📝 **Notes:**

- Invite expiration: **168 hours (7 days)**
- Service role has full access (for Edge Functions)
- Token acts as authorization (magic link model)
- Acceptance requires authentication + email match

