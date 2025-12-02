# 📋 Legal Pages - Where They're Referenced

**Last Updated:** 2025-01-14

---

## 🔗 **Route Definitions**

### File: `src/App.tsx`

**Imports (Lines 90-93):**
```typescript
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const RefundPolicy = lazy(() => import('@/pages/RefundPolicy'));
const CommunityGuidelines = lazy(() => import('@/pages/CommunityGuidelines'));
```

**Routes (Lines 491-497):**
```typescript
<Route path="/privacy" element={<PrivacyPolicy onBack={() => navigate('/')} />} />
<Route path="/privacy-policy" element={<PrivacyPolicy onBack={() => navigate('/')} />} />
<Route path="/terms" element={<TermsOfService onBack={() => navigate('/')} />} />
<Route path="/terms-of-service" element={<TermsOfService onBack={() => navigate('/')} />} />
<Route path="/refund-policy" element={<RefundPolicy onBack={() => navigate('/')} />} />
<Route path="/community-guidelines" element={<CommunityGuidelines onBack={() => navigate('/')} />} />
<Route path="/guidelines" element={<CommunityGuidelines onBack={() => navigate('/')} />} />
```

---

## 🔗 **UI Links & References**

### 1. Cookie Consent Banner
**File:** `src/components/CookieConsentBanner.tsx` (Lines 239-247)

**Links:**
- Privacy Policy: `/privacy-policy`
- Terms of Service: `/terms-of-service`
- Community Guidelines: `/community-guidelines`

**Context:** Footer links in the expanded cookie consent banner

---

### 2. Web Landing Page Footer
**File:** `src/components/landing/WebLandingPage.tsx` (Lines 527-529)

**Links:**
- Privacy: `/privacy`
- Terms: `/terms`
- Guidelines: `/community-guidelines`

**Context:** Footer navigation links on the marketing landing page

---

### 3. Email Templates
**File:** `src/components/EmailTemplates.tsx` (Lines 174-182)

**Links:**
- Privacy Policy: `https://liventix.tech/privacy`
- Terms of Service: `https://liventix.tech/terms`
- Community Guidelines: `https://liventix.tech/community-guidelines`

**Context:** Footer links in email templates (BaseEmailLayout)

**Note:** These use absolute URLs with `liventix.tech` domain - may need to update to match your actual domain

---

## 📝 **Type References**

### Bottom Navigation Types
**File:** `src/components/nav/BottomTabs.tsx` (Lines 44-46)

**Type Definitions:**
```typescript
| 'privacy-policy'
| 'terms-of-service'
| 'refund-policy'
```

**Context:** Type definitions for navigation screens (may be used for deep linking or navigation state)

---

## 🚫 **Unrelated References**

### RefundSettingsPanel
**File:** `src/components/organizer/RefundSettingsPanel.tsx`

**Note:** This file has a `RefundPolicy` interface, but it's unrelated to the legal page - it's for organizer refund settings configuration.

---

## 📊 **Summary**

### Routes Available:
- ✅ `/privacy` → Privacy Policy
- ✅ `/privacy-policy` → Privacy Policy (alternative)
- ✅ `/terms` → Terms of Service
- ✅ `/terms-of-service` → Terms of Service (alternative)
- ✅ `/refund-policy` → Refund Policy
- ✅ `/community-guidelines` → Community Guidelines
- ✅ `/guidelines` → Community Guidelines (short URL)

### Where They're Linked:
1. ✅ **Cookie Consent Banner** - All 3 main pages (Privacy, Terms, Guidelines)
2. ✅ **Web Landing Page Footer** - All 3 main pages
3. ✅ **Email Templates** - All 3 main pages (uses absolute URLs)

### Missing Links:
- ❌ **Settings Page** - No links to legal pages (could add)
- ❌ **Footer Component** - If there's a global footer, it's not linking to these
- ❌ **Signup/Login Pages** - No links to Terms/Privacy during signup
- ❌ **Profile/Settings** - No legal page links in user settings

---

## 🎯 **Recommendations**

### Add Links To:
1. **Settings Page** (`src/pages/new-design/SettingsPage.tsx`)
   - Add a "Legal" section with links to all 4 pages

2. **Signup Flow** (`src/components/auth/SmartAuthModal.tsx`)
   - Add "By signing up, you agree to our Terms of Service and Privacy Policy" with links

3. **Global Footer** (if exists)
   - Add standard footer links

4. **Email Templates**
   - Update domain from `liventix.tech` to your actual domain (or use relative paths)

---

## 🔍 **Quick Access URLs**

For local development:
```
http://localhost:5173/privacy
http://localhost:5173/terms
http://localhost:5173/refund-policy
http://localhost:5173/community-guidelines
```

For production (replace with your domain):
```
https://yourdomain.com/privacy
https://yourdomain.com/terms
https://yourdomain.com/refund-policy
https://yourdomain.com/community-guidelines
```

