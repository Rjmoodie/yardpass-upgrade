# 🎯 Liventix Ad System Architecture

## Overview
You have **TWO parallel monetization systems** that work together in the feed.

---

## 🏗️ **Complete Feed Assembly Flow**

```
User Opens Feed
      ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: ORGANIC RANKING (Purchase Intent Algorithm)        │
├─────────────────────────────────────────────────────────────┤
│ File: supabase/migrations/20251102000002_...sql             │
│ Function: get_home_feed_ranked()                            │
│                                                              │
│ Scores ALL events/posts by:                                 │
│ • 30% Purchase Intent (saved, ticket views, dwell)          │
│ • 25% Freshness (upcoming events)                           │
│ • 20% Affinity (follows, past tickets)                      │
│ • 15% Engagement (likes, comments)                          │
│ • 10% Exploration (diversity, discovery)                    │
│                                                              │
│ Returns: [Event1, Post1, Event2, Post2, ...] (ranked)       │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: AD SELECTION (Separate System)                      │
├─────────────────────────────────────────────────────────────┤
│ File: supabase/functions/home-feed/index.ts (Line 269)     │
│ Function: get_eligible_ads() RPC                            │
│                                                              │
│ Fetches paid promoted events based on:                      │
│ • Active campaigns (status = 'active')                      │
│ • Budget remaining (spend < budget)                         │
│ • Targeting match (category, location, demographics)        │
│ • Frequency caps (don't show same ad too often)             │
│ • Bid amount (higher bids prioritized)                      │
│                                                              │
│ Returns: [Ad1, Ad2, Ad3, ...] (separate list)               │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: AD INJECTION (Merge Organic + Ads)                  │
├─────────────────────────────────────────────────────────────┤
│ File: supabase/functions/home-feed/index.ts (Line 329-341) │
│ Function: injectAds()                                        │
│                                                              │
│ Algorithm:                                                   │
│ • Place organic items first (positions 0, 1, 2)             │
│ • Insert 1 ad every 6 organic items                         │
│ • Pattern: [Org, Org, Org, Ad, Org, Org, Org, Ad, ...]      │
│                                                              │
│ adFrequency = 6  // One ad per 6 items                      │
│                                                              │
│ Returns: Final feed with ads injected                        │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: SPONSORSHIP OVERLAY (Visual Only)                   │
├─────────────────────────────────────────────────────────────┤
│ File: src/components/sponsorship/SponsorBadges.tsx          │
│                                                              │
│ Adds visual sponsor badges to events:                       │
│ • Queries: sponsorship_orders table                         │
│ • Displays: "Sponsored by TechCorp" badge                   │
│ • Placement: Event card overlay (compact mode)              │
│                                                              │
│ NOTE: Sponsorships DON'T affect feed ranking!               │
│ They're purely visual branding on organic/ad events.        │
└─────────────────────────────────────────────────────────────┘
      ↓
  Feed Displayed to User
```

---

## 📊 **Three Types of Content in Feed**

| Type | What It Is | How It's Selected | Ranking | Visual Indicator |
|------|-----------|-------------------|---------|------------------|
| **Organic Event** | Regular event card | Purchase intent algorithm | Scored 0-1 | None |
| **Organic Post** | User-generated post | Same algorithm | Scored 0-1 | Author badge (GA, VIP, ORGANIZER) |
| **Promoted Event (Ad)** | Paid event promotion | `get_eligible_ads()` RPC | Injected at position 6, 12, 18... | ✨ "Promoted" badge |
| **Sponsored Event** | Event with sponsor | Either organic OR promoted | Same as base type | 🏢 "Sponsored by X" badge |

---

## 🎯 **AD SELECTION ALGORITHM**

**File:** Database RPC `get_eligible_ads()` (likely in a migration)

### **Selection Criteria:**

```sql
-- Pseudocode for get_eligible_ads
SELECT events 
FROM campaigns c
JOIN events e ON c.event_id = e.id
WHERE 
  -- Campaign is active
  c.status = 'active'
  AND c.start_date <= now()
  AND c.end_date >= now()
  
  -- Budget available
  AND c.spend_cents < c.budget_cents
  
  -- Targeting matches user
  AND (c.target_categories IS NULL OR user.interests && c.target_categories)
  AND (c.target_locations IS NULL OR user.location <-> c.target_locations < radius)
  AND (c.target_demographics IS NULL OR user.age IN c.target_demographics)
  
  -- Frequency cap not exceeded
  AND impressions_last_24h < c.frequency_cap_per_day
  
  -- Placement matches
  AND c.placement = 'feed'
  
ORDER BY 
  c.bid_amount DESC,  -- Higher bids win
  c.created_at ASC    -- Older campaigns (first-come-first-served)
LIMIT p_limit;
```

### **Key Differences from Organic:**

| Factor | Organic Ranking | Ad Selection |
|--------|----------------|--------------|
| **Driven By** | User behavior (intent, engagement) | **Money (bid amount)** |
| **Goal** | Maximize ticket purchases | **Maximize advertiser ROI** |
| **Personalization** | Deep (30+ signals) | Moderate (targeting only) |
| **Frequency** | Always present | Controlled (1 per 6 items) |

---

## 📍 **AD INJECTION POSITIONS**

**Current Settings (Line 258):**
```typescript
const adFrequency = 6;  // Show ad every 6 items
```

