# 🎫 Event Posting Policy - Complete Guide

## 📋 **Quick Answer**

**Who can post to an event?**
1. ✅ **Event Organizers** (creator, owner, or organization admins/editors)
2. ✅ **Ticket Holders** (anyone with a valid ticket: `issued`, `transferred`, or `redeemed`)

**Who CANNOT post?**
- ❌ Users without tickets
- ❌ Anonymous/unauthenticated users
- ❌ Users with invalid/expired tickets

---

## 🔐 **The Authorization Function**

All post creation is controlled by the SQL function `can_current_user_post()`:

```sql
CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid) 
RETURNS boolean AS $$
  SELECT
    EXISTS (
      -- ✅ OPTION 1: Event Ownership/Management
      SELECT 1
      FROM public.events ev
      WHERE ev.id = p_event_id
        AND (
          -- Direct creator
          ev.created_by = auth.uid()
          
          -- OR Individual owner
          OR (
            ev.owner_context_type = 'individual'
            AND ev.owner_context_id = auth.uid()
          )
          
          -- OR Organization member (owner/admin/editor)
          OR (
            ev.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = ev.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role IN ('owner','admin','editor')
            )
          )
        )
    )
    OR EXISTS (
      -- ✅ OPTION 2: Valid Ticket Holder
      SELECT 1
      FROM public.tickets t
      WHERE t.event_id = p_event_id
        AND t.owner_user_id = auth.uid()
        AND t.status IN ('issued','transferred','redeemed')
    );
$$ LANGUAGE sql STABLE;
```

---

## 🎯 **Posting Requirements Breakdown**

### **Option 1: Event Organizer Access** ✅

Users can post if they manage the event in any of these ways:

#### **1a. Direct Creator**
```sql
ev.created_by = auth.uid()
```
- The user who clicked "Create Event"
- Full control over the event

#### **1b. Individual Owner**
```sql
ev.owner_context_type = 'individual' 
AND ev.owner_context_id = auth.uid()
```
- Event is owned by an individual user
- That user matches the current user

#### **1c. Organization Member (Owner/Admin/Editor)**
```sql
ev.owner_context_type = 'organization'
AND EXISTS (
  SELECT 1 FROM org_memberships
  WHERE org_id = ev.owner_context_id
    AND user_id = auth.uid()
    AND role IN ('owner','admin','editor')
)
```
- Event is owned by an organization
- User is a member with elevated permissions:
  - **Owner**: Full control
  - **Admin**: Can manage events
  - **Editor**: Can create/edit content
- ❌ **NOT Viewers**: Read-only members cannot post

---

### **Option 2: Valid Ticket Holder** 🎫

Users can post if they have a ticket:

```sql
EXISTS (
  SELECT 1 FROM tickets
  WHERE event_id = p_event_id
    AND owner_user_id = auth.uid()
    AND status IN ('issued','transferred','redeemed')
)
```

**Valid Ticket Statuses:**
- ✅ **`issued`**: Original ticket, not yet used
- ✅ **`transferred`**: Ticket was transferred to this user
- ✅ **`redeemed`**: Ticket was scanned/used at event

**Invalid Ticket Statuses:**
- ❌ **`cancelled`**: Refunded or voided
- ❌ **`expired`**: Past event date (if applicable)
- ❌ **`pending`**: Payment not completed

---

## 🚨 **Rate Limiting**

Posts are rate-limited to prevent spam:

```typescript
// supabase/functions/posts-create/index.ts
const RATELIMIT_MAX_PER_MIN = 10; // Max 10 posts per minute
```

**How it works:**
1. Each user has a `rate_limits` entry
2. Bucket: `posts-create`
3. Tracked per minute (rolling window)
4. Exceeding limit → `429 Rate limit exceeded`

**Rate Limit Table:**
```sql
CREATE TABLE public.rate_limits (
  user_id uuid,
  bucket text,           -- 'posts-create'
  minute timestamptz,    -- Minute bucket
  count integer,         -- Number of posts in this minute
  PRIMARY KEY (user_id, bucket, minute)
);
```

---

## 🔒 **Row Level Security (RLS) Policies**

### **INSERT Policy for Posts**
```sql
CREATE POLICY "event_posts_insert_authorized" 
ON events.event_posts 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
  AND author_user_id = auth.uid()
  AND public.can_current_user_post(event_id)
);
```

