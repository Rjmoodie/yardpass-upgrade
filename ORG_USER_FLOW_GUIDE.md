# Organization Verification & Credit Buying - Complete User Flow

## 🎯 **Overview**

This document outlines the complete user journey for creating an organization, verifying it for payouts (optional), and buying credits for campaigns.

---

## 📊 **TWO SEPARATE SYSTEMS**

### **System 1: Stripe Connect (For Payouts)** 🏦
- **Purpose:** Receive money from ticket sales
- **Required:** Only if org hosts paid events
- **Involves:** KYC, bank account, tax info

### **System 2: Org Wallet (For Ad Spending)** 💳
- **Purpose:** Buy credits to spend on campaigns
- **Required:** For running ads/promotions
- **Involves:** Credit card payment, no KYC

**Important:** These are **INDEPENDENT** - you can buy credits without Stripe Connect!

---

## 🚀 **COMPLETE USER FLOW**

---

## **PHASE 1: Organization Creation** (5 minutes)

### **Step 1: User Navigates to Create Organization**
```
User clicks "Create Organization" button
  ↓
Route: /create-organization
  ↓
Component: OrganizationCreator loads
```

### **Step 2: Fill Organization Details**

**Form Fields:**
1. **Organization Name** (required)
   - Example: "YardPass Events Inc"
   
2. **Handle** (required)
   - Example: "@yardpass-events"
   - 3-30 characters, lowercase, letters/numbers/hyphens
   - Real-time availability check
   - ✅ Shows green checkmark if available
   - ❌ Shows red X if taken

3. **Description** (optional)
   - Multi-line text
   - Tell users about your organization

4. **Logo Upload** (optional)
   - Image file (PNG, JPG, SVG)
   - Uploaded to Supabase storage: `org-logos` bucket

5. **Social Links** (optional)
   - Instagram, Twitter, TikTok, Website, etc.
   - Component: `SocialLinkManager`

### **Step 3: Submit & Create**

**When user clicks "Create Organization":**
```typescript
// 1. Call RPC function
const { data: orgId } = await supabase.rpc('create_organization_with_membership', {
  p_name: 'YardPass Events Inc',
  p_handle: 'yardpass-events',
  p_logo_url: null, // Will be uploaded after
  p_creator_id: user.id
});

// 2. RPC function (database) does:
// - Creates org in organizations table
// - Automatically creates org_membership for creator
// - Sets creator role as 'owner'
// - Returns org ID

// 3. Update description and social links
await supabase
  .from('organizations')
  .update({
    description: '...',
    social_links: [...]
  })
  .eq('id', orgId);

// 4. Upload logo (if provided)
await supabase.storage
  .from('org-logos')
  .upload(`orgs/${orgId}/logo.png`, logoFile);

// 5. Update logo URL
await supabase
  .from('organizations')
  .update({ logo_url: publicUrl })
  .eq('id', orgId);
```

**Result:**
```
✅ Organization created
✅ User is now "owner" of the org
✅ org_membership record created
✅ Logo uploaded (if provided)
✅ Toast: "Organization Created"
```

**Navigation:**
```
User redirected to: /orgs/${orgId}/dashboard
  or
  onSuccess(orgId) callback
```

---

## **PHASE 2A: Stripe Connect Onboarding** (Optional, 10-15 minutes)

**⚠️ NOTE:** Only needed if org will receive PAYOUTS from ticket sales

### **Step 1: Access Stripe Connect Section**

```
Organization Dashboard → Payouts Tab
  ↓
Component: StripeConnectOnboarding
  props: {
    contextType: 'organization',
    contextId: orgId
  }
```

### **Step 2: Check Current Status**

**Hook checks:**
```typescript
const { account, status } = useStripeConnect('organization', orgId);

// Status can be:
// - 'unlinked': No Stripe account yet
// - 'restricted': Account exists but not verified
// - 'active': Fully verified and ready
```

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Enable Payouts         [Not Connected]│
│                                       │
│ Connect with Stripe to start         │
│ receiving payouts from your events.   │
│                                       │
│ [Connect with Stripe] button         │
└─────────────────────────────────────┘
```

### **Step 3: Click "Connect with Stripe"**

```typescript
await createStripeConnectAccount();

// This calls edge function:
supabase.functions.invoke('create-stripe-connect', {
  body: {
    context_type: 'organization',
    context_id: orgId,
    return_url: '/dashboard?tab=payouts',
    refresh_url: '/dashboard?tab=payouts'
  }
});

