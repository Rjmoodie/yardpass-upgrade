// Platform-aware routing based on your strategic breakdown
// Implements the mobile vs web feature distribution strategy

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { usePlatform } from '@/hooks/usePlatform';
import { WebOnly, MobileOnly, PlatformWrapper } from './PlatformWrapper';
import { PageLoadingSpinner } from './LoadingSpinner';

// Web-only components (Management, Analytics, Admin)
const SponsorshipPage = lazy(() => import('@/pages/SponsorshipPage'));
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

export const PlatformAwareRoutes: React.FC = () => {
  const { isWeb, isMobile } = usePlatform();

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
          <WebOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <SponsorshipPage userRole="sponsor" />
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
              <AnalyticsHub />
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
          <MobileOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <TicketsPage />
            </Suspense>
          </MobileOnly>
        } 
      />
      <Route 
        path="/scanner" 
        element={
          <MobileOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <ScannerPage />
            </Suspense>
          </MobileOnly>
        } 
      />
      <Route 
        path="/social" 
        element={
          <MobileOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <SocialPage />
            </Suspense>
          </MobileOnly>
        } 
      />
      <Route 
        path="/notifications" 
        element={
          <MobileOnly>
            <Suspense fallback={<PageLoadingSpinner />}>
              <NotificationSystem userId="current-user" />
            </Suspense>
          </MobileOnly>
        } 
      />

      {/* Platform-specific fallbacks */}
      <Route 
        path="/sponsorship" 
        element={
          <PlatformWrapper webOnly fallback={<div className="p-8 text-center">
            <h2 className="text-xl font-bold mb-4">Sponsorship Management</h2>
            <p className="text-muted-foreground">
              This feature is available on the web platform for full management capabilities.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Visit yardpass.tech on your desktop to access sponsorship tools.
            </p>
          </div>}>
            <Suspense fallback={<PageLoadingSpinner />}>
              <SponsorshipPage userRole="sponsor" />
            </Suspense>
          </PlatformWrapper>
        } 
      />
    </Routes>
  );
};

export default PlatformAwareRoutes;
