# 🔒 Secure Checkout - File Reference

**Date:** November 28, 2025  
**Component:** Secure Checkout Payment Flow

---

## 📁 **Main Files**

### **1. Frontend Component**
**File:** `src/components/EventCheckoutSheet.tsx`  
**Purpose:** Main checkout UI component with Stripe Embedded Checkout

**Key Features:**
- Two-step flow: "select" (ticket selection) → "pay" (Stripe checkout)
- Guest checkout support (email/name fields)
- Stripe Embedded Checkout integration
- Real-time inventory updates
- Session expiration timer

**Key Sections:**
- **Line 559:** "Secure Checkout" heading
- **Line 575-577:** Stripe `EmbeddedCheckoutProvider` and `EmbeddedCheckout`
- **Line 361:** `DialogContent` wrapper (the modal container)

---

### **2. Backend Edge Functions**

#### **A. Enhanced Checkout**
**File:** `supabase/functions/enhanced-checkout/index.ts`  
**Purpose:** Creates Stripe checkout session with ticket holds

**What it does:**
- Reserves tickets atomically
- Creates Stripe PaymentIntent/Checkout Session
- Returns `client_secret` for embedded checkout
- Handles idempotency

#### **B. Guest Checkout**
**File:** `supabase/functions/guest-checkout/index.ts`  
**Purpose:** Checkout flow for non-authenticated users

**What it does:**
- Validates guest email
- Creates temporary customer
- Creates checkout session
- Handles OTP verification

---

### **3. Supporting Files**

#### **A. Ticket API**
**File:** `src/lib/ticketApi.ts`  
**Purpose:** API client for ticket operations

**Functions:**
- `createGuestCheckoutSession()` - Creates checkout for guests
- `createCheckoutSession()` - Creates checkout for authenticated users

#### **B. Purchase Intent Tracking**
**File:** `src/hooks/usePurchaseIntentTracking.ts`  
**Purpose:** Tracks ticket views for analytics

**Functions:**
- `trackTicketView()` - Records when user views ticket details
- `trackProfileVisit()` - Records profile visits

---

## 🚨 **Errors Explained**

### **1. 409 Conflict on `ticket_detail_views`**

**Error:**
```
POST .../ticket_detail_views 409 (Conflict)
```

**What it means:**
- You're trying to insert a duplicate ticket view
- The table has a unique constraint preventing duplicate views
- This is **expected behavior** - deduplication is working

**Fix Applied:**
- Updated `usePurchaseIntentTracking.ts` to handle 409 errors
- Now silently ignores duplicate key violations
- Only logs actual errors

**Status:** ✅ **Fixed** - Now handles 409 conflicts gracefully

---

### **2. Missing `Description` Warning**

**Error:**
```
Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}
```

**What it means:**
- Radix UI Dialog requires accessibility description
- Screen readers need context about the dialog

**Fix Applied:**
- Added `DialogDescription` import
- Added `aria-describedby` to `DialogContent`
- Added hidden description for screen readers

**Status:** ✅ **Fixed** - Accessibility warning resolved

---

### **3. Performance Violations**

**Warnings:**
```
[Violation] 'click' handler took 163ms
[Violation] Forced reflow while executing JavaScript took 114ms
```

**What it means:**
- Click handler is slow (should be < 50ms)
- Layout recalculation happening during interaction
- Not breaking, but could be optimized

**Impact:** ⚠️ **Low** - Performance warning, not an error

**Potential fixes:**
- Debounce heavy operations
- Use `requestAnimationFrame` for layout reads
- Lazy load Stripe SDK

---

### **4. Preload Warning**

**Warning:**
```
The resource .../ai-cover-1763824427587.png was preloaded but not used within a few seconds
```

**What it means:**
- Image was preloaded but not displayed quickly
- Browser warning about unused preload

**Impact:** ⚠️ **Very Low** - Just a warning, doesn't affect functionality

---

## 📋 **File Structure**

```
src/
├── components/
│   └── EventCheckoutSheet.tsx          ← Main checkout UI
│   └── ui/
│       └── dialog.tsx                   ← Dialog component (accessibility)
│
├── hooks/
│   └── usePurchaseIntentTracking.ts     ← Analytics tracking
│
├── lib/
│   └── ticketApi.ts                     ← API client
│
supabase/functions/
├── enhanced-checkout/
│   └── index.ts                         ← Authenticated checkout
├── guest-checkout/
│   └── index.ts                         ← Guest checkout
```

---

## 🎯 **How Secure Checkout Works**

### **Flow:**

```
1. User clicks "Get Tickets"
   ↓
2. EventCheckoutSheet opens (step: "select")
   ↓
3. User selects tickets
   ↓
4. User clicks "Continue to Payment"
   ↓
5. Component calls enhanced-checkout Edge Function
   ↓
6. Edge Function:
   - Reserves tickets atomically
   - Creates Stripe PaymentIntent
   - Returns client_secret
   ↓
7. Component switches to step: "pay"
   ↓
8. Stripe EmbeddedCheckout renders with client_secret
   ↓
9. User completes payment
   ↓
10. Stripe redirects to success page
```

---

## ✅ **Fixes Applied**

1. ✅ **409 Conflict Handling** - Now silently ignores duplicate ticket views
2. ✅ **Accessibility Warning** - Added `DialogDescription` and `aria-describedby`
3. ⚠️ **Performance Warnings** - Documented (not critical, can optimize later)

---

**Last Updated:** November 28, 2025



