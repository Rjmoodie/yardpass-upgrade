# Feed Scoring Logic - File Reference

## Database Functions (Core Scoring Algorithm)

### Primary File:
**`supabase/migrations/20250115000018_hide_past_event_cards_from_feed.sql`**
- Contains `get_home_feed_ids()` function
- **Lines 140-164:** Core scoring algorithm
- **Scoring weights:**
  - 35% Freshness (how soon the event is)
  - 20% Engagement (likes, comments, tickets sold, follows)
  - 25% Affinity (user has tickets, follows event/org)
  - 15% Tag affinity (matches user's interests)
  - 5% Collaborative filtering
  - +0.05 Cold start boost (events created in last 48h)

### Scoring Formula (Line 154-164):
```sql
final_score = 
  0.35 * freshness +           -- Higher for sooner events
  0.20 * engagement_norm +     -- Likes, comments, tickets, follows
  0.25 * affinity_norm +       -- User connection to event/org
  0.15 * tag_affinity_norm +   -- User's tag preferences
  0.05 * collab_score +        -- Similar users liked this
  explore_boost                -- +0.05 for new events, +0.005 otherwise
```

### Other Related Files:
1. **`supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql`**
   - Alternative version with purchase intent optimization
   - Lines 267-400: Candidate events and scoring

2. **`supabase/migrations/20250104_improve_recommendation_intelligence.sql`**
   - Enhanced tag affinity and collaborative filtering
   - Log-normalized engagement signals

3. **`supabase/migrations/20250125_add_feed_filters.sql`**
   - Adds category, location, and date filtering

## Frontend (Calls the Functions)

### Edge Function:
**`supabase/functions/home-feed/index.ts`**
- Lines 477-489: Calls `get_home_feed_ranked()` RPC
- Lines 239-349: Ad injection logic
- Lines 384-906: Hydration (adds event details, posts, sponsors, etc.)

### Frontend Hooks:
1. **`src/hooks/useUnifiedFeedInfinite.ts`** (lines 32-94)
   - Calls the Edge Function
   - Handles pagination
   - Manages filters

2. **`src/hooks/useHomeFeed.ts`** (lines 101-272)
   - Alternative feed hook
   - Uses `get_home_feed` RPC directly

3. **`src/hooks/useAffinityFeed.ts`** (lines 20-108)
   - Uses `get_home_feed_ids` RPC directly
   - Lighter version

### Frontend Components:
1. **`src/features/feed/routes/FeedPageNewDesign.tsx`**
   - Main feed UI
   - Uses `useUnifiedFeedInfinite()`

2. **`src/components/MainFeed.tsx`**
   - Alternative feed UI (mobile-focused)
   - Simpler query without scoring

## Your Event's Low Score (0.0595)

Your event scored low because:

### Breakdown (estimated):
- **Freshness:** ~0.01 (114 days away = very far future, low urgency)
- **Engagement:** ~0.01 (no likes, comments, tickets, follows yet)
- **Affinity:** ~0.01 (you haven't bought ticket or followed)
- **Tag Affinity:** ~0.01 (no tag matches)
- **Collab:** ~0.00 (no similar users)
- **Cold Start Boost:** +0.05 (event created < 48h ago) ✓

**Total:** ~0.05-0.06 ✓ Matches your score!

## How to Boost Score

1. **Add a post with media** → +engagement (line 73-88)
2. **Add likes/comments to posts** → +engagement
3. **Add tickets** → +engagement
4. **Create event sooner** → +freshness
5. **Add tags** → +tag_affinity
6. **Follow the event/org** → +affinity

The cold start boost (0.05) is already helping, but it's still ranked low compared to events with real engagement (scores 1.5+).





