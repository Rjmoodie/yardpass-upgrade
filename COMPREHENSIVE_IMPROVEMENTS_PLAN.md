# 📋 Comprehensive Improvements Plan - Liventix

## 🎯 Overview

18 improvements identified across UX, performance, validation, and features.

---

## 🚨 Priority 1: Critical Deployment Issues

### **1. Deploy home-feed Edge Function** ⚠️ BLOCKS PRODUCTION
- **Issue:** CORS blocking www.liventix.tech
- **Status:** Code fixed, needs deployment
- **Action:** Login to Supabase CLI and deploy
- **Command:** 
  ```bash
  npx supabase login
  npx supabase functions deploy home-feed --no-verify-jwt
  ```

### **2. Upload Fixed .htaccess** ⚠️ BLOCKS PRODUCTION  
- **Issue:** JavaScript files served with wrong MIME type
- **Status:** Updated with Hostinger support's exact specifications
- **Action:** Upload new `dist/.htaccess` to Hostinger
- **MIME Types Added:**
  - `.js` → `application/javascript`
  - `.mjs` → `application/javascript`
  - `.css` → `text/css`
  - `.wasm` → `application/wasm`
  - `.json` → `application/json`
  - `.map` → `application/json`

---

## 🎨 Priority 2: UX Improvements (High Impact)

### **3. Event Video Comment Modal - Scroll Fix**
- **Issue:** Video fixed, comments need to scroll uniformly
- **Solution:** Restructure modal layout with fixed video, scrollable comments
- **Impact:** Better UX for long comment threads

### **4. Add "Going" Button for Events**
- **Issue:** No way for users to indicate attendance
- **Solution:** Add RSVP/Going button that:
  - Tracks attendance intent
  - Upsells tickets
  - Shows social proof ("123 people going")
- **Impact:** Increased ticket conversions

### **5. Improve Sharing Experience**
- **Issue:** Sharing not appealing enough
- **Solutions:**
  - Beautiful share cards with event images
  - Custom share text templates
  - Social media previews optimized
  - "Share and earn" incentives
- **Impact:** Viral growth potential

---

## 🐛 Priority 3: Bug Fixes

### **6. Post Count Discrepancy**
- **Issue:** Shows "3 posts" but actual count is 8
- **Cause:** Likely filtering or query issue
- **Solution:** Debug post counting logic in event details

### **7. Edge Function Checkout Error**
- **Issue:** Non-2xx status on checkout
- **Solution:** Add proper error handling and response codes

### **8. Location Permission on Every Refresh**
- **Issue:** App asks for location every time
- **Solution:** Cache permission state in localStorage
- **Impact:** Better UX, less annoying

---

## ⚡ Priority 4: Performance Optimizations

### **9. Reduce Mapbox Bundle**
- **Issue:** Importing unnecessary Mapbox utilities
- **Solution:** 
  - Import only what's needed
  - Use Mapbox GL JS tree-shaking
  - Consider mapbox-gl-js-amplify (lighter alternative)
- **Impact:** Save ~200-300 KB

### **10. Optimize Feed Loading**
- **Issue:** Feed performance needs improvement
- **Solutions:**
  - Virtual scrolling for long feeds
  - Image lazy loading
  - Pagination improvements
  - Cache feed data
- **Impact:** Faster feed, better mobile experience

### **11. Improve Mobile Navigation**
- **Issue:** Navigation feels sluggish on mobile
- **Solutions:**
  - Use CSS transforms (GPU acceleration)
  - Reduce JavaScript execution
  - Debounce scroll handlers
  - Use will-change CSS property
- **Impact:** Smoother 60fps navigation

---

## ✅ Priority 5: Validation & Data Integrity

### **12. Validate Username Uniqueness**
- **Issue:** No check if handle already exists
- **Solution:** Real-time validation query as user types
- **Implementation:**
  ```typescript
  const checkUsername = debounce(async (username) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();
    return !data; // true if available
  }, 500);
  ```

### **13. Validate Organization Name Uniqueness**
- **Issue:** No check if org name already exists
- **Solution:** Similar validation on org creation

---

## 🎨 Priority 6: UI Enhancements

### **14. Create Organizations Modal - Scrollable**
- **Issue:** Modal not scrollable
- **Solution:** Apply `.pb-nav` class to scroll container

### **15. Organization Dashboard - Loading State**
- **Issue:** No loading indicator when fetching org data
- **Solution:** Show skeleton loaders during fetch

### **16. Profile About Section**
- **Issue:** Missing about/bio field
- **Solution:** Add bio field to:
  - Database schema (user_profiles.bio)
  - Profile edit form
  - Profile display

### **17. Profile Layout - Name Optimization**
- **Issue:** "Roderick Moodie" not using full width
- **Solution:** Adjust layout to maximize horizontal space

### **18. Responsive Views & Buttons**
- **Issue:** Some views/buttons not responsive
- **Solution:** Audit and fix breakpoints across components

---

## 🌐 Priority 7: Offline Support

### **19. Implement Offline Mode**
- **Solutions:**
  - Service worker (already have `sw.js`)
  - Cache API for feed data
  - IndexedDB for tickets
  - Offline indicator
  - Queue actions for when back online
- **Impact:** Works without internet

---

## 📊 Implementation Priority Order

### **Week 1: Critical (Unblock Production)**
1. Deploy edge function (5 min)
2. Upload .htaccess fix (5 min)
3. Test production (5 min)

### **Week 2: High-Value UX**
4. Event video modal scroll fix (1 hour)
5. Add "Going" button (2 hours)
6. Fix post count (30 min)
7. Username/org name validation (1 hour)

### **Week 3: Performance**  
8. Optimize Mapbox imports (2 hours)
9. Optimize feed loading (3 hours)
10. Fix mobile navigation sluggishness (2 hours)
11. Fix location permission prompt (30 min)

### **Week 4: Polish**
12. Organization modal scroll fix (30 min)
13. Org dashboard loading state (30 min)
14. Profile about section (1 hour)
15. Profile layout optimization (30 min)
16. Responsive audit (2 hours)
17. Improve sharing (2 hours)

### **Week 5: Advanced**
18. Implement offline mode (8-12 hours)

---

## 🎯 Estimated Total: 30-35 hours

Most items are quick wins (30 min - 2 hours).
Offline mode is the only major undertaking.


