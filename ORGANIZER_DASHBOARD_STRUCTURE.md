# Organizer Dashboard File Structure

## Main Dashboard Components

### 1. Core Dashboard Files
```
src/components/OrganizerDashboard.tsx          # Main dashboard component (589 lines)
src/components/OrganizationDashboard.tsx       # Organization-specific dashboard
src/pages/OrganizerDashboard.tsx              # Dashboard page wrapper
```

### 2. Dashboard Sections
```
src/components/dashboard/
├── DashboardOverview.tsx                      # Main overview with metrics
├── EventsList.tsx                             # List of events
└── LoadingSpinner.tsx                         # Loading states
```

### 3. Campaign Management
```
src/components/campaigns/
├── CampaignDashboard.tsx                      # Main campaign interface
├── CampaignAnalytics.tsx                      # Campaign performance metrics
├── CampaignCreator.tsx                        # Create new campaigns
├── CampaignList.tsx                           # List of campaigns
└── CreativeManager.tsx                        # Manage ad creatives
```

### 4. Organizer Tools
```
src/components/organizer/
├── OrganizerCommsPanel.tsx                    # Communications/messaging
├── OrganizerRolesPanel.tsx                    # Role management
└── PackageEditor.tsx                          # Event package editor
```

### 5. Financial Management
```
src/components/wallet/
├── OrgWalletDashboard.tsx                     # Organization wallet
├── OrgBuyCreditsModal.tsx                     # Buy credits for org
├── WalletTransactionsTable.tsx                # Transaction history
├── WalletDashboard.tsx                        # Individual wallet
└── BuyCreditsModal.tsx                        # Individual credit purchase
```

## Supporting Components

### 6. Analytics & Reporting
```
src/components/AnalyticsHub.tsx                # Analytics dashboard
src/components/PayoutPanel.tsx                 # Payout management
```

### 7. Team & Organization
```
src/components/OrganizationTeamPanel.tsx       # Team management
src/components/OrgSwitcher.tsx                 # Switch between organizations
src/components/EventManagement.tsx             # Event management tools
```

## Routes & Navigation

### 8. App Routing (src/App.tsx)
```typescript
// Main dashboard route
<Route path="/dashboard" element={<OrganizerDashboard />} />

// Organization-specific dashboard
<Route path="/organization/:id" element={<OrganizationDashboardRouteComponent />} />
```

### 9. Navigation Integration
```typescript
// src/components/Navigation.tsx
{ 
  id: 'dashboard', 
  path: '/dashboard', 
  icon: BarChart3, 
  label: 'Dashboard', 
  show: userRole === 'organizer' 
}
```

## Dashboard Features

### 10. Main Tabs & Sections
The `OrganizerDashboard.tsx` includes these main sections:
- **Overview** - Event metrics, revenue, attendance
- **Events** - Event management and creation
- **Analytics** - Performance metrics and insights
- **Campaigns** - Advertising and promotion tools
- **Team** - Organization team management
- **Wallet** - Financial management and payouts
- **Communications** - Messaging and notifications
- **Settings** - Configuration and preferences

### 11. Key Dependencies
```typescript
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { CampaignDashboard } from '@/components/campaigns/CampaignDashboard';
import { OrgWalletDashboard } from '@/components/wallet/OrgWalletDashboard';
```

## Access Control
- **Role-based**: Only users with `role === 'organizer'` can access
- **Organization context**: Supports multiple organizations per user
- **URL parameters**: Organization selection via `?org=<id>` parameter
- **Local storage**: Remembers last selected organization

## Main Dashboard Component Structure

### OrganizerDashboard.tsx (589 lines)
```typescript
// Key imports and types
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2, CheckCircle2, Wallet, Megaphone, Settings, Mail } from 'lucide-react';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizationTeamPanel } from '@/components/OrganizationTeamPanel';
import EventManagement from './EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';
import { OrgWalletDashboard } from '@/components/wallet/OrgWalletDashboard';
import { CampaignDashboard } from '@/components/campaigns/CampaignDashboard';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';

// Main component features:
// - Organization switching with URL parameter support
// - Tab-based navigation between dashboard sections
// - Analytics integration and real-time data
// - Event management and creation
// - Campaign management and analytics
// - Team and role management
// - Financial management and payouts
// - Communications and messaging
```

This is a comprehensive dashboard system with separate concerns for events, campaigns, analytics, financial management, and team coordination.
