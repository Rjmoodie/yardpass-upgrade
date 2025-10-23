// Platform-aware routing based on your strategic breakdown
// Implements the mobile vs web feature distribution strategy

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { WebOnly, MobileOnly } from './PlatformWrapper';
import { PageLoadingSpinner } from './LoadingSpinner';
import { Button } from './ui/button';

// Web-only components (Management, Analytics, Admin)
const WebSponsorshipPage = lazy(() => import('@/pages/web/WebSponsorshipPage'));
const SponsorshipPage = lazy(() => import('@/pages/SponsorshipPage'));
const WebAnalyticsPage = lazy(() => import('@/pages/web/WebAnalyticsPage'));
const AnalyticsHub = lazy(() => import('@/components/AnalyticsHub'));
const EventManagement = lazy(() => import('@/components/EventManagement'));
const OrganizationDashboard = lazy(() => import('@/components/OrganizationDashboard'));
const PaymentEscrowManager = lazy(() => import('@/components/sponsorship/PaymentEscrowManager'));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard'));

// Mobile-only components (Consumer, Social, Discovery)
const MainFeed = lazy(() => import('@/components/MainFeed'));
const ScannerPage = lazy(() => import('@/components/ScannerPage'));
const SocialPage = lazy(() => import('@/components/SocialPage'));
const NotificationSystem = lazy(() => import('@/components/sponsorship/NotificationSystem'));
const TicketsPage = lazy(() => import('@/pages/TicketsPage'));

// Shared components (Both platforms)
const EventSlugPage = lazy(() => import('@/pages/EventSlugPage'));
const UserProfile = lazy(() => import('@/components/UserProfile'));
const SearchPage = lazy(() => import('@/components/SearchPage'));

const mobileUpsell = (
  <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
    <h2 className="text-xl font-semibold">Designed for Mobile</h2>
    <p className="text-sm text-muted-foreground">
      This experience is best on the YardPass mobile app where QR scanning, wallets, and social tools are optimized.
    </p>
    <Button size="sm" variant="outline">Download App</Button>
  </div>
);

const webUpsell = (
  <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
    <h2 className="text-xl font-semibold">Available on Desktop</h2>
    <p className="text-sm text-muted-foreground">
      Management, analytics, and contract workflows live on the desktop web experience for full control.
    </p>
    <p className="text-xs text-muted-foreground">
      Visit yardpass.tech from a desktop browser to unlock these tools.
    </p>
  </div>
);

export const PlatformAwareRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Shared Routes - Available on both platforms */}
      <Route path="/" element={<MainFeed />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/e/:identifier" element={<EventSlugPage />} />
      <Route path="/u/:username" element={<UserProfile />} />
      <Route path="/profile" element={<UserProfile />} />

      {/* Web-only Routes - Management, Analytics, Admin */}
      <Route
        path="/sponsorship"
        element={
          <WebOnly fallback={webUpsell}>
            <Suspense fallback={<PageLoadingSpinner />}>
              <WebSponsorshipPage />
            </Suspense>
          </WebOnly>
        }
      />
      <Route 
        path="/sponsorship/event/:eventId" 
        element={
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <SponsorshipPage userRole="organizer" />
            </Suspense>
          </WebOnly>
        }
      />
      <Route 
        path="/analytics" 
        element={
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <WebAnalyticsPage />
            </Suspense>
          </WebOnly>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <EventManagement />
            </Suspense>
          </WebOnly>
        } 
      />
      <Route 
        path="/organization-dashboard/:id" 
        element={
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <OrganizationDashboard />
            </Suspense>
          </WebOnly>
        } 
      />
      <Route 
        path="/payments" 
        element={
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <PaymentEscrowManager />
            </Suspense>
          </WebOnly>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <AdminDashboard />
            </Suspense>
          </WebOnly>
        } 
      />

      {/* Mobile-only Routes - Consumer, Social, Discovery */}
      <Route
        path="/tickets"
        element={
          <MobileOnly fallback={mobileUpsell}>
            <Suspense fallback={<PageLoadingSpinner />}>
              <TicketsPage />
            </Suspense>
          </MobileOnly>
        }
      />
      <Route
        path="/social"
        element={
          <MobileOnly fallback={mobileUpsell}>
            <Suspense fallback={<PageLoadingSpinner />}>
              <SocialPage />
            </Suspense>
          </MobileOnly>
        }
      />
    </Routes>
  );
};

export default PlatformAwareRoutes;
