# 🚀 Liventix Database Migration - Quick Checklist

> **Goal:** Transform 150+ tables in `public` schema into 12 domain-specific schemas

---

## ✅ Pre-Migration Setup

- [ ] **Create schemas**
  ```sql
  CREATE SCHEMA ref, campaigns, events, ticketing, sponsorship, analytics, messaging, organizations, users, payments, ml;
  ```

- [ ] **Create roles**
  ```sql
  CREATE ROLE app_read NOLOGIN;
  CREATE ROLE app_write NOLOGIN;
  GRANT app_read TO authenticated, anon;
  GRANT app_write TO service_role;
  ```

- [ ] **Create helper functions**
  ```sql
  CREATE FUNCTION public.current_org_id() ... -- For RLS
  CREATE TABLE public.outbox (...);           -- For webhooks
  ```

- [ ] **Load reference data**
  ```sql
  INSERT INTO ref.countries VALUES ...
  INSERT INTO ref.currencies VALUES ...
  ```

---

## 📊 Migration Order (By Domain)

### 1️⃣ **ref** (Reference Data)
- [ ] Create `ref.countries`, `ref.currencies`, `ref.industries`, etc.
- [ ] Load static data
- [ ] Grant SELECT to all roles

### 2️⃣ **users** (User Profiles)
- [ ] `ALTER TABLE public.user_profiles SET SCHEMA users;`
- [ ] `ALTER TABLE public.follows SET SCHEMA users;`
- [ ] Move to `ml.user_embeddings`
- [ ] Create view: `public.user_profiles`

### 3️⃣ **organizations** (Orgs & Memberships)
- [ ] Move `organizations.*`, `org_memberships.*`, `org_wallets.*`
- [ ] Enable RLS with `current_org_id()`
- [ ] Create backward-compatible views

### 4️⃣ **events** (Events & Posts)
- [ ] Move `events.*`, `event_posts.*`, `event_comments.*`
- [ ] Enable RLS (public events + tenant isolation)
- [ ] Create views

### 5️⃣ **ticketing** (Tickets & Orders)
- [ ] Move `tickets.*`, `orders.*`, `ticket_tiers.*`
- [ ] Enable RLS (owner can see their tickets)
- [ ] Add `organization_id` for tenant isolation
- [ ] Create views

### 6️⃣ **sponsorship** (Sponsors & Packages)
- [ ] Move `sponsors.*`, `sponsorship_packages.*`, `sponsorship_orders.*`
- [ ] Enable RLS with tenant isolation
- [ ] Add state machine for escrow
- [ ] Create views

### 7️⃣ **campaigns** (Ad Campaigns)
- [ ] Move `campaigns.*`, `ad_creatives.*`, `ad_impressions.*`
- [ ] Enable RLS
- [ ] Add state machine for campaign status
- [ ] Create views

### 8️⃣ **payments** (Double-Entry Ledger)
- [ ] Create `payments.accounts` and `payments.entries`
- [ ] Migrate from `wallets` and `wallet_transactions`
- [ ] Create migration script for existing data
- [ ] Verify books balance: `SUM(amount_cents) = 0`

### 9️⃣ **analytics** (Impressions & Views)
- [ ] Create partitioned `analytics.event_impressions` (by month)
- [ ] Move existing data to partitions
- [ ] Create monthly partitions (pg_cron)
- [ ] Add retention policy (drop old partitions)
- [ ] Create materialized views for dashboards

### 🔟 **messaging** (Messages & Notifications)
- [ ] Move `notifications.*`, `message_jobs.*`, `direct_messages.*`
- [ ] Enable RLS
- [ ] Create views

### 1️⃣1️⃣ **ml** (Machine Learning)
- [ ] Create `ml.event_embeddings`, `ml.sponsor_embeddings`
- [ ] Move embeddings from other schemas
- [ ] Set up vector indexes (pgvector)

---

## 🔒 Security (After Each Domain)

- [ ] **Enable RLS**
  ```sql
  ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;
  ```

- [ ] **Create tenant isolation policy**
  ```sql
  CREATE POLICY tenant_isolation ON <schema>.<table>
    FOR ALL USING (organization_id = public.current_org_id());
  ```

