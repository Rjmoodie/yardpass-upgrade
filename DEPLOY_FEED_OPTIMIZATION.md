# 🚀 Feed Optimization - Deployment Guide

**Status:** ✅ Ready to Deploy  
**Build:** SUCCESS  
**Tests:** PASSED  
**Risk:** LOW (backward compatible)

---

## 📋 Pre-Deployment Checklist

- [x] Code complete and tested
- [x] TypeScript check passed
- [x] Production build succeeded
- [x] No linter errors
- [x] Backward compatibility verified
- [x] Rollback plan documented
- [ ] Edge Function deployed
- [ ] Frontend deployed
- [ ] Smoke tests passed

---

## 🎯 Deployment Steps

### **Step 1: Deploy Edge Function (REQUIRED FIRST)**

The `posts-create` Edge Function must be deployed **before** frontend changes.

#### **Option A: Via Supabase Dashboard (If No CLI)**

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Edge Functions**
3. Find or create `posts-create` function
4. Click **"Deploy New Version"** or **"Create Function"**
5. Upload files from `supabase/functions/posts-create/`
6. Click **Deploy**

#### **Option B: Via Supabase CLI (Recommended)**

```bash
# Install Supabase CLI if not already
npm install -g supabase

# Login
supabase login

# Link to your project (one-time)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy posts-create

# Verify deployment
supabase functions list
```

**Expected Output:**
```
posts-create | deployed | 2025-12-04
```

---

### **Step 2: Test Edge Function**

Before deploying frontend, verify the Edge Function returns correct format:

```bash
# Test via curl (replace with your project URL and anon key)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/posts-create \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "YOUR_TEST_EVENT_ID",
    "text": "Deployment test post",
    "media_urls": []
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "post": {
    "item_type": "post",
    "item_id": "...",
    "author": { ... },
    "content": { ... },
    "metrics": { ... }
  },
  "event_title": "Event Name"
}
```

**If response matches:** ✅ Proceed to Step 3  
**If error or wrong format:** ❌ Debug Edge Function

---

### **Step 3: Deploy Frontend**

#### **Option A: Via Git Push (If using Vercel/Netlify)**

```bash
cd C:\Users\Louis Cid\Liventix\Liventix-app

# Ensure all changes are committed
git status

# If uncommitted changes:
git add .
git commit -m "feat: feed optimization + video limits + delete improvements + ticket fixes"

# Push to main (or your deploy branch)
git push origin main

# CI/CD will automatically build and deploy
```

**Monitor deployment:**
- Vercel/Netlify dashboard
- Wait for build to complete
- Check deployment URL

---

#### **Option B: Manual Build + Upload**

```bash
# Build is already done! (from earlier)
# Just deploy the dist/ folder to your hosting

# If you need to rebuild:
npm run build

# Then upload dist/ folder via:
# - FTP to hosting
# - Supabase Storage (if using that)
# - Manual file upload
```

---

### **Step 4: Smoke Tests (Critical!)**

After deployment, **immediately test** these flows:

#### **Test 1: Create Post**
1. Open app in browser
2. Navigate to Feed
3. Click "Create Post"
4. Add text + optional image
5. Click "Post"

**Expected:**
- ✅ Post appears instantly at top (< 100ms)
- ✅ Toast: "Posted! 🎉"
- ✅ Auto-scroll to top
- ✅ Console logs show cache update
- ✅ Network tab shows NO `/home-feed` refetch

**If any fail:** ❌ Rollback immediately

---

#### **Test 2: Video Duration Limit**
1. Try uploading a 35-second video
2. Should show error: "Video is 35s long. Maximum is 30s."
3. Try uploading a 25-second video
4. Should succeed

**Expected:**
- ✅ 35s video rejected before upload
- ✅ 25s video uploads successfully
- ✅ Limits note visible in modal

---

#### **Test 3: Delete Post**
1. Go to Profile → Posts
2. Click three-dot menu on your post
3. Click "Delete"
4. Confirm

**Expected:**
- ✅ Post disappears instantly
- ✅ Toast: "Post deleted"
- ✅ No page reload

---

#### **Test 4: Sound Toggle**
1. Open a video post in fullscreen
2. Click volume button
3. Should toggle mute/unmute

