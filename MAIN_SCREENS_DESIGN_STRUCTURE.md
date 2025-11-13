# 🎨 Liventix Main Screens - Design Structure & Files

Complete reference for all main screens in the Liventix application.

---

## 📱 Screen Categories

### **Mobile-Only Screens**
Features accessible only on mobile app
- Feed (Home)
- Search
- Tickets
- Social
- Profile

### **Web-Only Screens**
Features accessible only on web platform
- Sponsorship
- Analytics Dashboard
- Event Management
- Organization Dashboard

### **Shared Screens**
Accessible on both platforms
- Event Details
- User Profile
- Messages
- Notifications

---

## 1️⃣ FEED SCREEN (Mobile & Web)

### **Primary File:**
```
src/features/feed/routes/FeedPage.tsx
```

### **Core Components:**
```
src/features/feed/components/
├── UnifiedFeedList.tsx          # Main feed container
├── VideoMedia.tsx                # Video player component
└── useUnifiedFeedInfinite.ts    # Feed data hook
```

### **Card Components:**
```
src/components/
├── EventCard.tsx                 # Event cards in feed
├── UserPostCard.tsx              # User post cards
└── ActionRail.tsx                # Right-side action buttons
```

### **Supporting Components:**
```
src/components/
├── FeedFilter.tsx                # Filter drawer/modal
├── FeedGestures.tsx              # Swipe gestures
├── FeedKeymap.tsx                # Keyboard shortcuts
├── CommentModal.tsx              # Comment interface
└── PostCreatorModal.tsx          # Create post modal
```

### **Design Specs:**
- **Layout:** Vertical snap-scroll, full-screen cards
- **Colors:** Black background, white text, gradient overlays
- **Interactions:** Swipe up/down, tap to like/comment
- **Video:** Auto-play when in view, muted by default
- **Actions:** Like, Comment, Share, Create Post, Report

### **Routes:**
- `/` - Main feed

---

## 2️⃣ SEARCH SCREEN (Mobile & Web)

### **Primary File:**
```
src/components/SearchPage.tsx
```

### **Key Features:**
- Event search
- Host/organizer search
- Category filtering
- Location-based search
- Date range filtering

### **Design Specs:**
- **Layout:** Search bar at top, grid/list of results
- **Colors:** Dark theme with colored category badges
- **Interactions:** Tap result to view details
- **Filters:** Categories, dates, location, price range

### **Routes:**
- `/search` - Main search page

---

## 3️⃣ TICKETS SCREEN (Mobile Only)

### **Primary File:**
```
src/components/TicketsRoute.tsx
```

### **Supporting Components:**
```
src/components/
├── TicketSuccessPage.tsx         # Post-purchase confirmation
├── PurchaseSuccessHandler.tsx    # Purchase flow handler
└── EventTicketModal.tsx          # Ticket selection modal
```

### **Key Features:**
- Active tickets
- Past tickets
- QR code display
- Ticket details
- Transfer tickets
- Refund requests

### **Design Specs:**
- **Layout:** Wallet-style card list
- **Colors:** Gradient cards with event images
- **Interactions:** Tap to expand, swipe to archive
- **QR Codes:** Full-screen scannable codes

### **Routes:**
- `/tickets` - Tickets wallet

---

## 4️⃣ SOCIAL SCREEN (Mobile Only)

### **Primary File:**
```
src/pages/SocialPage.tsx
```

### **Key Features:**
- Friends list
- Following/followers
- Direct messages
- Social feed
- User discovery

### **Design Specs:**
- **Layout:** List of connections, profile cards
- **Colors:** Dark theme with profile images
- **Interactions:** Tap to view profile, swipe to message

### **Routes:**
- `/social` - Social connections

---

## 5️⃣ PROFILE SCREEN (Mobile & Web)

### **Primary Files:**
```
src/components/
├── UserProfile.tsx               # Main profile component
└── ProfileViewContext.tsx        # Profile state management
```

### **Key Features:**
- User info & stats
- Posts grid
- Events (hosted/attending)
- Edit profile
- Settings
- Followers/following counts

### **Design Specs:**
- **Layout:** Header with avatar, tabs for content
- **Colors:** Dark theme with accent colors
- **Interactions:** Tap avatar to edit, swipe between tabs
- **Sections:** Posts, Events, About, Media

### **Routes:**
- `/profile` - Own profile (requires auth)
- `/u/:userId` - Other user profiles

---

## 6️⃣ EVENT DETAILS SCREEN (Mobile & Web)

