# 🚀 Next Features & Improvements Plan

**Date**: January 28, 2025  
**Status**: Ready for Implementation

## 📋 Overview

With Comments, Posts, and Video/HLS Phases 1-2 complete, here are high-value next steps organized by priority:

---

## 🎯 High Priority (Quick Wins)

### 1. **Add Video Analytics Support** ⏱️ 1-2 hours

**Current State**: Video errors/metrics logged to console only  
**Goal**: Send video data to analytics for production monitoring

**Tasks**:
- Update `supabase/functions/track-analytics/index.ts` to handle:
  - `type === 'video_error'` → Insert into `video_errors` table (or log table)
  - `type === 'video_metric'` → Insert into `video_metrics` table (or log table)
- Create database tables if needed (or use existing analytics table)
- Re-enable analytics calls in `src/utils/videoLogger.ts`
- Test end-to-end

**Impact**: Production monitoring of video playback issues

---

### 2. **Performance Optimizations** ⏱️ 2-4 hours

**Areas to Review**:
- Bundle size optimization (check for unnecessary imports)
- Image lazy loading improvements
- Component code-splitting
- Query optimization (check React Query caching)

**Tasks**:
- Run bundle analyzer
- Identify large dependencies
- Optimize imports (use barrel exports consistently)
- Review React Query cache strategies

**Impact**: Faster load times, better UX

---

## 🏗️ Medium Priority (Feature Enhancements)

### 3. **Messaging System Completion** ⏱️ 4-8 hours

**Current State**: Based on `SOCIAL_SYSTEM_AUDIT.md`:
- Messaging tables not deployed (critical blocker)
- Frontend incomplete (TODOs present)

**Tasks**:
- Create messaging migration file
- Complete frontend integration
- Add message pagination
- Implement read receipt tracking

**Impact**: Complete messaging feature

---

### 4. **Following System Optimizations** ⏱️ 2-3 hours

**Current State**: Well-architected but needs optimization  
**From Audit**:
- No caching layer for follow data
- N+1 query problem on search results
- Multiple realtime subscriptions per page

**Tasks**:
- Add React Query caching for follow data
- Optimize search queries (batch requests)
- Consolidate realtime subscriptions

**Impact**: Better performance, reduced database load

---

## 🔧 Code Quality & Technical Debt

### 5. **Address TODO/FIXME Items** ⏱️ 2-3 hours

**Files with TODOs**:
- `src/utils/videoLogger.ts` - Analytics support TODO
- `src/features/posts/index.ts` - Check for TODOs
- `src/pages/new-design/EventDetailsPage.tsx`
- `src/components/PayoutDashboard.tsx`
- Others found in grep

**Tasks**:
- Review each TODO/FIXME
- Prioritize by impact
- Fix or document decisions

**Impact**: Cleaner codebase, reduced technical debt

---

### 6. **Type Safety Improvements** ⏱️ 2-4 hours

**Areas**:
- Ensure all features use domain types consistently
- Add missing type definitions
- Fix `any` types where possible
- Improve TypeScript strictness

**Tasks**:
- Audit type usage in `features/` directory
- Replace `any` with proper types
- Ensure domain types are used everywhere

**Impact**: Better developer experience, fewer bugs

---

## 📊 Analytics & Monitoring

### 7. **Enhanced Analytics Dashboard** ⏱️ 3-5 hours

**Current State**: Analytics system exists  
**Potential Improvements**:
- Video playback analytics view
- Error rate dashboards
- Performance metrics visualization
- User engagement metrics

**Tasks**:
- Create video analytics views
- Build error rate dashboards
- Add performance metrics

**Impact**: Better insights into app performance

---

## 🎨 UI/UX Improvements

### 8. **Accessibility Enhancements** ⏱️ 2-3 hours

**Areas**:
- Keyboard navigation improvements
- Screen reader support
- ARIA labels
- Focus management

**Tasks**:
- Audit accessibility in key components
- Add missing ARIA labels
- Improve keyboard navigation
- Test with screen readers

**Impact**: Better accessibility compliance

---

## 🔐 Security & Reliability

### 9. **Additional RLS Policies** ⏱️ 3-4 hours

**Current State**: Critical RLS fix deployed  
**Remaining** (from audit):
- Medium-priority tables could use RLS
- Reference tables review

**Tasks**:
- Review medium-priority tables
- Add RLS policies where needed
- Test policies thoroughly

**Impact**: Enhanced security

---

## 📝 Recommendations

### **Start Here** (Highest Impact/Quickest Wins):

1. **Video Analytics Support** - Enable production monitoring
2. **Performance Optimizations** - Improve user experience
3. **Address TODO Items** - Clean up technical debt

### **Next Sprint** (Feature Completion):

4. **Messaging System** - Complete important feature
5. **Following Optimizations** - Improve performance

### **Ongoing** (Code Quality):

6. **Type Safety** - Continuous improvement
7. **Accessibility** - Incremental improvements

---

## 🎯 Choose Your Adventure

**Option A: Production Monitoring**
- Video Analytics Support
- Enhanced Analytics Dashboard

**Option B: Performance Focus**
- Performance Optimizations
- Following System Optimizations

**Option C: Feature Completion**
- Messaging System
- Address TODOs

**Option D: Code Quality**
- Type Safety Improvements
- Address TODOs
- Accessibility Enhancements

---

Which direction would you like to go? I can start with any of these!

