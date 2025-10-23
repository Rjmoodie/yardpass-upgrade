# 🔧 Code Update Guide - Using New Database Schemas

## 📋 Overview

Now that your database is restructured, we need to update the application code to use the new schema-qualified table names.

**Good News:** Because we created backward-compatible views, your app should still work! But let's update it properly.

---

## 🎯 Strategy

### **Two Approaches:**

#### **Option A: Gradual (Recommended)**
- Keep using views for now
- Update code incrementally, feature by feature
- Test as you go
- Drop views at the end

#### **Option B: All at Once**
- Update all code now
- Drop views immediately
- Higher risk but cleaner

**We'll use Option A (Gradual) for safety.**

---

## 📂 What Needs Updating

### **1. TypeScript Types**
- `src/integrations/supabase/types.ts` - Regenerate from new schemas

### **2. Supabase Queries**
- All `supabase.from('table_name')` calls
- Update to use schema-qualified names or keep views

### **3. Database Functions/RPC**
- Update to reference new schema names
- Already using helper functions (`current_org_id()`)

### **4. Edge Functions**
- Update Supabase client queries
- Reference new schema names

---

## 🚀 Step-by-Step Updates

### **Step 1: Regenerate TypeScript Types**

The Supabase CLI can generate types from your new schema structure:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Generate types from all schemas
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.generated.ts
```

**Alternatively (manual approach):**

```typescript
// src/integrations/supabase/types.ts

// Update table references to include schema
export type Event = Database['events']['Tables']['events']['Row'];
export type EventInsert = Database['events']['Tables']['events']['Insert'];
export type EventUpdate = Database['events']['Tables']['events']['Update'];

export type Ticket = Database['ticketing']['Tables']['tickets']['Row'];
export type Order = Database['ticketing']['Tables']['orders']['Row'];

export type UserProfile = Database['users']['Tables']['user_profiles']['Row'];
export type Organization = Database['organizations']['Tables']['organizations']['Row'];
```

---

### **Step 2: Update Supabase Client Queries**

#### **Before (using views):**
```typescript
const { data: events } = await supabase
  .from('events')
  .select('*');
```

#### **After (using schema-qualified names):**
```typescript
const { data: events } = await supabase
  .from('events.events')  // schema.table
  .select('*');
```

#### **Or keep using views (easier):**
```typescript
// Keep this for now - views still work!
const { data: events } = await supabase
  .from('events')  // Uses public.events view
  .select('*');
```

---

### **Step 3: Update Common Query Patterns**

Let me create update scripts for each feature domain:

---

## 📦 Feature-by-Feature Updates

### **Users Feature**

```typescript
// src/features/users/api/userQueries.ts

// OLD
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('user_id', userId)
  .single();

// NEW (schema-qualified)
const { data: profile } = await supabase
  .from('users.user_profiles')
  .select('*')
  .eq('user_id', userId)
  .single();

// OR keep using view (easier for now)
const { data: profile } = await supabase
  .from('user_profiles')  // View works!
  .select('*')
  .eq('user_id', userId)
  .single();
```

---

### **Organizations Feature**

```typescript
// src/features/organizations/api/orgQueries.ts

// Get user's organizations
const { data: orgs } = await supabase
  .from('organizations.organizations')
  .select(`
    *,
    org_memberships!inner(
      user_id,
      role
    )
  `)
  .eq('org_memberships.user_id', userId);

// Or using helper function + view
const { data: orgs } = await supabase
  .from('organizations')  // View
  .select('*')
  .in('id', await supabase.rpc('user_orgs'));
```

---

### **Events Feature**

```typescript
// src/features/events/api/eventQueries.ts

// Get public events
const { data: events } = await supabase
  .from('events.events')
  .select(`
    *,
    event_posts(
      id,
      text,
      media_urls,
      like_count
    )
  `)
  .eq('visibility', 'public');

// Using view (simpler)
const { data: events } = await supabase
  .from('events')
  .select(`
    *,
    event_posts(*)
  `)
  .eq('visibility', 'public');
```

---

### **Ticketing Feature**

```typescript
// src/features/ticketing/api/ticketQueries.ts

// Get user's tickets
const { data: tickets } = await supabase
  .from('ticketing.tickets')
  .select(`
    *,
    ticket_tiers(*),
    events(
      title,
      start_at,
      venue
    )
  `)
  .eq('owner_user_id', userId);

// Using views
const { data: tickets } = await supabase
  .from('tickets')
  .select(`
    *,
    ticket_tiers(*),
    events(*)
  `)
  .eq('owner_user_id', userId);
```

---

## 🔍 Search & Replace Patterns

### **Option: Bulk Update (Risky)**

Use these patterns to update all at once:

```bash
# Find all supabase.from calls
grep -r "supabase.from(" src/