// Edge function:
// 1. Creates Stripe Express Account
// 2. Generates account link URL for onboarding
// 3. Returns: { account_link_url: 'https://connect.stripe.com/...' }

// Frontend:
window.location.href = data.account_link_url; // Redirects to Stripe
```

### **Step 4: Stripe Onboarding (External)**

**User is now on Stripe's site:**

1. **Business Details**
   - Business type (LLC, Corporation, etc.)
   - Business address
   - Tax ID (EIN)
   - Website

2. **Representative Info**
   - Name, DOB, SSN/Tax ID
   - Address
   - Phone number

3. **Bank Account**
   - Routing number
   - Account number
   - Account holder name

4. **Verification Documents** (if needed)
   - Upload ID (driver's license, passport)
   - Proof of address (if requested)

**Time:** 10-15 minutes

### **Step 5: Return to YardPass**

```
Stripe completes onboarding
  ↓
Redirects back to: /dashboard?tab=payouts
  ↓
StripeConnectOnboarding component refreshes
  ↓
Checks account status via: refresh-stripe-accounts function
```

**Status Changes:**
```
Initial:
  details_submitted: false
  charges_enabled: false
  payouts_enabled: false

After submission (pending):
  details_submitted: true
  charges_enabled: false  (Stripe reviewing)
  payouts_enabled: false  (Stripe reviewing)

After approval (1-2 days):
  details_submitted: true
  charges_enabled: true   ✅
  payouts_enabled: true   ✅
```

**UI Updates:**
```
┌─────────────────────────────────────┐
│ Enable Payouts              [Active]│
│                                       │
│ Your Stripe Connect account is fully │
│ verified and ready to receive payouts.│
│                                       │
│ Available Balance: $1,234.56         │
│ Pending: $567.89                     │
│                                       │
│ ✅ Details   ✅ Charges   ✅ Payouts│
│                                       │
│ [Manage Stripe Account] button       │
└─────────────────────────────────────┘
```

---

## **PHASE 2B: Buy Organization Credits** (5 minutes)

**⚠️ NOTE:** This is **SEPARATE** from Stripe Connect - no KYC required!

### **Step 1: Access Org Wallet**

```
Organization Dashboard → Wallet/Credits Tab
  ↓
Component: OrgWalletDashboard
  ↓
Shows: Current balance, transaction history
```

**UI:**
```
┌─────────────────────────────────────┐
│ Organization Wallet                  │
│                                       │
│ Balance: 50,000 credits             │
│ ≈ $500.00                            │
│                                       │
│ [Buy Credits] button                 │
│                                       │
│ Recent Transactions:                 │
│ - Campaign X: -500 credits          │
│ - Purchase by Alice: +10,000        │
│ - Campaign Y: -1,200 credits        │
└─────────────────────────────────────┘
```

### **Step 2: Click "Buy Credits"**

```
Button clicked
  ↓
Opens: OrgBuyCreditsModal
  ↓
Loads credit packages from database
```

### **Step 3: Select Package or Custom Amount**

**Modal Shows:**
```
┌─────────────────────────────────────┐
│ Buy Organization Credits             │
│                                       │
│ ○ 5,000 credits - $50.00            │
│ ● 10,000 credits - $100.00 [Popular]│
│ ○ 25,000 credits - $250.00          │
│ ○ Custom: [10000] = $100.00         │
│                                       │
│ Promo code: [optional field]         │
│                                       │
│ Subtotal: $100.00                    │
│ Fees: $0.00                          │
│ Total: $100.00                       │
│                                       │
│ [Pay $100.00]  [Cancel]              │
└─────────────────────────────────────┘
```

### **Step 4: Submit Purchase**

```typescript
// User clicks "Pay $100.00"
await onPurchase({ 
  package_id: 'uuid',
  promo_code: 'SAVE10' 
});

// Calls edge function:
const { data } = await supabase.functions.invoke('purchase-org-credits', {
  body: {
    org_id: orgId,
    package_id: selectedPackage, // or custom_credits: 10000
    promo_code: promoCode || null
  }
});

