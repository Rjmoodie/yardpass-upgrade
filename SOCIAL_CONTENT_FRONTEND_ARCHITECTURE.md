# Social Content Frontend Architecture

> **Documentation of all front-end files responsible for displaying social content (posts, comments, reactions, media)**
> 
> Related SQL: `VIEW_SOCIAL_CONTENT.sql`

## Overview

This document maps the database tables queried in `VIEW_SOCIAL_CONTENT.sql` to their corresponding front-end components, showing how social content flows from the database to the user interface.

---

## Database Tables → Frontend Components Map

### Core Database Tables
- `events.event_posts` - User posts with text and media
- `events.event_comments` - Comments on posts
- `events.event_reactions` - Likes on posts
- `events.event_comment_reactions` - Likes on comments
- `events.event_posts_with_meta` - Enhanced view with author metadata

---

## 🔌 Edge Functions (Supabase)

All social content operations go through serverless edge functions for security, rate limiting, and business logic.

### 1. **posts-list**
**Path:** `supabase/functions/posts-list/index.ts`

**Method:** `GET`

**Purpose:** Fetch paginated list of posts with metadata

**Query Parameters:**
```typescript
{
  event_id?: string    // Filter by event
  user_id?: string     // Filter by author
  limit?: number       // Items per page (default: 30, max: 50)
  page?: number        // Page number (legacy)
  cursor?: string      // Base64 cursor for pagination (recommended)
}
```

**Database Query:**
```typescript
.from('events.event_posts_with_meta')
.select('id, created_at, title, preview, author_user_id, like_count, comment_count')
.order('created_at', { ascending: false })
```

**Response:**
```typescript
{
  items: Post[]
  nextCursor?: string  // For pagination
}
```

**Features:**
- ✅ Cursor-based pagination (efficient for large datasets)
- ✅ Legacy offset pagination support
- ✅ Uses materialized view for performance
- ✅ 10-second cache headers
- ✅ RLS enforced (users see only allowed posts)

**Used By:** `EventFeed.tsx` (line 189)

---

### 2. **posts-create**
**Path:** `supabase/functions/posts-create/index.ts`

**Method:** `POST`

**Purpose:** Create new event post with text and media

**Request Body:**
```typescript
{
  event_id: string          // Required
  text: string              // Required (max 2000 chars)
  media_urls?: string[]     // Optional (image URLs or mux:playback_id)
  ticket_tier_id?: string   // Optional (auto-detected if not provided)
}
```

**Database Operations:**
```typescript
// 1. Permission check
.rpc("can_current_user_post", { p_event_id: event_id })

// 2. Auto-detect ticket tier
.from('ticketing.tickets')
.select('tier_id')
.eq('event_id', event_id)
.eq('owner_user_id', user.id)

// 3. Insert post
.from('events.event_posts')
.insert({
  event_id,
  author_user_id: user.id,
  text: text.trim(),
  media_urls: media_urls || [],
  ticket_tier_id: finalTicketTierId,
})

// 4. Fetch enriched result
.from('events.event_posts_with_meta')
.select('*')
.eq('id', post.id)
```

**Response:**
```typescript
{
  data: {
    id: string
    text: string
    author_name: string
    author_badge: string
    like_count: number
    comment_count: number
    // ... full post metadata
  }
}
```

**Features:**
- ✅ Idempotency key support (prevents duplicate posts)
- ✅ Rate limiting (10 posts per minute)
- ✅ Permission check via RPC
- ✅ Auto-detects user's badge/tier
- ✅ Returns enriched post data from view

**Error Codes:**
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (requires ticket or organizer role)
- `429` - Rate limit exceeded
- `400` - Invalid request (missing fields, text too long)

**Used By:** `PostCreator.tsx` (line 629)

---

### 3. **comments-add**
**Path:** `supabase/functions/comments-add/index.ts`

**Method:** `POST`

**Purpose:** Add comment to a post

**Request Body:**
```typescript
{
  post_id: string    // Required
  text: string       // Required (max 2000 chars)
}
```

**Database Operations:**
```typescript
// 1. Check post exists
.from('events.event_posts')
.select('id, event_id, deleted_at')
.eq('id', post_id)

// 2. Permission check
.rpc('can_current_user_post', { p_event_id: post.event_id })

// 3. Insert comment
.from('event_comments')
.insert({
  post_id,
  author_user_id: user.id,
  text: cleaned,
})

// 4. Get updated comment count
.from('events.event_posts')
.select('comment_count')
.eq('id', post_id)

// 5. Fetch author profile
.from('users.user_profiles')
.select('display_name, photo_url')
.eq('user_id', user.id)
```

