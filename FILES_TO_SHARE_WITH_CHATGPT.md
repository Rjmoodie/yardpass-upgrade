# Files to Share with ChatGPT for Scroll Flash Problem

## 📋 Quick File List

Share these files in this order:

### 1. Problem Summary (Read First)
- **`SCROLL_FLASH_PROBLEM_SUMMARY_FOR_CHATGPT.md`** ← Start here! Contains full problem description

### 2. Core Implementation Files (Most Important)

1. **`src/App.tsx`**
   - Lines 31-207: `ScrollRestorationManager` component
   - Lines 452-495: `AppContent` scroll reset logic
   - Line 651: Main scroll container definition
   - Line 698: Routes component with key prop

2. **`src/pages/new-design/ProfilePage.tsx`**
   - The page experiencing the flash
   - Check lines around 100-184 for any scroll-related code

3. **`src/components/layout/FullScreenSafeArea.tsx`**
   - Lines 79-115: Scroll reset logic in layout component

4. **`src/main.tsx`**
   - Line 77: Browser scroll restoration disabled

### 3. Supporting Files

5. **`src/index.css`**
   - Lines 8-20: CSS scroll lock styles (`.scroll-locked`, `.scroll-resetting`)

### 4. Context Files (Optional but Helpful)

6. **`SCROLL_FLASH_DEBUGGING_GUIDE.md`** - Debugging approaches tried
7. **`SCROLL_FLASH_ULTIMATE_FIX.md`** - Previous fix attempts
8. **`SCROLL_RESTORATION_ISSUE_SUMMARY.md`** - Original issue analysis

## 🎯 What to Ask ChatGPT

Copy this prompt:

```
I have a scroll restoration issue in my React app. When navigating between routes, 
the page header briefly appears then automatically scrolls down, hiding the header.

I've tried:
- useLayoutEffect to reset scroll before paint
- Disabling browser scroll restoration
- CSS scroll locking
- Multiple reset attempts at different timings
- Forcing route remount with key prop

But the scroll still restores after route change.

Please review the files I'm sharing and help identify why scroll restoration 
is still happening and suggest a solution.
```

## 📝 File Contents to Copy

1. **Start with:** `SCROLL_FLASH_PROBLEM_SUMMARY_FOR_CHATGPT.md` (full context)
2. **Then share:** The 5 core files listed above
3. **Mention:** React Router v6, lazy loading, fixed bottom nav, safe area insets

## ✅ Checklist Before Sharing

- [ ] Read `SCROLL_FLASH_PROBLEM_SUMMARY_FOR_CHATGPT.md` first
- [ ] Copy the 5 core files
- [ ] Include the prompt above
- [ ] Mention it's React Router v6
- [ ] Note that multiple approaches have been tried