// Edge function flow:
// 1. Verify user is authenticated ✅
// 2. Check user has owner/admin/editor role ✅
// 3. Ensure org_wallet exists (creates if needed)
// 4. Validate package/custom amount
// 5. Apply promo code (if valid)
// 6. Create invoice:
//    {
//      org_wallet_id: orgWalletId,
//      purchased_by_user_id: user.id, ← NEW! Tracks who paid
//      amount_usd_cents: 10000,
//      credits_purchased: 10000,
//      status: 'pending'
//    }
// 7. Create Stripe Checkout Session with:
//    - 3D Secure enabled (fraud prevention)
//    - Enhanced metadata (user_id, org_id, credits)
//    - Billing address required
// 8. Return: { session_url: 'https://checkout.stripe.com/...' }

// Frontend redirects:
window.location.href = data.session_url;
```

### **Step 5: Stripe Checkout (External)**

**User is now on Stripe Checkout:**

1. **Enter Payment Details**
   - Card number
   - Expiration date
   - CVC
   - Billing address (required)

2. **3D Secure** (if triggered)
   - High-risk transactions require authentication
   - SMS code or bank app confirmation

3. **Complete Payment**
   - Click "Pay $100.00"
   - Processing...

**Fraud Prevention Active:**
- Stripe Radar analyzes transaction
- 3DS challenges high-risk cards
- Velocity limits enforced

### **Step 6: Webhook Processing (Backend)**

```
Stripe sends webhook: checkout.session.completed
  ↓
wallet-stripe-webhook edge function receives it
  ↓
Verifies signature ✅
  ↓
Checks idempotency (prevents duplicate processing) ✅
  ↓
Extracts metadata:
  - org_wallet_id
  - invoice_id
  - credits
  - org_id
  ↓
Calls SQL function: org_wallet_apply_purchase()
  - Locks org_wallet row
  - Inserts org_wallet_transaction (+10,000 credits)
  - Updates org_wallets.balance_credits += 10,000
  ↓
Creates credit_lot: ← NEW!
  {
    org_wallet_id: orgWalletId,
    quantity_purchased: 10,000,
    quantity_remaining: 10,000,
    unit_price_cents: 1,
    source: 'purchase',
    stripe_checkout_session_id: session.id,
    invoice_id: invoiceId,
    expires_at: null // Org credits never expire
  }
  ↓
Updates invoice:
  {
    status: 'paid',
    paid_at: now(),
    stripe_payment_intent_id: pi.id
  }
  ↓
Returns success
```

### **Step 7: User Redirected Back**

```
Stripe redirects to: /orgs/{orgId}/wallet?success=1
  ↓
OrgWalletDashboard refreshes
  ↓
Shows updated balance: 60,000 credits (was 50,000)
  ↓
Transaction history shows:
  "Credit purchase - 10,000 credits by Alice Smith"
