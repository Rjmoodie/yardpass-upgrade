# 🎯 Liventix vs TikTok: Recommendation System Comparison

## Overview
TikTok recommends **content** (videos). Liventix recommends **events** (experiences).

---

## 📊 Core Recommendation Factors

| Factor | TikTok | Liventix | Status |
|--------|--------|----------|--------|
| **User Interactions** | Likes, shares, comments, watch time, follows | Likes, shares, comments, dwell time, saves, ticket purchases, event attendance | ✅ **ALIGNED** |
| **Content Information** | Sounds, hashtags, views, publish location | Event category, location, date, ticket tiers, organizer, venue | ✅ **ALIGNED** |
| **User Information** | Device, language, location, timezone, device type | Device, location, timezone, preferences | ✅ **ALIGNED** |
| **Weighting Priority** | User interactions > Content info > User info | **Same priority structure** | ✅ **ALIGNED** |

---

## 🏠 Feed Types Comparison

### **For You Feed**

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Purpose** | Discover new content | Discover new events | Home feed with ranked events | ✅ **IMPLEMENTED** |
| **Initial recommendations** | Popular content for broad audience | Popular events by location/category | `get_home_feed_ranked` RPC | ✅ **IMPLEMENTED** |
| **Onboarding** | Category selection (pets, travel) | Category selection (Sports, Music, Tech) | Filters: categories, dates, locations | ✅ **IMPLEMENTED** |
| **User interactions tracked** | Likes, comments, shares, watch time, skip | Likes, comments, shares, dwell time, saves, ticket views | `useImpressionTracker` | ✅ **IMPLEMENTED** |
| **Content information** | Hashtags, sounds, views, location | Categories, venue, city, dates, ticket tiers | Event metadata in database | ✅ **IMPLEMENTED** |
| **Collaborative filtering** | Users with similar interests | Events attended by similar users | `affinity_scores`, user behavior | ✅ **IMPLEMENTED** |
| **Not Interested** | Feedback to hide similar content | (Missing) | Not implemented | ❌ **GAP** |
| **Refresh feed** | Reset recommendations | (Partial) Page refresh reloads | Could add manual refresh button | ⚠️ **PARTIAL** |
| **Filter keywords** | Block specific words/hashtags | (Missing) | Not implemented | ❌ **GAP** |
| **Manage topics** | Adjust topic preferences | Category filters | Filter UI in feed | ✅ **IMPLEMENTED** |

---

### **Following Feed**

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Purpose** | Content from followed creators | Events from followed organizers | Following feed option | ✅ **IMPLEMENTED** |
| **Personalization** | Ranked by engagement predictions | Ranked by relevance + affinity | Affinity scoring system | ✅ **IMPLEMENTED** |
| **User interactions** | Profile visits, likes, comments, watch time | Profile visits, ticket purchases, saves | Tracked in `event_interactions` | ✅ **IMPLEMENTED** |
| **Unfollow** | Remove creator's posts | Remove organizer's events | `follows` table | ✅ **IMPLEMENTED** |
| **Filter keywords** | Block specific words | (Missing) | Not implemented | ❌ **GAP** |

---

### **Friends Tab**

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Purpose** | Content from mutual friends | Events from friends/connections | (Missing dedicated tab) | ❌ **GAP** |
| **Source** | Followers you follow back | Users you're connected with | `follows` table (mutual connections) | ⚠️ **PARTIAL** |
| **Suggested accounts** | People you may know | (Missing) | Not implemented | ❌ **GAP** |
| **Profile visits tracking** | Track who you visit | (Missing explicit tracking) | Could add to analytics | ⚠️ **PARTIAL** |
| **Contact sync** | Import phone contacts | (Missing) | Not implemented | ❌ **GAP** |
| **Filter keywords** | Block specific words | (Missing) | Not implemented | ❌ **GAP** |

---

### **LIVE Feed**

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **LIVE streaming** | Live video broadcasts | **N/A - Not in scope** | Not applicable | ⛔ **EXCLUDED** |
| **LIVE recommendations** | Real-time content discovery | **N/A - Not in scope** | Not applicable | ⛔ **EXCLUDED** |
| **Gifts & monetization** | Virtual gifts to creators | **N/A - Not in scope** | Not applicable | ⛔ **EXCLUDED** |

---

