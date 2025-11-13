# Liventix Restructuring - Complete Documentation Index

## 📚 What Got Restructured

### ✅ **COMPLETED: Codebase (Feature-First)**
- Frontend code organized by feature domain
- Platform-aware architecture (web vs mobile)
- Design tokens & unified theme system
- Backward-compatible exports

### 🚧 **IN PROGRESS: Database (Domain Schemas)**
- 12 domain schemas planned
- 150+ tables to be reorganized
- Production-grade architecture designed

---

## 📖 Documentation Structure

### 1. **Codebase Restructuring** (Feature-First)

#### 📄 `SECTION_8_FILE_ORGANIZATION_GUIDE.md` (26 KB)
**What:** Complete guide to feature-first file organization
**When to use:** Setting up new features, understanding project structure
**Key sections:**
- Folder structure by feature
- Component organization
- Backward compatibility strategy
- Migration walkthrough

---

### 2. **Database Restructuring** (Domain Schemas)

#### 📄 `DATABASE_RESTRUCTURING_PLAN.md` (40 KB) ⭐ **PRIMARY GUIDE**
**What:** Comprehensive database migration plan with production-grade patterns
**When to use:** Planning & executing database migration
**Key sections:**
- Domain schema breakdown (ref, campaigns, events, ticketing, etc.)
- Migration strategy (ALTER TABLE SET SCHEMA)
- RLS & tenant isolation (`current_org_id()`)
- Schema-level roles & permissions
- Double-entry ledger (payments.accounts + entries)
- State machines with ENUMs + triggers
- Analytics partitioning & rollups
- Outbox pattern for webhooks
- Migration timeline (6 weeks)

**Improvements from production feedback:**
- ✅ Use `ALTER TABLE SET SCHEMA` (not create/copy/drop)
- ✅ Shared `ref` schema for reference data
- ✅ Tenant isolation with security-definer functions
- ✅ Schema-level roles with default privileges
- ✅ Double-entry ledger for payments
- ✅ State machines for escrow/tickets/proposals
- ✅ Analytics partitioning by month
- ✅ Materialized views for dashboards
- ✅ Outbox pattern for reliable webhooks
- ✅ Separate `ml` schema for embeddings
- ✅ Hash verification (not just row counts)

#### 📄 `QUICK_DB_MIGRATION_CHECKLIST.md` (6.9 KB)
**What:** Quick reference checklist for migration tasks
**When to use:** Day-to-day migration work, tracking progress
**Key sections:**
- Pre-migration setup
- Migration order by domain (1-11)
- Security checklist (RLS, policies, grants)
- Advanced features checklist
- Testing & verification
- Rollback plan
- 6-week timeline with tasks

#### 📄 `DB_SCHEMA_ARCHITECTURE.md` (24 KB)
**What:** Visual diagrams & architecture overview
**When to use:** Understanding relationships, onboarding, presentations
**Key sections:**
- Schema structure diagram (ASCII art)
- Security model (RLS hierarchy)
- Payments flow (double-entry examples)
- State machine diagrams
- Analytics architecture
- Cross-schema relationships
- Performance optimizations summary

---

### 3. **Supporting Guides**

#### 📄 `PLATFORM_DESIGN_STRUCTURE.md` (1.1 MB)
**What:** Platform-aware UI/UX design system
**When to use:** Implementing platform-specific features
**Key sections:**
- Web vs mobile feature distribution
- Capability-gated features
- Design tokens (colors, spacing, motion)
- Upsell patterns

#### 📄 `SPONSORSHIP_SYSTEM_STRUCTURE.md` (594 lines)
**What:** Sponsorship feature architecture
**When to use:** Working on sponsorship features
**Key sections:**
- Marketplace, matches, proposals, deals
- State management
- Payment flows (escrow)

#### 📄 `TICKETING_SYSTEM_STRUCTURE.md` (765 lines)
**What:** Ticketing feature architecture
**When to use:** Working on ticketing features
**Key sections:**
- Ticket tiers, orders, checkout
- Payment processing
- QR code generation

