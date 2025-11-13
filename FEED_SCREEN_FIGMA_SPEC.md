# 📱 Liventix Feed Screen - Complete Figma Design Specification

## 🎯 Overview
The feed is a full-screen, vertically-scrolling, snap-scroll experience similar to TikTok/Instagram Reels with event cards and user posts.

---

## 📐 Screen Layout Structure

### **Container Hierarchy:**
```
┌─────────────────────────────────────────┐
│  Full Screen Container (100dvh)         │
│  ┌───────────────────────────────────┐  │
│  │  Background Gradient Layer        │  │
│  │  (Dark gradient + radial glow)    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Title Section (Fixed Top)        │  │
│  │  - LAUNDACH                       │  │
│  │  - YARD-PASS                      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Sticky Header (Filters)          │  │
│  │  - Location + Date Pills          │  │
│  │  - Tune Button                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Scrollable Feed Content          │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Card 1 (Event/Post)        │  │  │
│  │  │  - Full height snap point   │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Card 2 (Event/Post)        │  │  │
│  │  │  - Full height snap point   │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  ... (infinite scroll)            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🎨 Design Tokens

### **Colors:**
```
Background:
- Base: #000000 (Pure black)
- Gradient overlay: Linear from #0F0F0F → #000000
- Radial glow: rgba(120,119,198,0.35) at top center, fading to transparent

Text:
- Primary: #FFFFFF (White)
- Secondary: rgba(255,255,255,0.7) (70% white)
- Tertiary: rgba(255,255,255,0.4) (40% white)

Accents:
- Primary: #FF8C00 (Orange - brand color)
- Secondary: rgba(255,255,255,0.1) (10% white - glassmorphism)
- Border: rgba(255,255,255,0.12) (12% white)

Interactive States:
- Hover: rgba(255,255,255,0.2) (20% white)
- Active: rgba(255,255,255,0.15) (15% white)
- Focus ring: #FF8C00 with 60% opacity
```

### **Typography:**
```
Title "LAUNDACH":
- Font: Inter Bold
- Size: 24px (1.5rem)
- Weight: 700
- Color: #FFFFFF
- Letter spacing: 0.02em

Title "YARD-PASS":
- Font: Inter Bold / Cal Sans
- Size: 36px (2.25rem)
- Weight: 700
- Color: #FFFFFF
- Letter spacing: 0.01em

Location Header:
- Font: Inter Semibold
- Size: 14-16px (0.875-1rem)
- Weight: 600
- Color: #FFFFFF

Filter Pills:
- Font: Inter Medium
- Size: 10px (0.625rem)
- Weight: 500
- Color: rgba(255,255,255,0.7)
```

### **Spacing:**
```
Padding:
- Screen edges: 12px mobile, 16px desktop
- Card content: 16-24px
- Header padding: 8px top, 8px bottom
- Element gaps: 4-8px

