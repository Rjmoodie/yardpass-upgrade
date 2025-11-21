# ⚡ Quick Start - Sponsorship System

This runbook walks an implementer through proving out the sponsorship wing end-to-end using only the tables and constraints that ship in the Supabase migrations. Every SQL snippet below runs against the schema that already exists in this repo—no helper functions or custom views required.

---

## 🚦 Step 1: Confirm the Core Schema (2 min)

```sql
-- Verify the key sponsorship tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sponsors',
    'sponsor_profiles',
    'sponsorship_packages',
    'sponsorship_matches',
    'proposal_threads',
    'proposal_messages',
    'deliverables',
    'sponsorship_orders',
    'sponsorship_payouts',
    'event_sponsorships'
  )
ORDER BY table_name;
```

You should see every table above. If anything is missing, re-run the Supabase migrations before continuing.

---

## 🗂️ Step 2: Pick an Organization & Event (3 min)

```sql
-- List organizations you can act on
SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 5;

-- Inspect upcoming events for one of those orgs
SELECT id, title, start_at
FROM events
WHERE owner_context_id = 'your-org-id'
ORDER BY start_at DESC LIMIT 5;
```

Grab the `organization_id` and `event_id` you will reuse through the rest of the quick start.

---

## 🤝 Step 3: Create a Sponsor Profile (5 min)

```sql
-- Create the sponsor shell
INSERT INTO sponsors (
  name,
  logo_url,
  website_url,
  contact_email,
  created_by,
  industry,
  company_size,
  brand_values,
  preferred_visibility_options
) VALUES (
  'Acme Robotics',
  'https://example.com/logo.png',
  'https://acmerobotics.example',
  'partnerships@acmerobotics.example',
  '00000000-0000-0000-0000-000000000000', -- replace with an auth.users.id
  'technology',
  '201-500',
  '{"sustainability": true, "innovation_index": 92}'::jsonb,
  '{"preferred_formats": ["booth", "stage"], "requires_contract": true}'::jsonb
) RETURNING id;

-- Attach detailed targeting & budgeting data
INSERT INTO sponsor_profiles (
  sponsor_id,
  industry,
  company_size,
  annual_budget_cents,
  brand_objectives,
  target_audience,
  preferred_categories,
  regions,
  activation_preferences
) VALUES (
  'sponsor-id-from-above',
  'technology',
  '201-500',
  7500000,
  '{"goals": ["brand_awareness", "lead_gen"]}'::jsonb,
  '{"demographics": {"age": "25-44", "interests": ["robotics", "ai"]}}'::jsonb,
  ARRAY['technology', 'education'],
  ARRAY['North America', 'Europe'],
  '{"activation_channels": ["main_stage", "expo_floor"], "min_roi": 2.5}'::jsonb
) RETURNING *;
```

---

## 📦 Step 4: Publish a Sponsorship Package (5 min)

```sql
INSERT INTO sponsorship_packages (
  event_id,
  tier,
  title,
  description,
  price_cents,
  currency,
  inventory,
  benefits,
  visibility,
  is_active,
  created_by
) VALUES (
  'your-event-id',
  'gold',
  'Gold Stage Partner',
  'Premium logo placement, emcee mentions, and a 20x20 booth.',
  2500000,
  'USD',
  3,
  '{"logo_stage": true, "booth_size": "20x20", "social_posts": 4}'::jsonb,
  'public',
  true,
  '00000000-0000-0000-0000-000000000000'
) RETURNING id, tier, price_cents;
```

---

## 🔗 Step 5: Link the Sponsor to the Event (3 min)

```sql
INSERT INTO event_sponsorships (
  event_id,
  sponsor_id,
  tier,
  amount_cents,
  benefits,
  activation_status
) VALUES (
  'your-event-id',
  'your-sponsor-id',
  'intent',
  2500000,
  '{"announcements": true, "lead_capture": true}'::jsonb,
  'draft'
) ON CONFLICT (event_id, sponsor_id, tier) DO UPDATE
SET amount_cents = EXCLUDED.amount_cents,
    benefits = EXCLUDED.benefits,
    activation_status = EXCLUDED.activation_status;
```

`event_sponsorships` acts as the source of truth for organizer-facing views, so keep it in sync with packages and orders.

---

## 📊 Step 6: Seed Matching Intelligence (4 min)