**Response:**
```typescript
{
  success: true
  comment: {
    id: string
    text: string
    created_at: string
    author_user_id: string
    author_name: string
    author_photo_url: string | null
  }
  comment_count: number
}
```

**Features:**
- ✅ Text sanitization (removes control chars)
- ✅ Permission check (must be able to post to event)
- ✅ Validates post exists and not deleted
- ✅ Returns enriched comment with author info
- ✅ Triggers update comment_count in database
- ✅ No-store cache headers (always fresh)

**Error Codes:**
- `401` - Authentication required
- `403` - Not allowed to comment
- `404` - Post not found
- `410` - Post is deleted
- `400` - Invalid request

**Used By:** `CommentModal.tsx` (line 315)

---

### 4. **reactions-toggle**
**Path:** `supabase/functions/reactions-toggle/index.ts`

**Method:** `POST`

**Purpose:** Toggle like/reaction on a post

**Request Body:**
```typescript
{
  post_id: string    // Required
  kind: "like"       // Required (currently only "like" supported)
  action?: string    // Optional (not used, auto-toggle)
}
```

**Database Operations:**
```typescript
// 1. Check if already liked
.from("event_reactions")
.select("*")
.eq("post_id", post_id)
.eq("user_id", user_id)
.eq("kind", "like")

// 2a. If exists, DELETE (unlike)
.from("event_reactions")
.delete()
.eq("post_id", post_id)
.eq("user_id", user_id)
.eq("kind", "like")

// 2b. If not exists, INSERT (like)
.from("event_reactions")
.insert({ post_id, user_id, kind: "like" })

// 3. Get exact count
.from("event_reactions")
.select("*", { count: "exact", head: true })
.eq("post_id", post_id)
.eq("kind", "like")
```

**Response:**
```typescript
{
  post_id: string
  liked: boolean              // New state
  viewer_has_liked: boolean   // Same as 'liked'
  like_count: number          // Total likes on post
}
```

**Features:**
- ✅ Automatic toggle (no need to specify like/unlike)
- ✅ Race condition safe (unique index prevents duplicates)
- ✅ Returns exact count after operation
- ✅ Optimized with composite key delete

**Used By:** `useOptimisticReactions.ts`, `ActionRail.tsx`

---

### 5. **mux-create-direct-upload**
**Path:** `supabase/functions/mux-create-direct-upload/index.ts`

**Method:** `POST`

**Purpose:** Create Mux direct upload URL for video

**Request Body:**
```typescript
{
  event_id: string          // Required
  kind?: string             // "story_video" | "link_video" (default: "story_video")
  title?: string            // Optional
  caption?: string          // Optional
}
```

**External API:**
```typescript
POST https://api.mux.com/video/v1/uploads
Authorization: Basic {base64(token_id:token_secret)}

Body: {
  cors_origin: "*",
  new_asset_settings: {
    playback_policy: ["public"]
  }
}
```

**Database Operations:**
```typescript
// 1. Permission check
.rpc("can_current_user_post", { p_event_id: event_id })

// 2. Save placeholder row
.from("event_share_assets")
.insert({
  created_by: user.id,
  event_id,
  kind,
  title,
  caption,
  mux_upload_id: upload.id,
  active: true
})
```

**Response:**
```typescript
{
  upload_id: string        // Mux upload ID
  upload_url: string       // URL to PUT video file
  asset_row_id: string     // Database row ID
}
```

**Features:**
- ✅ Direct upload to Mux (no server storage needed)
- ✅ Public playback policy
- ✅ CORS enabled for browser uploads
- ✅ 25-second timeout protection
- ✅ Saves tracking row in database

**Flow:**
```
1. Frontend calls this function → get upload_url
2. Frontend PUT video to upload_url (with progress)
3. Mux processes video asynchronously
4. Frontend polls resolve-mux-upload for status
```

**Used By:** `PostCreator.tsx` (line 140)

---

### 6. **resolve-mux-upload**
**Path:** `supabase/functions/resolve-mux-upload/index.ts`

**Method:** `POST`

**Purpose:** Poll Mux upload status and get playback ID

**Request Body:**
```typescript
{
  upload_id: string    // Required (from mux-create-direct-upload)
}
```