### **Primary File:**
```
src/pages/EventSlugPage.tsx
```

### **Supporting Components:**
```
src/components/
├── EventFeed.tsx                 # Event-specific feed
├── EventTicketModal.tsx          # Ticket purchase
├── EventAttendeesPageEnhanced.tsx # Attendee list
└── ShareModal.tsx                # Share event
```

### **Key Features:**
- Event cover image/video
- Event details (date, time, location)
- Ticket tiers & pricing
- Event feed (posts)
- Attendees list
- Host info
- Share/save options

### **Design Specs:**
- **Layout:** Hero image, scrollable details, sticky ticket button
- **Colors:** Image-based color extraction, dark overlay
- **Interactions:** Scroll for details, tap to buy tickets
- **Sections:** About, Tickets, Feed, Attendees, Location

### **Routes:**
- `/e/:eventId` - Event details by ID
- `/e/:slug` - Event details by slug
- `/event/:eventId` - Legacy route (redirects)

---

## 7️⃣ SPONSORSHIP SCREEN (Web Only)

### **Primary Files:**
```
src/pages/web/
├── WebSponsorshipPage.tsx        # Main sponsorship page
└── WebLayout.tsx                 # Web layout wrapper
```

### **Components:**
```
src/components/sponsorship/
├── SponsorshipMarketplace.tsx    # Browse opportunities
├── SponsorProfileManager.tsx     # Manage sponsor profile
├── MatchAlgorithm.tsx            # AI matching
├── ProposalNegotiation.tsx       # Proposal chat
├── PaymentEscrowManager.tsx      # Payment handling
├── AnalyticsDashboard.tsx        # Sponsorship analytics
└── NotificationSystem.tsx        # Sponsor notifications
```

