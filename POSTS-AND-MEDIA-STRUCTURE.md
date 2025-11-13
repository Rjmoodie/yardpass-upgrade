# 📸 Posts & Media Structure - Complete Architecture

## 🗄️ **Database Schema**

### **`events.event_posts` Table**

```sql
CREATE TABLE events.event_posts (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events.events(id),
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  ticket_tier_id uuid REFERENCES ticketing.ticket_tiers(id),
  
  -- Content
  text text,                           -- Caption/description
  media_urls text[] DEFAULT '{}',      -- Array of media URLs (images/videos)
  link_url text,                       -- External link
  link_meta jsonb DEFAULT '{}',        -- Link preview metadata
  
  -- Metadata
  post_type text DEFAULT 'post',       -- 'post' | 'reshare' | 'announcement' | 'ad'
  visibility text DEFAULT 'public',    -- 'public' | 'followers' | 'private'
  language text,                       -- Auto-detected language
  moderation_state text DEFAULT 'clean', -- 'clean' | 'flagged' | 'removed'
  
  -- Engagement Counters
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  share_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  
  -- Flags
  pinned boolean DEFAULT false,
  deleted_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  edited_at timestamptz
);
```

---

## 📷 **Media URL Format**

### **Array Structure**
```typescript
media_urls: string[] = [
  'https://image.mux.com/ABC123/thumbnail.jpg',         // Image
  'https://stream.mux.com/XYZ789.m3u8',                 // Mux video
  'https://supabase.co/storage/v1/object/photo.jpg',   // Uploaded image
]
```

### **Mux Video Format**
```
Playback URL: https://stream.mux.com/{playback_id}.m3u8
Thumbnail:    https://image.mux.com/{playback_id}/thumbnail.jpg
Poster:       https://image.mux.com/{playback_id}/thumbnail.jpg?time=1
```

**Extraction Logic:**
```typescript
// src/lib/video/muxClient.ts
function extractMuxPlaybackId(url: string): string {
  // Extracts: XYZ789 from https://stream.mux.com/XYZ789.m3u8
  const match = url.match(/stream\.mux\.com\/([^\/\.]+)/);
  return match ? match[1] : '';
}

function posterUrl(
  { playbackId }: { playbackId: string },
  { time, width, fitMode }: { time?: number; width?: number; fitMode?: string }
): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}&fit_mode=${fitMode}`;
}
```

---

## 🎯 **Post Display Contexts**

### **1. Main Feed (TikTok-Style)**
**Component:** `src/features/feed/routes/FeedPageNewDesign.tsx`

**Features:**
- ✅ Full-screen vertical scroll
- ✅ Snap-to-item navigation
- ✅ Video autoplay (active item only)
- ✅ Global sound toggle
- ✅ Interleaved events + posts
- ✅ Floating actions (like, comment, share)

**Structure:**
```tsx
<div className="snap-y snap-mandatory overflow-y-auto h-full">
  {allFeedItems.map((item, idx) => (
    <section className="snap-start h-screen">
      {item.item_type === 'event' ? (
        <EventCardNewDesign item={item} />
      ) : (
        <UserPostCardNewDesign 
          item={item}
          isVideoPlaying={idx === activeIndex && !paused}
        />
      )}
    </section>
  ))}
</div>
```

**Data Flow:**
```
useUnifiedFeedInfinite (fetch posts/events)
  ↓
interleaveFeedItems (alternate events & posts)
  ↓
allFeedItems (sorted by engagement)
  ↓
Render full-screen cards
```

---

### **2. Event Detail Pages**
**Component:** `src/pages/new-design/EventDetailsPage.tsx`

**Features:**
- ✅ Tabbed interface (Details | Posts | Tagged)
- ✅ Grid layout (3 columns)
- ✅ Filtered by post type (organizer vs attendee)
- ✅ Click to open comment modal

**Tabs:**
1. **"Posts" Tab** → Organizer-only posts (official updates)
2. **"Tagged" Tab** → Attendee posts (user-generated content)

**Structure:**
```tsx
{activeTab === 'posts' && (
  <EventPostsGrid 
    eventId={event.id}
    filterType="organizer_only"
    onPostClick={(post) => openCommentModal(post)}
  />
)}

