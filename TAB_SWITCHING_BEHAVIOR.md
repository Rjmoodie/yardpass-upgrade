# Tab Switching Behavior - Posts vs Saved

## 🎯 Current Implementation

### Tab Switching
- **Posts Tab**: Shows `posts` array (user's posts)
- **Saved Tab**: Shows `savedEvents` array (saved events + posts)
- Both use the same grid layout (3 columns)
- Both use the same visual styling

### Scroll Reset on Tab Change
✅ **Added**: `useLayoutEffect` that resets scroll when `activeTab` changes
- Ensures user sees content from top when switching tabs
- Prevents confusion from different scroll positions

## 📊 Differences Between Tabs

### Posts Tab
- **Data Source**: `posts` state (from `loadPosts` function)
- **Content**: User's own posts
- **Image Source**: `p.media_urls[0]` (converted from Mux if needed)
- **Count**: Shows `posts.length` in tab

### Saved Tab
- **Data Source**: `savedEvents` state (from `loadSavedItems` function)
- **Content**: Saved events AND saved posts
- **Image Source**: 
  - For posts: `e.post_media_urls[0]` (converted from Mux if needed)
  - For events: `e.cover_image_url`
  - Fallback: Placeholder image if no image URL
- **Count**: Shows `savedEvents.length` in tab
- **Only visible**: When `isOwnProfile === true`

## 🔍 Potential Issues

### 1. **Empty Images in Saved Tab**
- If saved items don't have `cover_image_url` or `post_media_urls`, they'll show placeholder
- ✅ **Fixed**: Added fallback placeholder image

### 2. **Scroll Position on Tab Switch**
- Previously, switching tabs wouldn't reset scroll
- ✅ **Fixed**: Added `useLayoutEffect` to reset scroll on `activeTab` change

### 3. **Data Loading**
- Posts load when `profile?.user_id` changes
- Saved items load when `profile?.user_id` AND `isOwnProfile` are true
- Both are independent, so one might load before the other

## 🧪 Testing Tab Switching

1. Navigate to `/profile`
2. Click "Posts" tab → Should show posts grid
3. Scroll down a bit
4. Click "Saved" tab → Should:
   - Reset scroll to top
   - Show saved items grid
   - Display placeholder if images missing

## 📝 What to Check

If tabs look different or behave oddly:

1. **Check console** for errors loading data
2. **Verify data** - Are `posts` and `savedEvents` populated?
3. **Check images** - Are image URLs valid?
4. **Check scroll** - Does it reset when switching tabs?

## ✅ Fixes Applied

1. ✅ Scroll resets when switching tabs
2. ✅ Fallback images for empty URLs
3. ✅ Better image URL selection logic
4. ✅ Background gradient for broken images



