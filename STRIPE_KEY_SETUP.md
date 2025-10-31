# Stripe Publishable Key Setup 🔑

## ⚠️ **Current Error**

```
Please call Stripe() with your publishable key. You used an empty string.
```

**Cause**: Missing `VITE_STRIPE_PUBLISHABLE_KEY` in environment variables.

---

## ✅ **Quick Fix (2 Minutes)**

### **Step 1: Get Your Stripe Key**

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Find "Publishable key" (starts with `pk_test_`)
3. Click "Reveal test key" if hidden
4. Copy the key (e.g., `pk_test_51QJHCPIzC...`)

---

### **Step 2: Create `.env.local` File**

In your project root (`C:\Users\Louis Cid\Yardpass 3.0\yardpass-upgrade\`):

**Create new file**: `.env.local`

**Add this line**:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51QJHCPIzCYourActualKeyHere
```

**Example**:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51QJHCP IzCqP51F00kLx5eZVd3
```

---

### **Step 3: Restart Dev Server**

**Stop current server**: `Ctrl+C`

**Restart**:
```bash
npm run dev
```

---

### **Step 4: Verify**

Check browser console - error should be gone!

---

## 🔒 **Security Notes**

**Publishable key** is **SAFE to expose** in frontend code:
- ✅ Meant to be public
- ✅ Can't be used to charge cards
- ✅ Only creates payment intents
- ✅ Can be committed to git (but we use .env for flexibility)

**Secret key** (sk_test_...) must **NEVER** be in frontend:
- ❌ Keep on server only
- ❌ Never commit to git
- ❌ Never expose in browser

---

## 📝 **File Template**

Use this template for `.env.local`:

```bash
# Stripe Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE

# Supabase (already configured)
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# Optional: Feature Flags
# VITE_ENABLE_ANALYTICS=true
# VITE_DEBUG_MODE=false
```

---

## 🚀 **After Setup**

**Refresh browser** and test purchasing:
1. ✅ No Stripe key error
2. ✅ Stripe iframe loads
3. ✅ Can enter card info
4. ✅ Complete purchase

Use **Stripe test card**:
```
Card: 4242 4242 4242 4242
Exp: 12/34 (any future date)
CVC: 123 (any 3 digits)
ZIP: 12345 (any ZIP)
```

---

## ⚡ **Quick Commands**

```bash
# Create .env.local
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY" > .env.local

# Restart dev server
npm run dev

# Test purchase!
```

---

**Add your Stripe key now and restart the dev server!** 🚀