Margin:
- Title section: 16px top, 8px bottom
- Header filters: 6px top margin
- Card separation: 0 (snap scroll handles this)
```

### **Border Radius:**
```
Cards: 32px (rounded-[32px])
Filter pills: 9999px (rounded-full)
Buttons: 9999px (rounded-full)
Images: 12-16px (rounded-xl)
```

---

## 🏗️ Component Breakdown

### **1. Background Layer**

**Component:** `div.relative.h-dvh.w-full`

**Elements:**
1. **Gradient Overlay**
   - Position: Absolute, inset-0
   - Background: `linear-gradient(to bottom, #0F0F0F, #000000)`
   - Z-index: -1
   
2. **Radial Glow** (Purple accent)
   - Position: Absolute, top -30%
   - Size: 520px height, 125% width
   - Background: `radial-gradient(circle at center, rgba(120,119,198,0.35) 0%, rgba(32,31,60,0.05) 55%, transparent 75%)`
   - Blur: 48px (blur-3xl)

**Figma Setup:**
- Create 100vh frame
- Add linear gradient fill (black to dark gray)
- Add ellipse at top with radial gradient (purple glow)
- Apply gaussian blur 48px to ellipse

---

### **2. Title Section** (Fixed Top)

**Component:** `div.relative.z-40.px-3.pt-4.pb-2`

**Layout:**
```
┌─────────────────────────────┐
│  LAUNDACH                   │  ← 24px, bold, white
│  YARD-PASS                  │  ← 36px, bold, white
└─────────────────────────────┘
```

**Specs:**
- Container: Full width, centered content
- Max width: 1280px (max-w-5xl)
- Padding: 16px top, 8px bottom, 12px sides
- Text alignment: Center
- Z-index: 40 (above content)

**Figma Layers:**
1. Container frame (auto-layout, vertical)
2. Text "LAUNDACH" (24px, bold, #FFFFFF)
3. Text "YARD-PASS" (36px, bold, #FFFFFF)

---

### **3. Sticky Header** (Filter Bar)

**Component:** `header.sticky.top-0.z-30`

#### **3A. Main Filter Container**
```
┌────────────────────────────────────────┐
│  Near Brooklyn          [🎛️ Tune]     │  ← Glassmorphic bar
└────────────────────────────────────────┘
```

**Specs:**
- Background: rgba(255,255,255,0.05) (5% white)
- Border: 1px solid rgba(255,255,255,0.1)
- Border radius: 12px (rounded-xl)
- Padding: 8px 12px
- Backdrop blur: 24px (backdrop-blur-xl)
- Shadow: 0 8px 32px rgba(0,0,0,0.3)

**Elements:**
1. **Location Text**
   - Font: Inter Semibold
   - Size: 14-16px
   - Color: #FFFFFF
   - Flex: 1 (grows to fill space)

2. **Tune Button**
   - Background: rgba(255,255,255,0.1)
   - Border: 1px solid rgba(255,255,255,0.2)
   - Border radius: 9999px (full)
   - Padding: 6px 12px
   - Height: 28px
   - Icon: SlidersHorizontal (12px)
   - Text: "Tune" (11px, medium weight)
   - Color: #FFFFFF
   - Hover: rgba(255,255,255,0.2)

#### **3B. Filter Pills Row**
```
┌──────────────────────────────────────────┐
│  [📍 Near Brooklyn]  [🧭 This Weekend]  │  ← Small pills
└──────────────────────────────────────────┘
```

**Specs (Each Pill):**
- Background: rgba(0,0,0,0.3)
- Border: 1px solid rgba(255,255,255,0.1)
- Border radius: 9999px (full)
- Padding: 2px 8px
- Height: 20px
- Font size: 10px
- Icon size: 10px (h-2.5 w-2.5)
- Gap between icon and text: 4px
- Margin between pills: 4px

**Figma Setup:**
1. Create auto-layout frame (horizontal, 4px gap)
2. Add pill components (auto-layout, horizontal, 4px gap)
3. Icon (MapPin/Compass) 10x10px
4. Text (10px, medium)
5. Apply glassmorphic style

---

### **4. Feed Card** (Repeating Element)

**Component:** `section.snap-start.h-dvh`

#### **Card Container:**
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │   Card Content Area               │  │
│  │   (Event or Post)                 │  │
│  │                                   │  │
│  │   Glassmorphic background         │  │
│  │   Rounded corners 32px            │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Specs:**
- Height: calc(100dvh - 5rem) ≈ 90% screen height
- Width: 100% with 12px side padding (mobile), 24px (desktop)
- Max width: 1280px (centered)
- Border radius: 32px
- Border: 1px solid rgba(255,255,255,0.12)
- Background: rgba(255,255,255,0.05) (5% white - glassmorphism)
- Box shadow: 0 40px 90px rgba(0,0,0,0.45)
- Backdrop blur: 24px

**Inner Glow:**
- Position: Absolute, inset-0, z-index -10
- Background: `radial-gradient(circle at top, rgba(255,255,255,0.16) 0%, transparent 55%)`
- Opacity: 70%

**Figma Setup:**
1. Create frame (calc height, full width)
2. Apply glassmorphic fill (5% white)
3. Add border (12% white, 1px)
4. Add shadow (0, 40, 90, rgba(0,0,0,0.45))
5. Add inner radial gradient overlay
6. Apply backdrop blur effect (24px)

---

### **5. Event Card** (Type 1)

**Used for:** Event listings in feed

**Structure:**
```
┌─────────────────────────────────────────┐
│  ┌─────────────────────────┐            │
│  │  Event Cover Image      │            │
│  │  (16:9 aspect ratio)    │            │
│  │  with gradient overlay  │            │
│  │                         │            │
│  │  ┌───────────────────┐  │            │
│  │  │  Event Details    │  │            │
│  │  │  - Title          │  │            │
│  │  │  - Date/Time      │  │            │
│  │  │  - Location       │  │            │
│  │  │  - Price          │  │            │
│  │  └───────────────────┘  │            │
│  └─────────────────────────┘            │
│                                         │
│  [❤️ Like] [💬 Comment] [🎫 Tickets]   │
└─────────────────────────────────────────┘
```

**Component File:** `src/components/EventCard.tsx`

**Key Elements:**
- Event cover image (16:9)
- Title overlay
- Metadata (date, location, price)
- Action buttons (like, comment, tickets)

---

### **6. User Post Card** (Type 2)

**Used for:** Social posts in feed

**Structure:**
```
┌─────────────────────────────────────────┐
│  ┌─────────────────────────┐            │
│  │  [Avatar] Username      │  ← Header  │
│  │  Event Name • 2h ago    │            │
│  └─────────────────────────┘            │
│  ┌─────────────────────────┐            │
│  │                         │            │
│  │   Media Content         │            │
│  │   (Photo or Video)      │  ← Media   │
│  │   9:16 aspect ratio     │            │
│  │                         │            │
│  └─────────────────────────┘            │
│  Post caption text...      │  ← Caption │
│                            │            │
│  [❤️ 24] [💬 8] [↗️ Share] │  ← Actions │
└─────────────────────────────────────────┘
```

**Component File:** `src/components/UserPostCard.tsx`

#### **6A. Post Header:**
**Specs:**
- Height: 56px
- Padding: 12px 16px
- Layout: Horizontal, items centered
- Gap: 12px

**Elements:**
1. **Avatar**
   - Size: 40x40px
   - Border radius: 50% (full circle)
   - Border: 2px solid rgba(255,255,255,0.2)
   
2. **User Info (Vertical stack)**
   - Username
     - Font: Inter Semibold
     - Size: 15px
     - Color: #FFFFFF
     - Weight: 600
   
   - Event name + timestamp
     - Font: Inter Regular
     - Size: 13px
     - Color: rgba(255,255,255,0.6)
     - Format: "Event Name • 2h ago"

3. **More Button** (Right side)
   - Size: 32x32px
   - Icon: MoreVertical (20px)
   - Color: rgba(255,255,255,0.7)
   - Hover: rgba(255,255,255,1)

#### **6B. Media Area:**

**For Videos:**
```
Aspect Ratio: 9:16 (Portrait, TikTok-style)
Max Height: 80vh
Border Radius: 24px (rounded-3xl)
Background: #000000

Overlays:
- Loading spinner (center)
- Play/Pause button (tap anywhere)
- Progress bar (bottom, 2px height)
- Sound toggle (bottom right)
- Bookmark button (top right)
```

**For Images:**
```
Aspect Ratio: Flexible (covers container)
Max Height: 60vh
Border Radius: 16px (rounded-xl)
Object fit: Cover
```

**Video Controls:**
1. **Sound Toggle** (Bottom right)
   - Size: 40x40px
   - Background: rgba(0,0,0,0.5)
   - Backdrop blur: 8px
   - Icon: Volume2 or VolumeX (20px)
   - Border radius: 50%

2. **Bookmark Button** (Top right)
   - Size: 40x40px
   - Background: rgba(0,0,0,0.5)
   - Backdrop blur: 8px
   - Icon: Bookmark (20px)
   - Border radius: 50%

3. **Progress Bar** (Bottom)
   - Height: 2px
   - Width: 100%
   - Background: rgba(255,255,255,0.2)
   - Fill: #FFFFFF
   - Position: Absolute bottom

#### **6C. Caption Area:**
**Specs:**
- Padding: 12px 16px
- Font: Inter Regular
- Size: 14px
- Line height: 1.5
- Color: rgba(255,255,255,0.9)
- Max lines: 3 (with "... more" truncation)

#### **6D. Action Rail:**
```
┌────────────────────────────────────────┐
│  [❤️ 24]    [💬 8]    [↗️ Share]      │
└────────────────────────────────────────┘
```

**Specs:**
- Layout: Horizontal, evenly spaced
- Padding: 12px 16px
- Gap: 24px
- Height: 48px

**Each Action Button:**
```
Structure: [Icon] [Count]
Size: Auto (content-based)
Gap: 8px between icon and count
Tap target: 44x44px minimum

Icon:
- Size: 20px
- Color: #FFFFFF
- Hover: #FF8C00 (brand orange)

Count:
- Font: Inter Medium
- Size: 14px
- Color: rgba(255,255,255,0.8)
```

**Button Types:**
1. **Like Button**
   - Icon: Heart (outline when not liked, filled when liked)
   - Active color: #DC2626 (red)
   
2. **Comment Button**
   - Icon: MessageCircle
   - Color: #FFFFFF
   
3. **Share Button**
   - Icon: Share (arrow pointing up-right)
   - Color: #FFFFFF

---

## 📱 Responsive Breakpoints

### **Mobile (< 640px):**
```
Card padding: 12px sides
Card max width: 100%
Font sizes: Base (as specified)
Touch targets: 44x44px minimum
```

### **Desktop (>= 640px):**
```
Card padding: 24px sides
Card max width: 1280px (centered)
Font sizes: Slightly larger
Hover states: More prominent
```

---

## 🎬 Animations & Interactions

### **Scroll Behavior:**
```
Type: Snap scroll (vertical)
Snap type: Mandatory
Snap alignment: Start
Scroll snap stop: Always
Overscroll: Contain (no bounce)
```

### **Card Transitions:**
```
Transform: translateY (for snap scrolling)
Transition: 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)
Property: transform
```

### **Button Interactions:**
```
Hover:
- Scale: 1.05
- Background opacity: +10%
- Transition: 150ms ease

Active:
- Scale: 0.95
- Transition: 100ms ease

Focus:
- Ring: 2px solid rgba(255,140,0,0.6)
- Offset: 2px
```

### **Video Autoplay:**
```
Trigger: Card scrolls into view + user has interacted
Behavior: Play muted by default
Controls: Tap to pause/play, tap sound icon to unmute
```

---

## 🔍 Component Files Reference

| Component | File Path |
|-----------|-----------|
| **Feed Container** | `src/features/feed/components/UnifiedFeedList.tsx` |
| **Event Card** | `src/components/EventCard.tsx` |
| **User Post Card** | `src/components/UserPostCard.tsx` |
| **Video Player** | `src/components/feed/VideoMedia.tsx` |
| **Action Rail** | `src/components/ActionRail.tsx` |
| **Filter Modal** | `src/components/FeedFilter.tsx` |
| **Comment Modal** | `src/components/CommentModal.tsx` |
| **Ticket Modal** | `src/components/EventTicketModal.tsx` |

---

## 🎨 Glassmorphism Style Guide

### **Card Glassmorphism:**
```
Background: rgba(255,255,255,0.05)
Border: 1px solid rgba(255,255,255,0.12)
Backdrop blur: 24px
Box shadow: 0 40px 90px rgba(0,0,0,0.45)
```

### **Header Glassmorphism:**
```
Background: rgba(0,0,0,0.95) → rgba(0,0,0,0.7) gradient
Border: 1px solid rgba(255,255,255,0.1)
Backdrop blur: 16px (backdrop-blur-md)
```

### **Button Glassmorphism:**
```
Background: rgba(255,255,255,0.1)
Border: 1px solid rgba(255,255,255,0.2)
Backdrop blur: 8px
Hover: rgba(255,255,255,0.2)
```

---

## 📊 Dimensions Reference

### **Screen Sizes:**
```
Mobile Portrait: 375x812px (iPhone 13)
Mobile Landscape: 812x375px
Tablet: 768x1024px (iPad)
Desktop: 1440x900px (Standard)
```

### **Safe Areas (iOS):**
```
Status bar: 44px top
Home indicator: 34px bottom
Side margins: 12px left/right
```

### **Card Dimensions:**
```
Mobile: 
- Width: calc(100vw - 24px)
- Height: calc(100dvh - 80px)

Desktop:
- Width: min(1280px, calc(100vw - 48px))
- Height: calc(100dvh - 80px)
```

---

## 🎯 States & Variations

### **Loading State:**
```
Show: YardpassSpinner component
Position: Center of screen
Background: #000000
Message: "Loading your feed..."
```

### **Empty State:**
```
Show: Icon + message
Icon: Sparkles (48px)
Message: "No posts yet"
CTA: "Explore events" button
```

### **Error State:**
```
Show: Error icon + message
Icon: AlertCircle (48px, red)
Message: "We couldn't load your feed."
CTAs: "Refresh feed" + "Browse events" buttons
```

### **Video States:**
1. **Loading:** Spinner overlay (center)
2. **Playing:** No overlay, progress bar animating
3. **Paused:** Play button overlay (center, large)
4. **Buffering:** Spinner overlay
5. **Error:** Error message overlay

---

## 🎨 Color Palette for Figma

### **Brand Colors:**
```
Orange (Primary):    #FF8C00
Orange Light:        #FFB547
Yellow (Accent):     #FCD34D
```

### **Neutrals:**
```
Black:               #000000
Dark Gray:           #0F0F0F
Medium Gray:         #1E1E1E
Light Gray:          rgba(255,255,255,0.1)
White:               #FFFFFF
```

### **Semantic Colors:**
```
Success:             #16A34A
Warning:             #F59E0B
Error:               #DC2626
Info:                #3B82F6
```

### **Opacity Levels:**
```
5%:  Background fill
10%: Button background
12%: Borders
20%: Hover states
40%: Secondary text
60%: Tertiary text
70%: Primary text overlay
100%: Primary text
```

---

## 📐 Figma Layer Structure

```
Liventix Feed Screen
├── 🖼️ Background
│   ├── Gradient (linear)
│   └── Radial glow (blur 48px)
│
├── 📝 Title Section
│   ├── LAUNDACH (24px)
│   └── YARD-PASS (36px)
│
├── 🎛️ Sticky Header
│   ├── Filter bar (glassmorphic)
│   │   ├── Location text
│   │   └── Tune button
│   └── Filter pills row
│       ├── Location pill
│       └── Date pill
│
└── 📜 Feed Content (Scrollable)
    ├── Card 1 - Event
    │   ├── Cover image
    │   ├── Event info overlay
    │   └── Action buttons
    │
    ├── Card 2 - Post
    │   ├── Post header
    │   ├── Media (video/image)
    │   ├── Caption
    │   └── Action rail
    │
    └── ... (repeat)
```

---

## ✨ Special Effects

### **Glassmorphism:**
- **Blur:** 16-24px backdrop blur
- **Opacity:** 5-10% white background
- **Border:** 1px white at 10-20% opacity
- **Shadow:** Large, soft shadows (40-90px blur)

### **Gradient Overlays:**
- **Direction:** Usually top to bottom or radial from center
- **Colors:** Black to transparent or purple to transparent
- **Opacity:** 30-70%

### **Micro-interactions:**
- **Button press:** Scale 0.95, 100ms
- **Button hover:** Scale 1.05, 150ms  
- **Like animation:** Heart scale bounce
- **Scroll snap:** Smooth ease-out

---

## 📦 Export Settings for Figma

### **Assets to Export:**
```
Icons: SVG, 1x
Images: PNG, @2x and @3x for retina
Gradients: Export as CSS/code
Glassmorphic elements: Export with blur as separate layer
```

### **Component Variants:**
```
Event Card:
- Default
- With video
- Loading
- Error

Post Card:
- Default
- With video
- With multiple images
- Text only

Video Player:
- Playing
- Paused
- Loading
- Error
```

---

## 🎯 Design Principles

1. **Dark-first:** Black background, white text, subtle glows
2. **Glassmorphism:** Frosted glass aesthetic throughout
3. **Minimal borders:** Use opacity and blur for separation
4. **Large touch targets:** 44x44px minimum
5. **Smooth animations:** Ease curves, spring physics
6. **Content-first:** Media takes center stage
7. **Subtle gradients:** No harsh transitions

---

**Last Updated:** After systematic fixes
**Screen:** Feed (Main)
**Platform:** Mobile-first, responsive to desktop
**Framework:** React + Tailwind CSS