{activeTab === 'tagged' && (
  <EventPostsGrid 
    eventId={event.id}
    filterType="attendee_only"
    onPostClick={(post) => openCommentModal(post)}
  />
)}
```

**Grid Display:**
```tsx
<div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
  {posts.map(post => (
    <button className="aspect-square" onClick={() => openModal(post)}>
      <ImageWithFallback src={post.image} />
      {/* Overlay: likes count */}
    </button>
  ))}
</div>
```

---

### **3. User Profiles**
**Component:** `src/pages/new-design/ProfilePage.tsx`

**Features:**
- ✅ Grid layout (3 columns, Instagram-style)
- ✅ Tabs: Posts | Events | Tagged | Saved
- ✅ Hover overlay showing likes
- ✅ Click to open modal or navigate

**Structure:**
```tsx
<div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
  {displayContent.map(post => (
    <button 
      className="group relative aspect-square"
      onClick={() => {
        if (activeTab === 'posts') {
          openCommentModal(post);
        } else {
          navigate(`/e/${post.event_id}`);
        }
      }}
    >
      <ImageWithFallback src={post.image} />
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100">
        <Heart className="fill-white" />
        <span>{post.likes}</span>
      </div>
    </button>
  ))}
</div>
```

**Tabs:**
- **Posts**: User's own posts
- **Events**: Events user created
- **Tagged**: Posts where user is tagged
- **Saved**: Bookmarked posts

---

## 🎬 **Video Playback (Mux)**

### **Component:** `src/components/feed/VideoMedia.tsx`

**Features:**
- ✅ Auto-play when visible
- ✅ Auto-pause when off-screen
- ✅ Global sound control
- ✅ Loop playback
- ✅ Analytics tracking (views, play, complete)
- ✅ Poster frame (first frame thumbnail)

**Mux Player Setup:**
```tsx
<MuxPlayer
  ref={playerRef}
  playbackId={playbackId}               // Extracted from URL
  streamType="on-demand"
  autoPlay="muted"
  muted={muted}
  loop
  playsInline
  nocast
  preload="auto"
  poster={posterUrl}                    // First frame thumbnail
  envKey={MUX_DATA_ENV_KEY}             // Analytics key
  metadata={{
    video_id: playbackId,
    video_title: post.text,
    video_series: `event:${post.event_id}`,
    viewer_user_id: user?.id,
    custom_1: post.id,
    player_name: "Liventix Feed"
  }}
  onPlay={() => trackVideoPlay()}
  onTimeUpdate={(e) => trackProgress(e.detail.currentTime)}
  onEnded={() => trackComplete()}
/>
```

**Analytics Tracking:**
```typescript
// Track view (on load)
supabase.functions.invoke('track-analytics', {
  body: {
    type: 'mux_engagement',
    data: { event_type: 'view', post_id, playback_id }
  }
});

// Track play (on user interaction)
supabase.functions.invoke('track-analytics', {
  body: {
    type: 'mux_engagement',
    data: { event_type: 'play', post_id, playback_id }
  }
});

// Track completion (95% watched)
supabase.functions.invoke('track-analytics', {
  body: {
    type: 'mux_engagement',
    data: { event_type: 'complete', post_id, playback_id, progress: 0.95 }
  }
});
```

---

## 📊 **Post Types & Visibility**

### **Post Types**
```typescript
type PostType = 
  | 'post'          // Regular user post
  | 'reshare'       // Reposted content
  | 'announcement'  // Official event update
  | 'ad'            // Sponsored content