```

**Success UI:**
```
┌─────────────────────────────────────┐
│ Organization Wallet                  │
│                                       │
│ Balance: 60,000 credits ⬆️ +10,000  │
│ ≈ $600.00                            │
│                                       │
│ ✅ Payment successful!               │
│                                       │
│ Recent Transactions:                 │
│ • Purchase by Alice: +10,000 (just now)│
│ • Campaign X: -500 credits          │
│ • Purchase by Alice: +10,000 (2 days ago)│
└─────────────────────────────────────┘
```

---

## 🔐 **PERMISSION MATRIX**

| Action | Owner | Admin | Editor | Member |
|--------|-------|-------|--------|--------|
| **Create Org** | ✅ (becomes owner) | - | - | - |
| **Buy Credits** | ✅ | ✅ | ✅ | ❌ |
| **Spend Credits** | ✅ | ✅ | ✅ | ✅* |
| **Setup Stripe Connect** | ✅ | ✅ | ❌ | ❌ |
| **View Balance** | ✅ | ✅ | ✅ | ✅ |
| **View Transactions** | ✅ | ✅ | ✅ | ❌ |

*Members can spend if they have campaign permissions

---

## 🎭 **ROLE DEFINITIONS**

### **Owner**
- Creates the organization
- Full access to everything
- Can buy credits
- Can set up Stripe Connect
- Can invite other admins

### **Admin**
- Can buy credits
- Can manage campaigns
- Can view all transactions
- Can set up Stripe Connect
- Cannot delete org

### **Editor**
- Can buy credits
- Can create campaigns
- Cannot view all transactions
- Cannot manage Stripe Connect

### **Member**
- Can view balance
- Can spend on assigned campaigns
- Cannot buy credits
- Cannot view transaction history

---

## 💰 **CREDIT PURCHASE FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│                    ORG CREDIT PURCHASE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: User clicks "Buy Credits" in org dashboard         │
│         │ (Must be owner/admin/editor)                       │
│         ▼                                                    │
│  ┌────────────────────────────────┐                         │
│  │  OrgBuyCreditsModal opens      │                         │
│  │                                 │                         │
│  │  - Select package or custom     │                         │
│  │  - Enter promo code (optional)  │                         │
│  │  - Click "Pay $100.00"          │                         │
│  └────────────────────────────────┘                         │
│         │                                                    │
│         ▼                                                    │
│  purchase-org-credits Edge Function                          │
│         │                                                    │
│         ├─ ✅ Auth check (user logged in?)                  │
│         ├─ ✅ Permission check (owner/admin/editor?)        │
│         ├─ ✅ Ensure org_wallet exists                      │
│         ├─ ✅ Validate amount (min 1,000 credits)           │
│         ├─ ✅ Create invoice (purchased_by_user_id = Alice) │
│         ├─ ✅ Create Stripe Checkout Session                │
│         │     - 3D Secure enabled                           │
│         │     - Metadata: org_id, wallet_id, user_id        │
│         └─ ✅ Return session_url                            │
│         │                                                    │
│         ▼                                                    │
│  Redirect to Stripe Checkout                                │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────┐                         │
│  │  Stripe Checkout Page          │                         │
│  │                                 │                         │
│  │  - Enter card details           │                         │
│  │  - Billing address (required)   │                         │
│  │  - 3DS challenge (if high-risk) │                         │
│  │  - Click "Pay"                  │                         │
│  └────────────────────────────────┘                         │
│         │                                                    │
│         ▼                                                    │
│  Payment Processing (Stripe)                                │
│         │                                                    │
│         ├─ 🛡️ Radar fraud check                            │
│         ├─ 🛡️ 3DS authentication (if needed)               │
│         ├─ 💳 Charge Alice's card: $100.00                  │
│         │                                                    │
│         ▼                                                    │
│  checkout.session.completed webhook → YardPass              │
│         │                                                    │
│         ▼                                                    │
│  wallet-stripe-webhook Edge Function                        │
│         │                                                    │
│         ├─ ✅ Verify signature                              │
│         ├─ ✅ Check idempotency (prevent double-charge)     │
│         ├─ ✅ Call org_wallet_apply_purchase()              │
│         │     - Lock org_wallet row                         │
│         │     - Insert transaction: +10,000 credits         │
│         │     - Update balance: 50,000 → 60,000            │
│         │                                                    │
│         ├─ ✅ Create credit_lot (NEW!)                      │
│         │     - quantity: 10,000                            │
│         │     - unit_price: 1¢                              │
│         │     - source: 'purchase'                          │
│         │     - expires_at: NULL (never)                    │
│         │                                                    │
│         └─ ✅ Update invoice: status = 'paid'               │
│         │                                                    │
│         ▼                                                    │
│  Redirect to: /orgs/{orgId}/wallet?success=1               │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────┐                         │
│  │  Success Screen                 │                         │
│  │                                 │                         │
│  │  ✅ Payment successful!         │                         │
│  │  +10,000 credits added          │                         │
│  │  New balance: 60,000 credits    │                         │
│  │                                 │                         │
│  │  Purchased by: Alice Smith      │                         │
│  │  Date: Jan 13, 2025             │                         │
│  └────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏦 **STRIPE CONNECT FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│              STRIPE CONNECT ONBOARDING (OPTIONAL)            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Click "Connect with Stripe" in dashboard           │
│         │                                                    │
│         ▼                                                    │
│  create-stripe-connect Edge Function                        │
│         │                                                    │
│         ├─ Creates Stripe Express Account                   │
│         ├─ Generates onboarding link                        │
│         └─ Returns account_link_url                         │
│         │                                                    │
│         ▼                                                    │
│  Redirect to Stripe (external)                              │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────┐                 │
│  │  Stripe KYC & Onboarding               │                 │
│  │                                         │                 │
│  │  1. Business details (name, type, EIN)  │                 │
│  │  2. Representative info (SSN, DOB)      │                 │
│  │  3. Bank account (routing, account #)   │                 │
│  │  4. Upload documents (ID, proof)        │                 │
│  │                                         │                 │
│  │  Time: 10-15 minutes                    │                 │
│  └────────────────────────────────────────┘                 │
│         │                                                    │
│         ▼                                                    │
│  Stripe processes verification (1-2 days)                   │
│         │                                                    │
│         ▼                                                    │
│  Webhook: account.updated → stripe-webhook function         │
│         │                                                    │
│         ├─ Updates payout_accounts table                    │
│         ├─ Sets charges_enabled: true                       │
│         └─ Sets payouts_enabled: true                       │
│         │                                                    │
│         ▼                                                    │
│  Organization can now receive payouts! ✅                   │
│                                                              │
│  When tickets are sold:                                     │
│    → 95% goes to org's Stripe Connect account              │
│    → 5% platform fee                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **DATA FLOW SUMMARY**

### **Organization Creation**
```
User Input → create_organization_with_membership RPC
          → INSERT organizations (id, name, handle, created_by)
          → INSERT org_memberships (org_id, user_id, role='owner')
          → RETURN org_id
