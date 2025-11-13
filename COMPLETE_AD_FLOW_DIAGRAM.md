# 🎯 Complete Ad System Flow - Liventix

## 🏗️ **Two-Stage Feed Assembly**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER OPENS FEED                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STAGE 1: ORGANIC RANKING (Purchase Intent Algorithm)            ┃
┃ File: supabase/migrations/20251102000002_...sql                 ┃
┃ Function: get_home_feed_ranked()                                ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                  ┃
┃ Scores EVERY event/post by:                                     ┃
┃ • 30% Purchase Intent (saved, ticket views, dwell time)         ┃
┃ • 25% Freshness (upcoming soon)                                 ┃
┃ • 20% Affinity (follows, location, past tickets)                ┃
┃ • 15% Engagement (likes, comments)                              ┃
┃ • 10% Exploration (diversity, cold start)                       ┃
┃                                                                  ┃
┃ Filters:                                                         ┃
┃ • ✅ Future events only (start_at > now)                        ┃
┃ • ✅ Public events only                                         ┃
┃ • ✅ Exclude EVENT CARDS if user purchased                      ┃
┃ • ✅ Include POSTS from all events (even purchased)             ┃
┃                                                                  ┃
┃ Returns: ~30-80 items ranked by score                           ┃
┃ Example: [Event(0.85), Post(0.82), Event(0.78), ...]            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STAGE 2: AD SELECTION (Paid Promotion)                          ┃
┃ File: supabase/migrations/20251026112158_...sql                 ┃
┃ Function: get_eligible_ads()                                    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                  ┃
┃ Selects PAID promoted events by:                                ┃
┃ • ✅ Campaign active (status='active')                          ┃
┃ • ✅ Budget remaining (spent < budget)                          ┃
┃ • ✅ Dates valid (start_date <= now <= end_date)                ┃
┃ • ✅ Targeting match:                                           ┃
┃   - Category (Music, Sports, etc.)                              ┃
┃   - Location (NYC, SF, etc.)                                    ┃
┃   - Keywords (optional)                                         ┃
┃ • ✅ Placement = 'feed'                                         ┃
┃                                                                  ┃
┃ Priority Score (Lines 150-169):                                 ┃
┃ • 40% Budget remaining (more $ = higher priority)               ┃
┃ • 30% Category match (exact match bonus)                        ┃
┃ • 20% Location match (geo-targeted bonus)                       ┃
┃ • 10% Randomness (prevent same ad always winning)               ┃
┃                                                                  ┃
┃ Returns: ~1-5 ads (based on organic feed size)                  ┃
┃ Example: [Ad1, Ad2, Ad3]                                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STAGE 3: AD INJECTION (Merge)                                   ┃
┃ File: supabase/functions/home-feed/index.ts                     ┃
┃ Function: injectAds() (Lines 329-341)                           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                  ┃
┃ Placement Algorithm:                                            ┃
┃ • Skip first 3 items (organic content first)                    ┃
┃ • Insert 1 ad every 6 items                                     ┃
┃ • Pattern: [Org, Org, Org, AD, Org, Org, Org, AD, ...]          ┃
┃                                                                  ┃
┃ const adFrequency = 6;  // Configurable                         ┃
┃                                                                  ┃
┃ Final Feed Layout:                                              ┃
┃ Position 0-2: Organic (best content first)                      ┃
┃ Position 3-5: Organic                                           ┃
┃ Position 6:   AD #1 ← First ad slot                             ┃
┃ Position 7-11: Organic                                          ┃
┃ Position 12:  AD #2 ← Second ad slot                            ┃
┃ ...                                                              ┃
┃                                                                  ┃
┃ Returns: Final feed with ads injected                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   FEED DISPLAYED TO USER                            │
│                                                                     │
│ Items have:                                                         │
│ • item_type: 'event' or 'post'                                     │
│ • isPromoted: true/false (marks ads)                               │
│ • promotion: { campaignId, pricingModel, ... } (for ads only)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 **AD PRIORITY SCORING** (Lines 150-169)

**Formula:**
```javascript
priority_score = 
  (0.40 × budget_remaining_factor) +    // More $ left = higher priority
  (0.30 × category_match) +             // Exact category match
  (0.20 × location_match) +             // Geo-targeted match
  (0.10 × random())                     // Prevent always showing same ad
```

### **Example Ad Selection:**

Given these campaigns:

