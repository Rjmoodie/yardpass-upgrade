# 🎨 Production Design Files - Complete Reference

## Overview
This is the **single source of truth** for all design files currently powering the YardPass app.

---

## 📱 **Main App Pages** (`src/pages/new-design/`)

All main screens that users navigate to:

| File | Purpose | Status | Recent Fixes |
|------|---------|--------|--------------|
| **EventDetailsPage.tsx** | Event details, tickets, posts, map | ✅ Active | Organizer slug visibility ✓ |
| **FeedPageComplete.tsx** | Main feed with events/posts | ✅ Active | Import paths fixed ✓ |
| **SearchPage.tsx** | Search events, filters, results | ✅ Active | - |
| **TicketsPage.tsx** | User's tickets, QR codes | ✅ Active | - |
| **MessagesPage.tsx** | Direct messages, conversations | ✅ Active | - |
| **NotificationsPage.tsx** | Notifications list | ✅ Active | - |
| **ProfilePage.tsx** | User profile, posts, stats | ✅ Active | - |
| **ScannerSelectEventPage.tsx** | Organizer ticket scanner | ✅ Active | - |

**Path:** `/Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade/src/pages/new-design/`

---

## 🎴 **Feed Components** (`src/components/feed/`)

Specialized components for the feed experience:

| File | Purpose | Status | Recent Fixes |
|------|---------|--------|--------------|
| **FeedCard.tsx** | Event card with expandable details | ✅ Active | Text contrast 70%→90% ✓ |
| **FloatingActions.tsx** | Side buttons (like, comment, share) | ✅ Active | Count visibility 11px→14px ✓ |
| **TopFilters.tsx** | Top filter pills (Near Me, etc.) | ✅ Active | - |
| **EventCardNewDesign.tsx** | Event card variant | ✅ Active | - |
| **UserPostCardNewDesign.tsx** | User post card for feed | ✅ Active | - |
| **VideoMedia.tsx** | Video playback component | ✅ Active | - |
| **FeedCaption.tsx** | Caption text with expand/collapse | ✅ Active | - |
| **FeedActionRail.tsx** | Action buttons for posts | ✅ Active | - |
| **BottomNav.tsx** | Alternative bottom navigation | ✅ Active | - |

**Path:** `/Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade/src/components/feed/`

---

## 🎯 **Core UI Components** (`src/components/ui/`)

Shadcn UI components - **Foundation of all styling:**

### **Recently Fixed (High Priority):**
| File | Purpose | Recent Fixes |
|------|---------|--------------|
| **dialog.tsx** | Modals, bottom sheets | Modal visibility, borders, shadows ✓ |
| **card.tsx** | Card containers | Description contrast 60%→85% ✓ |
| **tabs.tsx** | Tab navigation | Background & text contrast ✓ |
| **slug-display.tsx** | Slug/tag badges | Dark mode contrast bug fixed ✓ |
| **button.tsx** | All buttons | - |

### **All UI Components:**
```
accordion.tsx          input-otp.tsx         separator.tsx
alert-dialog.tsx       input.tsx             sheet.tsx
alert.tsx              label.tsx             sidebar.tsx
aspect-ratio.tsx       menubar.tsx           skeleton.tsx
avatar.tsx             navigation-menu.tsx   slider.tsx
badge.tsx              pagination.tsx        sonner.tsx
bottom-sheet.tsx       popover.tsx           switch.tsx
breadcrumb.tsx         progress.tsx          table.tsx
button.tsx ✓           radio-group.tsx       tabs.tsx ✓
calendar.tsx           resizable.tsx         textarea.tsx
card.tsx ✓             responsive-bottom-sheet.tsx  toast.tsx
carousel.tsx           responsive-dialog.tsx toggle-group.tsx
chart.tsx              scroll-area.tsx       toggle.tsx
checkbox.tsx           select.tsx            tooltip.tsx
collapsible.tsx        separator.tsx         Match.tsx
command.tsx            TabNavigation.tsx
context-menu.tsx       slug-display.tsx ✓
dialog.tsx ✓           
drawer.tsx             
dropdown-menu.tsx      
form.tsx               
hover-card.tsx         
```

**Path:** `/Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade/src/components/ui/`

---

## 📦 **Modal Components** (`src/components/`)

### **Recently Enhanced:**
| File | Purpose | Recent Fixes |
|------|---------|--------------|
| **PostCreatorModal.tsx** | Create posts with media | Modal borders, text contrast ✓ |
| **EventCheckoutSheet.tsx** | Stripe checkout for tickets | Modal visibility, shadows ✓ |
| **TicketPurchaseModal.tsx** | Legacy ticket purchase | Modal borders, text ✓ |
| **CommentModal.tsx** | View/add comments | Modal visibility ✓ |
| **NotificationSystem.tsx** | Notification panel | Panel contrast, borders ✓ |

### **Other Key Components:**
```
NavigationNewDesign.tsx ✓    - Bottom nav (contrast fixed)
MapboxEventMap.tsx ✓         - Event location maps (theme fixed)
EventFeed.tsx                - Event-specific feed
EventPostsGrid.tsx           - Grid of event posts
ImageWithFallback.tsx        - Safe image loading
VideoRecorder.tsx            - Record videos
AttendeeListModal.tsx        - View event attendees
EventTicketModal.tsx         - Event ticket info
```

