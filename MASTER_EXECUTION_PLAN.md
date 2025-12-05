# 🚀 Master Execution Plan - Feed Optimization & Ticketing Hardening

**Date:** December 4, 2025  
**Status:** IN PROGRESS  
**Completion:** 50% (Feed optimization deployed, ticketing fixes in progress)

---

## ✅ COMPLETED TODAY

### **Feed Optimization (DONE)**
- ✅ posts-create Edge Function deployed
- ✅ Frontend code complete (build succeeded)
- ✅ 30-second video limit implemented
- ✅ Sound toggle button added
- ✅ Delete buttons optimized
- ✅ Auto-scroll to new posts
- ✅ Tests written

### **Ticketing Fixes (DONE)**
- ✅ 190 ghost reservations cleared
- ✅ 12 missing tickets created
- ✅ Platform audit complete
- ✅ Cleanup functions created
- ✅ Health monitoring view deployed

---

## 📋 REMAINING TASKS

### **TODAY (Next 2 Hours):**

#### **Task 1: Test Feed Optimization (30 min)**
- [ ] Follow `test-posts-create-deployment.md`
- [ ] Create test post in app
- [ ] Verify instant appearance
- [ ] Check console logs
- [ ] Verify no refetch in Network tab

**Owner:** You  
**File:** `test-posts-create-deployment.md`

---

#### **Task 2: Add Capacity Constraints (30 min)**
- [ ] Run `supabase/migrations/20251211_add_capacity_constraints.sql`
- [ ] Verify no violations
- [ ] Test constraints work

**Owner:** You  
**File:** `supabase/migrations/20251211_add_capacity_constraints.sql`

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of migration file
3. Click RUN
4. Expected: "✅ Constraints added successfully!"

---

#### **Task 3: Deploy Frontend Build (30 min)**
- [ ] Commit changes to git
- [ ] Push to deployment branch
- [ ] Monitor CI/CD deployment
- [ ] Verify app loads

**Commands:**
```bash
git add .
git commit -m "feat: feed optimization + ticketing fixes"
git push origin main
```

---

### **THIS WEEK (By Dec 11):**

#### **Task 4: Create Atomic Ticket Creation Function (2-3 hours)**
- [ ] Create migration file (provided in assessment)
- [ ] Test with real order
- [ ] Update Stripe webhook to use it
- [ ] Deploy to Supabase

**File:** Already provided in `TICKETING_SYSTEM_ASSESSMENT_V2_PRODUCTION.md` (lines 335-441)

---

#### **Task 5: Set Up Cron Jobs for Cleanup (1 hour)**
- [ ] Verify pg_cron extension enabled
- [ ] Schedule cleanup job (every 5 min)
- [ ] Schedule reconciliation job (daily)
- [ ] Verify jobs running

**SQL:**
```sql
-- Schedule cleanup
SELECT cron.schedule(
  'cleanup-ticket-holds',
  '*/5 * * * *',
  $$SELECT public.cleanup_expired_ticket_holds()$$
);

-- Verify
SELECT * FROM cron.job;
```

---

### **NEXT WEEK (By Dec 18):**

#### **Task 6: Set Up Monitoring Alerts (2-3 hours)**
- [ ] Create alert configurations
- [ ] Set up Slack/email notifications
- [ ] Test alert triggers
- [ ] Document in runbook

**Reference:** Assessment lines 160-245 (Alert definitions)

---

#### **Task 7: Create Per-Event Preflight Check (1 hour)**
- [ ] Run migration for event_readiness view
- [ ] Test on upcoming events
- [ ] Add to organizer workflow

**Reference:** Assessment lines 652-705

---

## 🎯 EXECUTION ORDER (Start Now)

### **Step 1: Verify posts-create Works (5 min)**

Open your app and try this in browser console:

```javascript
const supabase = window.supabase;  // or however you access it in your app

const response = await fetch('https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/posts-create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event_id: '28309929-28e7-4bda-af28-6e0b47485ce1',
    text: 'Test post after deployment',
    media_urls: []
  })
});

const data = await response.json();
console.log('✅ Response:', data);
console.log('Has correct structure?', data.success && data.post?.item_type === 'post');
```

**Expected:** Console shows `Has correct structure? true`

---

### **Step 2: Test Feed Optimization in App (10 min)**

1. Navigate to Feed
2. Click "Create Post"
3. Add text: "Testing instant feed update!"
4. Click "Post"

**Watch for:**
- ✅ Console logs:
  ```
  📤 [usePostCreation] Starting post creation...
  ✅ [usePostCreation] Media uploaded
  ✅ [usePostCreation] Post created
  🎉 [usePostCreation] Post creation successful, updating cache
  ✅ [prependPostToFeedCache] Added item to cache
  ```
- ✅ Post appears instantly at top
- ✅ Auto-scrolls to show your post
- ✅ Toast: "Posted! 🎉"

---

### **Step 3: Add Capacity Constraints (15 min)**

1. Open Supabase Dashboard → SQL Editor
2. Copy `supabase/migrations/20251211_add_capacity_constraints.sql`
3. Paste and RUN

**Expected Output:**
```
✅ Pre-flight check passed: No constraint violations found
✅ Constraint test passed: Invalid insert was rejected
✅ Constraints added successfully!
```

---

### **Step 4: Deploy Frontend (If Using Git Deploy)**

```bash
# In terminal
cd "C:\Users\Louis Cid\Liventix\Liventix-app"

git status

# If changes uncommitted:
git add .
git commit -m "feat: feed optimization deployed + ticketing constraints added"
git push origin main

# Monitor deployment in Vercel/Netlify dashboard
```

---

## 📊 Progress Tracker

| Task | Status | Time | Priority |
|------|--------|------|----------|
| posts-create deployed | ✅ | Done | P0 |
| Test Edge Function | ⏳ | 5 min | P0 |
| Test feed in app | ⏳ | 10 min | P0 |
| Add capacity constraints | ⏳ | 15 min | P0 |
| Deploy frontend | ⏳ | 30 min | P0 |
| Atomic ticket creation | ☐ | 2-3 hrs | P0 |
| Set up cron jobs | ☐ | 1 hr | P0 |
| Configure alerts | ☐ | 2-3 hrs | P1 |

---

## 🎯 TODAY'S GOAL

**Complete these by end of day:**
- ✅ posts-create deployed
- ⏳ Feed optimization tested
- ⏳ Capacity constraints added
- ⏳ Frontend deployed

**Tomorrow:**
- Atomic ticket creation function
- Cron job scheduling

**By Dec 18:**
- All P0 items complete
- Monitoring alerts live
- System production-ready

---

## 📞 If You Need Help

**Stuck on feed testing?** Check console for errors  
**Constraints fail?** Share the error message  
**Frontend deploy issues?** Check build logs

**I'm here to help you execute each step!** 🚀

---

**Next Action:** Run Step 1 (test Edge Function in browser console)