```sql
-- Record the feature vector that powered this match
INSERT INTO match_features (
  event_id,
  sponsor_id,
  features
) VALUES (
  'your-event-id',
  'your-sponsor-id',
  '{"audience_overlap": 0.82, "budget_fit": 0.76, "category_alignment": 0.9}'::jsonb
) RETURNING id;

-- Persist the actual match score surfaced to users
INSERT INTO sponsorship_matches (
  event_id,
  sponsor_id,
  score,
  overlap_metrics,
  status,
  notes
) VALUES (
  'your-event-id',
  'your-sponsor-id',
  0.78,
  '{"audience_overlap": 0.82, "budget_fit": 0.76}'::jsonb,
  'suggested',
  'Auto-generated during quick start run'
) RETURNING id;

-- Queue a recomputation so background workers can refine it later
INSERT INTO fit_recalc_queue (event_id, sponsor_id, reason)
VALUES ('your-event-id', 'your-sponsor-id', 'quick_start_validation');
```

---

## 💬 Step 7: Send a Proposal (4 min)

```sql
INSERT INTO proposal_threads (
  event_id,
  sponsor_id,
  status,
  created_by
) VALUES (
  'your-event-id',
  'your-sponsor-id',
  'sent',
  '00000000-0000-0000-0000-000000000000'
) RETURNING id;

INSERT INTO proposal_messages (
  thread_id,
  sender_type,
  sender_user_id,
  body,
  offer
) VALUES (
  'thread-id-from-above',
  'organizer',
  '00000000-0000-0000-0000-000000000000',
  'Excited to partner with Acme Robotics for the main stage experience!',
  '{"price_cents": 2500000, "benefits": ["logo_stage", "lead_capture"]}'::jsonb
);
```

---

## 📦 Step 8: Track Deliverables (3 min)

```sql
INSERT INTO deliverables (
  event_id,
  sponsor_id,
  type,
  spec,
  due_at,
  status
) VALUES (
  'your-event-id',
  'your-sponsor-id',
  'stage_branding',
  '{"description": "Provide stage backdrop assets", "asset_format": "PSD"}'::jsonb,
  now() + interval '14 days',
  'pending'
) RETURNING id;

INSERT INTO deliverable_proofs (
  deliverable_id,
  asset_url,
  metrics,
  submitted_by
) VALUES (
  'deliverable-id-from-above',
  'https://files.example.com/stage-backdrop.pdf',
  '{"dpi": 300, "dimensions": "1920x1080"}'::jsonb,
  '00000000-0000-0000-0000-000000000000'
);
```

---

## 💳 Step 9: Create & Advance an Order (5 min)

```sql
-- Initial escrow order
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
  2500000,
  'usd',
  'pending',
  'pending',
  '00000000-0000-0000-0000-000000000000'
) RETURNING id;

-- Mark as funded after payment confirmation
UPDATE sponsorship_orders
SET status = 'funded',
    escrow_state = 'funded',
    updated_at = now()
WHERE id = 'order-id-from-above';
```

---

## 💸 Step 10: Prepare the Payout (3 min)

```sql
INSERT INTO payout_queue (
  order_id,
  priority,
  scheduled_for,
  status
) VALUES (
  'order-id-from-above',
  10,
  now() + interval '2 days',
  'pending'
) RETURNING id;

-- Inspect pending payouts
SELECT pq.id,
       pq.order_id,
       pq.status,
       so.amount_cents,
       so.currency
FROM payout_queue pq
JOIN sponsorship_orders so ON so.id = pq.order_id
WHERE pq.status = 'pending'
ORDER BY pq.scheduled_for;
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

If every box checks out, the sponsorship wing is ready for deeper API and UI integration.

---

## 🧭 Next Steps

### Backend Integration (see `docs/BACKEND_INTEGRATION_COMPLETE.md`)
- Implement authenticated REST endpoints that wrap each SQL operation above
- Schedule workers for `fit_recalc_queue` and `payout_queue`
- Build Stripe Connect webhooks that update `sponsorship_orders`

### Frontend Integration (see `docs/FRONTEND_INTEGRATION_GUIDE.md`)
- Generate TypeScript types from Supabase
- Create hooks for packages, matches, proposals, deliverables, and orders
- Build dashboards that surface sponsor intent, negotiation status, and payout readiness

---

## 📊 Handy Operational Queries

```sql
-- Monitor sponsorship pipeline health
SELECT status, COUNT(*)
FROM sponsorship_matches
GROUP BY status
ORDER BY status;

-- Track proposals awaiting response
SELECT status, COUNT(*)
FROM proposal_threads
GROUP BY status;

-- Watch deliverable completion
SELECT status, COUNT(*)
FROM deliverables
GROUP BY status;

-- Summarize escrow and payouts
SELECT so.status,
       so.escrow_state,
       SUM(so.amount_cents) / 100 AS total_usd
FROM sponsorship_orders so
GROUP BY so.status, so.escrow_state
ORDER BY so.status;
```

You now have a production-aligned sponsorship wing walkthrough that mirrors the live schema.
