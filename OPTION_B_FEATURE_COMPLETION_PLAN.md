# 🚀 Option B: Feature Completion Plan

**Date**: January 28, 2025  
**Status**: Ready for Implementation  
**Estimated Time**: 6-11 hours total

---

## 📋 Overview

This plan completes two high-value features:
1. **Messaging System Completion** (4-8 hours)
2. **Following System Optimizations** (2-3 hours)

---

## 🎯 Part 1: Messaging System Completion

### Current State
- ✅ Database migration exists: `20251111000001_create_messaging_system.sql`
- ✅ Feature flag enabled: `messaging.enabled = true`
- ✅ Frontend components exist: `MessagingCenter.tsx`, `MessageButton.tsx`
- ⚠️ TODO: Unread message logic
- ⚠️ TODO: Message pagination
- ⚠️ TODO: Read receipts tracking

### Database Schema Verification

#### 1.1 Verify Migration Deployment & Schema (30 min)
- [ ] Check if `messaging.direct_conversations` table exists
- [ ] Check if `messaging.direct_messages` table exists
- [ ] Check if `messaging.conversation_participants` table exists
- [ ] Verify `conversation_participants.last_read_at` column exists
- [ ] Verify RLS policies are active and correct
- [ ] Test basic insert/select operations
- [ ] **Verify RLS prevents access to non-participant conversations**

**SQL Checks:**
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'messaging';

-- Check last_read_at column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'messaging' 
  AND table_name = 'conversation_participants'
  AND column_name = 'last_read_at';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'messaging';
```

#### 1.2 Add/Verify Indexes for Performance (15 min)
**Critical for pagination and unread queries**

**Required Indexes:**
```sql
-- For pagination (cursor-based queries)
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created 
ON messaging.direct_messages(conversation_id, created_at DESC);

-- For unread count queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created_asc
ON messaging.direct_messages(conversation_id, created_at);

-- For participant lookups
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_participant
ON messaging.conversation_participants(conversation_id, participant_id);
```

**Verify existing indexes:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'messaging';
```

### Tasks

#### 1.3 Implement Unread Message Logic (1-2 hours)
**File**: `src/components/messaging/MessagingCenter.tsx`

**Current**: `const hasUnread = false; // TODO: Implement unread logic`

**Single Source of Truth**: `conversation_participants.last_read_at`
- **Unread count**: Messages where `created_at > last_read_at`
- **Read receipts**: Show "Read" when recipient's `last_read_at >= message.created_at`
- **Multi-device behavior**: Global per-user (syncs across all devices)
  - When any client updates `last_read_at`, all devices see messages as read
  - This is the standard behavior for messaging apps

**Implementation**:
1. Query unread count per conversation:
```sql
SELECT 
  conversation_id,
  COUNT(*) as unread_count
FROM messaging.direct_messages dm
WHERE dm.conversation_id = $1
  AND dm.created_at > COALESCE(
    (SELECT last_read_at 
     FROM messaging.conversation_participants 
     WHERE conversation_id = $1 
       AND participant_id = $2
       AND participant_type = $3),
    '1970-01-01'::timestamptz
  )
GROUP BY conversation_id;
```

2. Update `last_read_at` when:
   - Conversation is opened
   - User scrolls to bottom of messages
   - New message arrives (auto-mark as read if conversation is active)

3. Show badge with unread count in conversation list

**Optional Enhancement** (Phase 2):
- Add `last_read_message_id` column for precise "Read up to message X" tracking
- Useful for handling clock skew and same-timestamp messages

#### 1.4 Add Message Pagination (Cursor-Based) (1-2 hours)
**File**: `src/components/messaging/MessagingCenter.tsx`

**Current**: Likely loads all messages at once (needs verification)

**Implementation**: **Cursor-based pagination** (NOT OFFSET - avoids bugs with concurrent inserts)

**Why Cursor-Based**:
- OFFSET is slow and buggy when messages are inserted while scrolling
- Cursor-based is faster and handles concurrent inserts correctly

