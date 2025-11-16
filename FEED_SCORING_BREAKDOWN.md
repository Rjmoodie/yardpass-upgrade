# Complete Feed Scoring Breakdown 🎯

## Final Score Formula

```
FINAL_SCORE = BASE_SCORE × DIVERSITY_MULTIPLIER × POST_MODIFIER

Where:
BASE_SCORE = (
  0.30 × PURCHASE_INTENT +
  0.25 × FRESHNESS +
  0.20 × AFFINITY +
  0.15 × ENGAGEMENT +
  0.10 × EXPLORATION
)
```

---

## 1. PURCHASE INTENT (Weight: 0.30 - 30% of base score)

### Tier 1: Explicit Intent (Strongest Signals)
| Signal | Weight | Half-Life | Description |
|--------|--------|-----------|-------------|
| **Saved/Bookmarked** | 5.0 | 21 days | User clicked "Save" or bookmarked the event |
| **Checkout Started** | 4.0 | 14 days | User initiated ticket purchase flow |
| **Ticket Details Viewed** | 3.0 | 14 days | User opened ticket tier selection modal |

### Tier 2: Strong Behavioral Signals
| Signal | Weight | Half-Life | Description |
|--------|--------|-----------|-------------|
| **Dwell Completed** | 2.0 | 7 days | User viewed event card for 10+ seconds |
| **Share Event** | 0.0 | 30 days | User shared event (NOT IMPLEMENTED YET) |
| **Similar Purchase** | 1.5 | 180 days | User bought tickets to similar events (category/venue) |

### Tier 3: Moderate Signals
| Signal | Weight | Half-Life | Description |
|--------|--------|-----------|-------------|
| **Profile Visit** | 0.8 | 30 days | User visited organizer's profile page |

### Tier 4: Preference Signals
| Signal | Weight | Half-Life | Description |
|--------|--------|-----------|-------------|
| **Price Fit** | 0.5 | None | Event price matches user's historical spending (IQR) |
| **Time Fit** | 0.3 | None | Event time matches user's attendance patterns (DOW/hour) |

**Price Fit Logic:**
- 1.0 if price is within user's 25th-75th percentile
- 0.6 if price is within 70%-130% of that range
- 0.0 otherwise

**Time Fit Logic:**
- 1.0 if event day/hour matches user's past attendance patterns (±2 hours)
- 0.0 otherwise

---

## 2. FRESHNESS (Weight: 0.25 - 25% of base score)

```
freshness = max(0, 1.0 - |days_from_start| / 180)
```

- **Recently created/upcoming events** → Higher score
- **Events far in future/past** → Lower score
- Linear decay over 180 days

---

## 3. AFFINITY (Weight: 0.20 - 20% of base score)

| Signal | Weight | Description |
|--------|--------|-------------|
| **Past Ticket** | 1.2 | User purchased tickets to this event before |
| **Follows Event** | 1.0 | User follows this specific event |
| **Follows Organizer** | 0.8 | User follows the event organizer |
| **Location Close** | 0.5 | Event within 10 miles of user |
| **Location Near** | 0.3 | Event within 10-25 miles of user |

**Total Affinity = Sum of all applicable signals**

---

## 4. ENGAGEMENT (Weight: 0.15 - 15% of base score)

### Bayesian Smoothed Engagement Rate

```
engagement = (likes + saves + 5) / (views + 5 + 10)
```

- Uses **Beta distribution** for Bayesian smoothing
- **Prior α = 5** (pseudo-likes)
- **Prior β = 10** (pseudo-views)
- Prevents new events from having artificially low scores
- Counts engagement from last 90 days only

**Components:**
- Likes on event posts
- Event saves/bookmarks
- Event impressions (views)

---

## 5. EXPLORATION (Weight: 0.10 - 10% of base score)

### A. Random Exploration (70% of exploration component)
```
exploration_score = 0.01 × hash(session_id + event_id)
```
- Deterministic hash ensures consistency within a session
- Allows users to discover new/unexpected events
- Session-specific randomization

### B. Cold Start Prior (30% of exploration component)
```
cold_start_prior = avg_views_for_city_and_category
```
- Boosts events from popular city/category combinations
- Helps new events with little engagement data
- Based on 90-day historical view counts

**Total Exploration = 0.7 × random + 0.3 × cold_start**

---

## 6. DIVERSITY MULTIPLIER (Applied to Base Score)

Prevents feed from being dominated by a single prolific organizer:

| Organizer Rank | Multiplier | Effect |
|----------------|------------|--------|
| **1st event** | 1.00 | No penalty |
| **2nd event** | 0.85 | 15% reduction |
| **3rd event** | 0.70 | 30% reduction |
| **4th+ event** | 0.55 | 45% reduction |

- Rank is per-organizer within the feed
- Ensures content variety
- Top event from each organizer appears at full strength

---

## 7. POST MODIFIER (Applied to Event Score)

When showing **posts** instead of event cards:

| Condition | Multiplier | Description |
|-----------|------------|-------------|
| **User Has Tickets** | 1.2 | 🔥 **20% boost** - prioritize social engagement for attending events |
| **User Has NOT Purchased** | 0.98 | **2% penalty** - slightly lower than event cards |

