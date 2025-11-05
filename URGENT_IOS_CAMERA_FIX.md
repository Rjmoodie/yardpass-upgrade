# 🚨 URGENT: iOS Camera & Permissions Fix

> **Status:** BLOCKING - Camera uploads won't work, app may crash on iOS, App Store will reject

---

## Problem Summary

Your app is missing:
1. Camera & Geolocation Capacitor plugins
2. All iOS permissions in Info.plist
3. Camera integration code

---

## Step 1: Install Missing Plugins (5 minutes)

```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

# Install Camera plugin
npm install @capacitor/camera

# Install Geolocation plugin (for "Near Me" feature)
npm install @capacitor/geolocation

# Sync to iOS project
npx cap sync ios
```

---

## Step 2: Fix Info.plist - Add ALL Required Permissions (5 minutes)

**File:** `ios/App/App/Info.plist`

**Replace the entire file with this:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>YardPass</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>UIMainStoryboardFile</key>
	<string>Main</string>
	<key>UIRequiredDeviceCapabilities</key>
	<array>
		<string>armv7</string>
	</array>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UIViewControllerBasedStatusBarAppearance</key>
	<true/>

	<!-- ============================================== -->
	<!-- CRITICAL iOS PERMISSIONS - REQUIRED FOR APP   -->
	<!-- ============================================== -->

	<!-- Camera Access -->
	<key>NSCameraUsageDescription</key>
	<string>YardPass needs camera access to let you capture photos and videos for event posts and stories.</string>

	<!-- Photo Library Access (Reading) -->
	<key>NSPhotoLibraryUsageDescription</key>
	<string>YardPass needs access to your photo library to let you select photos and videos for your posts.</string>

	<!-- Photo Library Access (Writing) -->
	<key>NSPhotoLibraryAddUsageDescription</key>
	<string>YardPass needs permission to save photos and videos to your library.</string>

	<!-- Location Access (When In Use) -->
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>YardPass uses your location to show nearby events and improve your event recommendations.</string>

	<!-- Location Access (Always - Optional, only if needed for background) -->
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>YardPass uses your location to notify you about nearby events even when the app is in the background.</string>

	<!-- Allow HTTPS to Supabase & External APIs -->
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<false/>
		<key>NSExceptionDomains</key>
		<dict>
			<!-- Supabase -->
			<key>supabase.co</key>
			<dict>
				<key>NSExceptionAllowsInsecureHTTPLoads</key>
				<false/>
				<key>NSIncludesSubdomains</key>
				<true/>
				<key>NSExceptionRequiresForwardSecrecy</key>
				<true/>
			</dict>
			<!-- Stripe -->
			<key>stripe.com</key>
			<dict>
				<key>NSExceptionAllowsInsecureHTTPLoads</key>
				<false/>
				<key>NSIncludesSubdomains</key>
				<true/>
			</dict>
		</dict>
	</dict>

	<!-- Allow Universal Links (Deep Linking) -->
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:yardpass.app</string>
		<string>applinks:www.yardpass.app</string>
	</array>

	<!-- App Capabilities -->
	<key>UIBackgroundModes</key>
	<array>
		<string>remote-notification</string>
	</array>

</dict>
</plist>
```

---

## Step 3: Add Camera Integration to PostCreatorModal (15 minutes)

**File:** `src/components/PostCreatorModal.tsx`

Add this hook at the top of your component:

```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

// Inside your component, add these functions:

const isNative = Capacitor.isNativePlatform();

// Function to capture photo with camera
const capturePhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      saveToGallery: false,
      correctOrientation: true
    });

    if (!image.webPath) return;

    // Convert to blob for upload
    const response = await fetch(image.webPath);
    const blob = await response.blob();
    
    // Create File object
    const file = new File([blob], `photo_${Date.now()}.jpg`, { 
      type: 'image/jpeg' 
    });

    // Add to your existing upload queue
    // (Use your existing uploadMedia function)
    await uploadMedia([file]);

  } catch (error) {
    console.error('Camera error:', error);
    toast.error('Failed to capture photo');
  }
};

// Function to pick photos from library
const pickPhotos = async () => {
  try {
    const images = await Camera.pickImages({
      quality: 90,
      limit: 10 // Max 10 photos
    });

    if (!images.photos.length) return;

    // Convert all photos to files
    const files = await Promise.all(
      images.photos.map(async (photo) => {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        return new File([blob], `photo_${Date.now()}.jpg`, { 
          type: 'image/jpeg' 
        });
      })
    );

    // Add to your existing upload queue
    await uploadMedia(files);

  } catch (error) {
    console.error('Photo picker error:', error);
    toast.error('Failed to select photos');
  }
};
```

**Update your media upload buttons:**

```typescript
{/* Replace your existing file input with these buttons */}
<div className="flex gap-2">
  {isNative ? (
    <>
      {/* Native Camera Button */}
      <Button
        type="button"
        variant="outline"
        onClick={capturePhoto}
        disabled={uploading}
      >
        <Camera className="h-4 w-4 mr-2" />
        Take Photo
      </Button>

      {/* Native Gallery Button */}
      <Button
        type="button"
        variant="outline"
        onClick={pickPhotos}
        disabled={uploading}
      >
        <ImageIcon className="h-4 w-4 mr-2" />
        Choose Photos
      </Button>
    </>
  ) : (
    // Keep your existing web file input as fallback
    <Button
      type="button"
      variant="outline"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
    >
      <ImageIcon className="h-4 w-4 mr-2" />
      Add Media
    </Button>
  )}
