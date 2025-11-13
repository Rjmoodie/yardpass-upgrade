# Stripe Embedded Checkout - Complete Setup Guide 🎨

## Overview
Switch between Stripe Hosted and Embedded checkout with a single environment variable!

---

## 🎯 **What You Get with Embedded Checkout**

### **User Experience:**
- ✅ **No redirect** - Stay on Liventix throughout
- ✅ **Prominent timer** - Large countdown at top (30:00... 29:59...)
- ✅ **Color-coded urgency**:
  - 🟢 Green (30-5 min)
  - 🟡 Amber (5-1 min)  
  - 🔴 Red + pulsing (< 1 min)
- ✅ **Warning alerts** - Pop-up when < 1 minute
- ✅ **Cancel button** - Easy to abandon
- ✅ **Seamless flow** - Feels like part of Liventix

### **Visual Preview:**
```
┌─────────────────────────────────────────────────────────┐
│ [← Cancel]    Liventix Launch       🕐 29:45           │
│               Complete your purchase                    │
└─────────────────────────────────────────────────────────┘
│                                                          │
│  [Stripe Embedded Payment Form]                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ Email: [___________________]                    │    │
│  │ Card:  [___________________]                    │    │
│  │ Name:  [___________________]                    │    │
│  │ ZIP:   [_____]                                  │    │
│  │                                                  │    │
│  │ [Pay $12.85]  (Orange button)                   │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘

(When < 1 min):
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Checkout Expiring!                                   │
│  Complete your payment in the next 30 seconds to        │
│  secure your tickets!                                    │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ **Setup Instructions**

### **Step 1: Add Environment Variable**

Create or update `.env.local`:

```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your Stripe publishable key

# Checkout Mode
VITE_USE_EMBEDDED_CHECKOUT=true  # true = embedded, false/missing = hosted
```

**Where to find your Stripe keys**:
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy "Publishable key" (starts with `pk_test_` or `pk_live_`)
3. Paste into `.env.local`

---

### **Step 2: Deploy Edge Function**

The `enhanced-checkout` function now supports both modes:

```bash
npx supabase functions deploy enhanced-checkout
```

**What it does**:
- Returns `session_url` for hosted checkout (redirect)
- Returns `client_secret` for embedded checkout (iframe)

---

### **Step 3: Test It!**

```bash
# Refresh browser
Ctrl/Cmd + Shift + R

# Try purchasing tickets
# Should stay on Liventix with embedded form!
```

---

## 🔄 **Switching Between Modes**

### **Hosted Checkout** (Current - Redirects to Stripe):
```bash
# .env.local
VITE_USE_EMBEDDED_CHECKOUT=false
# or just remove the variable
```

### **Embedded Checkout** (New - Stays on Liventix):
```bash
# .env.local
VITE_USE_EMBEDDED_CHECKOUT=true
```

**No code changes needed** - just toggle the env var!

---

## 📁 **Files Created/Modified**

| File | Purpose | Status |
|------|---------|--------|
| `src/components/StripeEmbeddedCheckout.tsx` | ✅ NEW - Embedded checkout component | 223 lines |
| `supabase/functions/enhanced-checkout/index.ts` | ✅ Modified - Return client_secret | +3 lines |
| `src/components/TicketPurchaseModal.tsx` | ✅ Modified - Support both modes | +30 lines |
| `package.json` | ✅ Modified - Added Stripe deps | +2 deps |

---

## 🎨 **Design Features**

### **Timer Header** (Sticky at Top):
```tsx
- Position: Fixed at top
- Color: Changes based on urgency
- Timer: Large, prominent (29:45)
- Event name: Displayed
- Cancel button: Left side
```

### **Warning Alert** (When < 1 min):
```tsx
- Position: Bottom center
- Style: Red warning card
- Animation: Fade in
- Message: "Complete payment in 30 seconds!"
```

### **Stripe Form** (Embedded):
```tsx
- Fully functional payment form
- Email, card, billing address
- Pay button branded orange
- PCI compliant (handled by Stripe)
```

---

## 🔐 **Security**

**Both modes are equally secure**:
- ✅ PCI compliant
- ✅ Stripe handles card data
- ✅ No sensitive data touches your server
- ✅ Same encryption standards

**Difference**:
- **Hosted**: Card data goes to stripe.com
- **Embedded**: Card data goes to Stripe iframe (same security, different UI)

---

## 🚀 **Performance**

### **Hosted Checkout**:
- ✅ Fast (just redirect)
- ✅ No extra JS load
- ⚠️ Full page navigation

### **Embedded Checkout**:
- ⚡ Loads Stripe.js SDK (~100KB)
- ⚡ Iframe rendering
- ✅ No page navigation
- ✅ Seamless UX

**Recommendation**: Embedded is worth the extra ~100KB for better UX!

---

## 📊 **Comparison**

| Feature | Hosted | Embedded |
|---------|--------|----------|
| **Timer Visibility** | Small (Stripe's) | Large (Liventix) |
| **Stay on Liventix** | ❌ No | ✅ Yes |
| **Custom Timer UI** | ❌ No | ✅ Yes |
| **Warning Alerts** | ❌ No | ✅ Yes |
| **Cancel Button** | ⚠️ Browser back | ✅ Prominent |
| **Brand Consistency** | ⚠️ Stripe branding | ✅ Liventix branding |
| **Setup Complexity** | ✅ Simple | ⚠️ Moderate |
| **PCI Compliance** | ✅ Yes | ✅ Yes |
| **Stripe Fees** | Same | Same |

---

## 🧪 **Testing Checklist**

### **Test Embedded Mode:**
- [ ] Set `VITE_USE_EMBEDDED_CHECKOUT=true`
- [ ] Refresh browser
- [ ] Start ticket purchase
- [ ] Should see full-screen checkout (NOT redirect)
- [ ] Timer should be prominent at top
- [ ] Enter test card: `4242 4242 4242 4242`
- [ ] Complete purchase
- [ ] Should stay on Liventix
- [ ] Verify tickets appear

### **Test Hosted Mode:**
- [ ] Set `VITE_USE_EMBEDDED_CHECKOUT=false`
- [ ] Refresh browser
- [ ] Start ticket purchase
- [ ] Should redirect to stripe.com
- [ ] See Stripe's page with your branding
- [ ] Complete purchase
- [ ] Return to Liventix

---

## ⚡ **Quick Start**

**To enable embedded checkout RIGHT NOW:**

1. **Create `.env.local`** in project root:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
VITE_USE_EMBEDDED_CHECKOUT=true
```

2. **Restart dev server**:
```bash
npm run dev
```

3. **Test purchase** - Should stay on Liventix!

---

## 🎯 **Recommended: Use Embedded**

**Why?**
- ✅ Better UX (no leaving app)
- ✅ Prominent timer (users see countdown)
- ✅ Easier to cancel
- ✅ More control over design
- ✅ Same security as hosted
- ✅ Same Stripe fees

**Only use Hosted if:**
- You want absolute minimal code
- You trust Stripe's optimization
- You don't care about timer visibility

---

## ✅ **Status**

- [x] Embedded checkout component created
- [x] Edge function supports both modes
- [x] Stripe.js SDK installed
- [x] Timer overlay implemented
- [ ] Environment variable configured (you need to do this)
- [ ] Test embedded checkout flow

**Ready to enable** - just set the env var! 🚀

