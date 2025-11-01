# 🚀 Sponsorship AI Matching - Quick Start Guide

## ✅ What Was Created

### **Backend (Database)**
- ✅ 5 migrations deployed successfully
- ✅ 6 Edge Functions deployed
- ✅ Cron job configured (every 10 minutes)
- ✅ Database triggers for auto-queueing
- ✅ Views, functions, and indexes optimized

### **Frontend (Components)**
Created in `src/`:

#### **UI Components**
- ✅ `components/ui/Match.tsx` - Match score displays & utilities
- ✅ `components/sponsorship/SponsorRecommendations.tsx` - Sponsor dashboard
- ✅ `components/sponsorship/EventSponsorMatches.tsx` - Organizer dashboard
- ✅ `components/sponsorship/LiveMatchCalculator.tsx` - On-demand scoring

#### **Pages**
- ✅ `pages/SponsorshipMarketplacePage.tsx` - Marketplace browser
- ✅ `pages/SponsorshipAIDashboard.tsx` - Admin/overview dashboard

#### **Utilities**
- ✅ `lib/sponsorship.ts` - Core functions
- ✅ `hooks/useSponsorshipMatching.ts` - React hooks
- ✅ `types/sponsorship-ai.ts` - TypeScript types

#### **Configuration**
- ✅ `supabase/config.toml` - Cron & function settings
- ✅ Seed data migration ready

---

## 🎯 Integration Steps

### **Step 1: Deploy Seed Data**

```bash
npx supabase db push
```

This creates:
- 3 sample sponsors (TechCorp, GreenEarth, Athletic Pro)
- 3 sponsor profiles with targeting data
- Audience insights for your events
- Sponsorship packages (Gold/Silver/Bronze tiers)
- Queued match calculations

### **Step 2: Add Routes** 

Add to your router (in `src/App.tsx` or routing config):

```tsx
import SponsorshipMarketplacePage from '@/pages/SponsorshipMarketplacePage';
import SponsorshipAIDashboard from '@/pages/SponsorshipAIDashboard';

// In your routes:
<Route path="/sponsorships/marketplace" element={<SponsorshipMarketplacePage />} />
<Route path="/sponsorships/dashboard" element={<SponsorshipAIDashboard />} />
```

### **Step 3: Add to Navigation**

Add sponsorship links to your nav:

```tsx
import { Building2, Sparkles } from 'lucide-react';

// In your navigation component:
<Link to="/sponsorships/marketplace">
  <Building2 className="h-4 w-4 mr-2" />
  Marketplace
</Link>

<Link to="/sponsorships/dashboard">
  <Sparkles className="h-4 w-4 mr-2" />
  AI Matching
</Link>
```

---

## 💡 Usage Examples

### **1. Show Recommendations for a Sponsor**

```tsx
import { SponsorRecommendations } from '@/components/sponsorship/SponsorRecommendations';

function SponsorDashboard() {
  const { sponsorId } = useSponsorContext(); // Your auth/context
  
  return (
    <div className="p-6">
      <SponsorRecommendations 
        sponsorId={sponsorId}
        limit={10}
        minScore={0.5}
      />
    </div>
  );
}
```

### **2. Show Suggested Sponsors for Event**

```tsx
import { EventSponsorMatches } from '@/components/sponsorship/EventSponsorMatches';

function EventSponsorTab({ eventId }: { eventId: string }) {
  return (
    <div className="p-6">
      <EventSponsorMatches 
        eventId={eventId}
        minScore={0.55}
      />
    </div>
  );
}
```

### **3. Using the Hooks**

```tsx
import { useSponsorRecommendations, useMatchScore } from '@/hooks/useSponsorshipMatching';

function MyComponent() {
  // Get recommendations
  const { packages, loading, error } = useSponsorRecommendations(sponsorId);
  
  // Compute live score
  const { score, breakdown, calculate } = useMatchScore(eventId, sponsorId);
  
  return (
    <div>
      {loading && <p>Loading...</p>}
      {packages.map(pkg => <div key={pkg.package_id}>{pkg.title}</div>)}
      
      <button onClick={calculate}>Calculate Match</button>
      {score && <p>Score: {Math.round(score * 100)}%</p>}
    </div>
  );
}
```

### **4. Trigger Recalculation After Update**

```tsx
import { handleProfileUpdate } from '@/lib/sponsorship';

async function updateSponsorBudget(sponsorId: string, newBudget: number) {
  // Update the profile
  await supabase
    .from('sponsor_profiles')
    .update({ annual_budget_cents: newBudget })
    .eq('sponsor_id', sponsorId);
  
  // Queue recalculation for all events
  await handleProfileUpdate(sponsorId);
  
  toast.success('Budget updated! Matches are being recalculated...');
}
```

---

## 🔧 Available Functions

### **From `lib/sponsorship.ts`:**

```typescript
// Compute live match score
const { score, breakdown } = await computeMatchScore(eventId, sponsorId);

// Trigger recalculation via Edge Function
await triggerRecalculation({ 
  sponsor_id: 'xxx',
  event_id: 'yyy',
  sponsor_ids: ['a', 'b'],
  event_ids: ['c', 'd']
});

// Process queue manually (admin only)
const processed = await processMatchQueue(100);

// Refresh materialized views
await refreshSponsorshipMVs(false);

// Check queue status
const { pendingCount } = await getQueueStatus();
```