**External APIs:**
```typescript
// 1. Get upload status
GET https://api.mux.com/video/v1/uploads/{upload_id}

// 2. Get asset details (if ready)
GET https://api.mux.com/video/v1/assets/{asset_id}
```

**Database Operations:**
```typescript
// Update asset row with playback ID
.from("event_share_assets")
.update({
  mux_playback_id: playbackId,
  mux_asset_id: assetId
})
.eq("mux_upload_id", upload_id)
```

**Response:**
```typescript
// Processing
{
  status: "waiting" | "asset_created" | "processing"
  playback_id: null
  asset_id?: string
  asset_status?: string
}

// Ready
{
  status: "ready"
  playback_id: string      // Use this for playback
  asset_id: string
}
```

**Features:**
- ✅ Poll until asset is ready
- ✅ Returns playback ID for streaming
- ✅ Updates database when ready
- ✅ Handles intermediate states

**Typical Flow:**
```
1. Upload completes → status: "waiting"
2. Mux creates asset → status: "asset_created" + asset_id
3. Mux transcodes → status: "processing"
4. Ready → status: "ready" + playback_id
```

**Used By:** `PostCreator.tsx` (line 148-165)

---

## Edge Function Quick Reference

| Function | Method | Purpose | Used By |
|----------|--------|---------|---------|
| **posts-list** | GET | Fetch posts feed | EventFeed.tsx |
| **posts-create** | POST | Create new post | PostCreator.tsx |
| **comments-add** | POST | Add comment | CommentModal.tsx |
| **reactions-toggle** | POST | Like/unlike post | ActionRail.tsx |
| **mux-create-direct-upload** | POST | Get video upload URL | PostCreator.tsx |
| **resolve-mux-upload** | POST | Get video playback ID | PostCreator.tsx |

---

## Edge Function Security Features

### Rate Limiting
**Implemented in:** `posts-create`

```typescript
// 10 posts per minute per user
const { data: rateCheck } = await serviceClient
  .from('public.rate_limits')
  .upsert({ 
    user_id: user.id, 
    bucket: 'posts-create', 
    minute: minute.toISOString(),
    count: 1 
  })
```

### Idempotency
**Implemented in:** `posts-create`

```typescript
// Prevents duplicate posts from retries
const idempotencyKey = req.headers.get('Idempotency-Key');
if (idempotencyKey) {
  // Check if already processed
  const { data: existing } = await serviceClient
    .from('public.idempotency_keys')
    .select('response')
    .eq('key', idempotencyKey)
    .eq('user_id', user.id)
}
```

### Permission Checks
**Used by:** All functions

```typescript
// RPC function checks:
// - User has ticket for event
// - User is event organizer
// - User is organization member
.rpc('can_current_user_post', { p_event_id: event_id })
```

### Input Sanitization
**Implemented in:** `comments-add`

```typescript
function sanitizeText(input: string): string {
  return input
    .replace(/[^\P{C}\t\n\r]+/gu, '')  // Remove control chars
    .replace(/\s{3,}/g, ' ')           // Collapse whitespace
    .trim();
}
```

---

## 📱 Core Social Feed Components

### 1. **EventFeed.tsx**
**Path:** `src/components/EventFeed.tsx`

**Purpose:** Main feed component that displays all event posts

**Key Features:**
- Displays posts with media (images/videos)
- Shows like and comment counts
- Handles real-time updates via `useRealtimeEngagement`
- Supports video playback with HLS streaming
- Prefetches video manifests for smooth scrolling

**Database Queries:**
```typescript
// Lines 249-258: Fetches comments
.from('events.event_comments')
.select(`
  id, text, created_at, author_user_id, post_id,
  user_profiles!event_comments_author_user_id_fkey (
    display_name, photo_url
  )
`)
```

**Edge Functions Used:**
- `GET /functions/v1/posts-list` - Fetches posts with metadata (line 189)

**Real-time Updates:**
- Uses `useRealtimeEngagement` hook to sync likes/comments in real-time
- Listens to window event `postCreated` for new posts (line 292)

---

### 2. **UserPostCard.tsx**
**Path:** `src/components/UserPostCard.tsx`

**Purpose:** Individual post card component for feed display

**Key Features:**
- Renders single post with video/image media
- Shows author info and badges (ORGANIZER, VIP, EARLY)
- Displays like/comment metrics
- Handles video playback with HLS
- Tracks video analytics (25%, 50%, 75%, 100% milestones)
- Lazy loads videos with intersection observer

