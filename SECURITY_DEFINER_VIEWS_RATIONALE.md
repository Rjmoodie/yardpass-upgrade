# SECURITY DEFINER Views - Intentional Architecture

## Overview
Supabase's database linter flags **all** `SECURITY DEFINER` views as `ERROR`-level warnings (rule `0010_security_definer_view`). However, in the Liventix architecture, these views are **intentional design choices**, not security bugs.

---

## Why We Use SECURITY DEFINER

### 1. **Fixing RLS Recursion Issues**
Views that query tables with RLS enabled can cause "infinite recursion detected in policy" errors when:
- Feed algorithms need to traverse social graphs
- Recommendation engines need to join across multiple tables
- Permission checks need to look up related data

**Solution**: Use `SECURITY DEFINER` views owned by a limited role (not superuser) to bypass RLS at the view level, while underlying tables still enforce RLS.

### 2. **Hiding Cross-Schema Complexity**
Liventix uses multiple schemas (`events`, `payments`, `sponsorship`, `analytics`) to organize domain logic. Client applications should not need to know about schema boundaries.

**Solution**: `SECURITY DEFINER` views in the `public` schema provide a clean API surface, hiding the internal schema organization.

### 3. **Powering Payments & Wallets Safely**
Financial operations (orders, tickets, refunds, payouts) require atomic operations across multiple tables with different security contexts.

**Solution**: Views with elevated privileges can safely coordinate cross-table reads while still enforcing business logic constraints.

### 4. **Heavy Analytics Logic**
Materialized views and analytics tables need to aggregate data across the entire database, bypassing per-user RLS to compute global metrics.

**Solution**: `SECURITY DEFINER` allows these views to see all data, while RLS policies on the views themselves control who can read the results.

---

## List of Intentional SECURITY DEFINER Views

### **Core Data (Events & Social)**
- `public.events` - Main event feed with cross-schema data
- `public.event_posts` - Posts with permission checks
- `public.event_comments` - Comments with RLS recursion fix
- `public.event_reactions` - Reactions with RLS recursion fix
- `public.follows` - Follow graph traversal
- `public.follow_profiles` - User profiles for followers
- `public.follow_stats` - Aggregate follower counts
- `public.following_stats` - Aggregate following counts
- `public.user_saved_posts` - Saved posts across schemas

### **Tickets & Orders (Payments)**
- `public.tickets` - Ticket availability and ownership
- `public.tickets_enhanced` - Enriched ticket data with event info
- `public.ticket_availability` - Real-time availability calculations
- `public.ticket_holds` - Temporary hold management
- `public.orders` - Order status and payment tracking
- `public.order_items` - Order line items with ticket data
- `public.invoices` - Invoice generation
- `public.refunds` - Refund processing

### **Marketplace & Discovery**
- `public.v_event_marketplace` - Public event listings
- `public.v_sponsor_marketplace` - Sponsor discovery
- `public.v_event_quality_score` - Event quality metrics
- `public.v_marketplace_analytics` - Marketplace performance

### **Recommendations & ML**
- `public.v_semantic_event_recommendations` - AI-powered event suggestions
- `public.v_semantic_sponsor_recommendations` - Sponsor matching
- `public.user_event_affinity` - User preference modeling
- `public.trending_posts` - Trending content algorithm
- `public.event_covis` - Event co-visitation analysis

### **Analytics & Reporting**
- `public.analytics_campaign_daily_mv` - Campaign performance
- `public.event_video_kpis_daily` - Video engagement metrics
- `public.mv_event_quality_scores` - Quality scoring
- `public.mv_event_reach_snapshot` - Reach analytics
- `public.mv_sponsorship_revenue` - Revenue reporting

### **Organizations & Wallets**
- `public.user_profiles` - User profile data
- `public.organizations` - Organization management
- `public.org_memberships` - Membership checks
- `public.org_wallets` - Wallet balances

### **Messaging & Notifications**
- `public.messaging_inbox` - Inbox aggregation
- (other messaging views as needed)

---

## Security Hardening (Current Standards)

All `SECURITY DEFINER` views in Liventix follow these safety rules:

1. **Limited Owner Role**: Views are owned by `app_views` or similar non-superuser role
2. **Underlying RLS**: Base tables in non-public schemas have their own RLS policies
3. **Minimal Exposure**: Views only expose fields that clients actually need
4. **Explicit Permissions**: Access is explicitly granted to `anon`, `authenticated`, or `service_role` as appropriate

Example pattern:
```sql
-- Underlying table in events schema with RLS
ALTER TABLE events.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON events.events ...;

-- Public view with SECURITY DEFINER
CREATE OR REPLACE VIEW public.events
WITH (security_invoker = false)  -- equivalent to SECURITY DEFINER
AS SELECT ... FROM events.events ...;

ALTER VIEW public.events OWNER TO app_views;  -- limited role
GRANT SELECT ON public.events TO anon, authenticated;
```

---

## What's NOT a Security Issue

❌ **Linter says**: "SECURITY DEFINER view detected"  
✅ **Reality**: Intentional design pattern

❌ **Linter says**: "ERROR-level warning"  
✅ **Reality**: Architectural choice, not a vulnerability

---

## What IS a Security Issue

🚨 If a `SECURITY DEFINER` view:
- Exposes sensitive fields that should be filtered
- Is owned by `postgres` superuser
- Bypasses RLS without proper business logic checks
- Allows writes that should be restricted

**Then**: Refactor that specific view

---

## Reducing Noise Over Time

### Option 1: Document & Accept (Current Approach)
- These warnings are expected and understood
- Focus energy on real security issues (RLS disabled, missing policies)
- Periodically review the list to ensure new views are intentional

### Option 2: Gradually Refactor (Optional)
Simple read-only views that don't need elevated privileges can be recreated as normal views:
```sql
-- Before: SECURITY DEFINER for no good reason
CREATE VIEW public.simple_lookup WITH (security_invoker = false) AS ...;

-- After: Normal invoker-rights view
CREATE VIEW public.simple_lookup AS ...;
```

This will shrink the linter noise over time, but it's a refactor project, not urgent.

---

## Summary for New Developers

> **"Why are there so many SECURITY DEFINER views?"**
>
> Because Liventix has complex permission logic across multiple schemas. These views are the **API surface** that clients interact with, while the underlying tables enforce strict RLS policies.
>
> The linter can't distinguish between "bad SECURITY DEFINER" and "good SECURITY DEFINER", so it flags everything. This document is our record of which views are intentional.

---

## Supabase Advisor Rule Mapping

| Rule Code | Description | Status |
|-----------|-------------|--------|
| `0010_security_definer_view` | SECURITY DEFINER views detected | ✅ **INTENTIONAL** - See above |
| `0013_rls_disabled_in_public` | RLS disabled on public tables | ✅ **FIXED** - See `20250105_enable_rls_internal_tables.sql` |
| `0016_materialized_view_in_api` | Materialized views exposed to API roles | ✅ **FIXED** - See `20250105_lockdown_materialized_views.sql` |

---

**Last Updated**: 2025-11-05  
**Reviewed By**: Development Team  
**Next Review**: When adding new SECURITY DEFINER views