```

### **Visibility Levels**
```typescript
type Visibility =
  | 'public'     // Anyone can see
  | 'followers'  // Only followers
  | 'private'    // Only author
```

---

## 🔄 **Feed Algorithm (Interleaving)**

### **Logic:** `src/features/feed/components/UnifiedFeedList.tsx`

**Step 1: Separate by Type**
```typescript
const events: FeedItem[] = [];
const posts: FeedItem[] = [];

items.forEach(item => {
  if (item.item_type === 'event') events.push(item);
  else if (item.item_type === 'post') posts.push(item);
});
```

**Step 2: Score Posts by Engagement**
```typescript
function postEngagementScore(item: FeedItem) {
  const hasVideo = item.media_urls?.some(url => url.includes('mux'));
  const likes = item.metrics?.likes || 0;
  const comments = item.metrics?.comments || 0;
  const views = item.metrics?.views || 0;

  const engagementWeight = (likes * 2) + (comments * 3) + (views * 0.5);
  return (hasVideo ? 2 : 0) + engagementWeight;
}

const sortedPosts = posts.sort((a, b) => 
  postEngagementScore(b) - postEngagementScore(a)
);
```

**Step 3: Interleave**
```typescript
// Pattern: Event, Post, Event, Post, ...
const result: FeedItem[] = [];
let eventIndex = 0;
let postIndex = 0;

while (eventIndex < events.length || postIndex < posts.length) {
  if (eventIndex < events.length) {
    result.push(events[eventIndex++]);
  }
  if (postIndex < posts.length) {
    result.push(sortedPosts[postIndex++]);
  }
}
```

---

## 💾 **Data Fetching**

### **Main Feed**
```typescript
// src/hooks/useUnifiedFeedInfinite.ts
const { data, fetchNextPage } = useUnifiedFeedInfinite({
  locations: ['Near Me'],
  categories: ['Music'],
  dates: ['This Weekend'],
  searchRadius: 25
});