**Props Interface:**
```typescript
{
  item: FeedItem (post type)
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onEventClick: (eventId: string) => void
  onAuthorClick?: (authorId: string) => void
  soundEnabled?: boolean
  isVideoPlaying?: boolean
}
```

**Video Features:**
- Preconnects to Mux CDN for faster loading
- Uses poster images for instant visual feedback
- Tracks play/pause/progress events

---

### 3. **PostCreator.tsx**
**Path:** `src/components/PostCreator.tsx`

**Purpose:** Post creation interface

**Key Features:**
- Text composer (max 280 characters)
- Image upload (up to 8MB per image, max 8 media items)
- Video upload (up to 512MB, uses Mux for transcoding)
- Event selection dropdown
- Draft auto-save to localStorage
- Shows user's ticket badges

**Configuration:**
```typescript
MAX_LEN = 280          // characters
MAX_MEDIA = 8          // files
MAX_IMAGE_MB = 8       // megabytes
MAX_VIDEO_MB = 512     // megabytes
IMAGE_BUCKET = 'event-media'
```

**Upload Flow:**
1. Images: Optimize → Upload to Supabase Storage → Get public URL
2. Videos: Create Mux upload → PUT to Mux → Poll for playback_id → Store as `mux:playback_id`

**Database Mutations:**
```typescript
// Line 629: Creates post
await supabase.functions.invoke('posts-create', {
  body: {
    event_id: selectedEventId,
    text: content.trim(),
    media_urls: ['url1', 'url2'],
    ticket_tier_id: selectedTicket?.tier_id ?? null,
  },
});
```

**User Permissions:**
- **Attendee mode:** Can post to events they have tickets for
- **Organizer mode:** Can post to events they organize OR attend

---

### 4. **PostCreatorModal.tsx**
**Path:** `src/components/PostCreator Modal.tsx`

**Purpose:** Modal wrapper for post creation experience

---

## 💬 Comments System

### 5. **CommentModal.tsx**
**Path:** `src/components/CommentModal.tsx`

**Purpose:** Full-featured comment interface with inline composer

**Key Features:**
- Displays all comments for a post
- Inline comment composer at bottom
- Comment likes/reactions
- Delete own comments
- Real-time comment updates
- Pagination (25 comments per page)
- Auto-scroll to bottom

**Database Queries:**

```typescript
// Line 115: Fetch post data
.from('events.event_posts')
.select('id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id')

// Line 435: Fetch comments
.from('events.event_comments')
.select(`
  id, text, author_user_id, created_at, post_id,
  user_profiles!event_comments_author_user_id_fkey (
    display_name, photo_url, username
  )
`)

// Line 315: Create new comment
.from('events.event_comments')
.insert({
  post_id: activePostId,
  author_user_id: user.id,
  text: draft.trim(),
})

// Line 540: Delete comment
.from('events.event_comments')
.delete()
.eq('id', commentId)
.eq('author_user_id', user.id)
```

**Real-time Updates:**
- Uses `useRealtimeComments` hook for live comment sync
- Optimistic UI updates (instant feedback before server confirms)