### **Design Specs:**
- **Layout:** Horizontal navigation, tabbed interface
- **Colors:** Yellow accent (#FFCC00), dark background
- **Interactions:** Click tabs, filter/search sponsors
- **Sections:** Marketplace, Analytics, Proposals, Settings

### **Routes:**
- `/sponsorship` - Sponsorship marketplace
- `/sponsorship/event/:eventId` - Event sponsorship
- `/sponsorship/sponsor/:sponsorId` - Sponsor details

---

## 8️⃣ ANALYTICS SCREEN (Web Only)

### **Primary File:**
```
src/pages/web/WebAnalyticsPage.tsx
```

### **Supporting Components:**
```
src/components/
├── AnalyticsHub.tsx              # Main analytics dashboard
├── EventAnalytics.tsx            # Event-specific analytics
└── AnalyticsWrapper.tsx          # Analytics tracking wrapper
```

### **Key Features:**
- Event performance metrics
- Ticket sales data
- Engagement stats
- Revenue tracking
- Attendee demographics
- Social metrics

### **Design Specs:**
- **Layout:** Grid of metric cards, charts
- **Colors:** Blue/purple gradient, dark cards
- **Interactions:** Hover for details, click for drill-down
- **Charts:** Line, bar, pie, area charts

### **Routes:**
- `/analytics` - Main analytics dashboard
- `/analytics/event/:eventId` - Event-specific analytics

---

## 9️⃣ EVENT MANAGEMENT SCREEN (Web Only)

### **Primary File:**
```
src/components/EventManagement.tsx
```

### **Related Components:**
```
src/components/
├── CreateEventFlow.tsx           # Create new event
├── EventCreator.tsx              # Event form
├── OrganizerDashboard.tsx        # Organizer overview
└── OrganizationDashboard.tsx     # Org management
```

### **Key Features:**
- Edit event details
- Manage tickets & tiers
- View attendees
- Event analytics
- Promote event
- Duplicate event
- Archive/delete event

### **Design Specs:**
- **Layout:** Sidebar nav, main content area
- **Colors:** Dark theme with action buttons
- **Interactions:** Form inputs, drag-drop media
- **Sections:** Details, Tickets, Team, Analytics, Settings

### **Routes:**
- `/create-event` - Create new event
- `/event/:eventId/manage` - Manage existing event
- `/dashboard` - Organizer dashboard

---

## 🔟 ORGANIZATION SCREEN (Web Only)

### **Primary Files:**
```
src/components/
├── OrganizationDashboard.tsx     # Main org dashboard
├── OrganizationCreator.tsx       # Create org
└── OrgInvitePage.tsx             # Team invitations
```

### **Key Features:**
- Organization profile
- Team management
- Event portfolio
- Analytics & insights
- Billing & payments
- Integrations

### **Design Specs:**
- **Layout:** Multi-column dashboard
- **Colors:** Brand colors, dark background
- **Interactions:** Tabs, modals for actions
- **Sections:** Overview, Events, Team, Settings

### **Routes:**
- `/org/:orgId` - Organization public page
- `/org/:orgId/dashboard` - Organization dashboard
- `/org/create` - Create new organization

---

## 1️⃣1️⃣ SCANNER SCREEN (Mobile Only)

### **Primary File:**
```
src/components/ScannerPage.tsx
```

### **Key Features:**
- QR code scanner
- Ticket validation
- Check-in guests
- Attendee lookup
- Manual entry

### **Design Specs:**
- **Layout:** Full-screen camera view
- **Colors:** Dark overlay with scan frame
- **Interactions:** Camera focus, tap to scan
- **Feedback:** Success/error animations

### **Routes:**
- `/scanner` - QR scanner for check-ins

---

## 1️⃣2️⃣ MESSAGES SCREEN (Mobile & Web)

### **Primary Files:**
```
src/components/
├── DirectMessagesList.tsx        # Conversation list
└── ConversationView.tsx          # Chat interface
```

### **Key Features:**
- Direct messages
- Group chats
- Message notifications
- Read receipts
- Media sharing

### **Design Specs:**
- **Layout:** List of conversations, chat view
- **Colors:** Dark theme, message bubbles
- **Interactions:** Swipe to delete, tap to open
- **Sections:** Inbox, Unread, Archived

### **Routes:**
- `/messages` - Message inbox
- `/messages/:conversationId` - Conversation

---

## 1️⃣3️⃣ NOTIFICATIONS SCREEN (Mobile & Web)

### **Primary File:**
```
src/components/NotificationCenter.tsx
```

### **Key Features:**
- Activity feed
- Push notifications
- In-app notifications
- Notification preferences
- Mark as read

### **Design Specs:**
- **Layout:** Vertical list, grouped by date
- **Colors:** Dark cards, colored badges
- **Interactions:** Tap to view, swipe to dismiss
- **Types:** Likes, Comments, Follows, Events, Tickets

### **Routes:**
- `/notifications` - Notification center

---

## 🎨 DESIGN SYSTEM FILES

### **Global Styles:**
```
src/
├── index.css                     # Global CSS, Tailwind config
└── App.css                       # App-specific styles
```

### **Theme Configuration:**
```
src/
├── lib/theme.ts                  # Theme tokens
└── contexts/ThemeContext.tsx     # Theme provider
```

### **UI Components:**
```
src/components/ui/
├── button.tsx                    # Button variants
├── card.tsx                      # Card component
├── dialog.tsx                    # Modal dialogs
├── input.tsx                     # Form inputs
├── toast.tsx                     # Toast notifications
├── sheet.tsx                     # Bottom sheets
├── tabs.tsx                      # Tab navigation
├── avatar.tsx                    # User avatars
├── badge.tsx                     # Status badges
└── skeleton.tsx                  # Loading skeletons
```

### **Layout Components:**
```
src/components/
├── Navigation.tsx                # Bottom navigation
├── PlatformAwareNavigation.tsx   # Platform-specific nav
├── WebLayout.tsx                 # Web page wrapper
└── MobileLayout.tsx              # Mobile wrapper
```

---

## 🗺️ ROUTING STRUCTURE

### **Main Routes File:**
```
src/App.tsx                       # Main app router
```

### **Route Categories:**

**Public Routes:**
- `/` - Feed
- `/search` - Search
- `/e/:eventId` - Event details
- `/u/:userId` - User profile

**Auth Required:**
- `/profile` - Own profile
- `/tickets` - Ticket wallet
- `/messages` - Messages
- `/notifications` - Notifications
- `/create-event` - Create event

**Web Only:**
- `/sponsorship` - Sponsorship
- `/analytics` - Analytics
- `/dashboard` - Organizer dashboard

**Mobile Only:**
- `/social` - Social connections
- `/scanner` - QR scanner

---

## 🎨 DESIGN TOKENS

### **Colors:**
```css
--primary: #030213              /* Dark background */
--accent: #FFCC00               /* Yellow accent */
--success: #10B981              /* Green */
--error: #EF4444                /* Red */
--warning: #F59E0B              /* Orange */
--info: #3B82F6                 /* Blue */
```

### **Typography:**
```css
--font-size-xs: 0.75rem         /* 12px */
--font-size-sm: 0.875rem        /* 14px */
--font-size-base: 1rem          /* 16px */
--font-size-lg: 1.125rem        /* 18px */
--font-size-xl: 1.25rem         /* 20px */
--font-size-2xl: 1.5rem         /* 24px */
--font-size-3xl: 1.875rem       /* 30px */
--font-size-4xl: 2.25rem        /* 36px */
```

### **Spacing:**
```css
--spacing-xs: 0.25rem           /* 4px */
--spacing-sm: 0.5rem            /* 8px */
--spacing-md: 1rem              /* 16px */
--spacing-lg: 1.5rem            /* 24px */
--spacing-xl: 2rem              /* 32px */
--spacing-2xl: 3rem             /* 48px */
```

### **Border Radius:**
```css
--radius-sm: 0.375rem           /* 6px */
--radius-md: 0.5rem             /* 8px */
--radius-lg: 0.75rem            /* 12px */
--radius-xl: 1rem               /* 16px */
--radius-2xl: 1.5rem            /* 24px */
--radius-full: 9999px           /* Fully rounded */
```

---

## 📊 SCREEN NAVIGATION FLOW

```
┌─────────────────────────────────────────────────────┐
│                    FEED (Home)                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  • Event Cards                               │   │
│  │  • User Posts                                │   │
│  │  • Video Content                             │   │
│  └─────────────────────────────────────────────┘   │
└──────┬────────┬────────┬────────┬─────────┬────────┘
       │        │        │        │         │
       ▼        ▼        ▼        ▼         ▼
   SEARCH   TICKETS  SOCIAL  PROFILE  EVENT DETAILS
       │        │        │        │         │
       │        │        └────────┼─────────┤
       │        │                 │         │
       │        └─────────────────┼─────────┤
       │                          │         │
       └──────────────────────────┴─────────┤
                                            │
                    ┌───────────────────────┴──────────┐
                    │                                  │
                    ▼                                  ▼
              MESSAGES                         NOTIFICATIONS
```

---

## 🔧 UTILITY FILES

### **Hooks:**
```
src/hooks/
├── useAuth.ts                    # Authentication
├── usePlatform.ts                # Platform detection
├── useAnalytics.ts               # Analytics tracking
├── useShare.ts                   # Share functionality
├── useToast.ts                   # Toast notifications
└── useInfiniteScroll.ts          # Infinite scroll
```

### **Utilities:**
```
src/lib/
├── supabase.ts                   # Supabase client
├── constants.ts                  # App constants
├── utils.ts                      # Helper functions
└── validation.ts                 # Form validation
```

### **Contexts:**
```
src/contexts/
├── AuthContext.tsx               # Auth state
├── ThemeContext.tsx              # Theme state
└── ProfileViewContext.tsx        # Profile state
```

---

## 📝 COMPONENT NAMING CONVENTIONS

### **Screens/Pages:**
- `[Name]Page.tsx` - Full page components
- `[Name]Screen.tsx` - Screen-level components

### **Features:**
- `[Feature]Dashboard.tsx` - Dashboard views
- `[Feature]List.tsx` - List views
- `[Feature]Card.tsx` - Card components
- `[Feature]Modal.tsx` - Modal dialogs

### **UI Components:**
- `Button.tsx` - Reusable button
- `Card.tsx` - Reusable card
- `[Name]Form.tsx` - Form components

---

## 🎯 NEXT STEPS FOR NEW SCREENS

To create a new screen:

1. **Create the main component:**
   ```
   src/pages/[ScreenName]Page.tsx
   ```

2. **Add supporting components:**
   ```
   src/components/[feature]/
   ```

3. **Create route in App.tsx:**
   ```typescript
   <Route path="/screen" element={<ScreenPage />} />
   ```

4. **Add navigation item (if needed):**
   ```typescript
   // In PlatformAwareNavigation.tsx
   { id: 'screen', path: '/screen', label: 'Screen', icon: Icon }
   ```

5. **Style with design tokens:**
   - Use Tailwind classes
   - Follow color scheme
   - Maintain consistent spacing

---

## 📚 DOCUMENTATION FILES

- `FEED_SCREEN_FIGMA_SPEC.md` - Feed screen specification
- `DESIGN_SYSTEM_FILES.md` - Design system reference
- `SYSTEMATIC_FIXES_APPLIED.md` - Bug fixes documentation
- `NEW_FEED_DESIGN_IMPLEMENTATION.md` - Modern feed design
- `PLATFORM_STRATEGY_IMPLEMENTATION.md` - Platform strategy

---

**Last Updated:** October 24, 2025
**Version:** 1.0.0
**Status:** Complete and up-to-date