**Expected:**
- ✅ Icon changes (VolumeX ↔️ Volume2)
- ✅ Background changes (gray → blue when ON)
- ✅ Sound actually toggles
- ✅ Console log: "🔊 Sound ON/OFF"

---

### **Step 5: Monitor for Issues (First Hour)**

**Watch for:**
- Error rate in Edge Functions dashboard
- Console errors in browser
- User complaints
- Network errors

**Check these URLs:**
- Supabase Dashboard → Edge Functions → posts-create → Logs
- Browser DevTools → Console (look for errors)
- Browser DevTools → Network (verify no failed requests)

**If error rate > 5%:** Investigate immediately  
**If error rate > 20%:** Consider rollback

---

## 🔄 Rollback Procedures

### **Rollback Edge Function (< 5 minutes)**

#### **Via Dashboard:**
1. Supabase Dashboard → Edge Functions → posts-create
2. Click "Versions"
3. Select previous version
4. Click "Deploy This Version"

#### **Via CLI:**
```bash
# Restore previous version from git
git checkout HEAD~1 supabase/functions/posts-create/index.ts

# Redeploy
supabase functions deploy posts-create
```

---

### **Rollback Frontend (< 10 minutes)**

#### **Via Git:**
```bash
# Revert the commit
git revert HEAD

# Push
git push origin main

# Wait for CI/CD to redeploy
```

#### **Via Hosting Dashboard:**
- Vercel/Netlify → Deployments
- Find previous successful deployment
- Click "Rollback to this deployment"

---

## 📊 Success Metrics (Monitor These)

### **Immediate (First Hour):**
- [ ] Post creation success rate > 95%
- [ ] No console errors in browser
- [ ] Edge Function error rate < 5%
- [ ] Average post creation time < 2s

### **First 24 Hours:**
- [ ] Feed optimization logs appearing correctly
- [ ] No user complaints about missing posts
- [ ] Cache hit rate > 90% (React Query DevTools)
- [ ] Delete functionality working

### **First Week:**
- [ ] Video duration rejections working (check logs)
- [ ] Sound toggle usage tracking
- [ ] No data integrity issues
- [ ] Performance stable

---

## 🎉 Post-Deployment Verification

### **Checklist:**

```sql
-- 1. Verify Edge Function is live
-- Go to Supabase Dashboard → Edge Functions
-- Should show: posts-create (deployed)

-- 2. Test creating a post in app
-- Should see in console:
-- 📤 [usePostCreation] Starting post creation...
-- ✅ [usePostCreation] Post created
-- 🎉 [usePostCreation] Post creation successful, updating cache
-- ✅ [prependPostToFeedCache] Added item to cache

-- 3. Check Network tab
-- Should NOT see request to: /functions/v1/home-feed after posting
-- Should ONLY see: /functions/v1/posts-create

-- 4. Test across devices
-- Desktop: Chrome, Firefox, Safari
-- Mobile: iOS Safari, Android Chrome
```

---

## 📞 Support Plan

### **If Users Report Issues:**

**Issue: "My post didn't appear"**
- Check: Console logs for cache update
- Check: Network tab for failed requests
- Fix: Clear browser cache, refresh

**Issue: "Can't upload video"**
- Check: Video duration (must be < 30s)
- Check: File size (must be < 512MB)
- Fix: Show error message, re-upload shorter video

**Issue: "Delete doesn't work"**
- Check: User is post author (can only delete own posts)
- Check: Console for errors
- Fix: Verify RLS policies

---

## 🎯 Timeline

**December 4, 2025 (Today):**
- ✅ All code complete
- ✅ Build successful
- ⏳ Deploy Edge Function (30 minutes)
- ⏳ Deploy frontend (1 hour)
- ⏳ Smoke tests (30 minutes)

**December 5, 2025:**
- Monitor for issues
- Fix any bugs found
- Collect user feedback

**December 11, 2025:**
- Review metrics
- Decide if feed optimization is stable
- Plan next optimizations

---

## 🚀 Ready to Deploy

**All systems GO!** 

**Next Action:** Deploy the Edge Function using one of the methods above.

**Need help?** Let me know which deployment method you want to use! 🎊

