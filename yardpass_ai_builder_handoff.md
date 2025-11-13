
# Liventix — Home Feed & PostHero: AI Builder Handoff

This is a compact, save-friendly handoff to **tie the updated files together**, including **supplementals** (helpers, contracts, routes, RPC/Edge notes, QA, and “done when” criteria).

---

## 1) Goal (what we’re building)
A swipeable, TikTok-style **home feed** of events where each slide shows a **PostHero** (image or Mux video) with a clean overlay (author, caption, event CTA, organizer chip, follow, add-to-calendar). Tapping the author or organizer deep-links to the right screens. Tapping **Comments** opens **CommentModal** for that post/event. **Realtime** posts stream in. Videos auto-play **only** on the active slide with **HLS** fallback. Everything should feel **tidy, spaced, and premium**—no piled/stacked, tacky feel.

---

## 2) Files & responsibilities (tie-in map)

### `src/pages/Index.tsx`
- Owns the **vertical swipe** feed of events (one event per full-height slide).
- Uses `useAffinityFeed(8)` to load recommended events.
- Fetches **top posts per event** via `supabase.rpc('get_event_posts', { p_event_ids, p_k: 3 })`.
- Subscribes to **realtime posts** via `useRealtimePosts([...eventIds], onInsert)`, prepending new post(s) to each event’s `posts` (up to 3).
- Picks a “**hero post**” per event (= first with `mediaUrl` else first post) and renders **PostHero**.
- Keeps **only the active slide’s video** playing (via `isActive` prop).
- Top-right **sort** toggle: “Upcoming” (feed order) vs “Active” (simple heuristic).
- Right-side **action rail** (Like, Comments, Post, Share, Report).
- **Modals**: `AttendeeListModal`, `EventTicketModal`, `ShareModal`, `PostCreatorModal`, `CommentModal`.
- Keyboard nav (Up/Down/Home/End) + basic image preloading + touch swipe zone.

### `src/components/PostHero.tsx` (your rewritten version)
- Displays **video** (HLS w/ `hls.js` fallback) or **image** hero, gradient overlays, clean layout (no tacky stack).
- Props:
  ```ts
  interface PostHeroProps {
    post: EventPost | undefined;
    event: Event;
    onOpenTickets: () => void;
    isActive: boolean;
    onPostClick: (postId: string) => void; // opens CommentModal (single-post mode)
  }
  ```
- **Video rules**:
  - Build `src` via `buildMuxUrl(post.mediaUrl)` (supports `mux:<playbackId>` or direct URL; `.m3u8` handled).
  - Init/destroy `Hls` on mount/unmount; set `playsInline`, `muted`, `loop`, and **autoplay only when `isActive && ready`**.
  - Single-tap toggles mute. Show small “Tap for sound” pill when muted.
- **Overlays**:
  - Footer: Author (click → user profile or event posts tab), 1–2 line caption, **EventCTA** (Details, Get Tickets), `OrganizerChip`, `FollowButton`, `AddToCalendar`.
  - **Image** mode additionally shows `RecentPostsRail` (thumbnails of latest three posts).

### `src/components/RecentPostsRail.tsx`
- Small, horizontally scrollable thumbnails (image or a play button for video).
- Clicking a tile calls `onPostClick(post.id)` to open **CommentModal** for that post.
- IntersectionObserver to delay rendering until on-screen.

### `src/components/CommentModal.tsx`
- Opens in two modes:
  - **Single-post mode** when `postId` **or** (`eventId` + `mediaPlaybackId`), showing **only** that post and its comments.
  - **Multi-post mode** when only `eventId` (paged by 10 posts).
- Handles: create comment, like/unlike post & comment, delete own comment, realtime INSERT subscription for comments (scoped to the visible set).
- Deep links: author avatars/names → profile; “View post” → event posts tab with `post` query param.

### `src/components/EventFeed.tsx` (if used elsewhere)
- Standalone posts list with video tracking via `useVideoAnalytics`.
- Like/Share/Comment actions, author & event deep links.

---

## 3) Canonical data contracts (Types)
(Use these across the app—**single source of truth**)

