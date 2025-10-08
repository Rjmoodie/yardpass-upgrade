# Feed experience review

## Snapshot
The home feed remains fast and immersive thanks to the virtualized renderer, and the data contract
between the Edge Function and the client is now aligned. Pagination, personalization, and engagement
counters are all wired through the same typed surface, which makes the experience resilient while we
iterate on ranking.

## What works today
- **Smooth rendering:** `UnifiedFeedList` leans on `react-window` + `AutoSizer` so we only paint the
  cards that are on screen. Skeletons keep first paint responsive while additional pages stream in.
  【F:src/components/UnifiedFeedList.tsx†L1-L188】
- **Shared engagement updates:** the feed hook exposes an `applyEngagementDelta` helper so likes and
  comments can update in place without a refetch, which is a good foundation for optimistic UI.
  【F:src/hooks/useUnifiedFeedInfinite.ts†L51-L87】
- **Server-side ranking fallback:** the `home-feed` Edge Function will call `get_home_feed_ranked`
  when available and drop back to a public-events list so the UI never hard fails if the RPC is
  missing. 【F:supabase/functions/home-feed/index.ts†L64-L121】

## Closed gaps
1. **Response schema drift.** The Edge Function and client share a `FeedItem` shape via a dedicated
   type module, keeping pagination and rendering in sync. 【F:supabase/functions/home-feed/index.ts†L20-L205】【F:src/hooks/unifiedFeedTypes.ts†L1-L55】
2. **Missing auth context.** Feed requests forward the Supabase bearer token so the server can
   personalize ranking and `viewer_has_liked` state. 【F:src/hooks/useUnifiedFeedInfinite.ts†L12-L49】【F:supabase/functions/home-feed/index.ts†L44-L81】
3. **Cursor vs offset.** The database wrapper accepts a cursor item id and the Edge Function returns a
   `nextCursor` pointer, powering infinite scroll without offsets. 【F:supabase/migrations/20250301000000_update_home_feed_cursor.sql†L1-L118】【F:src/hooks/useUnifiedFeedInfinite.ts†L12-L49】
4. **Open CORS policy.** Allowed origins are scoped to production, staging, and local development
   hosts. 【F:supabase/functions/home-feed/index.ts†L6-L15】
5. **Legacy hook drift.** `useUnifiedFeed` has been removed in favor of a single infinite hook and a
   shared type surface. 【F:src/hooks/useUnifiedFeedInfinite.ts†L1-L87】【F:src/hooks/unifiedFeedTypes.ts†L1-L55】

## Remaining recommendations
1. **Rate limiting & bot controls.** Layer Supabase Edge protections (rate limits, bot scoring, or
   reCAPTCHA) if the endpoint sees abuse.
2. **Realtime freshness.** Investigate realtime inserts or periodic background refresh so new posts
   land in the feed without manual reloads.
3. **Engagement analytics.** Extend the impression tracker to capture richer dwell metrics once the
   analytics tables are tuned for the additional volume.
