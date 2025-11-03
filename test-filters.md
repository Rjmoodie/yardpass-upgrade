# Filter Testing Guide

## How to Test Filters Are Working:

### Test 1: Category Filter
1. Open filter panel
2. Select "Music" category only
3. Click "Apply"
4. **Expected:** Only music events should appear in feed
5. **Check console:** Should see `filters: { categories: ['Music'], ... }`

### Test 2: Location Filter
1. Select "New York City" only
2. Click "Apply"
3. **Expected:** Only NYC events should appear
4. **Check console:** Should see `filters: { locations: ['New York City'], ... }`

### Test 3: Date Filter
1. Select "This Weekend" only
2. Click "Apply"
3. **Expected:** Only weekend events should appear
4. **Check console:** Should see `filters: { dates: ['This Weekend'], ... }`

### Test 4: Search Radius
1. Move slider to 10 miles
2. Click "Apply"
3. **Expected:** Only events within 10 miles
4. **Check console:** Should see `filters: { searchRadius: 10, ... }`

## Console Logs to Check:

```javascript
// In FeedPageNewDesign.tsx or UnifiedFeedList.tsx
console.log('Current filters:', filters);

// In useUnifiedFeedInfinite.ts
console.log('Fetching with filters:', { locations, categories, dates, searchRadius });

// In home-feed Edge Function
console.log('Feed filters received:', { locationFilters, categoryFilters, dateFilters, searchRadius });
```

## If Filters Aren't Working:

### Check 1: Are filters being passed?
```typescript
// In FeedPageNewDesign.tsx
const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = 
  useUnifiedFeedInfinite({
    locations: filters.locations,  // ✅ Should be here
    categories: filters.categories,
    dates: filters.dates,
    searchRadius: filters.searchRadius
  });
```

### Check 2: Query key invalidation
After applying filters, the query should refetch automatically due to changed query key.

### Check 3: Backend processing
The `home-feed` Edge Function should log:
```
🔍 Feed filters received: { locationFilters: [...], categoryFilters: [...], ... }
```