### **Example Feed Layout:**

```
Position 0:  [Organic Event]      ← Top ranked by purchase intent
Position 1:  [Organic Post]       ← High engagement post
Position 2:  [Organic Event]      ← Second-ranked event
Position 3:  [Organic Post]       
Position 4:  [Organic Event]      
Position 5:  [Organic Post]       
Position 6:  [AD - Promoted Event] ← First ad injected here
Position 7:  [Organic Post]       
Position 8:  [Organic Event]      
Position 9:  [Organic Post]       
Position 10: [Organic Event]      
Position 11: [Organic Post]       
Position 12: [AD - Promoted Event] ← Second ad injected here
...
```

**Algorithm (Lines 333-341):**
```typescript
for (let i = 0; i < organicItems.length; i++) {
  result.push(organicItems[i]);
  
  // Inject ad every 6 items (skip first 3 for user experience)
  if (i > 2 && (i + 1) % 6 === 0 && adIndex < adItems.length) {
    result.push(adItems[adIndex]);
    adIndex++;
  }
}
```

---

## 💰 **How Ads Are PRICED**

### **Two Pricing Models:**

**1. CPM (Cost Per Mille = Cost Per 1000 Impressions)**
- Advertiser pays when ad is VIEWED
- Typical rate: $5-50 per 1000 impressions
- Tracked in: `campaign_impressions` table
- Logic: User must view for 750ms+ (see `useImpressionTracker.ts`)

**2. CPC (Cost Per Click)**
- Advertiser pays when ad is CLICKED
- Typical rate: $0.50-$5 per click
- Tracked in: `campaign_clicks` table
- Logic: Click on "Get Tickets" or CTA button

---

## 🔍 **AD TARGETING (How Ads Match Users)**

**File:** `get_eligible_ads` RPC function

### **Targeting Dimensions:**

| Dimension | How It Works | Example |
|-----------|-------------|---------|
| **Category** | Match user's interests/history | User likes Music → Show Music event ads |
| **Location** | Distance-based | User in NYC → Show NYC events (within 50mi) |
| **Demographics** | Age, gender, etc. | 18-25yo → Show college events |
| **Keywords** | Match user behavior | User searched "concerts" → Show concert ads |
| **Custom Audience** | Retargeting | User viewed tickets but didn't buy → Retarget |

---

## 🎨 **VISUAL DIFFERENCES**

### **How Users Distinguish Content:**

**Organic Event:**
```
┌────────────────────────┐
│   [Event Image]        │
│                        │
│   Event Title          │
│   📅 Date • 📍 Location│
│   [Get Tickets] button │
└────────────────────────┘
```

**Promoted Event (Ad):**
```
┌────────────────────────┐
│   [Event Image]        │
│   ✨ Promoted          │ ← Yellow badge
│                        │
│   Event Title          │
│   📅 Date • 📍 Location│
│   [Learn More] button  │ ← Custom CTA
└────────────────────────┘
```

**Sponsored Event (Organic OR Ad):**
```
┌────────────────────────┐
│   [Event Image]        │
│   ✨ Promoted (maybe)  │
│                        │
│   Event Title          │
│   📅 Date • 📍 Location│
│   🏢 Sponsored by Nike │ ← Sponsor badge
│   [Get Tickets]        │
└────────────────────────┘
```

---

## 🔄 **INTERACTION BETWEEN SYSTEMS**

### **Can You Have Both?**

**YES!** An event can be:
1. ✅ **Organically Ranked** (shows up naturally via algorithm)
2. ✅ **ALSO Promoted** (paid boost via campaigns)
3. ✅ **ALSO Sponsored** (has sponsor visual badge)

**Example:**
```
"Summer Music Festival 2024"
├─ Organic Ranking: 0.85 (high score, would show anyway)
├─ Promoted: YES (organizer paid $500 CPM campaign)
├─ Sponsored: YES (Nike paid for branding)
└─ Result: Shows at position 6 (ad slot) with "Promoted" + "Sponsored by Nike"
```

---

## 🎯 **WHEN EACH SYSTEM ACTIVATES**

### **Organic Ranking (ALWAYS ACTIVE)**
- Runs for every user, every feed load
- Uses 30+ behavioral signals
- Optimizes for ticket purchases
- Free for event organizers

### **Ad System (OPTIONAL - PAID)**
- Only if organizer creates campaign
- Pays per impression (CPM) or click (CPC)
- Guarantees placement (position 6, 12, etc.)
- Bypasses organic ranking

### **Sponsorship System (OPTIONAL - PAID)**
- Only if sponsor buys package
- Pure visual branding (doesn't affect ranking)
- Can overlay on organic OR ad events
- Separate revenue stream (not ad budget)

---

## 💡 **AD SELECTION FILES**

### **1. Database Function**
**File:** Search for migration with `get_eligible_ads`

```sql
CREATE FUNCTION get_eligible_ads(
  p_user_id uuid,
  p_category text,
  p_location text,
  p_keywords text[],
  p_placement text,
  p_limit int
)
-- Returns eligible ad campaigns that match targeting criteria
```

Let me find this file:

<function_calls>
<invoke name="grep">
<parameter name="pattern">CREATE.*FUNCTION.*get_eligible_ads|CREATE.*REPLACE.*FUNCTION.*get_eligible_ads
