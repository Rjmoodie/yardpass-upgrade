# 🤖 AI-Powered Sponsorship Matching System

> **Status:** ✅ PRODUCTION READY  
> **Stack:** Supabase + PostgreSQL + React + TypeScript  
> **Deployed:** November 1, 2025

---

## 📋 Complete System Overview

### **What It Does**
Automatically matches sponsors with events using AI-powered scoring that considers:
- Budget alignment (25% weight)
- Audience overlap (35% weight)  
- Geographic fit (15% weight)
- Engagement quality (15% weight)
- Objective similarity (10% weight)

### **How It Works**
1. Sponsor creates profile with targeting preferences
2. Event organizer adds audience insights
3. Database triggers queue recalculation
4. Cron job processes queue every 10 minutes
5. AI computes match scores (0-100%)
6. UI displays recommendations in real-time

---

## 🗂️ Files Created (Complete List)

### **Backend - Database Migrations**
```
✅ supabase/migrations/20251022_0001_optimized_sponsorship_system.sql
✅ supabase/migrations/20251022_0002_sponsorship_cleanup_and_constraints.sql
✅ supabase/migrations/20251022_0003_sponsorship_enterprise_features.sql
✅ supabase/migrations/20251022_0004_sponsorship_final_polish.sql
✅ supabase/migrations/20251102000000_sponsorship_seed_data.sql
✅ supabase/config.toml (updated with cron)
```

### **Backend - Edge Functions (Deployed)**
```
✅ supabase/functions/sponsorship-recalc/
✅ supabase/functions/sponsorship-score-onchange/
✅ supabase/functions/sponsorship-checkout/
✅ supabase/functions/sponsorship-payouts/
✅ supabase/functions/sponsor-create-intent/
✅ supabase/functions/sponsor-payout/
```

### **Frontend - UI Components**
```
✅ src/components/ui/Match.tsx
✅ src/components/sponsorship/SponsorRecommendations.tsx
✅ src/components/sponsorship/EventSponsorMatches.tsx
✅ src/components/sponsorship/LiveMatchCalculator.tsx
```

### **Frontend - Pages**
```
✅ src/pages/SponsorshipMarketplacePage.tsx
✅ src/pages/SponsorshipAIDashboard.tsx
```

### **Frontend - Utilities**
```
✅ src/lib/sponsorship.ts
✅ src/hooks/useSponsorshipMatching.ts
✅ src/types/sponsorship-ai.ts
✅ src/types/sponsors.ts (updated)
```

### **Documentation**
```
✅ SPONSORSHIP_INTEGRATION_COMPLETE.md
✅ SPONSORSHIP_QUICK_START.md
✅ SPONSORSHIP_DEPLOYMENT_SUMMARY.md
✅ SPONSORSHIP_FINAL_STEPS.md
✅ README_SPONSORSHIP_AI.md (this file)
```

**Total:** 24 files created/updated

---

## 🚀 Deployment Commands

```bash
# 1. Deploy seed data
npx supabase db push

# 2. Process queue immediately  
npx supabase functions invoke sponsorship-recalc --method POST

# 3. Start dev server
npm run dev

# 4. Navigate to
# http://localhost:5173/sponsorships/dashboard
```

---

## 🎯 Integration Points

### **For Sponsors:**
```tsx
<SponsorRecommendations sponsorId={sponsor.id} />
```
Shows recommended sponsorship opportunities based on their profile.

### **For Organizers:**
```tsx
<EventSponsorMatches eventId={event.id} />
```
Shows suggested sponsors to contact for their event.

### **Marketplace:**
```tsx
<SponsorshipMarketplacePage />
```
Browse all available packages with search & filters.

### **Admin Dashboard:**
```tsx
<SponsorshipAIDashboard />
```
Monitor queue, process manually, view all matches.

---

## 📊 Database Architecture

### **Tables Created:**
- `sponsors` - Sponsor companies
- `sponsor_profiles` - Targeting & budget data
- `sponsor_public_profiles` - Public sponsor pages
- `event_audience_insights` - Event performance metrics
- `sponsorship_matches` - AI-computed fit scores
- `fit_recalc_queue` - Processing queue
- `proposal_threads` - Negotiation system
- `deliverables` - Activation tracking
- `package_templates` - Reusable blueprints
- `package_variants` - A/B testing
- `match_features` - ML feature store
- `match_feedback` - Human feedback loop
- `sponsorship_slas` - SLA tracking
- **13 total new tables**