**Query Pattern**:
```typescript
// First page (most recent 50 messages)
const { data } = await supabase
  .from('direct_messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false })
  .limit(50);

// Next page (older messages)
const oldestLoadedAt = messages[messages.length - 1].created_at;
const { data: olderMessages } = await supabase
  .from('direct_messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .lt('created_at', oldestLoadedAt) // Cursor: created_at < oldest currently loaded
  .order('created_at', { ascending: false })
  .limit(50);
```

**React Query Integration**:
- Use `useInfiniteQuery` with `created_at` as cursor
- Load more when scrolling up (older messages)
- Initial load: last 50 messages

#### 1.5 Implement Read Receipts (1-2 hours)
**File**: `src/components/messaging/MessagingCenter.tsx`

**Single Source of Truth**: `conversation_participants.last_read_at`

**Semantics**:
- **Delivered**: Message committed to DB (or sent to recipient's subscription)
- **Read**: Recipient's `last_read_at >= message.created_at`

**Implementation**:
1. Update `last_read_at` in `conversation_participants` when:
   - Conversation is opened
   - User scrolls to bottom of messages
   - New message arrives (mark as read if conversation is active)

2. Show read status on sent messages:
   - "Delivered" (check icon): Message in DB
   - "Read" (double check icon): Recipient's `last_read_at >= message.created_at`

**Update Query**:
```sql
UPDATE messaging.conversation_participants
SET last_read_at = now()
WHERE conversation_id = $1 
  AND participant_id = $2
  AND participant_type = $3;
```

**UI States**:
- Sending: Clock icon
- Delivered: Single check
- Read: Double check (blue)

#### 1.6 Add Real-time Message Subscriptions (1 hour)
**File**: `src/components/messaging/MessagingCenter.tsx`

**Current**: May have basic subscriptions, needs verification

**Critical Requirements**:
1. **Scoped Subscriptions**: Subscribe only to relevant conversations
   - Per-conversation: Subscribe to active conversation only
   - OR filtered by participant_id: Only receive messages for conversations you're in

2. **Cleanup on Unmount**: Ensure subscriptions are cleaned up
   - On conversation switch: Unsubscribe from old, subscribe to new
   - On component unmount: Clean up all subscriptions

**Implementation Pattern**:
```typescript
// Subscribe to specific conversation
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'messaging',
      table: 'direct_messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => {
      // Handle new message
      handleNewMessage(payload.new);
    }
  )
  .subscribe();

// Cleanup
useEffect(() => {
  return () => {
    channel.unsubscribe();
  };
}, [conversationId]);
```

**Enhancements**:
- Auto-update conversation list when new message arrives
- Update `last_read_at` when new message arrives in active conversation
- Show typing indicators (optional, Phase 2)
- Handle connection errors gracefully
- Reconnect logic for dropped connections

#### 1.7 Testing & Polish (1.5 hours)
**Core Functionality**:
- [ ] Test sending/receiving messages
- [ ] Test unread counts update correctly
- [ ] Test pagination loads older messages (cursor-based)
- [ ] Test read receipts update
- [ ] Test real-time updates
- [ ] Mobile responsiveness check

**Edge Cases**:
- [ ] **Non-participant access**: Try to query messages for conversation you're not in → must fail or return 0
- [ ] **Multi-device consistency**: Open same conversation in two tabs → verify read receipts/unread stay consistent
- [ ] **Concurrent inserts**: Send messages while scrolling → pagination should handle correctly
- [ ] **100+ messages**: Test pagination with large conversation
- [ ] **Subscription cleanup**: Verify no subscription leaks when switching conversations

**Performance**:
- [ ] Verify indexes are used (EXPLAIN queries)
- [ ] Test pagination performance with 1000+ messages
- [ ] Check network tab for query counts

---

## 🎯 Part 2: Following System Optimizations

### Current State
- ✅ `useFollowBatch` exists and is used in `UserSearchModal`
- ✅ `useFollowCountsCached` exists (SWR caching)
- ✅ `FollowRealtimeContext` exists (global subscriptions)
- ⚠️ Some components still use non-cached `useFollowCounts`
- ⚠️ Need to verify all components use optimized hooks

### Tasks

#### 2.1 Audit Current Usage (30 min)
- [ ] Find all usages of `useFollowCounts` (non-cached)
- [ ] Find all usages of `useFollow` that could use batch
- [ ] Identify components making redundant queries
- [ ] Count total follow-related queries in key flows (before optimization)

**Files to Check**:
- `src/components/follow/FollowStats.tsx` (uses `useFollowCounts` - needs migration)
- `src/components/follow/UserSearchModal.tsx` (already uses `useFollowBatch` ✅)
- Profile pages
- Event pages
- Any list components showing follow buttons

**Measurement Baseline**:
- Open Profile page → Count follow count queries
- Open UserSearch → Count follow status queries
- Scroll follower list → Count queries
- **Record numbers for before/after comparison**

#### 2.2 Migrate to Cached Follow Counts (1 hour)
**Files**: All components using `useFollowCounts`

**Change**:
```typescript
// Before
import { useFollowCounts } from '@/hooks/useFollowGraph';

// After
import { useFollowCountsCached } from '@/hooks/useFollowCountsCached';
```

**Files to Update**:
- `src/components/follow/FollowStats.tsx`
- Any profile components
- Event detail pages

#### 2.3 Optimize Search & List Components (1 hour)
**Goal**: Use `useFollowBatch` everywhere possible

**Files to Check**:
- Event attendee lists
- User search results (already done ✅)
- Follower/following lists
- Any component showing multiple follow buttons

**API Contract for `useFollowBatch`**:
- **Input**: `targetIds` array
- **Output**: `followMap` with `{ [targetId]: FollowState }`
- **Missing IDs**: If a `targetId` is not in `followMap`, it means `'none'` (not following)
- **Fallback behavior**: `FollowButton` can accept `followState` prop OR fall back to its own query
  - **Preferred**: Always pass `followState` from batch when available
  - **Fallback**: Allow individual query for edge cases (e.g., infinite lists where IDs appear later)

**Pattern**:
```typescript
// Before: N queries
{users.map(user => (
  <FollowButton targetType="user" targetId={user.id} />
))}

// After: 1 query
const { followMap, isLoading } = useFollowBatch({
  targetType: 'user',
  targetIds: users.map(u => u.id),
  enabled: users.length > 0
});

{users.map(user => (
  <FollowButton 
    targetType="user" 
    targetId={user.id}
    followState={followMap[user.id] || 'none'} // Pass state directly
    isLoading={isLoading}
  />
))}
```

**Infinite Lists**:
- For infinite scroll, batch query should include all currently visible IDs
- As new items load, include them in next batch query
- Consider debouncing batch queries if list updates frequently

#### 2.4 Verify Realtime Subscriptions (30 min)
- [ ] Verify `FollowRealtimeContext` is used in `App.tsx`
- [ ] Check that components use context instead of individual subscriptions
- [ ] **Verify no component creates its own per-user follow subscription**
- [ ] **All realtime follow updates go through `FollowRealtimeContext`**
- [ ] Test real-time updates work correctly
- [ ] Verify bounded subscriptions (not literally one, but not N per button/row)
- [ ] Check Network tab: Should see 1-2 follow-related subscriptions, not 10+

**Expected Behavior**:
- **Bounded subscriptions**: One per relevant graph or context (e.g., one for user follows, one for event follows)
- **NOT**: One subscription per follow button or per row
- **NOT**: Each component creating its own subscription

#### 2.5 Testing & Measurement (45 min)
**Functionality**:
- [ ] Test follow/unfollow actions
- [ ] Verify follow counts update correctly
- [ ] Test batch queries in search
- [ ] Test real-time updates

**Performance Measurement**:
- [ ] **Before/After Comparison**:
  - Open Profile page → Count `/rpc` or `/follow_counts` calls
  - Open UserSearch → Count follow status queries
  - Scroll follower list → Count queries
  - **Target**: At least 80% fewer follow count requests, 90% fewer batch queries

**Measurement Method**:
- Use React Query Devtools or Network tab
- Count API calls in key flows:
  - Profile page load
  - User search with 20 results
  - Follower list scroll
- Compare before vs after migration

**Success Criteria**:
- ✅ 80%+ reduction in follow count queries (via caching)
- ✅ 90%+ reduction in batch queries (via `useFollowBatch`)
- ✅ Bounded real-time subscriptions (verified in Network tab)
- ✅ Follow actions feel instant

---

## 📊 Success Metrics

### Messaging System
- ✅ Unread counts display correctly (using `last_read_at` as source of truth)
- ✅ Messages paginate smoothly (cursor-based, no OFFSET)
- ✅ Read receipts update in real-time (multi-device consistent)
- ✅ New messages appear instantly (scoped subscriptions)
- ✅ No performance issues with 100+ messages
- ✅ RLS prevents non-participant access
- ✅ Subscriptions cleaned up properly (no leaks)

### Following System
- ✅ **Measurable**: 80%+ reduction in follow count queries (via caching)
  - **How**: Compare network calls before/after in Profile + UserSearch flows
- ✅ **Measurable**: 90%+ reduction in batch queries (via `useFollowBatch`)
  - **How**: Count queries for 20-user search: before = 20, after = 1
- ✅ **Bounded** real-time subscriptions (not N per button, all via context)
  - **How**: Network tab shows 1-2 subscriptions, not 10+
- ✅ Follow actions feel instant

---

## 🚀 Implementation Order

### Phase 1: Following Optimizations (2-3 hours)
**Why First**: Quick wins, lower risk, immediate performance gains

1. Audit current usage
2. Migrate to cached counts
3. Optimize list components
4. Verify realtime
5. Test

### Phase 2: Messaging Completion (4-8 hours)
**Why Second**: More complex, requires careful testing

1. Verify migration
2. Implement unread logic
3. Add pagination
4. Add read receipts
5. Enhance real-time
6. Test & polish

---

## 📝 Files to Create/Modify

### New Files
- None (all components exist)

### Modified Files
- `src/components/messaging/MessagingCenter.tsx` (unread, pagination, read receipts, realtime)
- `src/components/follow/FollowStats.tsx` (use cached counts)
- Any profile/event components using follow counts
- Any list components showing follow buttons

### Database Changes

#### Schema Verification (No Changes Expected)
- Verify `messaging.conversation_participants.last_read_at` exists
- If missing, add:
  ```sql
  ALTER TABLE messaging.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
  ```

#### Indexes (Required for Performance)
**Migration**: `supabase/migrations/20250128_add_messaging_indexes.sql`

```sql
-- For cursor-based pagination
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created 
ON messaging.direct_messages(conversation_id, created_at DESC);

-- For unread count queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created_asc
ON messaging.direct_messages(conversation_id, created_at);

-- For participant lookups
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_participant
ON messaging.conversation_participants(conversation_id, participant_id);

-- Optional: For precise read tracking (if adding last_read_message_id)
-- CREATE INDEX IF NOT EXISTS idx_conversation_participants_last_read_message
-- ON messaging.conversation_participants(conversation_id, last_read_message_id);
```

#### RLS Verification (No Changes Expected)
- Verify RLS policies prevent non-participant access
- Test: Try to query conversation you're not in → must fail

---

## ⚠️ Risks & Mitigations

### Messaging System
- **Risk**: Migration not deployed → **Mitigation**: Check in 1.1, fail fast with clear error
- **Risk**: Performance with many messages → **Mitigation**: Cursor-based pagination + indexes
- **Risk**: Real-time connection issues → **Mitigation**: Add error handling, reconnect logic
- **Risk**: Subscription leaks → **Mitigation**: Explicit cleanup in useEffect, scoped subscriptions
- **Risk**: Clock skew affecting read receipts → **Mitigation**: Use `last_read_at` + optional `last_read_message_id`
- **Risk**: RLS not protecting data → **Mitigation**: Test non-participant access explicitly

### Following System
- **Risk**: Breaking existing functionality → **Mitigation**: Test thoroughly, incremental migration
- **Risk**: Cache invalidation issues → **Mitigation**: Use React Query's built-in invalidation, explicit `mutate()` after actions
- **Risk**: Missing IDs in batch → **Mitigation**: `useFollowBatch` returns `'none'` for missing IDs, `FollowButton` handles gracefully
- **Risk**: Subscription bloat → **Mitigation**: Verify bounded subscriptions, use context pattern

---

## ✅ Definition of Done

### Messaging System
- [ ] Unread counts work correctly (using `last_read_at` as source of truth)
- [ ] Messages paginate (cursor-based, loads older on scroll)
- [ ] Read receipts update when messages are read (multi-device consistent)
- [ ] Real-time updates work (scoped subscriptions, proper cleanup)
- [ ] RLS prevents non-participant access (tested)
- [ ] Indexes created and verified (EXPLAIN shows index usage)
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Tested with 100+ messages
- [ ] Edge cases tested (non-participant access, multi-device, concurrent inserts)
- [ ] **Monitoring**: Basic logging for failed sends, subscription errors, unread query failures
- [ ] **No noisy logs**: Confirm no excessive logging on happy path

### Following System
- [ ] All components use cached follow counts (`useFollowCountsCached`)
- [ ] All list components use `useFollowBatch`
- [ ] Bounded real-time subscriptions (verified in Network tab: 1-2, not 10+)
- [ ] Follow actions feel instant
- [ ] No N+1 query issues
- [ ] **Performance improved (measured)**: 80%+ reduction in follow count queries, 90%+ reduction in batch queries
- [ ] **Measurement documented**: Before/after query counts recorded

---

## 📦 PR Structure

### Following Optimizations PR

**Commit 1**: Switch to cached follow counts
- Migrate `FollowStats.tsx` and other simple components to `useFollowCountsCached`
- Update imports
- Test follow counts still work

**Commit 2**: Introduce batch queries in list views
- Add `useFollowBatch` to event attendee lists, follower lists, etc.
- Update `FollowButton` to accept `followState` prop
- Test batch queries work correctly

**Commit 3**: Verify realtime subscriptions
- Confirm `FollowRealtimeContext` usage
- Remove any per-component subscriptions
- Test real-time updates

### Messaging Completion PR

**Commit 1**: Add cursor-based pagination
- Implement `useInfiniteQuery` with `created_at` cursor
- Remove any OFFSET-based queries
- Test pagination with 100+ messages

**Commit 2**: Implement unread logic
- Query unread counts using `last_read_at`
- Update `last_read_at` when conversation opens
- Show unread badges in conversation list

**Commit 3**: Add read receipts & realtime enhancements
- Update `last_read_at` on scroll/read
- Show read/delivered indicators
- Add scoped real-time subscriptions with cleanup
- Test multi-device consistency

---

---

## 🔍 Key Design Decisions

### Messaging: Single Source of Truth
- **`conversation_participants.last_read_at`** is the single source of truth for:
  - Unread counts (messages where `created_at > last_read_at`)
  - Read receipts (show "Read" when recipient's `last_read_at >= message.created_at`)
- **Multi-device behavior**: Global per-user (syncs across all devices)
- **Optional enhancement**: Add `last_read_message_id` for precise tracking (Phase 2)

### Messaging: Cursor-Based Pagination
- **NOT using OFFSET** (slow and buggy with concurrent inserts)
- **Using cursor**: `created_at < oldestLoadedAt` for next page
- **Sort order**: `DESC` (newest first, load older on scroll up)

### Following: Bounded Subscriptions
- **NOT** "single subscription" (too restrictive)
- **Bounded**: One per relevant graph/context (e.g., user follows, event follows)
- **NOT** one per button/row (that's the anti-pattern we're fixing)
- **All via context**: `FollowRealtimeContext` manages subscriptions

### Following: Batch API Contract
- **Missing IDs**: Return `'none'` in `followMap` (not an error)
- **Fallback**: `FollowButton` can accept `followState` prop OR query individually
- **Preferred**: Always pass `followState` from batch when available

---

**Ready to start?** Let's begin with Phase 1 (Following Optimizations) for quick wins! 🚀

