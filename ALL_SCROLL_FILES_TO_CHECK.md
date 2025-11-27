# ALL FILES CAUSING SCROLL RESTORATION ISSUE

## 🎯 Root Problem
Profile page header disappears because scroll position is being restored after navigation.

---

## 📁 Files That Control Scroll Behavior

### 1. **`src/main.tsx`** ✅ FIXED
- **Issue**: BrowserRouter automatically restores scroll
- **Fix Applied**: Added `window.history.scrollRestoration = 'manual'`
- **Line**: Before `createRoot()` call

### 2. **`src/App.tsx`** ✅ FIXED  
- **Issue**: Main scroll container needs reset on route change
- **Fix Applied**: Enhanced scroll reset with multiple timing attempts
- **Lines**: ~193-240 (scroll reset useEffect)
- **Key Element**: `<main id="main-content">` at line ~378

### 3. **`src/pages/new-design/ProfilePage.tsx`** ✅ FIXED
- **Issue**: Creates nested scroll container + needs scroll reset
- **Fix Applied**: 
  - Set `scroll={false}` on FullScreenSafeArea
  - Added aggressive scroll reset with multiple timings
- **Lines**: 
  - FullScreenSafeArea: ~345 (now has `scroll={false}`)
  - Scroll reset: ~100-147

### 4. **`src/components/layout/FullScreenSafeArea.tsx`** ✅ FIXED
- **Issue**: Scroll container needs reset on route change
- **Fix Applied**: Added scroll reset when location.pathname changes
- **Lines**: ~76-85

### 5. **`src/index.css`**
- **Issue**: CSS might affect scroll behavior
- **Status**: Check these lines:
  - Line 317: `.feed-container { overflow-y: auto; }`
  - Line 377-385: `.scroll-container` and `.content-on-nav` styles
- **Action**: Verify no conflicting overflow styles

---

## 🔍 Key CSS Classes to Check

1. **`.scroll-container`** - Applied to main element
2. **`.content-on-nav`** - Applied to main element  
3. **`.overflow-y-auto`** - Check if main element gets this

---

## 🚨 If Still Not Working

1. **Check which element is actually scrolling**:
   - Open DevTools → Elements
   - Find the scrollable element (has scrollbar)
   - Check its `scrollTop` value

2. **Check if scroll is being restored AFTER our resets**:
   - Add console.log in scroll reset functions
   - See if scrollTop changes after our resets

3. **Verify main element has overflow**:
   - The main element might not have `overflow-y-auto`
   - Check if it needs to be added explicitly

---

## 📝 Current Fixes Summary

✅ Browser scroll restoration disabled  
✅ ProfilePage scroll disabled (uses parent)  
✅ Aggressive scroll resets at multiple timings  
✅ All scroll containers being reset  

If still broken, the issue is likely:
- Main element not actually scrollable
- Something restoring scroll after our resets
- Wrong element being reset