- [ ] **Grant schema-level permissions**
  ```sql
  GRANT USAGE ON SCHEMA <schema> TO app_read, app_write;
  GRANT SELECT ON ALL TABLES IN SCHEMA <schema> TO app_read;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA <schema> TO app_write;
  ```

- [ ] **Set default privileges**
  ```sql
  ALTER DEFAULT PRIVILEGES IN SCHEMA <schema>
    GRANT SELECT ON TABLES TO app_read;
  ```

---

## ⚙️ Advanced Features

- [ ] **State Machines**
  - [ ] `sponsorship.escrow_state` (pending → funded → locked → released)
  - [ ] `ticketing.ticket_status` (issued → redeemed)
  - [ ] `sponsorship.proposal_status` (draft → sent → accepted)
  - [ ] Add triggers to validate transitions

- [ ] **Analytics Partitioning**
  - [ ] Partition `analytics.event_impressions` by month
  - [ ] Partition `analytics.ticket_analytics` by month
  - [ ] Create auto-partition script (pg_cron)
  - [ ] Create retention policy (drop old partitions)

- [ ] **Materialized Views**
  - [ ] `analytics.mv_event_daily_stats`
  - [ ] `analytics.mv_sponsor_performance`
  - [ ] Set up CONCURRENTLY refresh (hourly)

- [ ] **Outbox Pattern**
  - [ ] Update application code to write to `public.outbox`
  - [ ] Create worker to process outbox
  - [ ] Test webhook reliability

---

## 🧪 Testing & Verification

### Data Integrity
- [ ] **Row counts match**
  ```sql
  SELECT COUNT(*) FROM public.campaigns;
  SELECT COUNT(*) FROM campaigns.campaigns;
  ```

- [ ] **Hash verification**
  ```sql
  SELECT md5(string_agg(id::text || '|' || status, ',' ORDER BY id))
  FROM campaigns.campaigns;
  ```

- [ ] **Foreign keys valid**
  ```sql
  SELECT * FROM campaigns.ad_creatives c
  LEFT JOIN campaigns.campaigns p ON c.campaign_id = p.id
  WHERE p.id IS NULL;  -- Should return 0 rows
  ```

- [ ] **Books balance (payments)**
  ```sql
  SELECT SUM(amount_cents) FROM payments.entries;  -- Must = 0
  ```

### Performance
- [ ] Query performance (before/after)
- [ ] Index usage (`EXPLAIN ANALYZE`)
- [ ] Connection pool stability

### Application
- [ ] Run full test suite
- [ ] Test all API endpoints
- [ ] Test UI flows
- [ ] Test RLS policies (as different users)

---

## 🔄 Rollback Plan

If something goes wrong:

1. **Stop application writes**
2. **Restore from backup**
   ```bash
   pg_restore liventix_backup.sql
   ```
3. **Drop new schemas**
   ```sql
   DROP SCHEMA campaigns CASCADE;
   DROP SCHEMA events CASCADE;
   -- ... etc
   ```
4. **Restart application with old code**

---

## 📅 Timeline (6 Weeks)

| Week | Domain | Tasks |
|------|--------|-------|
| **1** | Setup | Create schemas, roles, functions, ref data |
| **2** | Core | users, organizations, events |
| **3** | Transactions | ticketing, sponsorship |
| **4** | Marketing | campaigns, analytics partitioning |
| **5** | Supporting | payments (double-entry), messaging, ml |
| **6** | Cleanup | Drop old tables, update docs, performance testing |

---

## 🎯 Success Metrics

✅ **All 150+ tables** moved to domain schemas
✅ **RLS enabled** on all multi-tenant tables
✅ **Double-entry ledger** for payments (books balance)
✅ **State machines** enforce valid transitions
✅ **Analytics partitioned** by month
✅ **Materialized views** for dashboards
✅ **Outbox pattern** for webhooks
✅ **Zero downtime** migration
✅ **10x query performance** improvement
✅ **100% backward compatible** (views)

---

## 📚 Reference Documents

- **Full Guide:** `DATABASE_RESTRUCTURING_PLAN.md`
- **Code Structure:** `SECTION_8_FILE_ORGANIZATION_GUIDE.md`
- **Platform Design:** `PLATFORM_DESIGN_STRUCTURE.md`

---

**Ready to build a production-grade, enterprise-level database!** 💪

