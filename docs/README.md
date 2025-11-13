# Liventix Documentation

Welcome to the Liventix documentation hub. This folder contains comprehensive guides for all major features and systems.

## 📚 Documentation Index

### Sponsorship Intelligence Platform
A data-driven sponsorship matching system that connects event organizers with sponsors using behavioral analytics and AI-powered recommendations.

- **[System Overview](./SPONSORSHIP_SYSTEM.md)** - Architecture, data flow, and scoring algorithm
- **[Deployment Guide](./SPONSORSHIP_DEPLOYMENT.md)** - Step-by-step deployment instructions
- **[SQL Recipes](./SPONSORSHIP_SQL_RECIPES.md)** - Common queries and operations cookbook
- **[Phase 1 Summary](./SPONSORSHIP_PHASE1_SUMMARY.md)** - Implementation checklist and success criteria

**Quick Start:**
```bash
# 1. Apply migrations
npx supabase db push

# 2. Deploy functions
npx supabase functions deploy sponsorship-recalc
npx supabase functions deploy sponsorship-score-onchange

# 3. Verify
curl POST https://your-project.supabase.co/functions/v1/sponsorship-recalc \
  -H "Authorization: Bearer YOUR_KEY"
```

---

## 🗂️ Project Structure

```
liventix-upgrade/
├── docs/                          # Documentation (you are here)
│   ├── README.md                  # This file
│   ├── SPONSORSHIP_*.md           # Sponsorship system docs
│   └── ...                        # Other feature docs
├── src/
│   ├── types/
│   │   └── db-sponsorship.ts      # TypeScript types
│   ├── components/                # UI components
│   ├── hooks/                     # React hooks
│   └── ...
├── supabase/
│   ├── migrations/                # Database migrations
│   │   ├── 20251021_0001_sponsorship_foundation.sql
│   │   ├── 20251021_0002_sponsorship_views.sql
│   │   └── ...
│   └── functions/                 # Edge functions
│       ├── sponsorship-recalc/
│       ├── sponsorship-score-onchange/
│       └── ...
└── ...
```

---

## 🚀 Core Features

### 1. Event Management
- Create and manage events
- Ticket tiers and inventory management
- QR code scanning for entry
- Real-time analytics

### 2. Social Feed
- TikTok-style vertical video feed
- User posts and event content
- Engagement tracking (likes, comments, shares)
- HLS video streaming

### 3. Sponsorship Platform ⭐ NEW
- AI-powered sponsor-event matching
- Data-driven package recommendations
- ROI tracking and deliverables management
- Stripe Connect escrow for payments

### 4. Advertising System
- Campaign management
- Ad impressions and click tracking
- Wallet-based billing
- Multiple ad placements (feed, search, event pages)

### 5. Messaging & Notifications
- Direct conversations (user-to-user, user-to-org)
- Real-time notifications
- Event communications (email/SMS campaigns)
- Push notifications

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **Radix UI** for accessible components
- **TanStack Query** for data fetching
- **Capacitor** for mobile apps

### Backend
- **Supabase** (PostgreSQL + Edge Functions)
- **Deno** runtime for edge functions
- **Stripe** for payments
- **Mux** for video hosting
- **pg_cron** for scheduled jobs

### Infrastructure
- **GitHub Actions** for CI/CD
- **Cloudflare** for CDN
- **Railway** for cron jobs (optional)

---

## 📖 Key Concepts

### Sponsorship Matching
The system uses a weighted scoring algorithm to match sponsors with events:

```
score = 0.25 × budget_fit
      + 0.35 × audience_overlap
      + 0.15 × geo_fit
      + 0.15 × engagement_quality
      + 0.10 × objectives_similarity
```

Each match includes explainability metrics so organizers and sponsors understand *why* they're a good fit.

### Event Insights
Real-time aggregation of:
- Attendee demographics
- Engagement metrics (dwell time, video completion)
- Conversion rates (views → ticket purchases)
- Social sentiment and mentions

### Incremental Updates
When sponsor profiles or event data change, the system:
1. Queues affected pairs in `fit_recalc_queue`
2. Worker processes queue every 5 minutes
3. Updates match scores in `sponsorship_matches`
4. Views reflect new data immediately

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### SQL Testing
```bash
# Test specific migration
psql $TEST_DATABASE_URL -f supabase/migrations/FILE.sql

# Run test queries
psql $TEST_DATABASE_URL -f tests/sql/sponsorship_tests.sql
```

---

## 📊 Monitoring

### Key Metrics

**Sponsorship Platform:**
- Match scores (avg, distribution)
- Conversion funnel (viewed → contacted → accepted)
- Queue health (pending count, processing time)
- Revenue (GMV, platform fees)

**Event Platform:**
- Ticket sales (per event, per tier)
- Video engagement (views, completions, dwell time)
- User growth (signups, retention)
- Content quality (posts per event, engagement rates)

### Dashboards

Access monitoring dashboards at:
- Supabase: `https://app.supabase.com/project/YOUR_PROJECT/database`
- Stripe: `https://dashboard.stripe.com`
- Mux: `https://dashboard.mux.com`

### Alerts

Set up alerts for:
- Queue backup (> 10,000 pending items)
- Low match scores (avg < 0.3)
- Payment failures
- Edge function errors

---

## 🐛 Troubleshooting

### Common Issues

**1. Queue not processing**
```sql
-- Check cron job
SELECT * FROM cron.job WHERE jobname = 'sponsorship-recalc';

-- Manually trigger
SELECT net.http_post(
  url:='https://your-project.supabase.co/functions/v1/sponsorship-recalc',
  headers:='{"Authorization": "Bearer KEY"}'::jsonb
);
```

**2. Low match scores**
```sql
-- Check if data exists
SELECT COUNT(*) FROM sponsor_profiles;
SELECT COUNT(*) FROM event_audience_insights;
SELECT COUNT(*) FROM sponsorship_matches;

-- Inspect overlap metrics
SELECT overlap_metrics FROM sponsorship_matches LIMIT 5;
```

**3. Slow queries**
```sql
-- Analyze query
EXPLAIN ANALYZE SELECT * FROM v_sponsor_recommendations WHERE event_id = '...';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
```

---

## 🤝 Contributing

### Getting Started
1. Clone the repository
2. Install dependencies: `npm install`
3. Start local Supabase: `npx supabase start`
4. Run dev server: `npm run dev`

### Development Workflow
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "feat: add new feature"`
3. Push and create PR: `git push origin feature/my-feature`
4. Wait for CI checks to pass
5. Request review from maintainers

### Code Standards
- **TypeScript** strict mode
- **ESLint** for linting
- **Prettier** for formatting
- **Conventional Commits** for commit messages
- **SQL** 2-space indentation

### Documentation Standards
- Update docs when adding features
- Include code examples
- Add SQL recipes for new queries
- Update types when schema changes

---

## 📜 License

Proprietary - Liventix Inc. All rights reserved.

---

## 📞 Support

### Resources
- **Documentation:** This folder
- **GitHub Issues:** [liventix-upgrade/issues](https://github.com/liventix/liventix-upgrade/issues)
- **Email:** dev@liventix.com
- **Slack:** #engineering

### Office Hours
- Mondays 2-3 PM EST (Backend/Database)
- Wednesdays 10-11 AM EST (Frontend/Mobile)
- Fridays 3-4 PM EST (DevOps/Deployment)

---

**Last Updated:** October 21, 2025

**Documentation Version:** 1.0.0