#### 📄 `SPONSORSHIP_UI_DESIGN_FILES.md` (685 lines)
**What:** UI components for sponsorship features
**When to use:** Implementing sponsorship UI
**Key sections:**
- Component specifications
- Layout templates
- Interaction patterns

---

## 🎯 Quick Navigation

### I want to...

#### **Understand the overall structure**
1. Start with `DB_SCHEMA_ARCHITECTURE.md` (visual diagrams)
2. Then read `DATABASE_RESTRUCTURING_PLAN.md` (detailed guide)

#### **Execute the migration**
1. Read `DATABASE_RESTRUCTURING_PLAN.md` (full strategy)
2. Use `QUICK_DB_MIGRATION_CHECKLIST.md` (task-by-task)
3. Reference `DB_SCHEMA_ARCHITECTURE.md` (for diagrams)

#### **Understand the codebase structure**
1. Read `SECTION_8_FILE_ORGANIZATION_GUIDE.md`
2. Reference `PLATFORM_DESIGN_STRUCTURE.md` for design patterns

#### **Work on a specific feature**
- Sponsorship → `SPONSORSHIP_SYSTEM_STRUCTURE.md` + `SPONSORSHIP_UI_DESIGN_FILES.md`
- Ticketing → `TICKETING_SYSTEM_STRUCTURE.md`
- Platform-specific → `PLATFORM_DESIGN_STRUCTURE.md`

---

## 🚀 What's Next

### Phase 1: Database Restructuring (6 weeks)
**Status:** 📋 Planned

**Week 1: Setup**
- [ ] Create schemas (ref, campaigns, events, etc.)
- [ ] Create roles (app_read, app_write)
- [ ] Create helper functions (current_org_id)
- [ ] Load reference data

**Week 2-3: Core Domains**
- [ ] Migrate users, organizations, events
- [ ] Enable RLS with tenant isolation
- [ ] Create backward-compatible views

**Week 4: Transactions**
- [ ] Migrate ticketing, sponsorship
- [ ] Implement double-entry ledger
- [ ] Add state machines

**Week 5: Supporting Domains**
- [ ] Migrate campaigns, analytics, messaging
- [ ] Set up analytics partitioning
- [ ] Create materialized views

**Week 6: Cleanup**
- [ ] Drop old tables
- [ ] Performance testing
- [ ] Update documentation

### Phase 2: API Reorganization (2 weeks)
**Status:** 🔜 Next

- [ ] Reorganize Edge Functions by domain
- [ ] Create shared utilities
- [ ] Update function imports

### Phase 3: Type Organization (1 week)
**Status:** 🔜 Future

- [ ] Split large types file
- [ ] Generate feature-specific types
- [ ] Update imports

### Phase 4: Configuration (1 week)
**Status:** 🔜 Future

- [ ] Create feature configs
- [ ] Create platform configs
- [ ] Centralize environment variables

---

## 💡 Key Design Decisions

### Database Architecture

1. **Domain Schemas** (not type-based)
   - Groups related tables together
   - Matches feature-first code structure
   - Easier permissions & caching

2. **ALTER TABLE SET SCHEMA** (not create/copy/drop)
   - Preserves everything (OIDs, indexes, RLS, grants)
   - No data copying needed
   - Much faster & safer

3. **Shared ref Schema**
   - Global reference data (countries, currencies, etc.)
   - Read-only for all
   - Cacheable & version-controlled

4. **Tenant Isolation via JWT**
   - `current_org_id()` reads JWT claim
   - Single RLS policy template
   - Enforced at database level

5. **Double-Entry Ledger**
   - Accounting-grade financial tracking
   - Books always balance
   - Easy auditing & refunds

6. **State Machines**
   - ENUMs for valid states
   - Triggers validate transitions
   - Business logic in database

7. **Analytics Partitioning**
   - Monthly partitions for time-series
   - Auto-create/drop with pg_cron
   - 10x query performance