**Path:** `/Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade/src/components/`

---

## 🎨 **Styling & Theme Files**

| File | Purpose | Recent Changes |
|------|---------|----------------|
| **index.css** | Global styles, CSS variables | CSS variable system (pending) |
| **styles-new-design.css** | New design-specific styles | - |
| **tailwind.config.ts** | Tailwind configuration | - |

**Path:** `/Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade/src/`

---

## 🗂️ **Complete Production File Structure**

```
📁 yardpass-upgrade/
│
├── 📁 src/
│   │
│   ├── 📁 pages/
│   │   ├── 📁 new-design/          ✅ MAIN APP SCREENS
│   │   │   ├── EventDetailsPage.tsx     (644 lines) ✓ slug fixes
│   │   │   ├── FeedPageComplete.tsx     (275 lines) ✓ imports fixed
│   │   │   ├── MessagesPage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── ScannerSelectEventPage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   └── TicketsPage.tsx
│   │   │
│   │   └── [other legacy pages...]
│   │
│   ├── 📁 components/
│   │   ├── 📁 feed/                ✅ FEED-SPECIFIC COMPONENTS
│   │   │   ├── FeedCard.tsx               ✓ contrast fixes
│   │   │   ├── FloatingActions.tsx        ✓ count visibility
│   │   │   ├── TopFilters.tsx
│   │   │   ├── EventCardNewDesign.tsx
│   │   │   ├── UserPostCardNewDesign.tsx
│   │   │   ├── VideoMedia.tsx
│   │   │   ├── FeedCaption.tsx
│   │   │   ├── FeedActionRail.tsx
│   │   │   └── BottomNav.tsx
│   │   │
│   │   ├── 📁 ui/                  ✅ SHARED UI COMPONENTS
│   │   │   ├── dialog.tsx                 ✓ modal fixes
│   │   │   ├── card.tsx                   ✓ description contrast
│   │   │   ├── tabs.tsx                   ✓ tab contrast
│   │   │   ├── slug-display.tsx           ✓ dark mode fixes
│   │   │   ├── button.tsx
│   │   │   └── [50+ other shadcn components]
│   │   │
│   │   ├── 📁 figma/
│   │   │   └── ImageWithFallback.tsx
│   │   │
│   │   ├── NavigationNewDesign.tsx        ✓ nav contrast
│   │   ├── PostCreatorModal.tsx           ✓ modal visibility
│   │   ├── EventCheckoutSheet.tsx         ✓ modal borders
│   │   ├── TicketPurchaseModal.tsx        ✓ text contrast
│   │   ├── CommentModal.tsx               ✓ modal visibility
│   │   ├── NotificationSystem.tsx         ✓ panel contrast
│   │   ├── MapboxEventMap.tsx             ✓ map theme
│   │   ├── EventFeed.tsx
│   │   ├── EventPostsGrid.tsx
│   │   └── [100+ other components]
│   │
│   ├── 📁 features/
│   │   └── 📁 feed/
│   │       └── 📁 routes/
│   │           ├── FeedPage.tsx
│   │           └── FeedPageNewDesign.tsx
│   │
│   ├── index.css                   (global styles)
│   ├── styles-new-design.css       (new design styles)
│   └── App.tsx                     (routing)
│
├── 📁 supabase/functions/
│   ├── home-feed/                  (feed data with badge fixes)
│   ├── posts-list/
│   ├── comments-add/
│   └── reactions-toggle/
│
└── 📄 Documentation/
    ├── DESIGN_FILES_ANALYSIS.md
    ├── CLEANUP_COMPLETE_SUMMARY.md
    ├── MODAL_VISIBILITY_FIXES.md
    └── CONTRAST_FIXES_APPLIED.md
```

---

## 🎯 **Quick Reference: Where to Edit**

### **Need to change navigation?**
→ `src/components/NavigationNewDesign.tsx`

### **Need to change feed cards?**
→ `src/components/feed/FeedCard.tsx` or `EventCardNewDesign.tsx`

### **Need to change interaction buttons?**
→ `src/components/feed/FloatingActions.tsx`

### **Need to change modals?**
→ `src/components/PostCreatorModal.tsx` (post creation)
→ `src/components/EventCheckoutSheet.tsx` (ticket purchase)
→ `src/components/CommentModal.tsx` (comments)

### **Need to change page layouts?**
→ `src/pages/new-design/[PageName].tsx`

### **Need to change UI primitives (buttons, cards, etc.)?**
→ `src/components/ui/[component].tsx`

### **Need to change global styles?**
→ `src/index.css` (CSS variables, global classes)

---

## ✅ **All Fixed & Ready!**

**Total Production Files:**
- 8 main pages
- 9 feed components
- 56 UI components
- 6 modal components
- 1 navigation component
- All with your recent contrast & visibility fixes! ✓

**To push changes, run in YOUR terminal:**
```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade
git add .
git commit -m "feat: contrast improvements and design cleanup"
git push origin main
```

🎉 **Clean, organized, single source of truth!**