```

### **Credit Purchase**
```
User Input → purchase-org-credits function
          → Permission check (is owner/admin/editor?)
          → CREATE invoice (org_wallet_id, purchased_by_user_id)
          → Stripe Checkout Session
          → User pays on Stripe
          → Webhook processes payment
          → CREATE credit_lot (NEW!)
          → UPDATE org_wallet balance
          → Credits available
```

### **Stripe Connect** (Optional)
```
User Input → create-stripe-connect function
          → Stripe API creates Express Account
          → User completes KYC on Stripe
          → Stripe verifies (1-2 days)
          → Webhook updates payout_accounts
          → Org can receive payouts
```

---

## ⏱️ **TIMELINE**

### **Day 1: Organization Setup**
- **0:00** - Create organization (5 min)
- **0:05** - Buy first credits (5 min) ✅ **Ready to spend!**
- **0:10** - (Optional) Start Stripe Connect (15 min)

### **Day 2-3: Stripe Verification** (if Connect needed)
- Stripe processes verification
- Webhook updates account status
- Org receives notification: "Payouts enabled!"

### **Ongoing:**
- Buy more credits as needed (5 min each)
- Spend on campaigns
- Receive payouts from ticket sales (if Connect enabled)

---

## 🎯 **KEY TAKEAWAYS**

1. **Two Independent Systems:**
   - 💳 **Org Wallet** = Buy credits (immediate, no KYC)
   - 🏦 **Stripe Connect** = Receive payouts (1-2 days, requires KYC)

2. **Credit Buying is Fast:**
   - 5 minutes start to finish
   - No verification needed
   - Credits available immediately after payment

3. **Stripe Connect is Slow:**
   - 15 minutes onboarding
   - 1-2 days verification
   - Only needed for paid events

4. **Purchase Attribution:**
   - Always tracks WHO bought org credits
   - Important for reimbursement
   - Visible in transaction history

5. **Credits Never Expire:**
   - Org credits have no expiration
   - Tracked in lots for refund accuracy
   - FIFO deduction (oldest first)

---

## 🎬 **EXAMPLE SCENARIOS**

### **Scenario 1: New Org - Just Ads**
```
Alice creates "YardPass Events Inc"
  → Takes 5 minutes
  → Immediately buys 10,000 credits ($100)
  → Starts running ad campaigns
  → No Stripe Connect needed ✅
```

### **Scenario 2: New Org - Paid Events**
```
Bob creates "Brooklyn Music Festival"
  → Takes 5 minutes
  → Sets up Stripe Connect (15 min onboarding)
  → Waits 1-2 days for Stripe approval
  → Meanwhile, buys credits for ads
  → After approval, creates paid event
  → Receives payouts from ticket sales ✅
```

### **Scenario 3: Team Purchase**
```
Alice (owner) creates org
Bob (admin) joins team
Carol (editor) joins team

Alice buys 10,000 credits → purchased_by_user_id = Alice
Bob buys 5,000 credits → purchased_by_user_id = Bob
Carol buys 2,000 credits → purchased_by_user_id = Carol

Total org balance: 17,000 credits
Attribution: Alice (10k), Bob (5k), Carol (2k)

All three can spend from the shared pool
But accounting knows who funded what! ✅
```

---

**Your org flow is streamlined and production-ready!** 🚀