## 🔍 Search Comparison

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Search functionality** | Search videos by keyword | Search events by title/location/category | Search page + filters | ✅ **IMPLEMENTED** |
| **Search term suggestions** | Recommend search queries | (Missing autocomplete) | Not implemented | ❌ **GAP** |
| **Content matching** | Match videos to query | Match events to query | Full-text search | ✅ **IMPLEMENTED** |
| **Ranking factors** | Past searches, interactions, relevance | Event popularity, date proximity, location | `get_home_feed_ranked` | ✅ **IMPLEMENTED** |
| **Filters** | (Not mentioned) | Category, date, location, price | Advanced filter UI | ✅ **BETTER THAN TIKTOK** |

---

## 💬 Comments Comparison

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Comment recommendations** | Show interesting comments | (Missing sorting) | Comments shown chronologically | ⚠️ **PARTIAL** |
| **Comment ranking** | Likes, replies, creator/follower status | (Missing) | Not implemented | ❌ **GAP** |
| **Dislike comments** | Hide uninteresting comments | (Missing) | Not implemented | ❌ **GAP** |

---

## 🔔 Notifications Comparison

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Recommended content** | Suggest posts you might like | Suggest events you might attend | (Missing proactive notifications) | ❌ **GAP** |
| **Suggested people** | People you might know | (Missing) | Not implemented | ❌ **GAP** |
| **Activity-based** | Based on app activity level | Event reminders, ticket confirmations | Basic notifications | ⚠️ **PARTIAL** |
| **Notification preferences** | Granular control | (Missing settings UI) | Not implemented | ❌ **GAP** |

---

## 👥 Account Recommendations

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Suggested accounts** | People/creators to follow | Organizers to follow | (Missing dedicated UI) | ❌ **GAP** |
| **Based on activity** | Accounts you interact with | Organizers of events you attend | Could use ticket purchase data | ⚠️ **PARTIAL** |
| **Follower/view count** | Popular accounts weighted higher | Popular organizers | Organizer analytics available | ✅ **IMPLEMENTED** |
| **Mutual connections** | Friends-of-friends | (Missing) | `follows` table supports this | ⚠️ **PARTIAL** |
| **Contact sync** | Phone contacts import | (Missing) | Not implemented | ❌ **GAP** |
| **Remove suggestions** | Dismiss unwanted recommendations | (Missing) | Not implemented | ❌ **GAP** |

---

## 🛡️ Safety & Quality

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Content moderation** | Remove violating content | Remove spam/inappropriate events | Manual moderation | ⚠️ **PARTIAL** |
| **Rising content review** | Review before recommending | (Missing) | Not implemented | ❌ **GAP** |
| **Age restrictions** | Age-gated content | Age-appropriate events | (Missing) | ❌ **GAP** |
| **Community Guidelines** | Comprehensive rules | Basic TOS | Could add | ⚠️ **PARTIAL** |
| **Safety team** | Dedicated reviewers | (Missing) | Not implemented | ❌ **GAP** |

---

## 🎨 Diversification

| Feature | TikTok | Liventix | Implementation | Status |
|---------|--------|----------|----------------|--------|
| **Avoid repetition** | Don't show same video twice | Don't show same event twice (per session) | Deduplication in feed | ✅ **IMPLEMENTED** |
| **Avoid creator spam** | Limit consecutive posts from same creator | Limit consecutive events from same organizer | (Missing) | ❌ **GAP** |
| **Explore new categories** | Suggest diverse topics | Suggest diverse event categories | Category mixing in feed | ⚠️ **PARTIAL** |
| **Fallback content** | Show For You when Following is empty | Show popular events when no personalization data | Fallback in `get_home_feed_ranked` | ✅ **IMPLEMENTED** |

---

## 📈 Ranking Signals

### ✅ **Signals Liventix DOES Track**

| Signal Type | Examples | Database Tables |
|-------------|----------|-----------------|
| **Explicit interactions** | Likes, comments, shares, saves | `event_reactions`, `event_comments`, `saved_events` |
| **Implicit interactions** | Dwell time, completion rate, scroll behavior | `event_impressions`, `post_impressions` |
| **Transaction signals** | Ticket purchases, ticket views | `tickets`, `ticket_views` |
| **Social signals** | Follows, connections | `follows`, `user_connections` |
| **Location signals** | User location, event location, distance | `user_profiles.location`, `events.city` |
| **Temporal signals** | Event date proximity, time zone | `events.start_at`, user timezone |
| **Content metadata** | Category, venue, organizer | `events` table columns |
| **Promotional signals** | Sponsored content, ad boosts | `campaigns`, `campaign_impressions` |

