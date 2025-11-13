# Stripe Checkout Branding Guide 🎨

## Summary
How to customize Stripe Checkout to match Liventix branding (orange #FF8C00 and black theme).

---

## 🎯 **Liventix Brand Colors**

```css
Primary Orange: #FF8C00
Dark Background: #000000
Light Text: #FFFFFF
Border: rgba(255, 140, 0, 0.3)
```

---

## ⚙️ **Stripe Dashboard Configuration**

### **Step 1: Access Branding Settings**
1. Go to: https://dashboard.stripe.com/settings/branding
2. Sign in to your Stripe account

### **Step 2: Configure Brand**

**Brand Name:**
```
Liventix
```

**Brand Color (Primary):**
```
#FF8C00  (Liventix Orange)
```

**Icon** (512x512px square):
- Upload Liventix logo icon
- Will appear as favicon and in header

**Logo** (Rectangular, transparent PNG):
- Upload Liventix horizontal logo
- Recommended: 512x200px
- Shows in checkout header

**Accent Color:**
```
#FF8C00  (Same as primary)
```

---

## 💳 **What Gets Customized**

### **On Stripe Checkout Page:**

**Before** (Default Stripe):
- 🔵 Blue accent colors
- 📝 Generic "Business Name"
- ⚪ Default white/gray theme
- 🏢 Stripe logo

**After** (Liventix Branded):
- 🟠 Orange accents (#FF8C00)
- 🎪 Liventix logo in header
- 🎫 Liventix icon as favicon
- ✨ Brand-consistent experience

---

## 🔧 **Additional Customizations in Code**

### **Already Implemented:**

**1. Custom Timer Message** ⏱️
```typescript
custom_text: {
  submit: {
    message: "Your tickets are reserved for 30 minutes. Complete your purchase to secure them!",
  },
}
```
Shows above the "Pay" button!

**2. Button Text** 🔘
```typescript
submit_type: "pay"  // Button says "Pay" instead of "Subscribe"
```

**3. Session Expiration** ⏳
```typescript
expires_at: 30 minutes  // Synced with ticket hold
```

---

## 📱 **Preview Your Branding**

After configuring in Stripe Dashboard:

1. Start a test purchase on Liventix
2. Go to Stripe checkout
3. Should see:
   - 🟠 Orange accents
   - 🎪 Liventix logo
   - ⏱️ "Your tickets are reserved for 30 minutes..."
   - 💳 "Pay" button (orange when you click)

---

## 🎨 **Advanced: Custom CSS (Enterprise Only)**

If you have Stripe's **Enterprise plan**, you can add custom CSS:

```css
/* Make the background darker */
.Body {
  background-color: #0a0a0a;
}

/* Orange payment button */
.SubmitButton {
  background-color: #FF8C00 !important;
  border-color: #FF8C00 !important;
}

.SubmitButton:hover {
  background-color: #e67e00 !important;
}

/* Orange focus states */
.Input:focus {
  border-color: #FF8C00 !important;
  box-shadow: 0 0 0 1px #FF8C00 !important;
}
```

**Note**: Custom CSS requires **Stripe Enterprise** plan ($$$).

---

## 📊 **Standard vs Enterprise Comparison**

| Feature | Standard Plan | Enterprise Plan |
|---------|---------------|-----------------|
| Logo | ✅ Yes | ✅ Yes |
| Brand Color | ✅ Yes | ✅ Yes |
| Icon/Favicon | ✅ Yes | ✅ Yes |
| Custom Text | ✅ Yes | ✅ Yes |
| **Custom CSS** | ❌ No | ✅ Yes |
| **Custom Fonts** | ❌ No | ✅ Yes |
| **Layout Control** | ❌ No | ✅ Yes |

**For Liventix**: Standard branding features are **sufficient**! ✅

---

## 🔑 **What We Already Customized in Code**

✅ **Timer message**: "Your tickets are reserved for 30 minutes..."  
✅ **Button text**: "Pay" (not "Subscribe")  
✅ **Product description**: "Event tickets (includes processing fees)"  
✅ **30-minute expiration**: Matches ticket hold  
✅ **Auto-fill email**: Pre-fills user's email  
✅ **Promotion codes**: Enabled  
✅ **Success/Cancel URLs**: Redirects back to Liventix  

---

## 🚀 **Quick Setup Guide**

### **5-Minute Setup:**

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/settings/branding

2. **Upload Logo**: 
   - Icon: Square Liventix logo (512x512)
   - Logo: Horizontal Liventix logo (512x200)

3. **Set Colors**:
   - Brand color: `#FF8C00`
   - Accent color: `#FF8C00`

4. **Brand Name**: `Liventix`

5. **Save Settings**

6. **Test**: Start a purchase and check Stripe checkout!

---

## 🎯 **Result**

**Stripe Checkout will show**:
```
┌─────────────────────────────────────┐
│ [Liventix Logo]              Sandbox│
│                                      │
│ Liventix Launch - General Admission  │
│ $12.85                               │
│ Event tickets (includes processing)  │
│                                      │
│ Your tickets are reserved for 30     │
│ minutes. Complete your purchase to   │
│ secure them!                         │
│                                      │
│ [Pay with Link]  (Orange button)     │
│                                      │
│ Email: [___________]                 │
│ Card: [___________]                  │
│                                      │
│ [Pay]  (Orange button)               │
└─────────────────────────────────────┘
```

**Branded with Liventix orange throughout!** 🟠

---

## ✅ **Action Items**

- [ ] Configure Stripe Dashboard branding (5 minutes)
- [ ] Deploy edge function: `npx supabase functions deploy enhanced-checkout`
- [ ] Test purchase to see branded checkout
- [ ] Verify timer message appears
- [ ] Check logo displays correctly

**The custom timer message is already in the code** - just need to configure the visual branding in Stripe Dashboard! 🎨