// Calls Edge Function: home-feed
const response = await supabase.functions.invoke('home-feed', {
  body: { 
    limit: 30, 
    cursor, 
    filters,
    user_lat,
    user_lng
  }
});
```

### **Event Posts**
```typescript
// Fetch posts for a specific event
const { data: posts } = await supabase
  .from('event_posts')
  .select(`
    id,
    text,
    media_urls,
    like_count,
    comment_count,
    created_at,
    user_profiles!event_posts_author_user_id_fkey (
      display_name,
      photo_url
    ),
    ticket_tiers (
      name,
      badge_label
    )
  `)
  .eq('event_id', eventId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

### **Profile Posts**
```typescript
// User's own posts
const { data: posts } = await supabase
  .from('event_posts')
  .select('*')
  .eq('author_user_id', userId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

// Saved posts
const { data: saved } = await supabase
  .from('user_saved_posts')
  .select(`
    post_id,
    event_posts!inner (*)
  `)
  .eq('user_id', userId);
```

---

## 📱 **Responsive Design**

### **Main Feed (Mobile-First)**
```css
/* Full-screen on mobile */
.feed-container {
  height: 100vh;
  width: 100vw;
  snap-type: y mandatory;
}

/* Each card takes full screen */
.feed-card {
  height: 100vh;
  width: 100vw;
  snap-align: start;
}
```

### **Grid Layouts (Event/Profile)**
```css
/* Mobile: 3 columns, small gaps */
.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem; /* 4px */
}

/* Tablet: 3 columns, medium gaps */
@media (min-width: 640px) {
  .grid-container {
    gap: 0.5rem; /* 8px */
  }
}

/* Desktop: 3 columns, larger gaps */
@media (min-width: 768px) {
  .grid-container {
    gap: 0.75rem; /* 12px */
  }
}
```

---

## 🎨 **Media Display Patterns**

### **Pattern 1: Full-Screen (Feed)**
```tsx
{isVideo ? (
  <VideoMedia 
    url={mediaUrl}
    visible={isActive}
    globalSoundEnabled={soundOn}
  />
) : (
  <ImageWithFallback 
    src={mediaUrl}
    className="h-full w-full object-cover"
  />
)}

{/* Gradient overlay */}
<div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/90" />

{/* Content over media */}
<div className="absolute bottom-0 left-0 right-0 p-4">
  <Caption text={post.text} />
  <Author name={post.author} />
</div>
```

### **Pattern 2: Grid Thumbnail (Event/Profile)**
```tsx
<button className="aspect-square group">
  <ImageWithFallback 
    src={post.media_urls[0]}
    className="h-full w-full object-cover group-hover:scale-110"
  />
  
  {/* Hover overlay */}
  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100">
    <Heart /> {post.like_count}
  </div>
  
  {/* Video indicator */}
  {isVideo && (
    <Play className="absolute top-2 right-2" />
  )}
</button>
```

### **Pattern 3: Modal/Detail View**
```tsx
<CommentModal isOpen={true} postId={postId}>
  {/* Post header with author */}
  <div className="flex items-center gap-3">
    <Avatar src={post.author.avatar} />
    <span>{post.author.name}</span>
    <Badge>{post.badge}</Badge>
  </div>
  
  {/* Media carousel (if multiple) */}
  <div className="aspect-square">
    {post.media_urls.length > 1 ? (
      <Carousel items={post.media_urls} />
    ) : (
      <MediaItem src={post.media_urls[0]} />
    )}
  </div>
  
  {/* Caption */}
  <p>{post.text}</p>
  
  {/* Comments section */}
  <CommentList postId={post.id} />
</CommentModal>
```

---

## 📈 **Analytics & Tracking**

### **Post Impressions**
```sql
CREATE TABLE events.post_impressions (
  id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES event_posts(id),
  user_id uuid REFERENCES auth.users(id),
  session_id text NOT NULL,
  dwell_ms integer DEFAULT 0,           -- How long viewed
  completed boolean DEFAULT false,      -- Watched >95%
  created_at timestamptz DEFAULT now(),
  hour_bucket timestamptz               -- For deduplication
);
```

**Tracking Logic:**
```typescript
// On post visible in viewport
const trackImpression = async (postId: string) => {
  await supabase.from('post_impressions').insert({
    post_id: postId,
    session_id: sessionId,
    dwell_ms: 0,
    completed: false
  });
};

// On scroll away or unmount
const updateDwell = async (postId: string, dwellMs: number) => {
  const completed = dwellMs >= (totalDuration * 0.95);
  await supabase.from('post_impressions')
    .update({ dwell_ms: dwellMs, completed })
    .eq('post_id', postId)
    .eq('session_id', sessionId);
};
```

---

## 🔍 **Summary**

### **Post Structure:**
```typescript
{
  id: uuid,
  event_id: uuid,
  author_user_id: uuid,
  text: string,
  media_urls: string[],              // Images/videos
  like_count: number,
  comment_count: number,
  created_at: timestamp
}
```

### **Display Contexts:**
1. **Main Feed**: Full-screen TikTok-style (vertical scroll, autoplay)
2. **Event Pages**: Grid view with tabs (organizer posts vs attendee posts)
3. **User Profiles**: Instagram-style grid (posts, events, tagged, saved)

### **Media Types:**
- **Mux Videos**: `https://stream.mux.com/{playback_id}.m3u8`
- **Images**: CDN URLs or Supabase Storage
- **Multiple media**: Array of URLs displayed as carousel

### **Key Features:**
- ✅ Full-screen video playback with Mux
- ✅ Auto-play/pause based on visibility
- ✅ Global sound toggle
- ✅ Engagement-based sorting
- ✅ Interleaved events + posts
- ✅ Grid layouts for event/profile pages
- ✅ Click to open comment modal
- ✅ Analytics tracking (views, dwell time, completion)

---

**Everything is fully wired and production-ready!** 🚀

