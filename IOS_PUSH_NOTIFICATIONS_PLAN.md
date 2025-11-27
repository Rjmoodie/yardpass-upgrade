# iOS Push Notifications Implementation Plan 🔔

## Current Status

✅ **Plugin Installed**: `@capacitor/push-notifications` v7.0.3  
✅ **Hook Created**: `src/hooks/usePushNotifications.ts`  
✅ **Config Ready**: `capacitor.config.ts` has PushNotifications plugin configured  
✅ **Token Storage**: Database table `user_devices` exists for storing APNs tokens  

⚠️ **Missing**: iOS-specific configuration (APNs certificates, entitlements)  
⚠️ **Missing**: Backend push notification service to send notifications  
⚠️ **Missing**: Permission prompt UI/flow  

---

## Phase 1: iOS Configuration (Native Setup)

### 1.1 Apple Developer Portal Setup

**Required:**
1. **APNs Certificate or Key**
   - Option A: APNs Authentication Key (recommended)
     - Login to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
     - Create new key → Enable "Apple Push Notifications service (APNs)"
     - Download `.p8` key file (only downloadable once!)
     - Save Key ID and Team ID
   
   - Option B: APNs Certificate (legacy)
     - Create CSR in Keychain Access
     - Upload to Apple Developer Portal → Create APNs Certificate
     - Download and import to Keychain
     - Export as `.p12` with password

2. **App ID Configuration**
   - Ensure `com.liventix.app` has Push Notifications capability enabled
   - Verify in Xcode: Project → Signing & Capabilities → + Capability → Push Notifications

3. **Provisioning Profile**
   - Must include Push Notifications entitlement
   - Regenerate if needed after enabling capability

### 1.2 Xcode Configuration

**In `ios/App/App.xcodeproj`:**

1. **Enable Push Notifications Capability**
   ```
   - Open Xcode
   - Select project → Signing & Capabilities
   - Click "+ Capability"
   - Add "Push Notifications"
   - Add "Background Modes" → Check "Remote notifications"
   ```

2. **Update Info.plist (if needed)**
   ```xml
   <key>UIBackgroundModes</key>
   <array>
     <string>remote-notification</string>
   </array>
   ```

3. **Verify Bundle Identifier**
   - Must match: `com.liventix.app`
   - Same as in `capacitor.config.ts` → `appId`

### 1.3 Capacitor Configuration

**Already configured in `capacitor.config.ts`:**
```typescript
PushNotifications: {
  presentationOptions: ['badge', 'sound', 'alert']
}
```

**✅ No changes needed** - configuration is correct.

---

## Phase 2: Backend Push Notification Service

⚠️ **IMPORTANT DECISION POINT**: You have two implementation options:

### Option A: Push Provider Service (Recommended for Speed & Reliability)
**Use a specialized push provider** that handles APNs complexity for you:
- ✅ **OneSignal** - Free tier, easy setup, handles APNs + FCM
- ✅ **Firebase Cloud Messaging (FCM)** - Google's service, works with APNs
- ✅ **Expo Push Notification Service** - Simple API, works with Capacitor
- ✅ **Pusher Beams** - Simple API, good free tier

**Pros:**
- ✅ No HTTP/2 or JWT implementation needed
- ✅ Handles token invalidation automatically
- ✅ Built-in analytics and delivery tracking
- ✅ Retry logic and error handling included
- ✅ Production-ready immediately

**Cons:**
- ⚠️ **External dependency** - Your notifications depend on a third-party service (if OneSignal goes down, your notifications stop). However, these services are highly reliable (99.9%+ uptime) and you can switch providers if needed.
- ⚠️ **Potential cost at scale** - Free tiers typically cover moderate usage (e.g., OneSignal free up to 10,000 subscribers). At very large scale (millions of users), paid tiers apply. However, the engineering time saved usually outweighs the cost until you reach massive scale.

---

### Option B: Direct APNs Implementation (Advanced)
**Implement APNs HTTP/2 + JWT directly in Supabase Edge Function**

