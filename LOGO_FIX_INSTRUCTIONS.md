# Logo Fix Instructions

## Issue
The logo file `liventix-logo.png` is not accessible at the expected Supabase storage path, causing the error:
```json
{"error": "requested path is invalid"}
```

## Solutions

### Option 1: Upload Logo to Supabase Storage (Recommended)

1. **Go to Supabase Dashboard** → Storage
2. **Create or select a bucket** named `public` (must be public)
3. **Upload** `liventix-logo.png` to the root of the bucket
4. **Update the URL** in `src/components/EmailTemplates.tsx`:
   ```typescript
   const liventixLogo = 'https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/public/liventix-logo.png';
   ```

### Option 2: Host Logo on Your Domain/CDN

1. Upload logo to your app's public folder or CDN
2. Update the URL in `src/components/EmailTemplates.tsx`:
   ```typescript
   const liventixLogo = 'https://liventix.tech/liventix-logo.png';
   ```

### Option 3: Use a Placeholder (Temporary)

The code currently uses a placeholder. To use a real logo, replace the placeholder URL with your actual logo URL.

## Current Status

- ✅ Navigation issue in FollowListModal fixed (uses React Router navigate)
- ⚠️ Logo URL needs to be updated once file is uploaded
- ✅ Fallback placeholder in place to prevent errors

## Files to Update

1. `src/components/EmailTemplates.tsx` - Line 104 (logo URL)
2. `supabase/functions/send-purchase-confirmation/index.ts` - Line 130 (getLogoUrl function)