# Replace specific patterns
find src/ -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e "s/.from('user_profiles')/.from('users.user_profiles')/g" \
  -e "s/.from('organizations')/.from('organizations.organizations')/g" \
  -e "s/.from('events')/.from('events.events')/g" \
  -e "s/.from('tickets')/.from('ticketing.tickets')/g" \
  -e "s/.from('orders')/.from('ticketing.orders')/g"
```

**⚠️ WARNING:** Test thoroughly after bulk updates!

---

## 🧪 Testing Strategy

### **1. Feature-by-Feature Testing**

```bash
# Test each feature after updating:
npm run test -- src/features/users
npm run test -- src/features/events
npm run test -- src/features/ticketing
```

### **2. Integration Testing**

```bash
# Test full flows:
npm run test:e2e
```

### **3. Manual Testing Checklist**

- [ ] User login/signup
- [ ] View user profile
- [ ] Browse events
- [ ] View event details
- [ ] Purchase tickets
- [ ] View tickets in wallet
- [ ] Org dashboard (if org member)
- [ ] Create event (if organizer)
- [ ] Analytics dashboard

---

## 📊 Migration Progress Tracker

Track which parts of the codebase are updated:

```typescript
// MIGRATION_STATUS.md

## Code Migration Status

### Features
- [ ] users - Using views
- [ ] organizations - Using views
- [ ] events - Using views
- [ ] ticketing - Using views
- [ ] sponsorship - Using views
- [ ] campaigns - Using views
- [ ] analytics - Using views
- [ ] messaging - Using views
- [ ] payments - Using views

### Components
- [ ] UserProfile
- [ ] EventCard
- [ ] TicketCard
- [ ] OrgDashboard
- [ ] EventSlugPage
- [ ] WalletPage

### API/Hooks
- [ ] useAuth
- [ ] useEvents
- [ ] useTickets
- [ ] useOrganizations

### Edge Functions
- [ ] send-email
- [ ] purchase-tickets
- [ ] create-event
```

---

## 🎯 Recommended Approach

### **Phase 1: Keep Views (Now)**
1. ✅ Database migrated with views
2. ✅ App still works via views
3. ✅ No code changes needed immediately

### **Phase 2: Update Types (This Week)**
1. Regenerate TypeScript types
2. Update type imports
3. Fix type errors

### **Phase 3: Update Queries (Next Week)**
1. Update one feature at a time
2. Test each feature
3. Update related components

### **Phase 4: Drop Views (Later)**
1. Once all code updated
2. Verify no remaining references
3. Drop views in database

---

## 🔧 Practical Next Steps

### **Let's Start with Types:**

1. **Check current types file:**
   ```bash
   wc -l src/integrations/supabase/types.ts
   ```

2. **Back it up:**
   ```bash
   cp src/integrations/supabase/types.ts src/integrations/supabase/types.backup.ts
   ```

3. **Regenerate from new schemas:**
   - Option A: Use Supabase CLI
   - Option B: Manually update (safer, we control it)

4. **Fix TypeScript errors:**
   ```bash
   npm run type-check
   ```

---

## 💡 Pro Tips

### **1. Use Search Path**
Your database already has `search_path` set, so queries without schema qualification will work:

```sql
-- This works because search_path includes 'events'
SELECT * FROM events WHERE visibility = 'public';
```

### **2. Keep Views During Transition**
Views provide zero-downtime migration:

```typescript
// Your code keeps working
supabase.from('events')  // Uses public.events view → events.events
```

### **3. Update Incrementally**
Don't try to update everything at once:

```typescript
// Week 1: Update users feature
// Week 2: Update events feature  
// Week 3: Update ticketing feature
// etc.
```

### **4. Use TypeScript for Safety**
Let TypeScript catch errors:

```typescript
// If types are updated but queries aren't, TypeScript will error
const { data } = await supabase
  .from('wrong_table')  // ❌ TypeScript error
  .select('*');
```

---

## ⚠️ Common Pitfalls

### **1. Joins Across Schemas**

```typescript
// ❌ This might break
.select('*, organizations(*)')

// ✅ Be explicit
.select(`
  *,
  organizations.organizations(*)
`)
```

### **2. RPC Functions**

```typescript
// Update RPC calls to reference new schemas internally
// Your RPC functions already reference new schemas (we updated them)

// This still works:
const { data } = await supabase.rpc('user_orgs');
```

### **3. Policies**

RLS policies are already updated to reference new schemas. No action needed! ✅

---

## 🎯 What to Do Right Now

**Option 1: Conservative (Recommended)**
- Keep using views
- Update types only
- Test everything works
- Plan gradual code updates

**Option 2: Aggressive**
- Update all queries now
- Drop views
- Fix all errors
- Test extensively

**Which approach do you prefer?** 🤔

I can help you with either approach. Let me know and I'll create the specific update scripts!

