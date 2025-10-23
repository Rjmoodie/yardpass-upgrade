// Platform-aware routing (REVAMPED)
// Implements the mobile vs web feature distribution strategy with capability gates

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { WebOnly } from '@/components/gates/WebOnly';
import { MobileOnly } from '@/components/gates/MobileOnly';
import { UpsellDesktop, UpsellMobile } from '@/components/Upsells';
import { PageLoadingSpinner } from './LoadingSpinner';

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

// Upsells are now handled by the gate components themselves
// but can be customized per route if needed

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
          <WebOnly fallback={<UpsellDesktop feature="Sponsorship Management" />}>
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