**Pros:**
- ✅ Full control over delivery
- ✅ No external dependencies
- ✅ Potentially lower cost at scale

**Cons:**
- ⚠️ **Significant engineering effort** (HTTP/2 client, JWT signing, error handling)
- ⚠️ Must handle token invalidation manually
- ⚠️ Must implement retry logic
- ⚠️ Debugging APNs errors is complex

---

### 2.1 Recommended: Using OneSignal (Option A - Easiest)

**Setup Steps:**

1. **Create OneSignal Account**
   - Sign up at [onesignal.com](https://onesignal.com)
   - Create new app → Select "Apple iOS (APNs)"

2. **Configure APNs in OneSignal**
   - Upload your `.p8` APNs key
   - Enter Key ID and Team ID
   - Select bundle ID: `com.liventix.app`

3. **Supabase Edge Function with OneSignal**

**Create**: `supabase/functions/send-push-notification/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, data, badge } = await req.json();

    // Get device tokens for user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('push_token, platform')
      .eq('user_id', user_id)
      .eq('platform', 'ios')
      .not('push_token', 'is', null);

    if (error || !devices?.length) {
      return new Response(
        JSON.stringify({ error: 'No devices found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via OneSignal API
    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: devices.map(d => d.push_token),
        headings: { en: title },
        contents: { en: body },
        data: data || {},
        ios_badgeType: 'Increase',
        ios_badgeCount: badge || 1,
      }),
    });

    const result = await oneSignalResponse.json();

    if (!oneSignalResponse.ok) {
      throw new Error(`OneSignal error: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    // Remove invalid tokens (OneSignal returns them in errors)
    if (result.errors?.invalid_player_ids?.length) {
      const invalidTokens = result.errors.invalid_player_ids;
      await supabase
        .from('user_devices')
        .delete()
        .in('push_token', invalidTokens);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: result.recipients || devices.length,
        id: result.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Environment Variables:**
```
ONESIGNAL_APP_ID=your_app_id
ONESIGNAL_REST_API_KEY=your_rest_api_key
```

---

### 2.2 Alternative: Direct APNs Implementation (Option B - Advanced)

⚠️ **Warning**: This requires implementing HTTP/2 client and JWT signing in Deno. Consider Option A first.

**If you choose this route**, you'll need to:
1. Find or implement an HTTP/2 client for Deno
2. Implement JWT signing with ES256 algorithm
3. Handle APNs token-based authentication
4. Implement error handling (410 Unregistered, 400 BadRequest, etc.)
5. Handle token invalidation when APNs returns 410
6. Support both sandbox and production APNs endpoints

**Recommended library approach:**
- Use Deno's native HTTP/2 support
- Use a JWT library like `djwt` for signing
- Reference: [APNs HTTP/2 API Documentation](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)

---

### 2.3 Environment Separation: Sandbox vs Production

**Critical**: APNs has two environments:

1. **Sandbox** - Used for:
   - Development builds
   - TestFlight builds
   - Debug builds

2. **Production** - Used for:
   - App Store builds
   - Production releases

**OneSignal handles this automatically** - it detects the build type and uses the correct APNs endpoint.

**If implementing direct APNs**, you must:
```typescript
const APNS_ENDPOINT = Deno.env.get('NODE_ENV') === 'production'
  ? 'https://api.push.apple.com'  // Production
  : 'https://api.sandbox.push.apple.com';  // Sandbox
```

### 2.3 Database Trigger for Auto-Sending Notifications

**Create migration**: `supabase/migrations/YYYYMMDD_create_push_notification_triggers.sql`

⚠️ **Important**: Triggers calling Edge Functions should use `SERVICE_ROLE_KEY` (not anon key) for internal calls:

```sql
-- Trigger function to send push notifications on events
CREATE OR REPLACE FUNCTION public.send_event_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get Supabase URL and service role key from settings
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.supabase_service_role_key', true);
  
  -- Send notification when:
  -- - New comment on user's post
  -- - New like on user's post
  -- - Event reminder (1 hour before start)
  -- - Ticket purchase confirmation
  
  -- Use SERVICE_ROLE key for internal trigger calls (no user auth needed)
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id, -- or appropriate user
      'title', 'Notification Title',
      'body', 'Notification Body',
      'data', jsonb_build_object('type', 'event', 'id', NEW.event_id)
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.4 Auth & CORS Considerations

**For internal triggers (database → Edge Function):**
- ✅ Use `SERVICE_ROLE_KEY` in Authorization header
- ✅ No user JWT required (trigger is system-initiated)
- ✅ Set Supabase settings: `app.supabase_url` and `app.supabase_service_role_key`

**For external calls (admin/organizer tools → Edge Function):**
- ⚠️ Require user authentication
- ⚠️ Check user role/permissions
- ⚠️ Validate user has permission to send notification to target user

**Recommended**: Create two Edge Functions:
1. `send-push-notification` - Internal (trigger calls, uses SERVICE_ROLE)
2. `send-push-notification-admin` - External (admin calls, requires user auth + role check)

---

## Phase 3: Frontend Permission & Registration Flow

### 3.1 Permission Prompt UX Flow (Critical for Opt-In Rate)

⚠️ **DO NOT prompt immediately on first app launch** - iOS reviewers dislike this and users are less likely to grant permission.

**Recommended Flow:**

1. **First Launch**: Do nothing - let user explore app
2. **After User Engagement** (2-3 sessions or specific actions):
   - User enables "Event reminders" in settings, OR
   - User follows an organizer/event, OR
   - User purchases a ticket
3. **Show Custom In-App Prompt** (your UI, not iOS system dialog)
4. **If User Taps "Enable"**: THEN call `PushNotifications.requestPermissions()`
5. **If User Taps "Not Now"**: Show prompt again later (after more engagement)

**Why this works:**
- ✅ Users understand WHY they need notifications
- ✅ Higher opt-in rates (context matters)
- ✅ iOS App Review prefers this approach
- ✅ Feels seamless and intentional

### 3.2 Permission Prompt UI Component

**Create**: `src/components/NotificationPermissionPrompt.tsx`

```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Bell } from 'lucide-react';

export function NotificationPermissionPrompt({ isOpen, onClose, context }: {
  isOpen: boolean;
  onClose: () => void;
  context?: 'event' | 'follow' | 'ticket' | 'general';
}) {
  const { requestPermission, permission } = usePushNotifications();

  const handleEnable = async () => {
    // Close custom dialog first
    onClose();
    // Then show iOS system permission dialog
    await requestPermission();
  };

  const getContextualMessage = () => {
    switch (context) {
      case 'event':
        return 'Get notified when events you\'re interested in start or get updated.';
      case 'follow':
        return 'Stay updated when organizers you follow post new events.';
      case 'ticket':
        return 'Receive reminders before your events start.';
      default:
        return 'Get notified about new comments, likes, and event updates.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-6 w-6 text-primary" />
            <DialogTitle>Enable Notifications</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {getContextualMessage()}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={handleEnable} className="w-full">
            Enable Notifications
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Not Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3.3 Enhanced Hook with Token Lifecycle Management

**Update**: `src/hooks/usePushNotifications.ts` with full token lifecycle:

```typescript
// Key improvements needed:

// 1. Token Refresh Handling
PushNotifications.addListener('registration', async (token) => {
  // iOS can change tokens - update existing record, don't create duplicates
  await supabase.from('user_devices').upsert({
    user_id: user.id,
    platform: 'ios',
    push_token: token.value,
    app_version: getAppVersion(), // Track app version
    device_model: await getDeviceModel(), // Track device model
    last_seen_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,push_token', // Update if exists
  });
});

// 2. Registration Error Handling
PushNotifications.addListener('registrationError', async (error) => {
  console.error('Push registration error:', error);
  // Log to analytics/error tracking
  // Optionally show user-friendly message
});

// 3. Logout Cleanup
useEffect(() => {
  if (!user && Capacitor.isNativePlatform()) {
    // On logout: Optionally delete device tokens
    // OR: Keep tokens but mark as inactive (for re-engagement later)
    // Recommendation: Mark as inactive, don't delete
  }
}, [user]);

// 4. Token Invalidation Handling
// When backend receives 410 Unregistered from APNs:
// - Edge Function should delete/update the token
// - Frontend will get new token on next app launch
```

### 3.4 Context-Aware Permission Prompting

**Where to show prompts:**

```typescript
// Example: Show prompt when user enables event reminders
function EventSettings() {
  const [showPrompt, setShowPrompt] = useState(false);
  const { permission } = usePushNotifications();

  const handleToggleReminders = async () => {
    if (!permission.granted) {
      // Show custom prompt first
      setShowPrompt(true);
    } else {
      // Already granted, enable reminders
      // ... save setting
    }
  };

  return (
    <>
      <Switch 
        checked={remindersEnabled} 
        onCheckedChange={handleToggleReminders}
      />
      <NotificationPermissionPrompt
        isOpen={showPrompt}
        onClose={() => setShowPrompt(false)}
        context="event"
      />
    </>
  );
}
```

### 3.5 Hook Improvements Needed

**Current hook needs these additions:**

✅ **Token refresh handling** - Update existing tokens, don't create duplicates  
✅ **Device info tracking** - Store app_version, device_model for analytics  
✅ **Logout cleanup** - Mark tokens inactive (don't delete)  
✅ **Registration error logging** - Track failures for debugging  
✅ **Token invalidation** - Handle when backend reports invalid tokens

---

## Phase 4: Testing

### 4.1 Development Testing

1. **Test Token Registration**
   ```typescript
   // In app, check console for:
   console.log('APNs token received:', token.value);
   // Verify in database: SELECT * FROM user_devices WHERE user_id = '...';
   ```

2. **Test Permission Flow**
   - First launch → permission prompt
   - Deny → check permission state
   - Allow → verify token registration

3. **Test Notification Receipt**
   - Send test notification via Supabase Edge Function
   - Verify appears on device
   - Verify deep linking works

### 4.2 Production Testing

1. **APNs Environment**
   - Development: Uses sandbox APNs (for TestFlight/debug builds)
   - Production: Uses production APNs (for App Store builds)

2. **TestFlight Build**
   - Upload build to TestFlight
   - Install on test device
   - Verify notifications work

3. **App Store Build**
   - After App Store approval
   - Monitor notification delivery rates
   - Check error logs in Supabase

---

## Phase 5: Common Notification Types

### 5.1 Event-Based Notifications

- ✅ **New Comment**: When someone comments on user's post
- ✅ **New Like**: When someone likes user's post
- ✅ **Event Reminder**: 1 hour before event start
- ✅ **Ticket Purchase**: Confirmation after purchase
- ✅ **Event Update**: When organizer updates event details

### 5.2 Deep Link Routing

**Already implemented in hook:**
```typescript
if (data?.type === 'event' && data.id) {
  navigate(`/e/${data.id}`);
} else if (data?.type === 'post' && data.id) {
  navigate(`/post/${data.id}`);
}
```

---

## Phase 6: Token Lifecycle & Error Handling

### 6.1 Complete Token Lifecycle Management

**Token States:**
1. **Registration** → Save to `user_devices` with `active = true`
2. **Refresh** → Update existing token (iOS can change tokens)
3. **Invalidation** → Mark `active = false` when APNs returns 410
4. **Logout** → Optionally mark inactive (keep for re-engagement)
5. **Re-engagement** → Reactivate token when user logs back in

**Database Schema Update Needed:**
```sql
ALTER TABLE user_devices 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS app_version TEXT,
ADD COLUMN IF NOT EXISTS device_model TEXT,
ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_devices_active 
ON user_devices(user_id, platform, active) 
WHERE active = true;
```

### 6.2 Error Handling in Edge Function

**Handle APNs Errors Properly:**
```typescript
// In send-push-notification Edge Function:

if (oneSignalResponse.status === 200) {
  const result = await oneSignalResponse.json();
  
  // Remove invalid tokens (410 Unregistered)
  if (result.errors?.invalid_player_ids?.length) {
    const invalidTokens = result.errors.invalid_player_ids;
    await supabase
      .from('user_devices')
      .update({ active: false, last_seen_at: new Date().toISOString() })
      .in('push_token', invalidTokens);
  }
  
  // Log successful deliveries
  // Track metrics for analytics
}
```

### 6.3 Monitoring & Analytics

**Key Metrics to Track:**
- ✅ **Permission grant rate** - % of users who enable notifications
- ✅ **Token registration rate** - % of granted users with valid tokens
- ✅ **Delivery rate** - sent vs delivered (via OneSignal dashboard or APNs feedback)
- ✅ **Open rate** - tapped vs delivered (track deep link opens)
- ✅ **Token refresh rate** - how often iOS changes tokens
- ✅ **Invalidation rate** - how often tokens become invalid

**Tools:**
- OneSignal dashboard (if using Option A)
- Custom analytics table in Supabase
- Error logging (Sentry, LogRocket, etc.)

### 6.4 Retry Logic & Queue

**For failed notifications:**
- ✅ Queue failed sends for retry
- ✅ Exponential backoff (1min, 5min, 30min, 2hr)
- ✅ Max retries (3-5 attempts)
- ✅ Dead letter queue for permanent failures

---

## Deployment Checklist

### iOS Native Configuration
- [ ] APNs Authentication Key (.p8) downloaded and stored securely
- [ ] Key ID and Team ID documented
- [ ] Xcode: Push Notifications capability enabled
- [ ] Xcode: Background Modes → Remote notifications enabled
- [ ] Provisioning profile regenerated with Push Notifications
- [ ] Bundle ID matches: `com.liventix.app`

### Backend Setup
- [ ] **If using OneSignal (Recommended):**
  - [ ] OneSignal account created
  - [ ] APNs key uploaded to OneSignal
  - [ ] OneSignal App ID saved to Supabase secrets
  - [ ] OneSignal REST API Key saved to Supabase secrets
- [ ] **If using Direct APNs (Advanced):**
  - [ ] APNs Key ID saved to Supabase secrets
  - [ ] APNs Team ID saved to Supabase secrets
  - [ ] APNs Key content added to Supabase secrets
- [ ] Edge Function `send-push-notification` deployed
- [ ] Database migration for push notification triggers applied
- [ ] Supabase settings configured (`app.supabase_url`, `app.supabase_service_role_key`)

### Frontend Implementation
- [ ] Hook updated with full token lifecycle management
- [ ] Permission prompt UI component created
- [ ] Context-aware prompting implemented (show after engagement)
- [ ] Token refresh handling implemented
- [ ] Logout cleanup implemented
- [ ] Deep linking tested

### Testing
- [ ] TestFlight build created
- [ ] Token registration verified in database
- [ ] Permission flow tested (deny/allow)
- [ ] Test notification sent successfully
- [ ] Notification tap → deep link works
- [ ] Token refresh on app update tested
- [ ] Invalid token cleanup verified

### Production
- [ ] App Store build created
- [ ] Production APNs environment verified
- [ ] Notification delivery rate monitored
- [ ] Error logging configured
- [ ] Analytics tracking enabled

---

## Resources

- [Capacitor Push Notifications Docs](https://capacitorjs.com/docs/apis/push-notifications)
- [Apple APNs Documentation](https://developer.apple.com/documentation/usernotifications)
- [APNs HTTP/2 API](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## Next Steps

1. **Immediate**: Download APNs key from Apple Developer Portal
2. **This Week**: Configure Xcode project with Push Notifications capability
3. **This Week**: Create Edge Function for sending notifications
4. **Next Week**: Implement permission prompt UI
5. **Testing**: TestFlight build and verification

---

**Status**: ⚠️ Ready to implement - waiting on Apple Developer Portal access and APNs key setup.


