import { useState, useEffect, useMemo, useLayoutEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext'; // Removed AuthProvider import (already in main.tsx)
import { ProfileViewProvider, useProfileView } from '@/contexts/ProfileViewContext';
import { ThemeProvider } from "next-themes";
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { initIOSCapacitor, setupKeyboardListeners } from '@/lib/ios-capacitor';
import { Capacitor } from '@capacitor/core';
const Index = lazy(() => import('@/pages/Index'));
import NavigationNewDesign from '@/components/NavigationNewDesign';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
// Lazy load ShareModal (only when needed)
const ShareModal = lazy(() => import('@/components/ShareModal').then(m => ({ default: m.ShareModal })));
import { SharePayload } from '@/lib/share';
import { getEventRoute } from '@/lib/eventRouting';
import { Scan } from 'lucide-react';
import { PageLoadingSpinner } from '@/components/LoadingSpinner';
import { FullScreenLoading } from '@/components/layout/FullScreenLoading';
import { FullScreenSafeArea } from '@/components/layout/FullScreenSafeArea';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Event } from '@/types/events';
import { PerfPreconnect } from '@/components/Perf/PerfPreconnect';
import { WarmHlsOnIdle } from '@/components/Perf/WarmHlsOnIdle';
import { DeferredImports } from '@/components/Perf/DeferredImports';
import { useAccessibility } from '@/hooks/useAccessibility';
import { usePlatform } from '@/hooks/usePlatform';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Scroll restoration helper - single source of truth
function ScrollToTopOnRouteChange() {
  const location = useLocation();

  useLayoutEffect(() => {
    const main = document.getElementById('main-content');

    if (main instanceof HTMLElement) {
      // ✅ CRITICAL: Reset scroll synchronously before paint to prevent layout offset
      // This must happen immediately, not in requestAnimationFrame, to prevent visible scroll
      main.scrollTop = 0;
      main.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      
      // Only log scroll issues in development (not success)
      if (import.meta.env.DEV) {
        requestAnimationFrame(() => {
          if (main.scrollTop > 0) {
            console.warn('[ScrollReset] Failed to reset scroll:', location.pathname);
          }
        });
      }
    }

    // Fallback: also reset window scroll (synchronous)
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Scroll monitoring removed - was causing excessive console noise
  // The scroll reset in the first useEffect is sufficient

  return null;
}

// Lazy load heavy components
const EventSlugPage = lazy(() => import('@/pages/EventSlugPage'));
const EventAttendeesPage = lazy(() => import('@/pages/EventAttendeesPageEnhanced'));

// New Design Components (Integrated with Real Data)
const ProfilePageNew = lazy(() => import('@/pages/new-design/ProfilePage'));
const TicketsPageNew = lazy(() => import('@/pages/new-design/TicketsPage'));
const SearchPageNew = lazy(() => import('@/pages/new-design/SearchPage'));
const EventDetailsPageNew = lazy(() => import('@/pages/new-design/EventDetailsPage'));
const MessagesPageNew = lazy(() => import('@/pages/new-design/MessagesPage'));
const NotificationsPageNew = lazy(() => import('@/pages/new-design/NotificationsPage'));
const CreateEventFlow = lazy(() =>
  import('@/components/CreateEventFlow').then((m) => ({ default: m.CreateEventFlow })),
);
const OrganizerDashboard = lazy(() => import('@/components/OrganizerDashboard'));
const OrganizerRefundsPage = lazy(() => import('@/pages/new-design/OrganizerRefundsPage').then(m => ({ default: m.OrganizerRefundsPage })));
const UserProfile = lazy(() => import('@/components/UserProfile'));
const PostCreator = lazy(() => import('@/components/PostCreator'));
const SearchPage = lazy(() => import('@/components/SearchPage'));
const EventManagement = lazy(() => import('@/components/EventManagement'));
const OrganizationCreator = lazy(() => import('@/components/OrganizationCreator'));
const OrganizationDashboard = lazy(() => import('@/components/OrganizationDashboard'));
// LoadingSpinner is small, but can be lazy loaded if not used in critical path
const LoadingSpinner = lazy(() => import('@/components/dashboard/LoadingSpinner'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const RefundPolicy = lazy(() => import('@/pages/RefundPolicy'));
const DeploymentReadinessPage = lazy(() => import('@/pages/DeploymentReadinessPage'));
const VideoLabPage = lazy(() => import('@/pages/dev/VideoLabPage'));
const OrgInvitePage = lazy(() => import('@/pages/OrgInvitePage'));
const TicketsRoute = lazy(() => import('@/components/TicketsRoute').then(m => ({ default: m.TicketsRoute })));
const TicketSuccessPage = lazy(() => import('@/components/TicketSuccessPage'));
const PurchaseSuccessHandler = lazy(() =>
  import('@/components/PurchaseSuccessHandler').then((m) => ({ default: m.PurchaseSuccessHandler })),
);
const ScannerPage = lazy(() => import('@/components/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const ScannerSelectEventPage = lazy(() => import('@/pages/new-design/ScannerSelectEventPage'));
const AnalyticsHub = lazy(() => import('@/components/AnalyticsHub'));
const EventAnalytics = lazy(() => import('@/components/EventAnalytics'));
const EventAnalyticsPage = lazy(() => import('@/pages/EventAnalyticsPage'));
const AnalyticsWrapper = lazy(() =>
  import('@/components/AnalyticsWrapper').then((m) => ({ default: m.AnalyticsWrapper })),
);
const NotFound = lazy(() => import('@/pages/NotFound'));
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage'));
const OrganizationProfilePage = lazy(() => import('@/pages/OrganizationProfilePage'));
const EditProfilePage = lazy(() => import('@/pages/EditProfilePage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const SponsorDashboard = lazy(() => import('@/components/sponsor/SponsorDashboard'));
import { SponsorGuard } from '@/components/access/SponsorGuard';
const WalletPage = lazy(() => import('@/pages/WalletPage'));
const SponsorshipPage = lazy(() => import('@/pages/SponsorshipPage'));
const SponsorshipTestPage = lazy(() => import('@/pages/SponsorshipTestPage'));
const OrgWalletPage = lazy(() => import('@/pages/OrgWalletPage'));
const CampaignDashboardPage = lazy(() => import('@/pages/CampaignDashboardPage'));
const CampaignAnalyticsPage = lazy(() => import('@/pages/CampaignAnalyticsPageEnhanced'));
const MessagesPage = lazy(() => import('@/pages/MessagesPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SocialPage = lazy(() => import('@/components/SocialPage').then((m) => ({ default: m.SocialPage })));

// Auth guard
import { AuthGuard } from '@/components/AuthGuard';

type UserRole = 'attendee' | 'organizer' | 'admin';

// Redirect component for legacy event routes
function RedirectToEventSlug() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (id) {
      // Redirect to primary event slug route
      navigate(`/e/${id}`, { replace: true });
    }
  }, [id, navigate]);
  
  return <PageLoadingSpinner />;
}


// Scanner route component
function ScannerRouteComponent() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  if (!eventId) {
    return (
      <FullScreenSafeArea className="bg-background items-center justify-center p-4">
        <div className="text-center">
          <Scan className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Invalid Event ID</h2>
          <p className="text-muted-foreground mb-4">Please access the scanner from a valid event</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </FullScreenSafeArea>
    );
  }

  return <ScannerPage eventId={eventId} onBack={() => navigate('/dashboard')} />;
}

// Organization dashboard route component (handles hard refresh by reading :id)
function OrganizationDashboardRouteComponent({
  selectedOrganizationFallback,
}: {
  selectedOrganizationFallback: string | null;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const orgId = id || selectedOrganizationFallback || '';

  if (!user) return <AuthPage />;

  return (
    <OrganizationDashboard
      user={{
        id: user.id,
        name: profile?.display_name || 'User',
        role: ((profile?.role as UserRole) || 'attendee') as 'attendee' | 'organizer',
      }}
      organizationId={orgId}
      onBack={() => navigate('/profile')}
      onCreateEvent={() => navigate('/create-event')}
    />
  );
}

// Helper component to safely render user-dependent content
function UserDependentRoute({
  children,
}: {
  children: (
    user: NonNullable<ReturnType<typeof useAuth>['user']>,
    profile: ReturnType<typeof useAuth>['profile'],
  ) => React.ReactNode;
}) {
  const { user, profile } = useAuth();

  if (!user) {
    return <AuthPage />;
  }

  return <>{children(user, profile)}</>;
}

function AppContent() {
  const { user, profile, loading, updateRole } = useAuth();
  const { activeView } = useProfileView();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);

  useAccessibility();
  usePushNotifications(); // Setup push notifications for iOS

  // Setup keyboard listeners on app load
  // Note: iOS Capacitor StatusBar is initialized in main.tsx before render to ensure safe areas work immediately
  useEffect(() => {
    setupKeyboardListeners();
    
    // If iOS Capacitor wasn't initialized in main.tsx (shouldn't happen), initialize it here as fallback
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      initIOSCapacitor().then(() => {
        // Force safe area recalculation after StatusBar is configured
        window.dispatchEvent(new Event('resize'));
      }).catch(console.warn);
    }
  }, []);

  // Handle deep links from shared URLs
  useEffect(() => {
    const handleDeepLinkEvent = async (event: CustomEvent<{ url: string }>) => {
      try {
        const { handleDeepLink } = await import('@/utils/deepLinkHandler');
        const route = handleDeepLink(event.detail.url);
        
        if (route) {
          console.log('[App] Navigating to deep link route:', route);
          navigate(route, { replace: false });
        } else {
          console.warn('[App] Could not parse deep link:', event.detail.url);
          toast({
            title: "Invalid link",
            description: "This link could not be opened in the app.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('[App] Error handling deep link:', error);
        toast({
          title: "Something went wrong",
          description: "Please try again",
          variant: "destructive",
        });
      }
    };

    // Listen for deep link events from Capacitor
    window.addEventListener('deepLinkOpen', handleDeepLinkEvent as EventListener);
    
    // Also check if app was opened with a URL (initial launch)
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.getLaunchUrl().then((result) => {
          if (result?.url) {
            handleDeepLinkEvent(new CustomEvent('deepLinkOpen', { detail: { url: result.url } }));
          }
        }).catch(() => {
          // No launch URL, that's fine
        });
      });
    }

    return () => {
      window.removeEventListener('deepLinkOpen', handleDeepLinkEvent as EventListener);
    };
  }, [navigate, toast]);

  // Redirect component for legacy profile routes
  function RedirectToUserProfile() {
    const { id, username, userId } = useParams<{ id?: string; username?: string; userId?: string }>();
    
    useEffect(() => {
      const identifier = id || username || userId;
      if (identifier) {
        // Redirect to primary profile route
        navigate(`/profile/${identifier}`, { replace: true });
      }
    }, [id, username, userId]);
    
    return <PageLoadingSpinner />;
  }

  useEffect(() => {
    const onShareModalOpen = (e: CustomEvent<SharePayload>) => {
      if (import.meta.env.DEV) {
        // dev-only hook point if needed
      }
      setSharePayload(e.detail);
    };

    window.addEventListener('open-share-modal', onShareModalOpen as EventListener);
    return () => window.removeEventListener('open-share-modal', onShareModalOpen as EventListener);
  }, []);

  const userRole: UserRole = user ? ((profile?.role as UserRole) || 'attendee') : 'attendee';

  // Determine the platform-aware navigation role, prioritizing admin access where applicable
  const navigationRole: 'attendee' | 'organizer' | 'admin' =
    (profile?.role as UserRole) === 'admin'
      ? 'admin'
      : activeView === 'organizer' || (profile?.role as UserRole) === 'organizer'
        ? 'organizer'
        : 'attendee';

  // ✅ CRITICAL: Set data-role on root element to enable global purple theme
  // This ensures the entire app changes color when switching to organizer mode
  // Using useLayoutEffect to set synchronously before paint to prevent flash
  useLayoutEffect(() => {
    const root = document.documentElement; // <html> element
    
    // Determine role - prioritize profile role, fallback to localStorage, then route-based logic
    let currentRole = profile?.role;
    
    // If profile hasn't loaded yet, try to get from localStorage (set from previous session)
    if (!currentRole) {
      const cachedRole = localStorage.getItem('user_role');
      if (cachedRole === 'organizer' || cachedRole === 'attendee') {
        currentRole = cachedRole;
      }
    }
    
    // Fallback to route-based logic
    if (!currentRole) {
      currentRole = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/organization-dashboard') 
        ? 'organizer' 
        : 'attendee';
    }
    
    // Set data-role attribute on root element for global CSS variable override
    root.setAttribute('data-role', currentRole);
    
    // Cache role in localStorage for next page load (prevents flash)
    if (currentRole) {
      localStorage.setItem('user_role', currentRole);
    }
  }, [profile?.role, location.pathname]);

  const handleEventSelect = (eventId: string) => {
    navigate(`/e/${eventId}`);
  };

  const handleBackToFeed = () => {
    navigate('/');
    setSelectedEvent(null);
  };

  const handleRoleToggle = async () => {
    if (!user || !profile) {
      console.error('Missing user or profile:', { user: !!user, profile: !!profile });
      return;
    }

    const newRole = userRole === 'attendee' ? 'organizer' : 'attendee';

    try {
      const { error } = await updateRole(newRole);

      if (error) {
        console.error('Failed to update role:', error);
        toast({
          title: 'Error',
          description: 'Failed to update role: ' + (error.message || 'Unknown error'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Role Updated',
          description: `You are now ${newRole === 'organizer' ? 'an organizer' : 'an attendee'}`,
        });
      }
    } catch (err) {
      console.error('Exception during role update:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  // Determine role for data-role attribute, defaulting to 'organizer' for dashboard routes
  const routeRole = useMemo(() => {
    if (profile?.role) return profile.role;
    // Default to 'organizer' for dashboard/organizer routes while loading
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/organization-dashboard')) {
      return 'organizer';
    }
    return 'attendee';
  }, [profile?.role, location.pathname]);

  if (loading) {
    return (
      <FullScreenLoading 
        text="Loading..." 
        className="bg-gradient-to-br from-primary/5 to-secondary/5"
      />
    );
  }

  return (
    <>
      <GlobalErrorHandler />
      <PerfPreconnect />
      <WarmHlsOnIdle />
      <DeferredImports />
      <AnalyticsWrapper>
        <FullScreenSafeArea scroll={false} className="app-frame flex flex-col bg-background relative no-page-bounce" data-role={routeRole}>
          {/* One place to manage scroll */}
          <ScrollToTopOnRouteChange />

          <div className="app-mesh pointer-events-none" aria-hidden="true" />

          {/* Main Content Area */}
          {/* main is THE scroll container; it remounts per route */}
          <main
            id="main-content"
            key={location.pathname}
            ref={mainContentRef}
            className="content-on-nav scroll-container flex-1 overflow-y-auto"
            role="main"
            aria-label="Main content"
            style={{
              scrollPaddingBottom: 'var(--bottom-nav-safe)',
            }}
          >
            <div className="app-shell">
              <div className="app-surface">
                {/* Edge-to-edge on mobile for feed/search. Add more routes as needed. */}
                <div
                  className={`app-surface-content ${
                    location.pathname === '/' || location.pathname.startsWith('/search')
                      ? 'edge-to-edge'
                      : ''
                  }`}
                >
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <Routes key={location.pathname}>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route
                path="/search"
                element={
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <SearchPageNew />
                  </Suspense>
                }
              />
              {/* Redirect legacy event routes to primary /e/:identifier format */}
              <Route path="/events/:id" element={<RedirectToEventSlug />} />
              <Route path="/event/:id" element={<RedirectToEventSlug />} />
              
              {/* Redirect legacy profile routes to /profile format */}
              <Route path="/u/:username" element={<RedirectToUserProfile />} />
              <Route path="/user/:userId" element={<RedirectToUserProfile />} />
              
              <Route path="/org/:id" element={<OrganizationProfilePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/invite/org" element={<OrgInvitePage />} />
              <Route path="/e/:identifier" element={
                <Suspense fallback={<PageLoadingSpinner />}>
                  <EventDetailsPageNew />
                </Suspense>
              } />
              <Route path="/e/:identifier/tickets" element={<TicketsRoute />} />
              <Route path="/e/:identifier/attendees" element={<EventAttendeesPage />} />
              {/* (duplicate tickets route removed above) */}
              <Route path="/privacy" element={<PrivacyPolicy onBack={() => navigate('/')} />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy onBack={() => navigate('/')} />} />
              <Route path="/terms" element={<TermsOfService onBack={() => navigate('/')} />} />
              <Route path="/terms-of-service" element={<TermsOfService onBack={() => navigate('/')} />} />
              <Route path="/refund-policy" element={<RefundPolicy onBack={() => navigate('/')} />} />
              <Route path="/deployment-readiness" element={<DeploymentReadinessPage onBack={() => navigate('/')} />} />
              
              {/* Dev Routes - Only in development */}
              {import.meta.env.DEV && (
                <Route
                  path="/dev/video-lab"
                  element={
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <VideoLabPage />
                    </Suspense>
                  }
                />
              )}

              {/* Protected Routes */}
              <Route
                path="/create-event"
                element={
                  <AuthGuard>
                    <UserDependentRoute>
                      {(user, profile) => (
                        <CreateEventFlow
                          onBack={() => navigate((profile?.role as UserRole) === 'organizer' ? '/dashboard' : '/')}
                          onCreate={() => navigate('/')}
                        />
                      )}
                    </UserDependentRoute>
                  </AuthGuard>
                }
              />
              <Route
                path="/create-post"
                element={
                  <AuthGuard>
                    <UserDependentRoute>
                      {(user, profile) => (
                        <PostCreator
                          user={{
                            id: user.id,
                            name: profile?.display_name || 'User',
                            role: ((profile?.role as UserRole) || 'attendee') as 'attendee' | 'organizer',
                          }}
                          onBack={() => navigate('/')}
                          onPost={() => navigate('/')}
                        />
                      )}
                    </UserDependentRoute>
                  </AuthGuard>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <OrganizerDashboard />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/dashboard/refunds"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <OrganizerRefundsPage />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/profile"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <ProfilePageNew />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/profile/:username"
                element={
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <ProfilePageNew />
                  </Suspense>
                }
              />
              <Route
                path="/user/:userId"
                element={
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <ProfilePageNew />
                  </Suspense>
                }
              />
              <Route
                path="/edit-profile"
                element={
                  <AuthGuard>
                    <UserDependentRoute>{() => <EditProfilePage />}</UserDependentRoute>
                  </AuthGuard>
                }
              />
              <Route
                path="/messages"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <MessagesPageNew />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/notifications"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <NotificationsPageNew />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/social"
                element={
                  <AuthGuard>
                    <SocialPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/tickets"
                element={
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <TicketsRoute />
                  </Suspense>
                }
              />
              <Route
                path="/purchase-success"
                element={
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <PurchaseSuccessHandler />
                  </Suspense>
                }
              />
              <Route
                path="/scanner"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <ScannerSelectEventPage />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/scanner/:eventId"
                element={
                  <AuthGuard>
                    <ScannerRouteComponent />
                  </AuthGuard>
                }
              />
              <Route
                path="/event-management/:id"
                element={
                  <AuthGuard>
                    {selectedEvent ? (
                      <EventManagement event={selectedEvent} onBack={() => navigate('/dashboard')} />
                    ) : (
                      <div>Event not found</div>
                    )}
                  </AuthGuard>
                }
              />
              <Route
                path="/create-organization"
                element={
                  <AuthGuard>
                    <OrganizationCreator
                      onBack={() => navigate('/profile')}
                      onSuccess={(orgId) => {
                        setSelectedOrganizationId(orgId);
                        navigate('/organization-dashboard/' + orgId);
                      }}
                    />
                  </AuthGuard>
                }
              />
              <Route
                path="/organization-dashboard/:id"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <OrganizationDashboardRouteComponent selectedOrganizationFallback={selectedOrganizationId} />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/ticket-success"
                element={
                  <AuthGuard>
                    <TicketSuccessPage onBack={() => navigate('/')} onViewTickets={() => navigate('/tickets')} />
                  </AuthGuard>
                }
              />
              <Route
                path="/analytics"
                element={
                  <AuthGuard>
                    <AnalyticsHub />
                  </AuthGuard>
                }
              />
              <Route
                path="/analytics/event/:eventId"
                element={
                  <AuthGuard>
                    <EventAnalyticsPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/sponsor"
                element={
                  <AuthGuard>
                    <SponsorGuard>
                      <SponsorDashboard />
                    </SponsorGuard>
                  </AuthGuard>
                }
              />
              <Route
                path="/sponsorship"
                element={
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <SponsorshipPage />
                  </Suspense>
                }
              />
              <Route
                path="/sponsorship/event/:eventId"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <SponsorshipPage />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/sponsorship/sponsor/:sponsorId"
                element={
                  <AuthGuard>
                    <SponsorGuard>
                      <Suspense fallback={<PageLoadingSpinner />}>
                        <SponsorshipPage />
                      </Suspense>
                    </SponsorGuard>
                  </AuthGuard>
                }
              />
              <Route
                path="/wallet"
                element={
                  <AuthGuard>
                    <WalletPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/wallet/success"
                element={
                  <AuthGuard>
                    <WalletPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/orgs/:orgId/wallet"
                element={
                  <AuthGuard>
                    <OrgWalletPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/campaigns"
                element={
                  <AuthGuard>
                    <CampaignDashboardPage />
                  </AuthGuard>
                }
              />
              <Route
                path="/campaign-analytics"
                element={
                  <AuthGuard>
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <CampaignAnalyticsPage />
                    </Suspense>
                  </AuthGuard>
                }
              />
              <Route
                path="/sponsorship-test"
                element={
                  <AuthGuard>
                    <SponsorshipTestPage />
                  </AuthGuard>
                }
              />

              {/* Legacy request-access route redirect */}
              <Route path="/request-access/:eventId" element={<NotFound />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </div>
              </div>
            </div>
          </main>

        {/* Navigation - Show on most routes except specific ones */}
        {!location.pathname.startsWith('/event/') &&
          !location.pathname.startsWith('/event-management/') &&
          location.pathname !== '/ticket-success' && (
            <NavigationNewDesign />
          )}

        {/* Toast notifications */}
        <Toaster />

        {/* Share Modal (single instance) */}
        <ShareModal isOpen={!!sharePayload} onClose={() => setSharePayload(null)} payload={sharePayload} />
        </FullScreenSafeArea>
      </AnalyticsWrapper>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* ✅ REMOVED DUPLICATE: AuthProvider already wraps App in main.tsx */}
      <ProfileViewProvider>
        <AppContent />
      </ProfileViewProvider>
    </ThemeProvider>
  );
}