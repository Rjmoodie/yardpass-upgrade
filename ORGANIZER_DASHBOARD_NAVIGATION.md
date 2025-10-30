# 🧭 Organizer Dashboard Navigation Architecture

## Overview

The Organizer Dashboard now features **dual navigation modes** to optimize user experience across different contexts:

1. **App View** (Lightweight) - Mobile-friendly, essential features only
2. **Full Dashboard** - Complete feature set with all heavy utilities

---

## 🎯 Navigation Modes

### **App View** 📱 (Lightweight)
*Streamlined interface for mobile and quick access*

**Visible Tabs:**
- 📅 **Events** - Core event management
- ✉️ **Messaging** - Communication tools
- 👥 **Teams** - Team member management
- ⚙️ **Org Settings** - Organization configuration

**Use Cases:**
- Mobile devices
- Quick updates on-the-go
- Essential operations only
- Reduced cognitive load

---

### **Full Dashboard** 💻 (Complete)
*Comprehensive interface with all features and heavy utilities*

**Visible Tabs:**
- 📅 **Events** - Full event pipeline with analytics
- 📊 **Analytics** - Deep insights and metrics
- 📢 **Campaigns** - Marketing campaign management
- ✉️ **Messaging** - Event communications
- 👥 **Teams** - Team management
- 💰 **Wallet** - Financial operations
- 💵 **Payouts** - Payment distribution
- 🤝 **Sponsorship** - Sponsor relationship management
- ⚙️ **Org Settings** - Organization settings

**Use Cases:**
- Desktop/laptop usage
- Comprehensive event management
- Financial operations
- Marketing and sponsorship activities
- Advanced analytics review

---

## 🔄 View Mode Toggle

Users can switch between views using the toggle button in the dashboard header:

**App View Mode:**
- Button shows: **📊 Full Dashboard**
- Click to switch to Full Dashboard

**Full Dashboard Mode:**
- Button shows: **📱 App View**
- Click to switch to App View

**Features:**
- Persistent across sessions (stored in localStorage)
- Automatically defaults based on device width:
  - Mobile (< 768px): App View
  - Desktop (≥ 768px): Full Dashboard
- Smooth transitions between modes
- Active tab intelligently switches to "Events" if current tab unavailable in new mode

---

## 🎨 Visual Design

### Tab Styling
- **Icons + Labels**: Clear visual hierarchy
- **Horizontal Scrolling**: Responsive on smaller screens
- **Consistent Spacing**: `min-w-[90px]` for touch-friendly targets
- **Active State**: Visual feedback with accent colors
- **Mobile-First**: Touch-optimized with `flex-shrink-0`

### Toggle Button
- **Ghost variant**: Subtle, non-intrusive
- **Hidden on mobile**: View mode auto-adjusts
- **Icon + Text**: Clear affordance
- **Tooltip**: Explains switching behavior

---

## 🗂️ Tab Configuration

### Code Structure

```typescript
// Full list of all possible tabs
const TAB_KEYS = [
  'events', 
  'analytics', 
  'campaigns', 
  'messaging', 
  'teams', 
  'wallet', 
  'payouts', 
  'sponsorship'
] as const;

// App View tabs (lightweight)
const APP_VIEW_TABS: TabKey[] = [
  'events', 
  'messaging', 
  'teams'
];

// Full Dashboard tabs (complete)
const FULL_DASHBOARD_TABS: TabKey[] = [
  'events', 
  'analytics', 
  'campaigns', 
  'messaging', 
  'teams', 
  'wallet', 
  'payouts', 
  'sponsorship'
];
```

---

## 🔐 Persistence & State Management

### LocalStorage Keys
- `organizer.viewMode` - Stores current view mode ('app' | 'full')
- `organizer.lastTab.{orgId}` - Stores last active tab per organization
- `organizer.lastOrgId` - Stores last selected organization

### State Synchronization
1. **View Mode Changes**: Automatically saved to localStorage
2. **Tab Changes**: Synced to URL query params (`?tab=events`)
3. **Organization Changes**: Tab state preserved per organization
4. **Mode Switching**: If active tab unavailable, defaults to 'events'

### Analytics Tracking
```typescript
trackEvent('view_mode_toggled', { 
  new_mode: 'app' | 'full' 
});

trackEvent('organizer_tab_view', { 
  tab: tabKey, 
  org_id: organizationId 
});
```

---

## 📊 Tab Content Summary

### Events Tab
- Event pipeline with search & filters
- Status tracking (upcoming, live, completed, draft)
- Ticket sales and revenue metrics
- Quick event creation
- Operational insights

### Analytics Tab
- Deep dive into event performance
- Revenue trends and forecasting
- Attendance analytics
- Engagement metrics
- Custom reports

### Campaigns Tab
- Marketing campaign management
- Campaign creation wizard
- Budget tracking
- Performance metrics (CTR, conversions)
- Multi-channel support

### Messaging Tab
- Event communications panel
- Email & SMS messaging
- Recipient management
- Message history
- Template library

### Teams Tab
- Organization team members
- Role-based access control
- Invitation management
- Permission settings
- Team activity logs

