# OneSignal Quick Start Checklist ✅

Follow these steps to enable iOS push notifications:

## 1. OneSignal Account Setup (5 minutes)
- [ ] Sign up at [onesignal.com](https://onesignal.com) (Free tier)
- [ ] Create new app → Select "Apple iOS (APNs)"
- [ ] Copy your **OneSignal App ID** from Settings → Keys & IDs

## 2. APNs Configuration (10 minutes)
- [ ] Download APNs `.p8` key from [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
  - Create new key → Enable "Apple Push Notifications service (APNs)"
  - Save Key ID and Team ID
- [ ] Upload `.p8` key to OneSignal: Settings → Platforms → Apple iOS (APNs)
  - Enter Key ID, Team ID, Bundle ID: `com.liventix.app`
- [ ] Create REST API Key in OneSignal: Settings → Keys & IDs → Create New Key

## 3. Supabase Configuration (2 minutes)
- [ ] Add secrets in Supabase Dashboard → Project Settings → Edge Functions → Secrets:
  ```
  ONESIGNAL_APP_ID=your_app_id
  ONESIGNAL_REST_API_KEY=your_rest_api_key
  ```

## 4. Deploy Edge Function (1 minute)
```bash
npx supabase functions deploy send-push-notification
```

## 5. Apply Database Migration (1 minute)
```bash
npx supabase db push
```

## 6. iOS Native Setup (5 minutes)
- [ ] Open `ios/App/App.xcodeproj` in Xcode
- [ ] Enable "Push Notifications" capability
- [ ] Enable "Background Modes" → "Remote notifications"
- [ ] Verify Bundle ID matches: `com.liventix.app`
- [ ] Run `npx cap sync ios`

## 7. Test (5 minutes)
- [ ] Install app on iOS device
- [ ] Grant push notification permission
- [ ] Verify token appears in database:
  ```sql
  SELECT * FROM user_devices WHERE platform = 'ios';
  ```
- [ ] Send test notification via Edge Function

---

**Total Time: ~30 minutes**

**See `ONESIGNAL_SETUP_GUIDE.md` for detailed instructions.**