**Props Interface:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventTitle: string
  postId?: string
  mediaPlaybackId?: string  // fallback if postId not available
  onCommentCountChange?: (postId: string, newCount: number) => void
}
```

---

## 🎯 Supporting Components

### 6. **PostCarousel.tsx**
**Path:** `src/components/PostCarousel.tsx`

**Purpose:** Swipeable media carousel for posts with multiple images/videos

---

### 7. **PostHero.tsx**
**Path:** `src/components/PostHero.tsx`

**Purpose:** Large hero-style post display for featured content

---

### 8. **EventPostsList.tsx**
**Path:** `src/components/EventPostsList.tsx`

**Purpose:** List view of posts (currently minimal implementation)

**Status:** ⚠️ Placeholder component - needs full implementation

---

### 9. **RecentPostsRail.tsx**
**Path:** `src/components/RecentPostsRail.tsx`

**Purpose:** Sidebar showing recent posts from followed events/users

---

### 10. **ActionRail.tsx**
**Path:** `src/components/ActionRail.tsx`

**Purpose:** Vertical action buttons for like, comment, share, sound toggle

**Features:**
- Like button with optimistic updates
- Comment counter and navigation
- Share functionality
- Sound toggle for videos
- Report button
- Create post shortcut

---

## 📄 Page Components

### 11. **EventDetail.tsx**
**Path:** `src/components/EventDetail.tsx`

**Purpose:** Event details page with tabs for Overview, Posts, Attendees

**Tabs:**
- Overview: Event info, tickets, map
- **Posts:** Displays `EventFeed` component
- Attendees: List of ticket holders

---

### 12. **EventDetails.tsx**
**Path:** `src/pages/EventDetails.tsx`

**Purpose:** Full event details page accessible via `/event/:id`

**Features:**
- Event header with cover image
- Event metadata (date, location, category)
- Mapbox integration for venue location
- Share functionality

---

### 13. **EventSlugPage.tsx**
**Path:** `src/pages/EventSlugPage.tsx`

**Purpose:** Event page accessed via human-readable slug

**Database Query:**
```typescript
// Line 102: Fetches posts with metadata
.from('event_posts_with_meta')
.select('*')
.eq('event_id', eventId)
```

---

### 14. **UserProfilePage.tsx**
**Path:** `src/pages/UserProfilePage.tsx` and `src/features/profile/routes/ProfilePage.tsx`

**Purpose:** User profile showing their posts and activity

**Database Query:**
```typescript
// Line 260: Fetches user's posts
.from('events.event_posts')
.select(`
  id, text, media_urls, created_at, like_count, comment_count,
  events:events!event_posts_event_id_fkey (
    id, title, cover_image_url
  ),
  ticket_tiers:ticket_tiers!event_posts_ticket_tier_id_fkey (
    badge_label
  )
`)
.eq('author_user_id', userId)
.order('created_at', { ascending: false })
```

---

## 🔧 Custom Hooks (Data Fetching & Real-time)

### 15. **useEventPostsInfinite.ts**
**Path:** `src/hooks/useEventPostsInfinite.ts`

**Purpose:** Infinite scroll pagination for event posts

**Database Query:**
```typescript
// Line 30: Fetches posts with pagination
.from('events.event_posts')
.select(`
  id, text, media_urls, created_at, author_user_id,
  like_count, comment_count,
  user_profiles!event_posts_author_user_id_fkey (
    display_name, photo_url
  )
`)
.eq('event_id', eventId)
.order('created_at', { ascending: false })
.range(from, to)
```

---

### 16. **useRealtimeComments.ts**
**Path:** `src/hooks/useRealtimeComments.ts`

**Purpose:** Real-time comment synchronization using Supabase Realtime

**Database Queries:**
```typescript
// Line 64: Fetches initial posts
.from('events.event_posts')
.select('id, event_id, comment_count')

