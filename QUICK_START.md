# ⚡ Quick Start - Sponsorship System

## 🚀 Get Running in 30 Minutes

### Step 1: Verify Deployment (2 min)

```sql
-- Run in Supabase SQL Editor
SELECT * FROM validate_sponsorship_data();
```

✅ All checks should return `PASS`

### Step 2: Create Your First Package (5 min)

```sql
-- 1. Get an event ID
SELECT id, title FROM events LIMIT 5;

-- 2. Create a package
INSERT INTO sponsorship_packages (
  event_id,
  tier,
  title,
  description,
  price_cents,
  inventory,
  benefits
) VALUES (
  'your-event-id',
  'gold',
  'Gold Sponsor',
  'Premier sponsorship with maximum visibility',
  250000,  -- $2,500
  5,
  '{"logo_placement": true, "booth": "10x10", "social_posts": 5}'::jsonb
) RETURNING *;

-- 3. Publish it
UPDATE sponsorship_packages 
SET is_active = true 
WHERE id = 'package-id-from-above';
```

### Step 3: View in Marketplace (1 min)

```sql
-- See your package with all metrics
SELECT * FROM v_sponsorship_package_cards 
WHERE package_id = 'your-package-id';
```

### Step 4: Create a Sponsor (5 min)

```sql
-- 1. Create sponsor entity
INSERT INTO sponsors (
  name,
  logo_url,
  website_url,
  created_by
) VALUES (
  'Acme Corporation',
  'https://example.com/logo.png',
  'https://acme.com',
  auth.uid()
) RETURNING *;

-- 2. Create sponsor profile
INSERT INTO sponsor_profiles (
  sponsor_id,
  industry,
  annual_budget_cents,
  preferred_categories,
  regions,
  brand_objectives
) VALUES (
  'sponsor-id-from-above',
  'technology',
  500000,  -- $5,000 annual budget
  ARRAY['technology', 'business'],
  ARRAY['North America', 'Europe'],
  '{"goals": ["brand awareness", "lead generation"]}'::jsonb
) RETURNING *;
```

### Step 5: Compute Match Score (2 min)

```sql
-- Get match score between your event and sponsor
SELECT * FROM fn_compute_match_score(
  'your-event-id'::uuid,
  'your-sponsor-id'::uuid
);
```

Expected output:
```json
{
  "score": 0.7234,
  "breakdown": {
    "budget_fit": 0.850,
    "audience_overlap": {...},
    "engagement_quality": 0.720,
    ...
  }
}
```

### Step 6: View Recommendations (1 min)

```sql
-- See recommended packages for the sponsor
SELECT * FROM v_sponsor_recommended_packages
WHERE sponsor_id = 'your-sponsor-id'
ORDER BY score DESC
LIMIT 10;

-- See recommended sponsors for the event
SELECT * FROM v_event_recommended_sponsors
WHERE event_id = 'your-event-id'
ORDER BY score DESC
LIMIT 10;
```

### Step 7: Create a Proposal (5 min)

```sql
-- 1. Create proposal thread
INSERT INTO proposal_threads (
  event_id,
  sponsor_id,
  status,
  created_by
) VALUES (
  'your-event-id',
  'your-sponsor-id',
  'draft',
  auth.uid()
) RETURNING *;

-- 2. Add initial message
INSERT INTO proposal_messages (
  thread_id,
  sender_type,
  sender_user_id,
  body,
  offer
) VALUES (
  'thread-id-from-above',
  'organizer',  -- or 'sponsor'
  auth.uid(),
  'We would love to have you sponsor our event!',
  '{"price_cents": 250000, "benefits": {"logo_stage": true}}'::jsonb
);

-- 3. Send proposal
UPDATE proposal_threads 
SET status = 'sent' 
WHERE id = 'thread-id';
```

### Step 8: Test Order Creation (5 min)

```sql
-- Create sponsorship order
INSERT INTO sponsorship_orders (
  package_id,
  sponsor_id,
  event_id,
  amount_cents,
  currency,
  status,
  escrow_state,
  created_by_user_id
) VALUES (
  'your-package-id',
  'your-sponsor-id',
  'your-event-id',
  250000,
  'USD',
  'pending',
  'pending',
  auth.uid()
) RETURNING *;
```

### Step 9: Process Match Queue (2 min)

```sql
-- Manually process any pending matches
SELECT process_match_queue(100);

-- Check queue health
SELECT * FROM check_recalc_queue_health();
```

### Step 10: Refresh Analytics (2 min)

