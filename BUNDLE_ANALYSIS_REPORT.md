# 📦 YardPass Bundle Analysis Report
**Generated:** November 9, 2025  
**Build Time:** 51.7 seconds  
**Total Modules:** 4,313  

---

## 🚨 Critical Findings

### **Interactive Shell Size: 560 KB gzipped** 🔴 OVER BUDGET

**Target:** <200 KB gzipped  
**Actual:** ~560 KB gzipped  
**Over by:** 280% (2.8x target)

**Components:**
```
vendor.js:     521 KB gzipped  (93% of total)
index.js:       39 KB gzipped  (7% of total)
----------
Total:         560 KB gzipped
```

**Verdict:** 🔴 **Critical** - Needs optimization

---

## 📊 Detailed Bundle Breakdown

### **Top 10 Largest Chunks (Gzipped)**

| Chunk | Size (Gzipped) | Category | Action Needed |
|-------|----------------|----------|---------------|
| **vendor.js** | 521 KB | Core dependencies | 🔴 **CRITICAL - Analyze** |
| **mapbox.js** | 445 KB | Maps | ✅ Code-split (OK) |
| **charts.js** | 67 KB | Analytics charts | ✅ Code-split (OK) |
| **analytics.js** | 59 KB | PostHog | ✅ Code-split (OK) |
| **ui.js** | 35 KB | Radix UI | ✅ Acceptable |
| **motion.js** | 25 KB | Framer Motion | ✅ Code-split (OK) |
| **video.js** | 28 KB | Mux Player | ✅ Code-split (OK) |
| **FeedPageNewDesign.js** | 24 KB | Feed page | ✅ Acceptable |
| **CampaignDashboard.js** | 22 KB | Campaign page | ✅ Code-split (OK) |
| **EventManagement.js** | 18 KB | Event management | ✅ Code-split (OK) |

---

## 🔴 Priority 1: Vendor Chunk Analysis

**Problem:** `vendor.js` is 521 KB gzipped (93% of interactive shell)

**What's likely in vendor.js:**
Based on your dependencies, the vendor chunk probably contains:

```javascript
// Estimated breakdown (needs visual confirmation):
@supabase/supabase-js:     ~80 KB  (15%)
react + react-dom:         ~50 KB  (10%)
@tanstack/react-query:     ~40 KB  (8%)
react-router-dom:          ~30 KB  (6%)
Radix UI (core):           ~35 KB  (7%)
posthog-js (if in vendor): ~40 KB  (8%)
Other dependencies:        ~246 KB (46%)
```

**Recommended Actions:**

**A. Extract Heavy Non-Critical Libs to Lazy Chunks**
```typescript
// vite.config.ts - Update manualChunks
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    // Already split
    if (id.includes('mapbox-gl')) return 'mapbox';
    if (id.includes('recharts')) return 'charts';
    if (id.includes('@mux/mux-player')) return 'video';
    if (id.includes('@stripe')) return 'stripe';
    if (id.includes('framer-motion')) return 'motion';
    if (id.includes('@radix-ui')) return 'ui';
    if (id.includes('posthog')) return 'analytics';
    
    // 🎯 NEW: Split more libs
    if (id.includes('react-hook-form')) return 'forms';
    if (id.includes('zod')) return 'validation';
    if (id.includes('date-fns')) return 'dates';
    if (id.includes('@tanstack/react-virtual')) return 'virtual';
    if (id.includes('dompurify')) return 'security';
    
    // Keep core libs in vendor
    if (id.includes('react') || id.includes('react-dom')) return 'vendor';
    if (id.includes('@supabase')) return 'vendor';
    if (id.includes('react-router')) return 'vendor';
    if (id.includes('@tanstack/react-query')) return 'vendor';
    
    // Everything else
    return 'vendor';
  }
}
```

**B. Lazy Load Analytics**
```typescript
// Only load PostHog when user interacts (not on initial load)
const PostHogProvider = lazy(() => import('posthog-js/react').then(m => ({ 
  default: m.PostHogProvider 
})));
```

**C. Defer Non-Critical Features**
```typescript
// Load these after initial render
useEffect(() => {
  // Wait for idle time
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import('@/lib/analytics'); // PostHog
      import('@/lib/error-tracking'); // Sentry, etc.
    });
  }
}, []);
```

---