// Real-time subscriptions:
// Line 89: INSERT on event_posts
// Line 100: DELETE on event_posts
// Line 127: INSERT on event_comments
// Line 155: DELETE on event_comments
```

**Subscription Pattern:**
```typescript
supabase
  .channel(`event-comments-${eventId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'event_comments',
    filter: `post_id=in.(select id from event_posts where event_id='${eventId}')`
  }, handleNewComment)
  .subscribe()
```

---

### 17. **useRealtime.tsx**
**Path:** `src/hooks/useRealtime.tsx`

**Purpose:** General real-time event subscription manager

**Subscriptions:**
```typescript
// Lines 161, 171: event_posts table changes
// Lines 186-197: event_reactions for posts
// Lines 211-222: event_comments
```

**Usage Pattern:**
```typescript
useRealtime({
  eventId: 'event-uuid',
  onPostCreated: (post) => { /* handle */ },
  onPostDeleted: (postId) => { /* handle */ },
  onReactionAdded: (reaction) => { /* handle */ },
  onCommentAdded: (comment) => { /* handle */ }
})
```

---

### 18. **useOptimisticReactions.ts**
**Path:** `src/hooks/useOptimisticReactions.ts`

**Purpose:** Optimistic UI updates for post likes/reactions

**Flow:**
1. User clicks like → UI updates immediately
2. API call sent in background
3. If API fails, rollback UI change
4. Real-time subscription confirms final state

---

### 19. **useRealtimeEngagement.ts**
**Path:** `src/hooks/useRealtimeEngagement.ts`

**Purpose:** Aggregate engagement metrics (likes + comments) with real-time updates

---

## 📊 Analytics & Engagement

### 20. **useOrganizerAnalytics.ts**
**Path:** `src/hooks/useOrganizerAnalytics.ts` and `src/hooks/useOrganizerAnalytics.tsx`

**Purpose:** Organizer dashboard analytics for event posts and engagement

**Database Queries:**
```typescript
// Line 143-148: Fetches reactions with post joins
.from('events.event_reactions')
.select(`
  post_id, kind,
  event_posts!event_reactions_post_id_fkey (event_id)
`)
.in('event_posts.event_id', eventIds)
```

**Metrics Calculated:**
- Total posts per event
- Total reactions per event
- Reaction types breakdown (like, love, etc.)
- Top posts by engagement

---

### 21. **useVideoAnalytics.ts**
**Path:** `src/hooks/useVideoAnalytics.ts`

**Purpose:** Video playback tracking and analytics

**Events Tracked:**
- Video view start/stop
- Progress milestones (25%, 50%, 75%, 100%)
- Play/pause actions
- Video completion

**Database Query:**
```typescript
// Line 30: Fetches video posts
.from('events.event_posts')
.select('id, media_urls, event_id')
.contains('media_urls', [playbackId])
```

---

### 22. **AnalyticsHub.tsx**
**Path:** `src/components/AnalyticsHub.tsx`

**Purpose:** Dashboard component showing engagement metrics and charts

**Database Queries:**
```typescript
// Lines 654-677: Fetches event with posts and reactions
.from('events.events')
.select(`
  id, title,
  event_posts:event_posts!event_posts_event_id_fkey(
    id,
    event_reactions:event_reactions!event_reactions_post_id_fkey(kind)
  )
`)
```

**Real-time Subscriptions:**
```typescript
// Line 1076: Listens to all changes on event_posts
// Line 1077: Listens to all changes on event_reactions
```

**Metrics Displayed:**
- Total posts
- Total engagement (likes + comments)
- Engagement trends over time
- Top posts
- Active users

---

## 🎨 UI & Social Features

### 23. **SocialPage.tsx**
**Path:** `src/components/SocialPage.tsx`

**Purpose:** User social media links management page

---

### 24. **SocialLinkDisplay.tsx**
**Path:** `src/components/SocialLinkDisplay.tsx`

**Purpose:** Display user's social media links with icons

**Supported Platforms:**
- Instagram
- Twitter
- Website/Blog
- LinkedIn
- TikTok
- YouTube

---

### 25. **SocialLinkManager.tsx**
**Path:** `src/components/SocialLinkManager.tsx`

**Purpose:** CRUD interface for managing social links in user profile

---

## 🗄️ Database Schema Types

### 26. **types.ts**
**Path:** `src/integrations/supabase/types.ts`

**Type Definitions:**

```typescript
// Lines 971-1054: event_comments table
Database['public']['Tables']['event_comments']

// Lines 1181-1314: event_posts table
Database['public']['Tables']['event_posts']

// Lines 1315-1392: event_reactions table
Database['public']['Tables']['event_reactions']

// Lines 4715-4923: event_posts_with_meta view
Database['public']['Views']['event_posts_with_meta']
```

---

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                          │
├─────────────────────────────────────────────────────────────┤
│  events.event_posts                                         │
│  events.event_comments                                      │
│  events.event_reactions                                     │
│  events.event_comment_reactions                             │
│  event_posts_with_meta (VIEW)                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Edge Functions Layer                      │
├─────────────────────────────────────────────────────────────┤
│  GET  /functions/v1/posts-list          (fetch posts)      │
│  POST /functions/v1/posts-create        (create post)      │
│  POST /functions/v1/mux-create-direct-upload (video)       │
│  POST /functions/v1/resolve-mux-upload  (video status)     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Custom Hooks Layer                        │
├─────────────────────────────────────────────────────────────┤
│  useEventPostsInfinite    (paginated posts)                │
│  useRealtimeComments      (live comment sync)              │
│  useRealtimeEngagement    (live like/comment counts)       │
│  useOptimisticReactions   (instant like feedback)          │
│  useVideoAnalytics        (video tracking)                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Component Layer                           │
├─────────────────────────────────────────────────────────────┤
│  EventFeed          → Displays posts feed                  │
│  UserPostCard       → Single post with media               │
│  CommentModal       → Comments interface                   │
│  PostCreator        → Create new posts                     │
│  ActionRail         → Like/comment/share buttons           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 Real-time Update Flow

```
User Action (e.g., "Like Post")
        ↓
Optimistic UI Update (instant feedback)
        ↓
API Call to Supabase
        ↓
Database Update
        ↓
Realtime Broadcast (Postgres Changes)
        ↓
Supabase Realtime Channel
        ↓
useRealtime Hook Receives Event
        ↓
Component State Updates
        ↓
UI Re-renders with Confirmed Data
```

---

## 🎥 Video Upload & Playback Flow

### Upload Flow (PostCreator.tsx)
```
1. User selects video file
2. Create Mux Direct Upload URL
   └─ POST /functions/v1/mux-create-direct-upload
3. Upload video to Mux via PUT
   └─ Track progress with XHR
4. Poll for processing status
   └─ POST /functions/v1/resolve-mux-upload
5. Store playback_id as "mux:PLAYBACK_ID"
6. Create post with media_urls
   └─ POST /functions/v1/posts-create
```

### Playback Flow (UserPostCard.tsx)
```
1. Parse media_url: "mux:PLAYBACK_ID"
2. Build HLS manifest URL
   └─ https://stream.mux.com/PLAYBACK_ID.m3u8
3. Initialize HLS.js player
   └─ useHlsVideo hook
4. Load and play video
5. Track analytics events
   └─ 25%, 50%, 75%, 100% milestones
```

---

## 🔐 Security & Permissions

### Row Level Security (RLS)
All queries respect Supabase RLS policies:

- **event_posts:** Users can read public posts, write to events they attend/organize
- **event_comments:** Users can read all comments, create/delete their own
- **event_reactions:** Users can create/delete their own reactions
- **user_profiles:** Public read, users can update their own

### Frontend Permission Checks

**PostCreator.tsx (Lines 227-361):**
```typescript
// Attendee mode: Can post to events with tickets
// Organizer mode: Can post to events they organize OR attend
```

**CommentModal.tsx:**
```typescript
// Can only delete own comments (line 540)
.eq('author_user_id', user.id)
```

---

## 🚀 Performance Optimizations

### EventFeed.tsx
- **HLS Prefetch:** Warms next video manifest before scroll (line 125)
- **Intersection Observer:** Only plays visible videos (line 86-106)
- **Lazy Loading:** Images load as they enter viewport

### UserPostCard.tsx
- **Preconnect to Mux:** Reduces handshake latency (line 103-124)
- **Lazy Video Load:** Videos load when within 200% viewport (line 78-100)
- **Poster Images:** Shows thumbnail while video loads (line 353)

### CommentModal.tsx
- **Pagination:** Loads 25 comments at a time (PAGE_SIZE = 25)
- **Virtual Scrolling:** Only renders visible comments
- **Optimistic Updates:** Instant UI feedback before server confirms

---

## 🐛 Debugging Tips

### Check Database Content
Use `VIEW_SOCIAL_CONTENT.sql` to inspect data:
```sql
-- Run each section to see:
-- 1️⃣ All posts with media
-- 2️⃣ All comments
-- 3️⃣ All post reactions
-- 4️⃣ All comment reactions
-- 5️⃣ Complete post view with engagement
```

### Check Real-time Subscriptions
```javascript
// In browser console:
supabase.getChannels()  // See active channels

// Enable debug logging:
localStorage.setItem('supabase.realtime.debug', 'true')
```

### Check Video Playback
```javascript
// In UserPostCard.tsx, lines 326-336
// Dev mode logs video status:
console.debug('UserPostCard video debug', {
  post: item.item_id,
  isVideoPlaying,
  ready,
  videoSrc,
  hlsError,
  showFallback,
})
```

---

## 📦 Dependencies

### Core Libraries
- **React** - UI framework
- **Supabase Client** - Database & real-time
- **HLS.js** - Video streaming
- **date-fns** - Date formatting
- **Mux** - Video hosting & transcoding

### UI Components
- **shadcn/ui** - Component library (Button, Card, Dialog, etc.)
- **Lucide React** - Icons
- **Radix UI** - Accessible primitives

---

## 🎯 Key Files Quick Reference

| Component | Path | Primary Table(s) | Purpose |
|-----------|------|------------------|---------|
| **EventFeed** | `src/components/EventFeed.tsx` | `event_posts`, `event_comments` | Main feed |
| **UserPostCard** | `src/components/UserPostCard.tsx` | `event_posts` | Single post |
| **CommentModal** | `src/components/CommentModal.tsx` | `event_comments`, `event_reactions` | Comments UI |
| **PostCreator** | `src/components/PostCreator.tsx` | `event_posts` | Create posts |
| **useRealtimeComments** | `src/hooks/useRealtimeComments.ts` | All social tables | Live sync |
| **useEventPostsInfinite** | `src/hooks/useEventPostsInfinite.ts` | `event_posts` | Pagination |

---

## 📝 Related Documentation

- `VIEW_SOCIAL_CONTENT.sql` - Database queries for social content
- `DB_SCHEMA_ARCHITECTURE.md` - Full database schema documentation
- `PLATFORM_DESIGN_STRUCTURE.md` - Overall platform architecture

---

---

## 🔧 Recent Fixes (October 24, 2025)

### Issue: Comments, Likes, and Ticket Tiers Not Showing

**Problem:** After database migration, posts were displaying but missing:
- Comment counts and preview comments
- Like counts and liked status
- Ticket tier badges (VIP, ORGANIZER, etc.)
- Author profile information
- Event details

**Root Cause:** The `posts-list` edge function was only selecting 8 basic fields from `event_posts` table without any joins, but the frontend expected 20+ enriched fields including author profiles, ticket tiers, event details, and engagement data.

**Solution Applied:**

#### 1. **Updated `posts-list` Edge Function** (`supabase/functions/posts-list/index.ts`)
- ✅ Added JOIN with `user_profiles` to get author info (display_name, photo_url, username, social links)
- ✅ Added JOIN with `ticket_tiers` to get badge labels (VIP, ORGANIZER, etc.)
- ✅ Added JOIN with `events` to get event details and organizer info
- ✅ Added `enrichPosts()` function to:
  - Batch check `liked_by_me` status for current user
  - Calculate `is_organizer` flag (checks if author created event)
  - Flatten nested data structure for frontend compatibility
  - Add all missing fields frontend expects

**Before:**
```typescript
.from('event_posts')
.select('id, created_at, text, media_urls, author_user_id, like_count, comment_count, event_id')
```

**After:**
```typescript
.from('events.event_posts')
.select(`
  id, created_at, text, media_urls, author_user_id, 
  like_count, comment_count, event_id, ticket_tier_id,
  user_profiles!event_posts_author_user_id_fkey ( display_name, photo_url, username, ... ),
  events!event_posts_event_id_fkey ( title, organizer_name, ... ),
  ticket_tiers!event_posts_ticket_tier_id_fkey ( badge_label, name )
`)
// + enrichPosts() for liked_by_me and is_organizer
```

#### 2. **Fixed Schema References**
- ✅ Updated `comments-add` to use `events.event_comments` (was `event_comments`)
- ✅ Updated `reactions-toggle` to use `events.event_reactions` (was `event_reactions`)
- ✅ Updated `EventFeed.tsx` to use `events.event_comments` for comment fetching

#### 3. **Data Flow Now Complete**

```
Database                Edge Function              Frontend
─────────               ─────────────              ────────
events.event_posts  →   posts-list (with joins) →  EventFeed.tsx
├─ author_user_id   →   + user_profiles        →   ✅ Author name/photo
├─ ticket_tier_id   →   + ticket_tiers         →   ✅ Badge labels
├─ event_id         →   + events               →   ✅ Event title
├─ like_count       →   + liked_by_me check    →   ✅ Like button state
└─ comment_count    →   (already computed)     →   ✅ Comment count

events.event_comments → comments-add          →  CommentModal
events.event_reactions → reactions-toggle      →  ActionRail (like button)
```

#### Files Changed:
1. `supabase/functions/posts-list/index.ts` - Complete rewrite with enrichment
2. `supabase/functions/comments-add/index.ts` - Schema prefix fix
3. `supabase/functions/reactions-toggle/index.ts` - Schema prefix fix  
4. `src/components/EventFeed.tsx` - Schema prefix fix

**Result:** All social features now working:
- ✅ Posts display with full author info
- ✅ Ticket tier badges show (VIP, ORGANIZER, GA, etc.)
- ✅ Like buttons work with correct state
- ✅ Comment counts accurate
- ✅ Comment modal opens and functions
- ✅ Can add/delete comments
- ✅ Can like/unlike posts
- ✅ Real-time updates continue to work

---

**Last Updated:** October 24, 2025  
**Maintained By:** Development Team  
**Questions?** Check the codebase or reach out to the team.

