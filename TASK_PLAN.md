# 🚀 Liventix Launch Task Plan - Collaborative Working Document

> **Status**: Week 2 | **Last Updated**: Today  
> **Goal**: Launch-ready platform by end of Week 6

---

## 📋 Quick Status Dashboard

| Category | Progress | Status |
|----------|----------|--------|
| Frontend | 5/14 tasks | 🟡 In Progress |
| Backend | 3/7 tasks | 🟡 In Progress |
| Branding | 0/6 tasks | 🔴 Not Started |
| Compliance | 1/7 tasks | 🔴 Not Started |
| QA/Testing | 2/4 tasks | 🟡 In Progress |
| Admin/Ops | 1/5 tasks | 🔴 Not Started |

**Overall: 12/43 tasks complete (28%)**

---

## 🎯 This Week's Focus (Week 2)

### ✅ Already Done
- [x] Feed stability improvements
- [x] Comments migration started
- [x] Post Creator migration started
- [x] Video/HLS stabilization started
- [x] Edge Function audit started
- [x] Realtime subscriptions hardening
- [x] E2E regression testing started

### 🔥 Must Complete This Week

#### **Backend Security (CRITICAL)**
- [ ] **RLS Verification Audit** - Start immediately
  - [ ] Review RLS policies on `event_posts` table
  - [ ] Review RLS policies on `events` table
  - [ ] Review RLS policies on `tickets` table
  - [ ] Review RLS policies on `organizations` table
  - [ ] Review RLS policies on `user_profiles` table
  - [ ] Create test users with different roles
  - [ ] Test: Attendee can only see public events
  - [ ] Test: Organizer can only edit their own events
  - [ ] Test: Users can only see their own tickets
  - [ ] Document any security gaps found
  - **Owner**: BE Lead | **Priority**: 🔴 Critical

#### **Frontend Migrations (HIGH)**
- [ ] **Complete Comments Migration**
  - [ ] Move `CommentModal.tsx` → `features/comments/components/`
  - [ ] Move `CommentsSheet.tsx` → `features/comments/components/`
  - [ ] Move `CommentItem.tsx` → `features/comments/components/`
  - [ ] Move `useCommentActions.ts` → `features/comments/hooks/`
  - [ ] Move `useRealtimeComments.ts` → `features/comments/hooks/`
  - [ ] Create `features/comments/index.ts` (public API)
  - [ ] Update all imports across codebase
  - [ ] Test: Comments work in feed
  - [ ] Test: Comments work in event pages
  - [ ] Test: Comments work in profile pages
  - [ ] Remove old comment files
  - **Owner**: FE Lead | **Priority**: 🟡 High

- [ ] **Complete Post Creator Migration**
  - [ ] Move `PostCreatorModal.tsx` → `features/posts/components/`
  - [ ] Move post-related hooks → `features/posts/hooks/`
  - [ ] Move post API calls → `features/posts/api/`
  - [ ] Create `features/posts/index.ts` (public API)
  - [ ] Update all imports
  - [ ] Test: Create post from feed
  - [ ] Test: Create post from event page
  - [ ] Test: Post appears in feed after creation
  - [ ] Remove old post creator files
  - **Owner**: FE Lead | **Priority**: 🟡 High

#### **Video/HLS Stability (HIGH)**
- [ ] **Continue Video Improvements**
  - [ ] Test HLS playback on iOS Safari
  - [ ] Test HLS playback on Android Chrome
  - [ ] Test HLS playback on desktop browsers
  - [ ] Verify fallback to MP4 works
  - [ ] Test video preloading doesn't block scrolling
  - [ ] Fix any jank or dropped frames
  - [ ] Test on slow network (3G simulation)
  - **Owner**: FE Lead | **Priority**: 🟡 High

#### **Empty States & Loading (MEDIUM)**
- [ ] **Add Loading Skeletons**
  - [ ] Create `LoadingSkeleton.tsx` component
  - [ ] Add skeleton to feed while loading
  - [ ] Add skeleton to event details page
  - [ ] Add skeleton to profile page
  - [ ] Add skeleton to ticket wallet
  - **Owner**: FE Lead | **Priority**: 🟢 Medium