| Campaign | Budget Left | Category Match | Location Match | Priority Score |
|----------|-------------|----------------|----------------|----------------|
| "Concert Promo" | $5000 | ✅ Music | ✅ NYC | **0.90** ← Winner! |
| "Sports Event" | $1000 | ❌ Sports | ✅ NYC | **0.42** |
| "Tech Meetup" | $3000 | ❌ Tech | ❌ SF | **0.25** |

**Result:** "Concert Promo" gets selected and shown to user.

---

## 🔄 **INTERACTION: Organic Ranking vs. Ads**

### **Independent Systems:**

**Organic Ranking:**
- Happens FIRST
- Scores based on user behavior
- Free for organizers
- Example: "Summer Music Festival" scores 0.85

**Ad System:**
- Happens SECOND (after organic)
- Scores based on bid/budget
- Paid by organizers
- Example: "Concert Promo" has $5000 budget

**Injection:**
- Merges the two lists
- Keeps organic ranking intact
- Inserts ads at fixed positions (6, 12, 18...)

---

## 💡 **IMPORTANT: Ads DON'T Affect Organic Ranking**

An event can be:

1. **Organic Only** (free, ranked by algorithm)
   ```
   Position 3: "Local Band Show" (score: 0.72)
   - Shows because algorithm thinks user will buy tickets
   ```

2. **Ad Only** (paid, bypasses ranking)
   ```
   Position 6: "Major Concert" (promoted, score: N/A)
   - Shows because organizer paid $500 CPM
   - Might have scored 0.10 organically (low), but ad guarantees placement
   ```

3. **Both Organic AND Ad** (best of both worlds)
   ```
   Position 2: "Taylor Swift Concert" (score: 0.95)  ← Organic placement
   Position 12: "Taylor Swift Concert" (promoted)    ← Also paid ad
   - Shows TWICE: once organically, once as ad
   - Organizer gets double exposure
   ```

---

## 🎨 **AD FREQUENCY TUNING**

**Current Setting (Line 258):**
```typescript
const adFrequency = 6;  // 1 ad per 6 items = 16.7% of feed
```

### **Ad Density Options:**

| adFrequency | Ad % | Feed Layout |
|-------------|------|-------------|
| `4` | 25% | [Org, Org, Org, **AD**, Org, Org, Org, **AD**] ← Aggressive |
| `6` | 16.7% | [Org×3, **AD**, Org×5, **AD**] ← **Current (balanced)** |
| `8` | 12.5% | [Org×3, **AD**, Org×7, **AD**] ← Conservative |
| `10` | 10% | [Org×3, **AD**, Org×9, **AD**] ← Minimal |

**To change:**
Edit `supabase/functions/home-feed/index.ts` line 258

---

## 📈 **AD PERFORMANCE TRACKING**

**Files:**
- `src/hooks/useImpressionTracker.ts` - Tracks ad views/clicks
- `campaigns.campaign_impressions` - Stores impression data
- `campaigns.campaign_clicks` - Stores click data

**Metrics:**
```sql
-- Check ad performance
SELECT 
  c.name AS campaign,
  c.pricing_model,
  COUNT(DISTINCT ci.id) AS impressions,
  COUNT(DISTINCT cc.id) AS clicks,
  ROUND(COUNT(DISTINCT cc.id)::numeric / NULLIF(COUNT(DISTINCT ci.id), 0) * 100, 2) AS ctr_percent,
  c.spent_credits / 100.0 AS spent_dollars
FROM campaigns.campaigns c
LEFT JOIN campaigns.campaign_impressions ci ON ci.campaign_id = c.id
LEFT JOIN campaigns.campaign_clicks cc ON cc.campaign_id = c.id
WHERE c.created_at > now() - interval '30 days'
GROUP BY c.id, c.name, c.pricing_model, c.spent_credits
ORDER BY impressions DESC;
```

---

## 🎯 **THREE CONTENT TYPES IN FEED**

### **Type 1: Organic Content** (FREE)
- **Selected by:** Purchase intent algorithm
- **Cost:** Free
- **Placement:** Positions 0-2, 4-5, 7-11, 13-17, etc.
- **Badge:** None (or "ORGANIZER" if creator posted)
- **Ranking:** Based on 30+ behavioral signals

---

### **Type 2: Promoted Ads** (PAID - CPM/CPC)
- **Selected by:** `get_eligible_ads()` (budget + targeting)
- **Cost:** $5-50 CPM or $0.50-5 CPC
- **Placement:** Positions 6, 12, 18, 24... (every 6 items)
- **Badge:** ✨ "Promoted"
- **Ranking:** Priority score (budget × targeting match)