```sql
-- Refresh materialized views
SELECT refresh_sponsorship_mvs(true);

-- Check refresh log
SELECT * FROM mv_refresh_log ORDER BY ran_at DESC LIMIT 5;
```

---

## 🛠 Sponsorship Wing Activation (15 min)

Follow this checklist once the core workflow above is green to light up the new sponsorship wing modules end-to-end.

### Configure Sponsor Workspace (5 min)

```sql
-- Create workspace container
INSERT INTO sponsorship_workspaces (organization_id, name, slug, created_by)
VALUES (
  'your-org-id',
  'Premium Sponsors',
  'premium-sponsors',
  auth.uid()
) RETURNING *;

-- Seed workspace roles
INSERT INTO sponsorship_workspace_members (workspace_id, user_id, role)
VALUES
  ('workspace-id', auth.uid(), 'owner'),
  ('workspace-id', 'sponsor-manager-user-id', 'manager');
```

### Register Marketplace Widgets (5 min)

```sql
-- Connect packages to wing dashboards
INSERT INTO sponsorship_widget_registry (
  workspace_id,
  package_id,
  widget_type,
  config
)
SELECT
  'workspace-id',
  id,
  'marketplace_card',
  jsonb_build_object('highlight', tier, 'cta', 'Request Proposal')
FROM sponsorship_packages
WHERE event_id = 'your-event-id';

-- Verify widgets resolve
SELECT *
FROM v_sponsorship_workspace_widgets
WHERE workspace_id = 'workspace-id';
```

### Enable Sponsor Command Center (5 min)

```sql
-- Start telemetry stream for sponsorship wing dashboards
SELECT enable_sponsorship_command_center(
  workspace_id := 'workspace-id',
  capture_rollups := true,
  notify_slack_webhook := 'https://hooks.slack.com/services/...'
);

-- Check live metrics feed
SELECT * FROM sponsorship_command_center_feed
WHERE workspace_id = 'workspace-id'
ORDER BY collected_at DESC
LIMIT 20;
```

---

## ✅ Verification Checklist

After completing the quick start, verify:

- [ ] Package appears in `v_sponsorship_package_cards`
- [ ] Sponsor profile exists with targeting data
- [ ] Match score computed and stored in `sponsorship_matches`
- [ ] Recommendations appear in views
- [ ] Proposal thread created with messages
- [ ] Order created with correct status
- [ ] Queue processing works
- [ ] Materialized views refresh successfully
- [ ] Sponsorship workspace online with members
- [ ] Widgets render in `v_sponsorship_workspace_widgets`
- [ ] Command center feed streaming latest metrics

---

## 🎯 Next Steps

### Backend Integration (1-2 days)
1. Implement REST API endpoints (see `docs/BACKEND_INTEGRATION_COMPLETE.md`)
2. Set up Stripe Connect integration
3. Configure webhooks
4. Deploy Edge Functions
5. Set up cron jobs

### Frontend Integration (3-5 days)
1. Generate TypeScript types
2. Create React hooks (see `docs/FRONTEND_INTEGRATION_GUIDE.md`)
3. Build UI components
4. Implement pages
5. Add real-time subscriptions

### Launch Preparation (1 week)
1. Test all workflows end-to-end
2. Load test with realistic data
3. Set up monitoring and alerts
4. Train support team
5. Create user documentation
6. Soft launch with beta users

---

## 🔧 Development Commands

```bash
# Generate types
npx supabase gen types typescript --project-id your-project > src/types/database.types.ts

# Deploy Edge Functions
npx supabase functions deploy sponsorship-recalc
npx supabase functions deploy rollup-event-stats
npx supabase functions deploy reconcile-payments

# Check migration status
npx supabase migration list

# Run local development
npm run dev
```

---

## 📚 Learn More

- **Complete System Overview**: `SYSTEM_COMPLETE.md`
- **Backend API Guide**: `docs/BACKEND_INTEGRATION_COMPLETE.md`
- **Frontend Guide**: `docs/FRONTEND_INTEGRATION_GUIDE.md`
- **All Documentation**: `MASTER_INDEX.md`

---

## 💡 Pro Tips

1. **Start Simple**: Create 1-2 test packages and sponsors first
2. **Use Views**: Query `v_*` views instead of joining tables manually
3. **Monitor Queues**: Keep `fit_recalc_queue` under 1000 items
4. **Refresh MVs**: Run `refresh_sponsorship_mvs(true)` after bulk data changes
5. **Test Locally**: Use Supabase local development for testing

---

**You're ready to build! 🎉**

Start with Step 1 above and work through each step to see your sponsorship system in action.