**Post Selection Logic:**
- Top 3 posts per event (by recency + engagement)
- Engagement score = `likes + (1.2 × comments)`
- Only posts from last 365 days
- Excludes deleted posts

---

## 8. CANDIDATE EVENT FILTERS (Pre-scoring)

Events must pass ALL filters to be scored:

### Basic Eligibility
- ✅ `visibility = 'public'`
- ✅ `start_at >= now()` (future events only)
- ✅ `start_at < now() + 365 days` (within next year)
- ✅ `is_flashback = false` (no flashback events)

### User-Specific Filters
- ✅ **NOT purchased** (event cards only - hide cards for events user already has tickets for)
- ✅ **Category match** (if category filter applied)
- ✅ **Distance match** (if "Near Me" filter applied)
- ✅ **Date range match** (if date filter applied)

---

## 9. PAGINATION & RANKING

### Final Ranking Order
```sql
ORDER BY 
  final_score DESC,
  anchor_ts DESC NULLS LAST,
  event_id DESC
```

1. **Primary:** Highest score wins
2. **Tiebreaker 1:** Most recent start time
3. **Tiebreaker 2:** Event ID (stable sort)

### Pagination
- Uses `ROW_NUMBER()` + `p_cursor_item_id`
- Returns items AFTER the cursor row
- Limit + 1 to detect if more pages exist

---

## 10. TIME DECAY FORMULA

All time-decayed signals use exponential decay:

```
decay = exp(-ln(2) × days_elapsed / half_life_days)
```

**Example (Saved Event):**
- Day 0: decay = 1.00 (100% weight)
- Day 21: decay = 0.50 (50% weight - half-life)
- Day 42: decay = 0.25 (25% weight)
- Day 63: decay = 0.125 (12.5% weight)

**Half-Lives:**
- Explicit intent: 14-21 days (fast decay)
- Behavioral signals: 7-30 days (medium decay)
- Similarity: 180 days (slow decay)

---

## 📊 Example Score Calculation

### Event: "Summer Music Festival"
**User Context:**
- Saved event 10 days ago
- Viewed ticket details 5 days ago
- Lives 8 miles from venue
- Previously bought 2 similar events
- Event is in 30 days

### Step 1: Purchase Intent
```
saved_decay = exp(-ln(2) × 10 / 21) = 0.73
ticket_detail_decay = exp(-ln(2) × 5 / 14) = 0.78
similar_purchase_decay = exp(-ln(2) × 60 / 180) = 0.79

purchase_intent = 
  5.0 × 0.73  (saved) +
  3.0 × 0.78  (ticket detail) +
  1.5 × 0.79  (similar purchase)
= 3.65 + 2.34 + 1.19
= 7.18
```

### Step 2: Freshness
```
freshness = 1.0 - (30 / 180) = 0.83
```

### Step 3: Affinity
```
affinity = 0.5 (location_close within 10 miles)
```

### Step 4: Engagement
```
likes = 50, views = 500
engagement = (50 + 5) / (500 + 5 + 10) = 0.107
```

### Step 5: Exploration
```
random = 0.005 (from hash)
cold_start = 100 (avg views for city/category)
exploration = 0.7 × 0.005 + 0.3 × (100/max_cold)
```

### Step 6: Normalize & Combine
```
Assume max_intent = 10.0, max_fresh = 1.0, max_aff = 2.0, max_eng = 0.2, max_cold = 200

base_score = 
  0.30 × (7.18 / 10.0) +  // Purchase intent
  0.25 × (0.83 / 1.0) +   // Freshness
  0.20 × (0.5 / 2.0) +    // Affinity
  0.15 × (0.107 / 0.2) +  // Engagement
  0.10 × exploration      // Exploration
= 0.215 + 0.208 + 0.05 + 0.080 + 0.010
= 0.563
```

### Step 7: Diversity Multiplier
```
If this is the organizer's 1st event in feed:
final_score = 0.563 × 1.0 = 0.563
```

### Step 8: Post Modifier (if showing post)
```
If user has tickets:
  post_score = 0.563 × 1.2 = 0.676
If user has NOT purchased:
  post_score = 0.563 × 0.98 = 0.552
```

---

## 🎯 Summary: All Factors Ranked by Impact

### Highest Impact (Can Double/Halve Scores)
1. **Purchase Intent Signals** (30% of base, 5.0x max weight)
2. **User Has Tickets** (1.2x boost for posts)
3. **Diversity Multiplier** (0.55x to 1.0x)

### High Impact
4. **Freshness** (25% of base)
5. **Affinity** (20% of base)

### Moderate Impact
6. **Engagement** (15% of base)
7. **Exploration** (10% of base)

### Fine-Tuning
8. **Time Decay** (exponential decay over weeks/months)
9. **Bayesian Smoothing** (prevents zero-engagement penalty)

---

## 🔧 Tunable Parameters

All weights stored in `model_feature_weights` table - can be adjusted without redeploying code!

**To adjust weights:**
```sql
UPDATE public.model_feature_weights
SET weight = 4.0  -- new weight
WHERE feature = 'intent.saved';
```

**No code changes needed!** SQL function reads from table dynamically.

---

Generated: November 7, 2025