**Files:**
- Selection: `supabase/migrations/20251026112158_fix_get_eligible_ads_direct_uploads.sql`
- Injection: `supabase/functions/home-feed/index.ts` (Line 239-357)
- Tracking: `src/hooks/useImpressionTracker.ts`

---

### **Type 3: Sponsored Events** (PAID - Fixed Package)
- **Selected by:** Either organic OR ad system
- **Cost:** $500-5000 (one-time sponsorship package)
- **Placement:** Wherever base content appears
- **Badge:** 🏢 "Sponsored by Nike" (in addition to Promoted if also an ad)
- **Ranking:** Same as base content (organic score or ad position)

**Files:**
- Visual: `src/components/sponsorship/SponsorBadges.tsx`
- Data: `sponsorship.sponsorship_orders` table
- Matching: `supabase/migrations/20251022_0001_optimized_sponsorship_system.sql`

---

## 🔀 **HOW THEY COMBINE**

### **Scenario 1: Regular Event (Organic Only)**
```
┌────────────────────────────┐
│ "Local Coffee Meetup"      │ ← Organic ranking: 0.65
│ 📅 Nov 10 • ☕️ Starbucks   │
│ [Get Tickets]              │
└────────────────────────────┘
Position: 4 (organic slot)
Cost to organizer: $0
Selected because: User saved similar events
```

---

### **Scenario 2: Promoted Event (Ad Only)**
```
┌────────────────────────────┐
│ ✨ Promoted                │ ← Yellow badge
│ "Major Music Festival"     │
│ 📅 Dec 15 • 🎵 Madison SQ  │
│ [Learn More →]             │ ← Custom CTA
└────────────────────────────┘
Position: 6 (first ad slot)
Cost to organizer: $500 (CPM campaign)
Selected because: Paid budget, targeting matched
Organic score: 0.25 (would be position 50+ if not promoted)
```

---

### **Scenario 3: Sponsored Event (Organic + Sponsorship)**
```
┌────────────────────────────┐
│ "Tech Conference 2024"     │ ← Organic ranking: 0.78
│ 📅 Nov 20 • 🏢 Convention  │
│ 🏢 Sponsored by TechCorp   │ ← Sponsor badge
│ [Get Tickets]              │
└────────────────────────────┘
Position: 2 (organic slot - high score)
Cost to organizer: $0 for placement (but $5000 to TechCorp for sponsorship)
Selected because: High organic score
Sponsor: TechCorp paid for visual branding
```

---

### **Scenario 4: EVERYTHING (Promoted + Sponsored)**
```
┌────────────────────────────┐
│ ✨ Promoted                │ ← Paid ad
│ "Taylor Swift Concert"     │
│ 📅 Dec 31 • 🎤 Stadium     │
│ 🏢 Sponsored by Pepsi      │ ← Paid sponsor
│ [Buy Tickets →]            │ ← Custom CTA
└────────────────────────────┘
Position: 12 (second ad slot)
Cost to organizer: 
  - $1000 CPM campaign (ad placement)
  - $10,000 to Pepsi (sponsorship branding)
Total revenue: $11,000
```

---

## 💰 **REVENUE BREAKDOWN**

| Revenue Stream | How It Works | Typical Price | Tables |
|----------------|-------------|---------------|--------|
| **Promoted Ads (CPM)** | Pay per 1000 views | $5-50 CPM | `campaigns.campaigns`, `campaign_impressions` |
| **Promoted Ads (CPC)** | Pay per click | $0.50-5 per click | `campaigns.campaigns`, `campaign_clicks` |
| **Sponsorships** | One-time package | $500-5000 | `sponsorship.sponsorship_orders` |
| **Ticket Fees** | Platform fee on sales | 6.6% + $2.19 | `orders`, `tickets` |

---

## 🎯 **AD INJECTION CODE**

**Location:** `supabase/functions/home-feed/index.ts` (Lines 329-341)

```typescript
const result: any[] = [];
let adIndex = 0;

for (let i = 0; i < organicItems.length; i++) {
  result.push(organicItems[i]);  // Add organic item
  
  // Inject ad every N items (skip first few items)
  if (i > 2 && (i + 1) % adFrequency === 0 && adIndex < adItems.length) {
    result.push(adItems[adIndex]);  // Insert ad here
    adIndex++;
  }
}
```

**Key Details:**
- `i > 2` → Skips first 3 items (always show best organic content first)
- `(i + 1) % 6 === 0` → Every 6th item
- Graceful degradation → If no ads available, shows organic only

