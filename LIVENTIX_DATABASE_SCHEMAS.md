# 🗄️ Liventix Database Schemas Overview

**All schemas used in the platform**

---

## 📊 **Core Schemas**

### **1. `events` Schema**
**Purpose:** Event management and organization

**Key Tables:**
- `events.events` - Event details (title, date, venue, etc.)
  - Fields: id, title, start_at, end_at, venue, category, cover_image_url, description, city, visibility, owner_context_type, owner_context_id, created_by

**Used For:**
- Creating and managing events
- Event discovery and search
- Linking to organizations and users

---

### **2. `ticketing` Schema**
**Purpose:** Complete ticketing and order management system

**Key Tables:**

**`ticketing.ticket_tiers`**
- Ticket types/tiers for each event
- Fields: id, event_id, name, price_cents, quantity, issued_quantity, reserved_quantity, status, sales_start, sales_end

**`ticketing.orders`**
- Purchase orders from customers
- Fields: id, event_id, user_id, status, total_cents, subtotal_cents, fees_cents, stripe_payment_intent_id, created_at

**`ticketing.order_items`**
- Line items within orders
- Fields: id, order_id, tier_id, quantity, price_cents

**`ticketing.tickets`**
- Individual tickets issued to customers
- Fields: id, order_id, event_id, tier_id, owner_user_id, status, qr_code, created_at, sequence_number

**`ticketing.ticket_holds`**
- Temporary reservations during checkout (15 min expiry)
- Fields: id, user_id, tier_id, quantity, status, expires_at, created_at

**`ticketing.refunds`**
- Refund records
- Fields: id, order_id, amount_cents, reason, status, created_at

**Key Views:**
- `ticketing.event_health` - Real-time health monitoring for all events
- `ticketing.event_readiness` - Pre-launch readiness check

**Key Functions:**
- `ticketing.complete_order_atomic()` - Atomically create tickets for paid orders
- `public.cleanup_expired_ticket_holds()` - Clean up expired holds (cron job)
- `ticketing.reconcile_issued_quantity()` - Fix counter drift
- `ticketing.reconcile_event_tickets()` - Per-event reconciliation

---

### **3. `organizations` Schema**
**Purpose:** Organization and team management

**Key Tables:**

**`organizations.organizations`**
- Organization profiles
- Fields: id, name, description, created_at

**`organizations.org_memberships`**
- User memberships in organizations
- Fields: id, org_id, user_id, role, created_at

**Used For:**
- Multi-user event management
- Organizer dashboards
- Team collaboration
- RLS policies for data access

---

### **4. `public` Schema**
**Purpose:** User profiles and authentication

**Key Tables:**

**`public.profiles`** (or similar)
- User profile information
- Fields: id, email, display_name, photo_url, role (attendee/organizer/admin)

**Used For:**
- User authentication (via Supabase Auth)
- Profile display
- Permission checking

---

### **5. `social` Schema** (if exists)
**Purpose:** Social features - posts, reactions, comments

**Key Tables:**

**`social.event_posts`** (or `public.event_posts`)
- Posts on event feeds
- Fields: id, event_id, author_user_id, text, media_urls, like_count, comment_count, created_at

**`social.event_reactions`** (or similar)
- Likes, comments on posts
- Fields: id, post_id, user_id, kind (like/comment/share)

**Used For:**
- Event feed
- User engagement
- Community building

---

### **6. `analytics` Schema** (if exists)
**Purpose:** Analytics and tracking

**Potential Tables:**
- Page views
- Scan logs
- Event metrics
- User behavior tracking

---

## 🔐 **Cross-Schema Relationships**

### **Events → Ticketing**
```sql
ticketing.ticket_tiers.event_id → events.events.id
ticketing.orders.event_id → events.events.id
ticketing.tickets.event_id → events.events.id
```

### **Events → Organizations**
```sql
events.events.owner_context_id → organizations.organizations.id
(when owner_context_type = 'organization')
```

### **Ticketing → Users**
```sql
ticketing.orders.user_id → auth.users.id
ticketing.tickets.owner_user_id → auth.users.id
```

### **Organizations → Users**
```sql
organizations.org_memberships.user_id → auth.users.id
organizations.org_memberships.org_id → organizations.organizations.id
```

---

## 📋 **RLS Policies by Schema**

### **ticketing.orders**
1. `own_orders_select` - Users see their own orders
2. `org_orders_select` - Org members see all org event orders
3. `orders_insert_own_only` - Users can create orders
4. `orders_update_service_role` - Only service role can update

### **ticketing.tickets**
Similar policies for ticket access

### **events.events**
Public visibility controls based on `visibility` field

---

## 🔍 **Today's Work Involved:**

### **Schemas Modified:**
1. ✅ `ticketing` - Added constraints, functions, views
2. ✅ `public` - Cleanup functions

### **Schemas Queried:**
1. ✅ `ticketing` - All tables
2. ✅ `events` - Event data
3. ✅ `organizations` - Org memberships
4. ✅ `public` - User profiles

---

## 📊 **Schema Statistics (Liventix Official Event)**

| Schema | Table | Record Count |
|--------|-------|--------------|
| `ticketing` | orders | 35 (11 paid, 24 pending) |
| `ticketing` | tickets | 11 |
| `ticketing` | ticket_tiers | 1 (General Admission) |
| `ticketing` | ticket_holds | 0 (after cleanup) |
| `events` | events | 1 |
| `organizations` | org_memberships | Multiple |

---

## 🎯 **Key Schema Patterns**

### **Naming Conventions:**
- Snake_case for table/column names
- Plural for table names (orders, tickets, events)
- Foreign keys: `{table}_id` (event_id, user_id)

### **Timestamps:**
- `created_at` - Record creation (TIMESTAMPTZ)
- `updated_at` - Last modification
- `deleted_at` - Soft delete marker
- `expires_at` - Expiration time (holds)

### **Status Enums:**
- `order_status`: pending, paid, cancelled, refunded
- `ticket_status`: issued, transferred, redeemed, refunded
- `ticket_tier_status`: active, inactive, sold_out
- `event_visibility`: public, unlisted, private

---

## 🔧 **Schema Management**

### **Migrations:**
Location: `supabase/migrations/`

Recent migrations today:
- `20251204000001_ticket_accounting_hardened.sql`
- `20251211_add_capacity_constraints.sql` (planned)
- `20251215_atomic_ticket_creation.sql` (planned)

### **Functions:**
Location: `supabase/functions/`

Edge Functions:
- `posts-create` - Create social posts
- `mux-create-direct-upload` - Video uploads
- `stripe-webhook` - Payment processing

---

## 📈 **Future Schema Additions**

**Planned:**
1. `analytics` schema - Detailed metrics
2. `messaging` schema - Chat/notifications
3. `campaigns` schema - Marketing campaigns
4. `sponsorship` schema - Sponsor management

---

## ✅ **Summary**

**Core Schemas:**
- `events` - Event management
- `ticketing` - Orders, tickets, tiers
- `organizations` - Orgs and teams
- `public` - Users and profiles
- `social` - Posts and engagement

**Total:** 5 main schemas actively used

**Database:** PostgreSQL via Supabase
**ORM:** None (direct Supabase client)
**Migrations:** SQL-based