### Wallet Tab
- Organization wallet balance
- Transaction history
- Payment methods
- Refund management
- Financial overview

### Payouts Tab
- Payment distribution
- Connected accounts (Stripe/PayPal)
- Payout schedules
- Transaction reconciliation
- Tax documentation

### Sponsorship Tab *(Coming Soon)*
- Sponsorship package creation
- Sponsor relationship management
- Revenue tracking
- ROI metrics
- Sponsor portal access

---

## 🚀 Implementation Details

### Component File
`src/components/OrganizerDashboard.tsx`

### Key Features
1. **Conditional Rendering**: Tabs render based on `availableTabs` array
2. **Responsive Design**: Toggle hidden on mobile, auto-adjusts view mode
3. **Lazy Loading**: Heavy components loaded on-demand with Suspense
4. **Tab Memory**: Remembers last active tab per organization
5. **URL Sync**: Tab state reflected in URL for bookmarking

### Hooks Used
- `useState` - View mode and tab state
- `useEffect` - Persistence and synchronization
- `useCallback` - Optimized toggle function
- `useMemo` - Available tabs computation
- `useSearchParams` - URL state management

---

## 📱 Responsive Behavior

### Desktop (≥ 768px)
- Shows toggle button
- Defaults to Full Dashboard
- All tabs visible (if in Full mode)
- Horizontal tab layout with scroll

### Mobile (< 768px)
- Hides toggle button
- Defaults to App View
- Only essential tabs visible
- Touch-optimized spacing
- Smooth horizontal scroll

---

## 🎯 User Flow Examples

### Example 1: Desktop User
1. Opens dashboard → Full Dashboard mode
2. Sees all 8 tabs + Org Settings
3. Can toggle to App View for focused work
4. View preference saved for next visit

### Example 2: Mobile User
1. Opens dashboard → App View mode
2. Sees 3 essential tabs + Org Settings
3. No toggle button (automatic)
4. Lightweight, fast experience

### Example 3: Switching Organizations
1. User switches from Org A to Org B
2. Last active tab for Org B is restored
3. View mode persists across org switches
4. Seamless continuation of work

---

## 🔧 Customization Guide

### Adding New Tabs

1. **Add to TAB_KEYS**:
```typescript
const TAB_KEYS = [..., 'newtab'] as const;
```

2. **Add to appropriate view**:
```typescript
const FULL_DASHBOARD_TABS = [..., 'newtab'];
// Or
const APP_VIEW_TABS = [..., 'newtab'];
```

3. **Add TabTrigger**:
```tsx
{availableTabs.includes('newtab') && (
  <TabsTrigger value="newtab" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
    <Icon className="h-5 w-5" />
    <span className="text-xs whitespace-nowrap">New Tab</span>
  </TabsTrigger>
)}
```

4. **Add TabsContent**:
```tsx
<TabsContent value="newtab" className="space-y-6">
  <YourComponent />
</TabsContent>
```

---

## ✅ Testing Checklist

- [ ] View mode toggle works correctly
- [ ] View mode persists across sessions
- [ ] Tab visibility correct in both modes
- [ ] Active tab switches when unavailable in new mode
- [ ] URL params sync with tab changes
- [ ] LocalStorage updates correctly
- [ ] Analytics events fire properly
- [ ] Mobile responsiveness validated
- [ ] Organization switching preserves state
- [ ] All tab content loads correctly

---

## 🐛 Troubleshooting

### Issue: Toggle button not appearing
**Solution**: Check screen width (only visible ≥ 768px)

### Issue: Tabs not switching
**Solution**: Ensure tab key is in TAB_KEYS array

### Issue: View mode not persisting
**Solution**: Check browser localStorage is enabled

### Issue: Wrong tabs showing
**Solution**: Verify availableTabs includes correct tabs

---

## 📚 Related Files

- `src/components/OrganizerDashboard.tsx` - Main component
- `src/components/AnalyticsHub.tsx` - Analytics tab
- `src/components/campaigns/CampaignDashboard.tsx` - Campaigns tab
- `src/components/organizer/OrganizerCommsPanel.tsx` - Messaging tab
- `src/components/OrganizationTeamPanel.tsx` - Teams tab
- `src/components/wallet/OrgWalletDashboard.tsx` - Wallet tab
- `src/components/PayoutPanel.tsx` - Payouts tab

---

## 🎓 Best Practices

1. **Always check availableTabs** before rendering tab-specific UI
2. **Use conditional rendering** for tab triggers and content
3. **Persist user preferences** for better UX
4. **Track analytics events** for usage insights
5. **Test on multiple devices** and screen sizes
6. **Maintain tab state** across organization switches
7. **Provide clear visual feedback** for active states

---

## 🚧 Future Enhancements

- [ ] Custom tab ordering per user preference
- [ ] Keyboard shortcuts for tab navigation
- [ ] Tab search/filter for power users
- [ ] Drag-and-drop tab reordering
- [ ] Tab groups/categories
- [ ] Pin favorite tabs
- [ ] Tab-specific notifications

---

**Last Updated**: October 28, 2025
**Version**: 1.0.0
**Component**: `OrganizerDashboard`