8. **Materialized Views**
   - Pre-aggregated dashboards
   - REFRESH CONCURRENTLY (non-blocking)
   - 100x faster than raw queries

9. **Outbox Pattern**
   - Reliable webhooks
   - Written in same transaction
   - Worker processes outbox

10. **Separate ml Schema**
    - Embeddings & ML artifacts
    - Can deploy to read replicas
    - Different performance profile

### Codebase Architecture

1. **Feature-First** (not type-based)
   - Organized by business domain
   - Clear boundaries
   - Easier to maintain

2. **Platform-Aware** (not user-agent sniffing)
   - Capability-gated features
   - Upsell patterns for optimal platform
   - Better UX

3. **Design Tokens**
   - CSS variables for theming
   - Consistent across platforms
   - Easy to customize

4. **Backward Compatibility**
   - Index files export public API
   - Old imports still work
   - Gradual migration

---

## 📊 Metrics & Goals

### Database Migration

**Before:**
- ❌ 150+ tables in `public` schema
- ❌ No domain boundaries
- ❌ Hard to manage permissions
- ❌ Poor query performance (no partitioning)
- ❌ Wallet transactions (log-style, not accounting)

**After:**
- ✅ 12 domain schemas
- ✅ Clear boundaries (matches code)
- ✅ Schema-level permissions
- ✅ 10x query performance (partitions + MVs)
- ✅ Double-entry ledger (books balance)
- ✅ State machines (invalid transitions rejected)
- ✅ Tenant isolation (RLS with JWT)
- ✅ Outbox pattern (reliable webhooks)

**Performance Goals:**
- 10x faster analytics queries (partitioning)
- 100x faster dashboards (materialized views)
- < 100ms query time for common dashboards
- Zero downtime migration

**Security Goals:**
- 100% tenant isolation (no cross-tenant leaks)
- All multi-tenant tables have RLS
- State machines prevent invalid flows
- Audit trail for all financial transactions

### Codebase Organization

**Before:**
- ❌ Type-based organization (`components/`, `hooks/`, `lib/`)
- ❌ 5000-line types file
- ❌ Hard to find related code

**After:**
- ✅ Feature-based organization (`features/feed/`, `features/ticketing/`)
- ✅ Feature-specific types
- ✅ Clear boundaries & public APIs
- ✅ Backward compatible (old imports work)

---

## 🔗 Related Resources

### External Documentation
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [pg_cron Extension](https://github.com/citusdata/pg_cron)
- [Double-Entry Accounting](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)

### Internal Docs (in repo)
- `/docs/api/` - API documentation
- `/docs/architecture/` - Architecture decisions
- `/docs/guides/` - Developer guides

---

## ✅ Completion Checklist

### Documentation
- [x] Database restructuring plan
- [x] Quick migration checklist
- [x] Schema architecture diagrams
- [x] File organization guide
- [x] This index document

### Codebase
- [x] Feature-first structure implemented
- [x] Backward-compatible exports
- [x] Design tokens applied
- [x] Platform-aware components

### Database
- [ ] Schemas created
- [ ] Tables migrated
- [ ] RLS policies applied
- [ ] Double-entry ledger implemented
- [ ] State machines added
- [ ] Analytics partitioned
- [ ] Materialized views created
- [ ] Outbox pattern implemented
- [ ] Performance tested
- [ ] Old tables dropped

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks met
- [ ] Security audit complete

---

## 📞 Support

**Questions about the migration?**
- Check the relevant guide first (see Quick Navigation above)
- Look for similar patterns in the codebase
- Refer to the state machine diagrams for valid transitions

**Found an issue?**
- Document the issue with reproduction steps
- Check if it's a schema-level or data-level problem
- Verify RLS policies are correct
- Check logs for database errors

**Need to rollback?**
- Follow rollback plan in `DATABASE_RESTRUCTURING_PLAN.md`
- Restore from most recent backup
- Drop new schemas
- Restart app with previous code

---

**This restructuring sets Liventix up for production-grade performance, security, and maintainability!** 🚀