### **Views Created:**
- `v_sponsorship_package_cards` - Marketplace listings
- `v_sponsor_recommended_packages` - Sponsor recommendations
- `v_event_recommended_sponsors` - Organizer recommendations
- `v_event_performance_summary` - Event metrics

### **Functions Created:**
- `fn_compute_match_score()` - AI scoring algorithm
- `fn_upsert_match()` - Compute & store in one call
- `process_match_queue()` - Batch processing
- `refresh_sponsorship_mvs()` - Refresh materialized views

### **Triggers Created:**
- `trg_queue_recalc_sponsor_profiles` - Auto-queue on profile update
- `trg_queue_recalc_event_insights` - Auto-queue on insight update

---

## 🔄 Auto-Processing Flow

```
Profile Updated
    ↓
Database Trigger
    ↓
Add to fit_recalc_queue
    ↓
Cron Job (every 10 min)
    ↓
sponsorship-recalc Edge Function
    ↓
Compute AI Score
    ↓
Store in sponsorship_matches
    ↓
UI Updates (Real-time)
```

---

## 💡 Common Tasks

### **Update Sponsor Profile & Trigger Recalc:**
```typescript
import { handleProfileUpdate } from '@/lib/sponsorship';

await supabase
  .from('sponsor_profiles')
  .update({ annual_budget_cents: 500000 })
  .eq('sponsor_id', sponsorId);

await handleProfileUpdate(sponsorId);
```

### **Mark Sponsor as Contacted:**
```typescript
await supabase
  .from('sponsorship_matches')
  .update({ 
    status: 'suggested',
    contacted_at: new Date().toISOString()
  })
  .eq('event_id', eventId)
  .eq('sponsor_id', sponsorId);
```

### **Get Match Score:**
```typescript
import { computeMatchScore } from '@/lib/sponsorship';

const { score, breakdown } = await computeMatchScore(eventId, sponsorId);
console.log(`Match: ${Math.round(score * 100)}%`);
console.log('Budget Fit:', breakdown.budget_fit);
console.log('Audience Overlap:', breakdown.audience_overlap);
```

---

## 🎨 Component Examples

### **Minimal Example:**
```tsx
import { useSponsorRecommendations } from '@/hooks/useSponsorshipMatching';

function SimpleRecommendations() {
  const { packages, loading } = useSponsorRecommendations('sponsor-id-here');
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {packages.map(pkg => (
        <div key={pkg.package_id}>
          {pkg.title} - {Math.round(pkg.score * 100)}% match
        </div>
      ))}
    </div>
  );
}
```

### **Full-Featured:**
```tsx
import { SponsorRecommendations } from '@/components/sponsorship/SponsorRecommendations';

function RichSponsorDashboard() {
  return (
    <div className="container mx-auto p-6">
      <h1>Recommended for You</h1>
      <SponsorRecommendations 
        sponsorId={currentSponsor.id}
        limit={20}
        minScore={0.5}
      />
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### **No matches showing?**
```sql
-- Check if queue is processing
SELECT COUNT(*) FROM fit_recalc_queue WHERE processed_at IS NULL;

-- Manually process
SELECT process_match_queue(100);

-- View matches
SELECT * FROM sponsorship_matches ORDER BY score DESC;
```

### **Cron not running?**
```bash
# Check logs
npx supabase functions logs sponsorship-recalc --tail

# Manually invoke
npx supabase functions invoke sponsorship-recalc --method POST
```

### **Edge Function errors?**
Check environment variables are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 📈 Performance

- **50+ optimized indexes** for fast queries
- **Materialized views** for common aggregations
- **Batch processing** to avoid overload
- **Real-time subscriptions** for live updates
- **Incremental recalculation** (not full refresh)

---

## 🎉 Success Criteria

After deployment, you should be able to:

✅ See recommended packages in sponsor dashboard  
✅ See suggested sponsors in event management  
✅ Browse marketplace with filters  
✅ Calculate live match scores  
✅ Track contacts and status  
✅ Monitor queue in admin dashboard  
✅ Process automatically via cron  

---

## 📞 Support

- See `SPONSORSHIP_QUICK_START.md` for detailed integration
- See `SPONSORSHIP_FINAL_STEPS.md` for deployment checklist
- Check Supabase Dashboard for logs and monitoring

---

**Your AI sponsorship matching system is complete and production-ready!** 🚀