### ❌ **Signals Liventix Does NOT Track (Yet)**

| Signal Type | TikTok Has | Liventix Status |
|-------------|------------|-----------------|
| **Skip behavior** | User skipped video quickly | Not tracking explicit "skip" | ❌ **GAP** |
| **Profile visit frequency** | How often you visit a creator | Not tracking profile visits | ❌ **GAP** |
| **Hashtag interactions** | Which hashtags you engage with | No hashtag system | ❌ **GAP** |
| **Sound/audio preferences** | Which sounds you like | Not applicable to events | ⛔ **N/A** |
| **Contact sync** | Who you know IRL | No contact import | ❌ **GAP** |
| **"Not Interested" feedback** | Explicit negative signal | No dislike/hide feature | ❌ **GAP** |

---

## 🎯 Liventix-Specific Advantages

| Feature | TikTok Equivalent | Liventix Implementation | Benefit |
|---------|-------------------|-------------------------|---------|
| **Ticket Purchase Intent** | N/A (no transactions) | Track ticket views, cart adds, purchases | **Better conversion prediction** |
| **Event RSVP/Interest** | Save video | Save event, view tickets, share | **Stronger intent signal** |
| **Organizer Trust** | Creator reputation | Organizer verification, past event success | **Quality filtering** |
| **Date/Time Preferences** | N/A (content always available) | Learn user's preferred event times/days | **Temporal personalization** |
| **Price Sensitivity** | N/A | Track which ticket tiers users view/buy | **Price-aware recommendations** |
| **Travel Distance** | N/A | Distance-based filtering (Near Me) | **Location relevance** |
| **Multi-attendee behavior** | N/A | Group ticket purchases | **Social graph insights** |
| **Sponsorship matching** | N/A | AI sponsor-event fit scores | **Monetization intelligence** |

---

## 🚨 Critical Gaps to Address

### **Priority 1: User Feedback Loops**

| Missing Feature | Impact | Implementation Effort |
|-----------------|--------|----------------------|
| **"Not Interested" button** | Can't learn from negative signals | **LOW** - Add button + table |
| **"Hide this organizer"** | Can't block unwanted content | **LOW** - Add to user preferences |
| **Report event** | Safety/quality issues | **MEDIUM** - Add moderation queue |

### **Priority 2: Engagement Signals**

| Missing Feature | Impact | Implementation Effort |
|-----------------|--------|----------------------|
| **Track profile visits** | Missing engagement signal | **LOW** - Add to impressions |
| **Track ticket view duration** | Missing intent signal | **MEDIUM** - Add to checkout flow |
| **"Skip" detection** | Can't detect disinterest | **LOW** - Track sub-1s dwell times |

### **Priority 3: Diversification**

| Missing Feature | Impact | Implementation Effort |
|-----------------|--------|----------------------|
| **Limit same organizer** | Feed gets repetitive | **LOW** - Add to ranking logic |
| **Category mixing** | Users stuck in filter bubble | **MEDIUM** - Add diversity scoring |
| **Explore mode** | Hard to discover new interests | **MEDIUM** - Add exploration bonus |

---

## 📊 Recommendation Quality Score

| Category | TikTok (10/10) | Liventix | Score |
|----------|----------------|----------|-------|
| **Core Ranking Signals** | ✅ All present | ✅ All present + ticket data | **11/10** ⭐ |
| **User Feedback** | ✅ Not Interested, Refresh | ❌ Missing | **3/10** |
| **Feed Variety** | ✅ Multiple feeds | ⚠️ One main feed | **5/10** |
| **Diversification** | ✅ Anti-spam, category mixing | ⚠️ Basic dedup only | **4/10** |
| **Safety/Moderation** | ✅ Comprehensive | ⚠️ Basic | **3/10** |
| **Social Discovery** | ✅ Friends Tab, contacts | ❌ Missing | **2/10** |
| **Personalization Depth** | ✅ Deep learning models | ✅ Affinity + fit scores | **8/10** |
| **Transaction Intelligence** | ❌ No commerce | ✅ Ticket purchase data | **10/10** ⭐ |

**Overall: 46/80 (58%)** - Good foundation, clear improvement path

---

## 🎯 Recommendation Ranking Files

### **Where Liventix Aligns with TikTok**

#### **1. Main Ranking Algorithm**
**File:** `supabase/migrations/*_affinity_scoring.sql` or RPC functions
- **TikTok equivalent:** Core recommendation engine
- **Status:** ✅ You have `get_home_feed_ranked` RPC
- **What it does:** Scores events based on user affinity