- [ ] **Add Empty States**
  - [ ] Empty feed state (no posts/events)
  - [ ] Empty search results
  - [ ] Empty event list
  - [ ] Empty ticket wallet
  - [ ] Empty profile posts
  - [ ] All with clear CTAs
  - **Owner**: FE Lead | **Priority**: 🟢 Medium

---

## 📅 Next Week (Week 3) Preview

### Critical Tasks
- [ ] **Stripe Payments Testing**
  - [ ] Test card payments
  - [ ] Test 3D Secure flow
  - [ ] Test Apple Pay (if configured)
  - [ ] Test Google Pay (if configured)
  - [ ] Test error handling (declined cards, etc.)
  - **Owner**: BE Lead

- [ ] **Ticket Delivery & Wallet Sync**
  - [ ] Test ticket appears in wallet after purchase
  - [ ] Test email delivery with QR code
  - [ ] Test multiple tickets for one purchase
  - [ ] Test race conditions don't cause duplicates
  - **Owner**: BE

- [ ] **Event Management Migration**
  - [ ] Move `EventManagement.tsx` → `features/events/`
  - [ ] Move event creation flow
  - [ ] Move event editing
  - [ ] Update all imports
  - **Owner**: FE Lead

### High Priority
- [ ] **Search Redesign**
  - [ ] Design search UI with Design team
  - [ ] Create `features/search/` module
  - [ ] Implement search bar
  - [ ] Add filters
  - [ ] Test performance
  - **Owner**: FE + Design

- [ ] **App Icons & Splash Screens**
  - [ ] Design app icons (all sizes)
  - [ ] Design splash screens
  - [ ] Export for iOS
  - [ ] Export for Android
  - [ ] Export for web/PWA
  - **Owner**: Design

---

## 🔍 Detailed Task Breakdowns

### 🔴 Critical Path: RLS Security Audit

**Goal**: Ensure no user can access data they shouldn't

#### Step 1: Inventory All Tables
```sql
-- Run this to see all tables with RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname IN ('public', 'users')
ORDER BY tablename;
```

#### Step 2: Test Each Table
For each table, create test scenarios:

**`event_posts` table:**
- [ ] Guest user can see public posts
- [ ] Guest user CANNOT see private posts
- [ ] User can only edit their own posts
- [ ] User CANNOT delete others' posts
- [ ] Organizer can see all posts in their events

**`events` table:**
- [ ] Guest user can see public events
- [ ] Guest user CANNOT see private events
- [ ] Organizer can edit their own events
- [ ] Organizer CANNOT edit others' events
- [ ] User can see events they're attending

**`tickets` table:**
- [ ] User can only see their own tickets
- [ ] User CANNOT see others' tickets
- [ ] Organizer can see tickets for their events
- [ ] Organizer CANNOT see tickets for other events

#### Step 3: Document Findings
- [ ] Create `SECURITY_AUDIT.md` document
- [ ] List all policies found
- [ ] List any gaps or issues
- [ ] Create fix plan for any issues

**Estimated Time**: 2-3 days  
**Dependencies**: None  
**Blocks**: Launch if not done

---

### 🟡 High Priority: Comments Migration

**Goal**: Move all comment logic to `features/comments/` module

#### Current Files to Move:
```
src/components/CommentModal.tsx
src/components/post-viewer/CommentsSheet.tsx
src/components/post-viewer/CommentItem.tsx
src/components/post-viewer/useCommentActions.ts
src/hooks/useRealtimeComments.ts
```

#### Target Structure:
```
features/comments/
├── index.ts              # Public API exports
├── components/
│   ├── CommentModal.tsx
│   ├── CommentsSheet.tsx
│   └── CommentItem.tsx
├── hooks/
│   ├── useCommentActions.ts
│   └── useRealtimeComments.ts
├── api/
│   └── comments.ts       # API calls
└── types.ts              # TypeScript types
```

#### Migration Steps:
1. [ ] Create `features/comments/` directory structure
2. [ ] Move files to new locations
3. [ ] Update imports within moved files
4. [ ] Create `features/comments/index.ts` with exports
5. [ ] Find all files importing old paths:
   ```bash
   grep -r "from.*CommentModal" src/
   grep -r "from.*CommentsSheet" src/
   grep -r "from.*useCommentActions" src/
   grep -r "from.*useRealtimeComments" src/
   ```