**Requirements:**
1. ✅ User must be authenticated (not anonymous)
2. ✅ `author_user_id` must match current user (can't post as someone else)
3. ✅ Must pass `can_current_user_post()` check

### **INSERT Policy for Comments**
```sql
CREATE POLICY "event_comments_insert_authorized"
ON events.event_comments
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM event_posts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id
      AND public.can_current_user_post(e.id)
      AND p.deleted_at IS NULL
  )
);
```

**Requirements (same as posts):**
1. ✅ Authenticated
2. ✅ Author matches current user
3. ✅ Must pass `can_current_user_post()` for the event
4. ✅ Post must not be deleted

---

## 🛠️ **Implementation Flow**

### **Frontend (User clicks "Post")**
```typescript
// src/hooks/usePostCreator.ts or similar
const createPost = async (eventId: string, text: string, mediaUrls: string[]) => {
  const { data, error } = await supabase.functions.invoke('posts-create', {
    body: { 
      event_id: eventId, 
      text, 
      media_urls: mediaUrls 
    }
  });
  
  if (error?.requiresTicket) {
    // Show "Get Tickets" prompt
    openTicketSheet(eventId);
  }
};
```

### **Edge Function (`posts-create`)**
```typescript
// Step 1: Authenticate
const { data: { user } } = await supabaseClient.auth.getUser();
if (!user) return 401;

// Step 2: Rate limit check
const { data: rateCheck } = await serviceClient
  .from('rate_limits')
  .upsert({ user_id, bucket: 'posts-create', minute, count: 1 });
if (rateCheck.count > 10) return 429; // Rate limit exceeded

// Step 3: Permission check
const { data: canPost } = await supabaseClient
  .rpc('can_current_user_post', { p_event_id: event_id });
  
if (!canPost) {
  return 403; // ❌ "You must have a ticket or be an event organizer"
}

// Step 4: Insert post (RLS will double-check)
const { data: post } = await supabaseClient
  .from('event_posts')
  .insert({ event_id, author_user_id: user.id, text, ... });
```

### **Database (RLS Policy)**
```sql
-- Final check before INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND author_user_id = auth.uid()
  AND public.can_current_user_post(event_id)
);
```

**Result:** 3 layers of security (Frontend → Edge Function → RLS)

---

## 🎨 **User Experience**

### **Scenario 1: Organizer Posts**
```
1. Organizer creates event
2. Immediately sees "Post to this event" button
3. Can post unlimited content (subject to rate limits)
4. Badge shows "Organizer" or "Host"
```

### **Scenario 2: Ticket Holder Posts**
```
1. User buys ticket
2. Sees event feed + "Post to this event" button
3. Can share photos, videos, text
4. Badge shows ticket tier (e.g., "VIP", "General Admission")
```

### **Scenario 3: Non-Ticket Holder Tries to Post**
```
1. User clicks "Post to this event"
2. Modal appears: "Get a ticket to post"
3. CTA button: "View Tickets" → redirects to ticket purchase
4. After purchase → can immediately post
```

---

## 📊 **Post Metadata & Badges**

When a user posts, their badge is automatically determined:

```typescript
// Derive author's badge
let finalTicketTierId = ticket_tier_id;
if (!finalTicketTierId) {
  // Check if user has a ticket
  const { data: tickets } = await supabaseClient
    .from('tickets')
    .select('ticket_tier_id, ticket_tiers(name, badge_label)')
    .eq('event_id', event_id)
    .eq('owner_user_id', user.id)
    .eq('status', 'issued')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (tickets?.[0]) {
    finalTicketTierId = tickets[0].ticket_tier_id;
  }
}

// If no ticket → check if organizer
if (!finalTicketTierId) {
  const { data: isManager } = await supabaseClient
    .rpc('is_event_manager', { p_event_id: event_id });
  
  if (isManager) {
    // Badge = "Organizer" or "Host" (frontend decides)
  }
}
```

**Badge Display:**
- **Organizers:** "Organizer", "Host", or custom role
- **Ticket Holders:** Ticket tier name (e.g., "VIP", "Early Bird", "General Admission")
- **Fallback:** Generic "Attendee" badge

---

## 🔍 **Policy Verification**

### **Test 1: Organizer Can Post**
```sql
-- As organizer user
SELECT can_current_user_post('<event_id>'); 
-- Returns: true ✅
```

### **Test 2: Ticket Holder Can Post**
```sql
-- As ticket holder
SELECT can_current_user_post('<event_id>');
-- Returns: true ✅
```

### **Test 3: Random User Cannot Post**
```sql
-- As user without ticket or organizer role
SELECT can_current_user_post('<event_id>');
-- Returns: false ❌
```

---

## 🚫 **Common Denial Reasons**

| Reason | Error Message | Status Code | Solution |
|--------|--------------|-------------|----------|
| **Not authenticated** | "Unauthorized" | 401 | Sign in |
| **No ticket/access** | "You must have a ticket or be an event organizer to post to this event" | 403 | Buy ticket or get added as organizer |
| **Rate limit exceeded** | "Rate limit exceeded" | 429 | Wait 1 minute |
| **Invalid ticket status** | (Same as no ticket) | 403 | Check ticket status (may be cancelled/refunded) |
| **Organization viewer role** | (Same as no ticket) | 403 | Request editor+ role from org admin |

---

## 🎯 **Summary**

### **✅ Who Can Post:**
1. **Event creators** (the user who made the event)
2. **Individual owners** (if event is owned by a specific user)
3. **Organization owners/admins/editors** (if event is owned by an org)
4. **Ticket holders** (with status: `issued`, `transferred`, or `redeemed`)

### **❌ Who Cannot Post:**
1. Anonymous users
2. Users without tickets
3. Organization viewers (read-only members)
4. Users with cancelled/expired tickets
5. Users exceeding rate limits (10 posts/min)

### **🔒 Security Layers:**
1. **Frontend check** (UX: show/hide post button)
2. **Edge Function check** (`can_current_user_post()`)
3. **RLS Policy check** (database-level enforcement)
4. **Rate limiting** (spam prevention)

---

## 📂 **Related Files**

| File | Purpose |
|------|---------|
| `complete_database.sql` | Function definition (line 745) |
| `supabase/functions/posts-create/index.ts` | Post creation logic |
| `supabase/functions/comments-add/index.ts` | Comment creation logic |
| `supabase/migrations/20250201090000_add_event_roles_system.sql` | RLS policies |

---

**TL;DR:** Only **event organizers** (creator/owner/org admins/editors) and **ticket holders** (with valid tickets) can post to events. Anonymous users and non-ticket holders are blocked. All checks are enforced at database level via RLS + Edge Functions. 🎫✅

