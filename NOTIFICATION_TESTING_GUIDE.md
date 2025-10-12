# 📬 Notification Testing Guide

## 🎯 How to Test Notifications

### Step 1: Get Your User ID

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Run this query:

```sql
select id, email from auth.users where email = 'your-email@example.com';
```

5. Copy your `user_id` (UUID format like: `34cce931-f181-4caf-8f05-4bcc7ee3ecaa`)

---

### Step 2: Insert Test Notifications

1. Open the file: `test-notifications.sql`
2. **Find and replace ALL instances of** `YOUR_USER_ID` with your actual user ID
3. Copy the entire SQL script
4. Go to **Supabase SQL Editor**
5. Paste and run the script

---

### Step 3: View Notifications in Your App

1. Go to your **Profile page** (`/profile`)
2. Look for the **bell icon** in the top-right corner
3. You should see a **red badge** with the count of unread notifications (8)
4. **Click the bell** to open the notification panel

---

## 🔔 Expected Notifications

You should see 8 test notifications:

1. **🎉 Welcome to YardPass!** (Success) - 2 min ago
2. **📅 New Event Posted** (Info) - 5 min ago  
3. **⚠️ Ticket Sale Ends Soon** (Warning) - 15 min ago
4. **❤️ Someone liked your post** (Success) - 30 min ago
5. **💬 New Comment** (Info) - 1 hour ago
6. **🎫 Ticket Confirmed** (Success) - 2 hours ago
7. **🔔 Event Tomorrow** (Info) - 1 day ago
8. **❌ Payment Failed** (Error) - 3 hours ago

---

## 🎨 Notification Styling

### Visual Indicators by Type:

- **Success** (✅): Green accent, checkmark icon
- **Info** (ℹ️): Blue accent, info icon
- **Warning** (⚠️): Yellow/Orange accent, alert icon
- **Error** (❌): Red accent, X icon

### Features to Test:

- ✅ Click notification to navigate to `action_url`
- ✅ Click "Mark all read" to mark all as read
- ✅ Click individual notification to mark as read
- ✅ Unread notifications have darker background
- ✅ Badge shows correct count
- ✅ Badge disappears when all read

---

## 🧹 Clean Up Test Data

After testing, you can delete the test notifications:

```sql
-- Delete all test notifications for your user
delete from public.notifications 
where user_id = 'YOUR_USER_ID'
and created_at > now() - interval '2 days';

-- Or delete all notifications
delete from public.notifications 
where user_id = 'YOUR_USER_ID';
```

---

## 🐛 Troubleshooting

### Bell Icon Not Showing
- Make sure you're on `/profile` page (notifications only show there)
- Check browser console for errors

### No Notifications Appearing
- Verify your user_id is correct
- Check SQL query ran successfully
- Refresh the page

### Badge Not Updating
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Check browser console for errors

### Can't Mark as Read
- Check RLS policies in Supabase
- Verify you're logged in with the correct user

---

## 📝 Notes

- Notifications are **profile-page only** (not global)
- Real notifications come from:
  - Post likes/comments
  - Event updates
  - Ticket purchases
  - Payment issues
  - Campaign updates
- Test notifications use realistic timestamps
- Bell has **no glow effect** (clean design)

---

## 🎯 Quick Test Checklist

- [ ] Bell icon visible on profile page only
- [ ] Badge shows count (8)
- [ ] Clicking bell opens panel
- [ ] All 8 notifications visible
- [ ] Different colors per type
- [ ] Timestamps show correctly
- [ ] "Mark all read" works
- [ ] Individual marking works
- [ ] Badge updates after marking
- [ ] Navigation works on click