6. [ ] Update each import to use `features/comments`
7. [ ] Test: Comments work in feed
8. [ ] Test: Comments work in event pages
9. [ ] Test: Comments work in profile pages
10. [ ] Delete old files
11. [ ] Run full test suite

**Estimated Time**: 1-2 days  
**Dependencies**: None  
**Blocks**: Code organization

---

### 🟡 High Priority: Post Creator Migration

**Goal**: Move all post creation logic to `features/posts/` module

#### Current Files to Move:
```
src/components/PostCreatorModal.tsx
src/components/post-viewer/usePostWithComments.ts (maybe keep here?)
src/hooks/usePosts.ts (if exists)
```

#### Target Structure:
```
features/posts/
├── index.ts
├── components/
│   └── PostCreatorModal.tsx
├── hooks/
│   └── usePosts.ts
├── api/
│   └── posts.ts
└── types.ts
```

#### Migration Steps:
1. [ ] Create `features/posts/` directory structure
2. [ ] Move `PostCreatorModal.tsx`
3. [ ] Move post-related hooks
4. [ ] Move post API calls
5. [ ] Create `features/posts/index.ts`
6. [ ] Update all imports
7. [ ] Test: Create post from feed
8. [ ] Test: Create post from event page
9. [ ] Test: Post appears correctly after creation
10. [ ] Delete old files

**Estimated Time**: 1 day  
**Dependencies**: None  
**Blocks**: Code organization

---

## 🧪 Testing Checklist

### E2E Test Scenarios (Run Weekly)

#### User Journey: Browse & Purchase
- [ ] Sign up as new user
- [ ] Browse feed
- [ ] Click on event
- [ ] View event details
- [ ] Add ticket to cart
- [ ] Complete checkout
- [ ] Receive ticket in wallet
- [ ] View ticket QR code
- [ ] All without errors

#### User Journey: Create Event
- [ ] Sign up as organizer
- [ ] Create organization
- [ ] Create event
- [ ] Set ticket tiers
- [ ] Publish event
- [ ] Event appears in feed
- [ ] Can edit event
- [ ] Can view analytics
- [ ] All without errors

#### User Journey: Post & Comment
- [ ] Create post from feed
- [ ] Post appears in feed
- [ ] Add comment to post
- [ ] Comment appears immediately
- [ ] Like post
- [ ] Like comment
- [ ] Delete own post
- [ ] All without errors

---

## 🐛 Bug Tracking

### Current Known Issues
- [ ] Issue: [Description]
  - Priority: 🔴/🟡/🟢
  - Owner: [Name]
  - Status: Open/In Progress/Fixed

### Fixed This Week
- [x] Fixed: Video controls not responsive
- [x] Fixed: "No post selected" flash during navigation
- [x] Fixed: Missing thumbnails for videos

---

## 📝 Notes & Decisions

### Technical Decisions
- **Date**: Decision about [topic]
- **Rationale**: Why we chose this approach
- **Alternatives Considered**: What else we looked at

### Design Decisions
- **Date**: Decision about [topic]
- **Rationale**: Why we chose this approach

---

## 🎯 Daily Goals

### Today's Focus
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Tomorrow's Plan
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

---

## ✅ Quick Wins (Can Do Anytime)

These are small tasks that can be done in parallel:

- [ ] Fix any console warnings
- [ ] Improve error messages
- [ ] Add loading states to buttons
- [ ] Improve accessibility labels
- [ ] Update documentation comments
- [ ] Clean up unused imports
- [ ] Fix TypeScript any types
- [ ] Improve code formatting

---

## 📞 Need Help?

### Blockers
- [ ] **Blocker**: [Description]
  - **Who can help**: [Name/Role]
  - **What's needed**: [Specific help]

### Questions
- [ ] **Question**: [Description]
  - **For**: [Name/Role]

---

## 🎉 Completed This Week

- [x] Feed stability improvements
- [x] Video controls made responsive
- [x] Fixed "No post selected" flash
- [x] Added video thumbnails
- [x] Improved swipe navigation

---

*This is a living document - update as we complete tasks!*


