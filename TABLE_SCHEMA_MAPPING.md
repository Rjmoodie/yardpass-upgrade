# 📊 Table to Schema Mapping

## All Tables Found in Codebase → New Schema Location

Based on codebase scan and database structure:

### **Users Schema (users.*)**
```
user_profiles → users.user_profiles ✅
user-avatars → users.user-avatars ✅ (storage bucket)
user_search → users.user_search ✅
user_event_interactions → users.user_event_interactions ✅
follows → users.follows ✅
follow_profiles → users.follow_profiles ✅
```

### **Organizations Schema (organizations.*)**
```
organizations → organizations.organizations ✅
org_memberships → organizations.org_memberships ✅
org_invitations → organizations.org_invitations ✅
org_contact_imports → organizations.org_contact_imports ✅
org_contact_import_entries → organizations.org_contact_import_entries ✅
org-logos → organizations.org-logos ✅ (storage bucket)
org-media → organizations.org-media ✅ (storage bucket)
role_invites → organizations.role_invites ✅
```

### **Events Schema (events.*)**
```
events → events.events ✅
event_posts → events.event_posts ✅
event_posts_with_meta → events.event_posts_with_meta ✅ (view/table)
event_comments → events.event_comments ✅
event_comment_reactions → events.event_comment_reactions ✅
event_reactions → events.event_reactions ✅
event_roles → events.event_roles ✅
event_invites → events.event_invites ✅
event_sponsorships → events.event_sponsorships ✅
event-media → events.event-media ✅ (storage bucket)
event-assets → events.event-assets ✅ (storage bucket)
event_video_counters → events.event_video_counters ✅
```

### **Ticketing Schema (ticketing.*)**
```
tickets → ticketing.tickets ✅
ticket_tiers → ticketing.ticket_tiers ✅
orders → ticketing.orders ✅
refunds → ticketing.refunds ✅
scan_logs → ticketing.scan_logs ✅
guest_codes → ticketing.guest_codes ✅
```

### **Sponsorship Schema (sponsorship.*)**
```
sponsors → sponsorship.sponsors ✅
sponsor_profiles → sponsorship.sponsor_profiles ✅
sponsor_members → sponsorship.sponsor_members ✅
sponsorship_packages → sponsorship.sponsorship_packages ✅
sponsorship_orders → sponsorship.sponsorship_orders ✅
sponsorship_matches → sponsorship.sponsorship_matches ✅
proposal_threads → sponsorship.proposal_threads ✅
proposal_messages → sponsorship.proposal_messages ✅
deliverables → sponsorship.deliverables ✅
deliverable_proofs → sponsorship.deliverable_proofs ✅
v_sponsorship_package_cards → sponsorship.v_sponsorship_package_cards ✅ (view)
```

### **Analytics Schema (analytics.*)**
```
analytics_events → analytics.analytics_events ✅
event_impressions → analytics.event_impressions ✅
post_impressions → analytics.post_impressions ✅
post_views → analytics.post_views ✅
```

### **Messaging Schema (messaging.*)**
```
notifications → messaging.notifications ✅
direct_conversations → messaging.direct_conversations ✅
direct_messages → messaging.direct_messages ✅
conversation_participants → messaging.conversation_participants ✅
message_jobs → messaging.message_jobs ✅
message_job_recipients → messaging.message_job_recipients ✅
```

### **Payments Schema (payments.*)**
```
org_wallets → payments.org_wallets ✅
org_wallet_transactions → payments.org_wallet_transactions ✅
payout_accounts → payments.payout_accounts ✅
```

### **Reference Schema (ref.*)**
```
cultural_guides → ref.cultural_guides ✅
```

### **Public Schema (public.*)** - System Tables
```
reports → public.reports ✅ (stays in public)
information_schema.tables → information_schema.tables ✅ (PostgreSQL system)
```

---

## 📋 Summary

**Total Tables Found:** 57
**Tables with Views:** ~40 (backward compatible)
**Storage Buckets:** 6 (no changes needed)
**System Tables:** 2 (no changes needed)

---

## ✅ Update Strategy

### **Phase 1: Core Features (Today)**
Update most frequently used tables:
1. `user_profiles` (38 uses)
2. `events` (44 uses)
3. `organizations` (17 uses)
4. `org_memberships` (17 uses)
5. `tickets` (23 uses)

### **Phase 2: Secondary Features (This Week)**
6. `event_posts` (10 uses)
7. `sponsorship_*` tables
8. `follows` (17 uses)
9. `notifications` (5 uses)

### **Phase 3: Low-Priority (Later)**
10. Analytics tables
11. Messaging tables
12. Less-used features

---

## 🚀 Automated Update Script

We'll use sed to batch update the most common queries:

```bash
# Update user schema references
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/.from('user_profiles')/.from('users.user_profiles')/g" \
  -e "s/.from('follows')/.from('users.follows')/g" \
  {} +

# Update organization schema references  
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/.from('organizations')/.from('organizations.organizations')/g" \
  -e "s/.from('org_memberships')/.from('organizations.org_memberships')/g" \
  {} +

# Update events schema references
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/.from('events')/.from('events.events')/g" \
  -e "s/.from('event_posts')/.from('events.event_posts')/g" \
  {} +

# Update ticketing schema references
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/.from('tickets')/.from('ticketing.tickets')/g" \
  -e "s/.from('ticket_tiers')/.from('ticketing.ticket_tiers')/g" \
  -e "s/.from('orders')/.from('ticketing.orders')/g" \
  {} +
```

---

## ⚠️ Important Notes

1. **Storage buckets** (e.g., `user-avatars`, `org-logos`) don't need schema prefixes
2. **Views exist** for all main tables, so code works now without changes
3. **Test after each phase** to ensure nothing breaks
4. **TypeScript will help** - if types are updated, TS will catch errors