---

## 📊 Database Views You Can Query

### **For Sponsors:**
```typescript
// Get recommendations
const { data } = await supabase
  .from('v_sponsor_recommended_packages')
  .select('*')
  .eq('sponsor_id', sponsorId)
  .gte('score', 0.5)
  .order('score', { ascending: false });
```

### **For Organizers:**
```typescript
// Get sponsor matches
const { data } = await supabase
  .from('v_event_recommended_sponsors')
  .select('*')
  .eq('event_id', eventId)
  .gte('score', 0.5)
  .order('score', { ascending: false });
```

### **Marketplace:**
```typescript
// Browse all packages
const { data } = await supabase
  .from('v_sponsorship_package_cards')
  .select('*')
  .order('quality_score_100', { ascending: false })
  .limit(20);
```

---

## 🎨 Component Properties

### **SponsorRecommendations**
```tsx
<SponsorRecommendations 
  sponsorId={string}
  limit={number}          // Default: 10
  minScore={number}       // Default: 0.5 (50%)
/>
```

### **EventSponsorMatches**
```tsx
<EventSponsorMatches 
  eventId={string}
  minScore={number}       // Default: 0.5 (50%)
/>
```

### **LiveMatchCalculator**
```tsx
<LiveMatchCalculator 
  eventId={string}
  sponsorId={string}
  className={string}      // Optional
/>
```

---

## ⚙️ System Architecture

### **Data Flow:**

1. **Profile/Insight Updated** 
   → Database trigger fires
   → Item added to `fit_recalc_queue`

2. **Cron Job (Every 10 min)**
   → `sponsorship-recalc` Edge Function runs
   → Processes queue batch
   → Computes scores via AI algorithm
   → Upserts to `sponsorship_matches`

3. **Frontend Queries Views**
   → `v_sponsor_recommended_packages`
   → `v_event_recommended_sponsors`
   → Real-time subscriptions update UI

### **Manual Triggers:**

- Update sponsor profile → Auto-queues via trigger
- Update event insights → Auto-queues via trigger
- Manual recalc → Call `triggerRecalculation()`
- Admin queue process → Call `processMatchQueue()`

---

## 🧪 Testing

### **1. Run Seed Migration**
```bash
npx supabase db push
```

### **2. Process Queue Manually** (don't wait for cron)
```sql
SELECT process_match_queue(50);
```

### **3. View Results**
```sql
-- Check matches
SELECT 
  sm.event_id,
  sm.sponsor_id,
  s.name as sponsor_name,
  sm.score,
  sm.overlap_metrics
FROM sponsorship_matches sm
JOIN sponsors s ON s.id = sm.sponsor_id
ORDER BY sm.score DESC
LIMIT 10;

-- Check queue
SELECT COUNT(*) as pending 
FROM fit_recalc_queue 
WHERE processed_at IS NULL;
```

### **4. Navigate to UI**
```
http://localhost:3000/sponsorships/marketplace
http://localhost:3000/sponsorships/dashboard
```

---

## 🎯 Common Integration Patterns

### **Add to Sponsor Dashboard:**

```tsx
import { SponsorRecommendations } from '@/components/sponsorship/SponsorRecommendations';

function SponsorDashboardPage() {
  return (
    <Tabs>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
      </TabsList>
      
      <TabsContent value="recommendations">
        <SponsorRecommendations sponsorId={currentSponsorId} />
      </TabsContent>
    </Tabs>
  );
}
```

### **Add to Event Management:**

```tsx
import { EventSponsorMatches } from '@/components/sponsorship/EventSponsorMatches';

function EventManagementPage() {
  return (
    <Tabs>
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="sponsors">Suggested Sponsors</TabsTrigger>
      </TabsList>
      
      <TabsContent value="sponsors">
        <EventSponsorMatches eventId={eventId} />
      </TabsContent>
    </Tabs>
  );
}
```

---

## 🔐 Security Notes

- ✅ RLS policies enforce sponsor/organizer access
- ✅ Views auto-filter based on authenticated user
- ✅ Edge Functions validate JWT tokens (except cron)
- ✅ Service role functions restricted

---

## 📈 Monitoring

### **Queue Health:**
```sql
-- Check queue age
SELECT 
  COUNT(*) as pending,
  MIN(queued_at) as oldest,
  MAX(queued_at) as newest
FROM fit_recalc_queue
WHERE processed_at IS NULL;
```

### **Match Quality:**
```sql
-- Average scores by sponsor
SELECT 
  s.name,
  AVG(sm.score) as avg_score,
  COUNT(*) as total_matches
FROM sponsorship_matches sm
JOIN sponsors s ON s.id = sm.sponsor_id
GROUP BY s.id, s.name
ORDER BY avg_score DESC;
```

### **Edge Function Logs:**
```bash
npx supabase functions logs sponsorship-recalc --tail
```

---

## 🎉 You're All Set!

Your sponsorship AI matching system is now:
- ✅ Fully deployed
- ✅ Processing automatically
- ✅ UI components ready
- ✅ Hooks available
- ✅ Types defined
- ✅ Seed data ready

**Next:** Deploy seed data and start using the components in your app!

```bash
npx supabase db push
```

Then navigate to: `http://localhost:3000/sponsorships/dashboard`