```ts
// Shared Event and related types across the application

export interface EventPost { 
  id: string; 
  authorName: string; 
  authorBadge: 'ORGANIZER' | 'ATTENDEE'; 
  isOrganizer?: boolean; 
  content: string; 
  timestamp: string; 
  likes: number; 
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  thumbnailUrl?: string;
  commentCount?: number;
  authorId?: string;         // profile deep-link
  ticketTierId?: string;     // post-to-tier deep-link
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

export interface Event {
  id: string; 
  title: string; 
  description: string; 
  organizer: string; 
  organizerId: string; 
  category: string; 
  startAtISO: string;       // raw ISO string
  endAtISO?: string;
  dateLabel: string;        // "Sept 2, 2024"
  location: string; 
  coverImage: string; 
  ticketTiers: TicketTier[]; 
  attendeeCount: number; 
  likes: number; 
  shares: number; 
  isLiked?: boolean; 
  posts?: EventPost[];
  organizerVerified?: boolean;
  minPrice?: number | null;
  remaining?: number | null;
  latestActivityAt?: number; // for activity sorting
  slug?: string;             // for routing
  videoUrl?: string;         // optional hero video
  totalComments?: number;    // aggregate event comments
}

// Supabase-flavored DTOs (query shapes)
export interface DatabaseTicketTier { 
  id: string; 
  name: string; 
  price_cents: number; 
  badge_label?: string; 
  quantity: number; 
}

export interface DatabaseEvent {
  id: string; 
  title: string; 
  description: string; 
  organizer_id: string; 
  category: string; 
  start_at: string; 
  city?: string; 
  venue?: string; 
  cover_image_url?: string;
  ticket_tiers?: DatabaseTicketTier[];
}
```

---

## 4) Supplementals (helpers, routes, constants)

### `src/utils/mux.ts`
```ts
export const isVideoUrl = (u?: string | null) =>
  !!u && /mux:|\.m3u8$|\.mp4$|\.mov$|\.webm$/i.test(u);

export const buildMuxUrl = (u?: string | null) => {
  if (!u) return undefined;
  if (u.startsWith('mux:')) return `https://stream.mux.com/${u.slice(4)}.m3u8`;
  return u;
};

export const extractMuxPlaybackId = (u?: string | null) => {
  if (!u) return null;
  const m = u.match(/mux:([a-zA-Z0-9]+)/);
  if (m) return m[1];
  const m2 = u.match(/stream\.mux\.com\/([a-zA-Z0-9]+)/);
  return m2 ? m2[1] : null;
};
```

### `src/lib/routes.ts`
```ts
export const routes = {
  event: (id: string) => `/event/${id}`,
  post: (id: string) => `/post/${id}`,
  user: (id: string) => `/u/${id}`,
  org:  (id: string) => `/org/${id}`,
};
```

### `src/lib/constants.ts`
```ts
export const DEFAULT_EVENT_COVER =
  '/images/placeholders/event-cover-fallback.jpg';
