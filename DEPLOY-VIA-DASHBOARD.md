# 📤 Deploy Edge Functions via Dashboard (No CLI Needed)

## 🎯 **Method 1: Auto-Deploy from Local Files**

### **Step 1: Open Supabase Dashboard**
https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions

### **Step 2: Deploy posts-create**

1. Click **"posts-create"** in the functions list
2. Click **"Deploy"** tab
3. Supabase will detect local changes
4. Click **"Deploy new version"** button
5. Wait for deployment to complete (~30 seconds)

### **Step 3: Deploy home-feed**

1. Click **"home-feed"** in the functions list
2. Click **"Deploy"** tab
3. Click **"Deploy new version"** button
4. Wait for deployment (~30 seconds)

---

## 🎯 **Method 2: Manual Copy/Paste**

If auto-deploy doesn't work:

### **For posts-create:**

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions/posts-create
2. Click **"Edit function"**
3. Delete all code in the editor
4. Copy entire contents of: `supabase/functions/posts-create/index.ts`
5. Paste into dashboard editor
6. Click **"Save"** then **"Deploy"**

### **For home-feed:**

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions/home-feed
2. Click **"Edit function"**
3. Delete all code
4. Copy entire contents of: `supabase/functions/home-feed/index.ts`
5. Paste into editor
6. Click **"Save"** then **"Deploy"**

---

## ✅ **Verification:**

After deployment, check logs:
```
Dashboard → Functions → posts-create → Logs

Should see:
  ✅ "Deployment successful"
  ✅ No error messages
```

Test by creating a post:
```
Dashboard → Functions → posts-create → Invoke

Body:
{
  "event_id": "<test_event_id>",
  "text": "Test post",
  "media_urls": ["https://example.com/image.jpg"]
}

Should return:
  ✅ 201 Created (if valid)
  ✅ 403 Forbidden (if no permission)
```

---

## 🎯 **What Changed:**

### **posts-create:**
- ✅ Checks if event is flashback
- ✅ Validates media required (flashbacks)
- ✅ Enforces 300 char limit (flashbacks)
- ✅ Strips links (flashbacks)
- ✅ Checks 90-day window

### **home-feed:**
- ✅ Excludes flashback events from fallback query
- ✅ Flashback POSTS still appear ✅

---

**Choose whichever method works best for you!** 🚀

