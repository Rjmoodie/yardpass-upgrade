# OneSignal Setup Guide for iOS Push Notifications 📱

This guide will walk you through setting up OneSignal for iOS push notifications in your YardPass app.

## Prerequisites

- ✅ Apple Developer Account access
- ✅ APNs Authentication Key (.p8 file)
- ✅ Xcode project configured with Push Notifications capability

---

## Step 1: Create OneSignal Account

1. **Sign up for OneSignal**
   - Go to [onesignal.com](https://onesignal.com)
   - Click "Sign Up Free"
   - Choose the **Free** tier (10,000 subscribers, unlimited notifications)

2. **Create a New App**
   - After signing up, click "New App/Website"
   - Enter app name: **"YardPass"** or **"Liventix"**
   - Select platform: **Apple iOS (APNs)**

---

## Step 2: Configure APNs in OneSignal

### Get Your APNs Key from Apple Developer

1. **Download APNs Authentication Key**
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Click **"+"** to create a new key
   - Enter a name (e.g., "YardPass Push Key")
   - Check **"Apple Push Notifications service (APNs)"**
   - Click **"Continue"** → **"Register"**
   - **Download the `.p8` file** (⚠️ You can only download this once!)
   - **Save the Key ID** (e.g., "ABC123XYZ")
   - **Note your Team ID** (found in top-right corner of Apple Developer Portal)

### Upload to OneSignal

1. **In OneSignal Dashboard:**
   - Go to **Settings** → **Platforms** → **Apple iOS (APNs)**
   - Upload your `.p8` file
   - Enter **Key ID** (from Apple Developer Portal)
   - Enter **Team ID** (from Apple Developer Portal)
   - Enter **Bundle ID**: `com.liventix.app`
   - Click **"Save"**

✅ OneSignal will automatically handle sandbox vs production APNs environments.

---

## Step 3: Get OneSignal Credentials

From your OneSignal dashboard:

1. **App ID**
   - Go to **Settings** → **Keys & IDs**
   - Copy the **OneSignal App ID** (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

2. **REST API Key**
   - Go to **Settings** → **Keys & IDs**
   - Click **"Rest API Key"** → **"Create New Key"**
   - Give it a name (e.g., "YardPass Push Server")
   - Copy the key (looks like: `YzA1Nm...`)

---

## Step 4: Add Credentials to Supabase

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Go to **Project Settings** → **Edge Functions** → **Secrets**

2. **Add Environment Variables:**
   ```
   ONESIGNAL_APP_ID=your_app_id_here
   ONESIGNAL_REST_API_KEY=your_rest_api_key_here
   ```

   Click **"Save"** for each secret.

---

## Step 5: Deploy Edge Function

The Edge Function is already created at:
```
supabase/functions/send-push-notification/index.ts
```

**Deploy it:**
```bash
npx supabase functions deploy send-push-notification
```

---

## Step 6: Test Push Notifications

### Test from Supabase Dashboard

1. **Open Supabase SQL Editor**
2. **Run this query** (replace `YOUR_USER_ID` with a test user ID):

```sql
SELECT net.http_post(
  url := current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
  ),
  body := jsonb_build_object(
    'user_id', 'YOUR_USER_ID',
    'title', 'Test Notification',
    'body', 'This is a test push notification!',
    'data', jsonb_build_object('type', 'test')
  )
) AS result;
```

### Or Use curl

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "title": "Test Notification",
    "body": "This is a test push notification!",
    "data": {"type": "test"}
  }'
```

---

## Step 7: Configure iOS App

### In Xcode

1. **Enable Push Notifications Capability**
   - Open `ios/App/App.xcodeproj` in Xcode
   - Select your project → **Signing & Capabilities**
   - Click **"+ Capability"**
   - Add **"Push Notifications"**
   - Add **"Background Modes"** → Check **"Remote notifications"**

2. **Verify Bundle ID**
   - Must match: `com.liventix.app`
   - Same as in `capacitor.config.ts` → `appId`

3. **Rebuild App**
   ```bash
   npx cap sync ios
   ```

---

## Step 8: Test on Device

1. **Install app on iOS device** (via TestFlight or direct install)
2. **Grant push notification permission** (when prompted)
3. **Verify token is stored** in `user_devices` table:
   ```sql
   SELECT * FROM user_devices WHERE user_id = 'YOUR_USER_ID';
   ```
4. **Send test notification** (see Step 6)
5. **Verify notification appears** on device

---

## Troubleshooting

### "No devices found" error
- ✅ Check that user has granted push notification permission
- ✅ Verify token exists in `user_devices` table
- ✅ Ensure `active = true` in database

### Notifications not received
- ✅ Check OneSignal dashboard → **Delivery** tab for errors
- ✅ Verify APNs key is correctly configured in OneSignal
- ✅ Check device is connected to internet
- ✅ Ensure app is using correct bundle ID

### Token not stored
- ✅ Check browser console for errors
- ✅ Verify `user_devices` table exists and has correct permissions
- ✅ Check RLS policies allow user to insert their own tokens

---

## Next Steps

- ✅ Set up database triggers for automatic notifications (comments, likes, etc.)
- ✅ Implement context-aware permission prompts (see `NotificationPermissionPrompt.tsx`)
- ✅ Add notification analytics tracking
- ✅ Set up notification preferences in user settings

---

## Resources

- [OneSignal Documentation](https://documentation.onesignal.com/)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Apple APNs Documentation](https://developer.apple.com/documentation/usernotifications)

---

**Status**: ✅ Ready to configure - follow steps above to complete setup.