</div>
```

---

## Step 4: Add Geolocation Hook (10 minutes)

**Create:** `src/hooks/useGeolocation.ts`

```typescript
import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentPosition = async () => {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to browser geolocation
      return new Promise<UserLocation>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };
            setLocation(loc);
            resolve(loc);
          },
          (err) => {
            setError(err.message);
            reject(err);
          }
        );
      });
    }

    setLoading(true);
    setError(null);

    try {
      // Check permission first
      const permission = await Geolocation.checkPermissions();
      
      if (permission.location === 'denied') {
        throw new Error('Location permission denied');
      }

      if (permission.location === 'prompt') {
        // Request permission
        await Geolocation.requestPermissions();
      }

      // Get current position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      const loc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      setLocation(loc);
      return loc;

    } catch (err: any) {
      console.error('Geolocation error:', err);
      setError(err.message || 'Failed to get location');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    location,
    error,
    loading,
    getCurrentPosition
  };
};
```

**Use in your feed:**

```typescript
// In your feed component
import { useGeolocation } from '@/hooks/useGeolocation';

const FeedPage = () => {
  const { location, getCurrentPosition } = useGeolocation();

  // On "Near Me" filter click
  const handleNearMeFilter = async () => {
    try {
      const pos = await getCurrentPosition();
      // Use pos.lat and pos.lng in your feed API call
      fetchFeed({ userLat: pos.lat, userLng: pos.lng });
    } catch (error) {
      toast.error('Please enable location access');
    }
  };

  // ...
};
```

---

## Step 5: Test on Real iOS Device (20 minutes)

**IMPORTANT:** Camera and location **ONLY work on real devices**, not simulators!

```bash
# 1. Build app
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open Xcode
npx cap open ios

# 4. Connect iPhone via USB

# 5. In Xcode:
#    - Select your iPhone from device dropdown (top)
#    - Click Run (▶️)

# 6. Test these scenarios:
#    ✅ App launches without crashing
#    ✅ Tap "Take Photo" → iOS camera permission prompt appears
#    ✅ Allow camera → camera opens
#    ✅ Take photo → photo appears in upload queue
#    ✅ Tap "Choose Photos" → photo library opens
#    ✅ Select photos → photos appear in queue
#    ✅ Tap "Near Me" filter → location permission prompt appears
#    ✅ Allow location → events near you load
```

---

## Step 6: Verify Permissions in Xcode (5 minutes)

1. Open Xcode: `npx cap open ios`
2. Select `App` target in left sidebar
3. Go to **"Signing & Capabilities"** tab
4. Verify you see:
   - ✅ Associated Domains (for deep links)
   - ✅ Push Notifications (if needed)
5. Click **"+ Capability"** if missing any

---

## Common Issues & Fixes

### Issue: "Plugin Camera does not have method 'getPhoto'"
**Fix:** Run `npx cap sync ios` after installing plugin

### Issue: Camera crashes app
**Fix:** Check Info.plist has `NSCameraUsageDescription`

### Issue: "This app has crashed because it attempted to access privacy-sensitive data..."
**Fix:** Missing permission strings in Info.plist

### Issue: Photos appear rotated
**Fix:** Set `correctOrientation: true` in Camera.getPhoto()

### Issue: Can't test camera in simulator
**Fix:** Camera only works on real devices, use USB cable

---

## Checklist

- [ ] Install `@capacitor/camera` package
- [ ] Install `@capacitor/geolocation` package
- [ ] Update Info.plist with ALL permissions
- [ ] Add camera integration to PostCreatorModal
- [ ] Create useGeolocation hook
- [ ] Run `npx cap sync ios`
- [ ] Test on REAL iOS device (not simulator)
- [ ] Verify camera permission prompt appears
- [ ] Verify photo library access works
- [ ] Verify location permission prompt appears
- [ ] Verify "Near Me" filter works

---

## Time Estimate
- **Total:** 1-2 hours
- **Critical path:** Steps 1-3 (Camera + Permissions)
- **Testing:** Must use real iPhone

---

## Next Steps After This Fix

Once camera works:
1. ✅ Test media upload to Supabase Storage
2. ✅ Test video recording (similar to photos)
3. ✅ Set up Push Notifications with APNs
4. ✅ Configure Universal Links for deep linking

---

**Status:** 🚨 BLOCKING - Fix this first before anything else!