---

## 📊 **EXAMPLE FEED ASSEMBLY**

**Your Current Data:**

**Organic Ranking Returns:**
1. Event: "[K6 LOAD TEST]" (score: 0.70)
2. Event: "[RACE TEST]" (score: 0.54)
3. Post: "Excited for this!" (score: 0.48)
4. Post: "Can't wait!" (score: 0.45)
5. Post: "Who's going?" (score: 0.42)
6. Post: "See you there!" (score: 0.40)

**Ad Selection Returns:**
- Ad: "3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec" (priority: 0.85)

**Final Feed After Injection:**
```
Position 0: Event "[K6 LOAD TEST]"        (organic, score 0.70)
Position 1: Event "[RACE TEST]"           (organic, score 0.54)
Position 2: Post "Excited for this!"      (organic, score 0.48)
Position 3: Post "Can't wait!"            (organic, score 0.45)
Position 4: Post "Who's going?"           (organic, score 0.42)
Position 5: Post "See you there!"         (organic, score 0.40)
Position 6: Event "Promoted Event"        (AD, ✨ Promoted badge)
```

---

## 🧪 **CHECK YOUR ADS**

```sql
-- See active campaigns
SELECT 
  c.id,
  c.name,
  c.status,
  c.pricing_model,
  (c.total_budget_credits - COALESCE(c.spent_credits, 0)) AS remaining_budget_cents,
  c.start_date,
  c.end_date
FROM campaigns.campaigns c
WHERE c.status = 'active'
ORDER BY c.created_at DESC;
```

```sql
-- Test ad selection manually
SELECT * FROM get_eligible_ads(
  '34cce931-f181-4caf-8f05-4bcc7ee3ecaa'::uuid,  -- your user
  NULL,  -- category
  NULL,  -- location
  NULL,  -- keywords
  'feed',  -- placement
  5  -- limit
);
```

---

## 🎛️ **TUNING AD FREQUENCY**

Want more/fewer ads? Edit `supabase/functions/home-feed/index.ts`:

```typescript
// Line 258 - Change this number
const adFrequency = 6;  // Current: 1 ad per 6 items

// Options:
const adFrequency = 10;  // 1 ad per 10 items (10% ads)
const adFrequency = 4;   // 1 ad per 4 items (25% ads)
```

Then redeploy Edge Function:
```bash
supabase functions deploy home-feed
```

---

## 🎯 **SUMMARY: Complete Revenue Stack**

```
┌─────────────────────────────────────────────────────────────┐
│ ORGANIC FEED (Optimized for Ticket Sales)                  │
│ • Purchase intent algorithm                                 │
│ • 30+ behavioral signals                                    │
│ • Time-decay, diversity, exploration                        │
│ • Revenue: Ticket sales (6.6% fee)                          │
└─────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────┐
│ PROMOTED ADS (Paid Event Boosts)                            │
│ • CPM/CPC campaigns                                         │
│ • Budget-based priority                                     │
│ • Injected every 6 items                                    │
│ • Revenue: Ad spend ($5-50 CPM)                             │
└─────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────┐
│ SPONSORSHIPS (Brand Partnerships)                           │
│ • AI-matched sponsor-event fit                              │
│ • One-time packages ($500-5000)                             │
│ • Visual badges only                                        │
│ • Revenue: Sponsorship fees                                 │
└─────────────────────────────────────────────────────────────┘
                            =
┌─────────────────────────────────────────────────────────────┐
│ FINAL FEED (Maximizes Total Revenue)                        │
│ • Best organic content ranked first                         │
│ • Ads injected at regular intervals                         │
│ • Sponsor badges on applicable events                       │
│ • Revenue: Tickets + Ads + Sponsorships                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 **Key Files**

| System | Files |
|--------|-------|
| **Organic Ranking** | `supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql` |
| **Ad Selection** | `supabase/migrations/20251026112158_fix_get_eligible_ads_direct_uploads.sql` |
| **Ad Injection** | `supabase/functions/home-feed/index.ts` (Lines 239-357, 529-537) |
| **Ad Tracking** | `src/hooks/useImpressionTracker.ts` |
| **Sponsorship Visual** | `src/components/sponsorship/SponsorBadges.tsx` |
| **Sponsorship Matching** | `supabase/migrations/20251022_0001_optimized_sponsorship_system.sql` |

---

**Bottom line:** Ads are injected AFTER organic ranking, at fixed positions (6, 12, 18...), selected by budget/targeting, and tracked separately for billing. 🎯