```

### `src/components/EventCTA.tsx` (interface only; implementation exists)
```ts
interface EventCTAProps {
  eventTitle: string;
  startAtISO: string;
  attendeeCount: number;
  minPrice?: number | null;
  remaining?: number | null;
  onDetails: () => void;
  onGetTickets: () => void;
}
```

### `src/components/OrganizerChip.tsx` (interface only)
```ts
interface OrganizerChipProps {
  organizerId: string;
  name: string;
  verified?: boolean;
}
```

### `src/components/follow/FollowButton.tsx` (interface only)
```ts
interface FollowButtonProps {
  targetType: 'organizer' | 'user' | 'event';
  targetId: string;
}
```

### `src/hooks/useAuthGuard.ts`
- Exposes `withAuth(fn, message?)` and `requireAuth(fn, message?)` used across the feed.

---

## 5) Data flow & interactions

- **Initial events**: `useAffinityFeed(8)` → map into `Event[]` used by the page.
- **Fetch top posts**: On mount/ID changes, call `supabase.rpc('get_event_posts', { p_event_ids: ids, p_k: 3 })`. Group rows by `event_id`, map into `EventPost[]`, set `events[i].posts`.
- **Realtime posts**: `useRealtimePosts(eventIds, onInsert)` → when a new post arrives, **unshift** into that event’s `posts` array, capped at **3**.
- **Hero selection**: pick the first post with `mediaUrl`; else just the first post.
- **PostHero**:
  - Video: `buildMuxUrl(post.mediaUrl)`, init `Hls` when needed; if active slide → `video.play()` else pause & reset time.
  - Author chip → profile; caption 1–2 lines; CTA row with `EventCTA`, `OrganizerChip`, `FollowButton`, `AddToCalendar`.
  - Image mode → show `RecentPostsRail`.
- **Comments**:
  - The action rail’s **Comments** opens `CommentModal`:
    - If launched from a specific post tile or hero: provide `postId` (single-post mode).
    - If launched from video where only `mediaPlaybackId` is known: pass `mediaPlaybackId` so the modal can resolve the post.
- **Ticketing**: `onGetTickets` calls `requireAuth(() => setShowTicketModal(true))`.
- **Share**: `ShareModal` uses `currentEvent.title/text/url` (navigator share if available).
- **Like** (event): optimistic UI toggle; persist via your `event_reactions` (if applicable).

---

## 6) Supabase: RPC + Edge function

### RPC: `get_event_posts(p_event_ids uuid[], p_k int default 3)`
- Returns _at most `p_k` posts per event_, shaped like:
  ```sql
  id, event_id, created_at, text, media_urls,
  author_user_id, author_display_name, author_is_organizer,
  like_count, comment_count, ticket_tier_id
  ```

### Edge function: `posts-list` (GET)
- Query params: `event_id?`, `user_id?`, `limit=20`.
- Auth: Bearer token from `supabase.auth.getSession()`.
- Response rows merged with event titles; mapped to:
  ```ts
  {
    id, text, media_urls, created_at,
    author_user_id, event_id,
    like_count, comment_count,
    is_organizer, badge_label,
    user_profiles: { display_name, photo_url },
    events: { title },
    liked_by_me
  }
  ```

### Tables referenced
- `event_posts`, `events`, `user_profiles`, `ticket_tiers`
- `event_comments`, `event_reactions`, `event_comment_reactions`

---

## 7) Navigation contract (tap/click rules)

- **Author name/avatar** → `routes.user(post.authorId)`; if missing, fallback: `routes.event(event.id)?tab=posts`.
- **OrganizerChip** → `routes.org(event.organizerId)`; else `routes.event(event.id)?tab=details`.
- **EventCTA**:
  - Details → `routes.event(event.id)`
  - Get Tickets → `requireAuth(() => setShowTicketModal(true))`
- **RecentPostsRail** tile → `onPostClick(post.id)` (opens `CommentModal` single-post mode).
- **Action rail**:
  - Like → optimistic event like.
  - Comment → open **CommentModal** targeting the hero post.
  - Post (+) → `requireAuth(onCreatePost)`.
  - Share → `ShareModal` or `navigator.share` fallback.
  - Report → `ReportButton` with `targetType="event"`.

---

## 8) UI polish guardrails (to avoid stacked/tacky look)

- **Spacing**: Use consistent 8/12/16px rhythm. Keep micro-copy small (`text-xs`/`text-sm`), bold for titles only.
- **Overlays**: soft gradients (`from-black/80 to-transparent` for videos; `from-black/75 via-black/10 to-black/30` for images).
- **Chip & badges**: tiny (`text-[10px]`) and **sparse**; avoid more than 2–3 pills in a row.
- **Rail**: thumbnails in 96px–104px square; rounded-lg with subtle borders; show counts inside a dim black pill.
- **Performance**: lazy hydrate the rail via IntersectionObserver; prefetch next/prev cover images; ensure `Hls` destroyed on unmount; **only one** video playing at a time.

---

## 9) “Done when” checklist

- [ ] Active slide’s video **autoplays muted**, and pauses when not active; unmuting resumes play.
- [ ] **HLS** works on Chrome/Firefox (via hls.js) and **natively** on Safari; no console errors/leaks.
- [ ] Taps route correctly: author → profile; organizer → organizer page; **Details**/**Tickets** behave.
- [ ] **CommentModal** opens to the right scope:
  - [ ] Single-post when launched from a specific post or video (using `postId` or `mediaPlaybackId` resolution).
  - [ ] Multi-post when launched from event-level.
  - [ ] Realtime comments append in visible scope only.
- [ ] **Realtime posts** prepend into event feeds (cap 3).
- [ ] **Sort toggle** switches between default feed & activity heuristic order.
- [ ] Layout looks airy, no crowding; text truncates after 1–2 lines where specified.

---

## 10) Troubleshooting notes

- **iOS autoplay**: keep `muted`, `playsInline`; call `.play()` only after `ready`; avoid `autoplay` attr on markup.
- **HLS fallback**: `canPlayType('application/vnd.apple.mpegurl')` gate; if unsupported, init `Hls` and attach; destroy on cleanup.
- **Mux URL**: If you only have `mux:<id>`, use `https://stream.mux.com/<id>.m3u8`.
- **Auth**: If `supabase.auth.getSession()` is null, skip Edge fetches gracefully and show empty states.
- **Object lifetimes**: Store `hlsRef` and destroy on effect cleanup and when `src` changes.

---

## 11) Minimal install notes
```bash
npm i hls.js date-fns
# (Ensure shadcn/ui + lucide-react are already configured)
```

**That’s it — this doc plus your updated files is everything the AI builder needs to glue the flow.**
