# Ad Hoc Distribution Setup for YardPass

## Prerequisites
- Apple Developer Account ✅ (You have this!)
- Physical iOS devices for testing
- Device UDIDs (Unique Device Identifiers)

## Step 1: Collect Device UDIDs

### Method 1: iTunes/Finder (Mac)
1. Connect device to Mac
2. Open Finder (macOS Catalina+) or iTunes (older macOS)
3. Select your device
4. Click on Serial Number to reveal UDID
5. Copy the UDID

### Method 2: Device Settings
1. Go to Settings > General > About
2. Look for "Identifier" or "UDID"
3. Long press to copy

### Method 3: Online Tools
- Visit: https://udid.tech (on the device)
- UDID will be displayed and can be copied

## Step 2: Register Devices in Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to: **Certificates, Identifiers & Profiles** > **Devices**
3. Click **+** to add new device
4. Enter:
   - Device Name: "John's iPhone" (descriptive name)
   - Device UDID: [paste from step 1]
5. Click **Continue** > **Register**

## Step 3: Create Ad Hoc Provisioning Profile

1. In Apple Developer Portal, go to **Profiles**
2. Click **+** to create new profile
3. Select **Ad Hoc** under **Distribution**
4. Choose your App ID: `com.yardpass.app`
5. Select the certificate for your Apple ID
6. Choose all registered devices
7. Name the profile: "YardPass Ad Hoc"
8. Download the `.mobileprovision` file

## Step 4: Update GitHub Actions for Ad Hoc Build

The workflow needs to be modified to:
- Use the ad hoc provisioning profile
- Build for device (not simulator)
- Create an IPA file for distribution

## Step 5: Install on Devices

### Method 1: Direct Installation
- Send IPA file to testers
- Install via tools like 3uTools, iFunbox, or AltStore

### Method 2: Web Distribution
- Upload IPA to a web server
- Create a manifest file
- Users can install directly from Safari

## Device Limit
- **100 devices per year** per Apple Developer account
- Devices can be removed and re-added
- Reset happens annually on your account anniversary

## Testing Features Available
✅ Push notifications
✅ Camera/QR scanning  
✅ Apple Pay
✅ Location services
✅ Biometric authentication
✅ All native iOS features