#### **2. User Interaction Tracking**
**Files:**
- `src/hooks/useImpressionTracker.ts` - Dwell time, completion
- `supabase/migrations/20251026130000_create_organic_impressions_tables.sql` - Impressions
- Event reactions, comments, saves

**TikTok equivalent:** Watch time, likes, shares
**Status:** ✅ Fully implemented

#### **3. Content Information**
**Files:**
- `supabase/migrations/*_events_schema.sql` - Event metadata
- Event categories, locations, dates, tiers

**TikTok equivalent:** Video metadata (sounds, hashtags, captions)
**Status:** ✅ Fully implemented

#### **4. Ad/Promotion Injection**
**Files:**
- `supabase/functions/home-feed/index.ts` (Lines 239-357) - `injectAds()`
- `src/hooks/useCampaignBoosts.ts` - Client-side boosts

**TikTok equivalent:** Sponsored content placement
**Status:** ✅ Fully implemented

---

## ❌ Where Liventix Has Gaps

### **1. User Feedback Mechanisms**

**Missing:**
- "Not Interested" button
- "Hide this organizer"
- "Report event"
- Keyword filtering

**Files to create:**
- `src/components/feed/NotInterestedButton.tsx`
- `supabase/migrations/*_add_content_preferences.sql`
- Table: `user_content_preferences` (hidden_organizers, blocked_keywords, category_weights)

---

### **2. Friends/Social Discovery**

**Missing:**
- Dedicated friends feed
- Contact sync
- "People you may know"
- Mutual friends indicator

**Files to create:**
- `src/pages/FriendsFeed.tsx`
- `supabase/migrations/*_add_friend_recommendations.sql`
- RPC: `get_friend_recommended_events`

---

### **3. Diversification Logic**

**Missing:**
- Limit consecutive events from same organizer
- Force category mixing
- Prevent filter bubbles

**Files to update:**
- `supabase/functions/home-feed/index.ts` - Add diversity penalty
- Add: `consecutive_same_organizer_penalty` in ranking

---

### **4. Advanced Personalization**

**Missing:**
- Manage topic preferences UI
- Refresh feed button
- Time-of-day preferences

**Files to create:**
- `src/pages/settings/FeedPreferences.tsx`
- `supabase/migrations/*_add_user_feed_preferences.sql`

---

## 🚀 Quick Wins to Close Gaps

### **Easy (1-2 hours each)**

1. **Add "Not Interested" button**
   ```tsx
   // In EventCardNewDesign.tsx
   <button onClick={() => hideEvent(event.id)}>
     Not Interested
   </button>
   ```

2. **Track profile visits**
   ```sql
   CREATE TABLE user_profile_visits (
     user_id UUID,
     visited_user_id UUID,
     visited_at TIMESTAMPTZ
   );
   ```

3. **Limit same organizer**
   ```typescript
   // In ranking logic
   if (consecutiveFromSameOrganizer > 2) {
     score *= 0.5; // Penalty
   }
   ```

4. **Add refresh feed button**
   ```tsx
   <button onClick={() => refetch()}>
     🔄 Refresh
   </button>
   ```

---

## 📋 Recommendation: Implementation Priority

### **Phase 1: Critical User Feedback** (1 week)
- [ ] "Not Interested" button
- [ ] "Hide organizer" option
- [ ] Track explicit skips (< 1s dwell)

### **Phase 2: Diversification** (1 week)
- [ ] Limit consecutive same-organizer events
- [ ] Category mixing algorithm
- [ ] Exploration bonus

### **Phase 3: Social Discovery** (2 weeks)
- [ ] Friends feed
- [ ] "People you may know"
- [ ] Profile visit tracking

### **Phase 4: Advanced Personalization** (2 weeks)
- [ ] Topic preference management
- [ ] Keyword filtering
- [ ] Time-of-day preferences

---

## 🎉 Summary

**Liventix Strengths:**
- ✅ Strong transaction signals (ticket purchases)
- ✅ Location-based intelligence
- ✅ Temporal relevance (event dates)
- ✅ Comprehensive analytics
- ✅ Sponsor AI matching

**Areas to Improve:**
- ❌ User feedback loops (Not Interested)
- ❌ Social discovery (Friends feed)
- ❌ Feed diversification
- ❌ Comment ranking

**You're 58% aligned with TikTok's recommendation best practices - strong foundation!** 🎯