## ✅ What's Already Optimized

**These ARE properly code-split (won't block initial load):**

| Library | Size | Status |
|---------|------|--------|
| Mapbox GL | 445 KB | ✅ Lazy-loaded on map pages |
| Recharts | 67 KB | ✅ Lazy-loaded on analytics |
| Mux Player | 28 KB | ✅ Lazy-loaded on video posts |
| Framer Motion | 25 KB | ✅ Lazy-loaded on animated pages |

**Good code splitting on heavy page components:**
- EventManagement: 18 KB (lazy)
- CreateEventFlow: 16 KB (lazy)
- CampaignDashboard: 22 KB (lazy)
- OrganizerDashboard: 11 KB (lazy)

---

## 🟡 Radix UI Analysis

**Radix UI chunk:** 35 KB gzipped (120 KB raw)

**Verdict:** ✅ **Acceptable** - Not the main problem

Your `@/components/ui/*` wrapper pattern appears to be working well. Radix is already tree-shaken reasonably.

**No immediate action needed** - focus on vendor chunk first.

---

## 📈 Performance Budget Scorecard

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Interactive Shell** | ~560 KB | <200 KB | 🔴 **Over 2.8x** |
| **Vendor Chunk** | 521 KB | <150 KB | 🔴 **Over 3.5x** |
| **Heavy Libs Split** | ✅ Yes | ✅ Yes | ✅ **Good** |
| **Page Components Split** | ✅ Yes | ✅ Yes | ✅ **Good** |
| **CSS Size** | 56 KB | <50 KB | 🟡 **Slightly over** |

---

## 🎯 Recommended Action Plan

### **Phase 1: Quick Wins** (2-3 hours)

**1. Split More Libraries from Vendor**
Extract these to separate lazy chunks:
- `react-hook-form` + `zod` → `forms` chunk
- `date-fns` → `dates` chunk  
- `dompurify` → `security` chunk
- `@tanstack/react-virtual` → `virtual` chunk

**Expected Reduction:** 50-80 KB from vendor

**2. Lazy Load PostHog**
Don't load analytics until after first paint:
```typescript
// Defer PostHog to after interactive
setTimeout(() => import('posthog-js'), 2000);
```

**Expected Reduction:** 40-60 KB from vendor

**3. Tree-Shake @supabase/supabase-js**
Verify you're only importing what you need:
```typescript
// ❌ Bad: Imports entire library
import { createClient } from '@supabase/supabase-js';

// ✅ Good: Only imports client
import { createClient } from '@supabase/supabase-js/dist/module/index.js';
```

**Expected Reduction:** 20-30 KB

**Total Expected:** Vendor chunk: 521 KB → ~350 KB (33% reduction)

---

### **Phase 2: Advanced** (1-2 days)

**1. Implement Route-Based Splitting**
```typescript
// Split by user journey
const AttendeeRoutes = lazy(() => import('@/routes/AttendeeRoutes'));
const OrganizerRoutes = lazy(() => import('@/routes/OrganizerRoutes'));
const SponsorRoutes = lazy(() => import('@/routes/SponsorRoutes'));
```

**2. Consider Removing Unused Dependencies**
Audit `package.json` for unused libraries:
```bash
npx depcheck
```

**3. Implement Service Worker**
Cache vendor chunk aggressively (1 year):
```javascript
// Cache vendor.js forever (it's content-hashed)
workbox.precacheAndRoute([
  { url: '/assets/vendor-*.js', revision: null }
]);
```

---

## 📸 Visual Analysis Available

**The interactive treemap is ready!**

**To view:**
1. Open Finder
2. Navigate to: `/Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade/`
3. Double-click `bundle-analysis.html`

**What you'll see:**
- 📊 Visual treemap of all chunks
- 🔍 Click boxes to drill into dependencies
- 📏 Size shows both raw and gzipped
- 🎨 Colors show relative size

**Look for:**
- Large boxes in "vendor" chunk (what's taking space?)
- Duplicate dependencies (multiple versions?)
- Unexpected heavy libraries

---

## 🎯 Immediate Next Steps

**Option 1:** Open `bundle-analysis.html` manually and review  
**Option 2:** Move to Phase 2 tickets (indexes, caching, skeletons)  
**Option 3:** Implement vendor chunk splitting now  

**What would you like to do?**
