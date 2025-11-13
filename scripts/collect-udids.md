# Device UDID Collection Guide

## Quick UDID Collection Methods

### Method 1: Online UDID Collector (Easiest)
1. Send this link to your testers: **https://udid.tech**
2. Ask them to open it on their iOS device
3. The UDID will be displayed automatically
4. They can copy/paste it to you

### Method 2: iTunes/Finder (Mac Users)
1. Connect device to Mac
2. Open Finder (Catalina+) or iTunes (older)
3. Click on device name
4. Click on "Serial Number" to reveal UDID
5. Copy the UDID

### Method 3: Settings App (iOS 14+)
1. Go to Settings > General > About
2. Look for "Identifier" or "UDID"
3. Long press to copy

## Sample Email to Testers

```
Subject: Liventix Beta Testing - Device Registration Required

Hi [Tester Name],

Thank you for agreeing to test Liventix! To install the app on your device, I need your device's UDID.

Please follow these steps:
1. Open this link on your iOS device: https://udid.tech
2. Copy the UDID that appears
3. Reply to this email with your UDID

Once I have your UDID, I'll send you the installation instructions.

Thanks!
[Your Name]
```

## UDID Format
UDIDs look like this:
`00008020-001234567890ABCD`

## Device Registration Template
When you collect UDIDs, organize them like this:

| Device Name | UDID | iOS Version | Owner |
|-------------|------|-------------|-------|
| John's iPhone 15 | 00008020-001234567890ABCD | 17.2 | John Smith |
| Sarah's iPhone 14 | 00008020-001234567890EFGH | 17.1 | Sarah Johnson |

## Next Steps After Collection
1. Register devices in Apple Developer Portal
2. Create ad hoc provisioning profile
3. Build IPA with GitHub Actions
4. Distribute to testers

