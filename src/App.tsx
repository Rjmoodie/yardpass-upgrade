import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import AuthModal from '@/components/AuthModal';
import AuthPage from '@/pages/AuthPage';
import Index from '@/pages/Index';
import Navigation from '@/components/Navigation';
import { ShareModal } from '@/components/ShareModal';
import { SharePayload } from '@/lib/share';
import { getEventRoute } from '@/lib/eventRouting';
import { Scan } from 'lucide-react';
import { PageLoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load heavy components
const EventDetail = lazy(() => import('@/components/EventDetail'));
const EventSlugPage = lazy(() => import('@/pages/EventSlugPage'));
const EventAttendeesPage = lazy(() => import('@/pages/EventAttendeesPage'));
const CreateEventFlow = lazy(() => import('@/components/CreateEventFlow').then(m => ({ default: m.CreateEventFlow })));
const OrganizerDashboard = lazy(() => import('@/components/OrganizerDashboard'));
const UserProfile = lazy(() => import('@/components/UserProfile'));
const PostCreator = lazy(() => import('@/components/PostCreator'));
const SearchPage = lazy(() => import('@/components/SearchPage'));
const EventManagement = lazy(() => import('@/components/EventManagement'));
const OrganizationCreator = lazy(() => import('@/components/OrganizationCreator'));
const OrganizationDashboard = lazy(() => import('@/components/OrganizationDashboard'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const RefundPolicy = lazy(() => import('@/pages/RefundPolicy'));
const TicketsPage = lazy(() => import('@/components/TicketsPage'));
const TicketSuccessPage = lazy(() => import('@/components/TicketSuccessPage'));
const PurchaseSuccessHandler = lazy(() => import('@/components/PurchaseSuccessHandler').then(m => ({ default: m.PurchaseSuccessHandler })));
const ScannerPage = lazy(() => import('@/components/ScannerPage').then(m => ({ default: m.ScannerPage })));
const AnalyticsHub = lazy(() => import('@/components/AnalyticsHub'));
const EventAnalytics = lazy(() => import('@/components/EventAnalytics'));
const AnalyticsWrapper = lazy(() => import('@/components/AnalyticsWrapper').then(m => ({ default: m.AnalyticsWrapper })));
const NotFound = lazy(() => import('@/pages/NotFound'));
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const EventDetails = lazy(() => import('@/pages/EventDetails'));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage'));
const OrganizationProfilePage = lazy(() => import('@/pages/OrganizationProfilePage'));
const EditProfilePage = lazy(() => import('@/pages/EditProfilePage'));
const MainPostsFeed = lazy(() => import('@/components/MainPostsFeed').then(m => ({ default: m.MainPostsFeed })));

type Screen = 'feed' | 'search' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post' | 'event-management' | 'create-organization' | 'organization-dashboard' | 'privacy-policy' | 'terms-of-service' | 'refund-policy' | 'tickets' | 'scanner' | 'ticket-success';
type UserRole = 'attendee' | 'organizer';

interface Event {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;
  date: string;
  location: string;
  coverImage: string;
  videoUrl: string;
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  slug?: string;
}

interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

// Scanner route component
function ScannerRouteComponent() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  
  if (!eventId) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <Scan className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Invalid Event ID</h2>
          <p className="text-muted-foreground mb-4">
            Please access the scanner from a valid event
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ScannerPage
      eventId={eventId}
      onBack={() => navigate('/dashboard')}
    />
  );
}

// Import the new auth guard
import { AuthGuard } from '@/components/AuthGuard';

// Helper component to safely render user-dependent content
function UserDependentRoute({ 
  children 
}: { 
  children: (user: NonNullable<ReturnType<typeof useAuth>['user']>, profile: ReturnType<typeof useAuth>['profile']) => React.ReactNode 
}) {
  const { user, profile } = useAuth();
  
  if (!user) {
    return <AuthPage />;
  }
  
  return <>{children(user, profile)}</>;
}

function AppContent() {
  const { user, profile, loading, updateRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [screenData, setScreenData] = useState<any>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  useEffect(() => {
    const onShareModalOpen = (e: CustomEvent<SharePayload>) => {
      if (import.meta.env.DEV) {
      }
      setSharePayload(e.detail);
    };
    
    window.addEventListener('open-share-modal', onShareModalOpen as EventListener);
    return () => window.removeEventListener('open-share-modal', onShareModalOpen as EventListener);
  }, []);

  const userRole: UserRole = profile?.role || 'attendee';

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    // Use slug if available, otherwise fall back to UUID
    navigate(getEventRoute(event));
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
          title: "Error",
          description: "Failed to update role: " + (error.message || 'Unknown error'),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Role Updated",
          description: `You are now ${newRole === 'organizer' ? 'an organizer' : 'an attendee'}`,
        });
      }
    } catch (err) {
      console.error('Exception during role update:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">🎪</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <AnalyticsWrapper>
      <div className="flex min-h-[100dvh] flex-col bg-background relative">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        
        {/* Main Content Area */}
        <main className="
          flex-1 overflow-y-auto
          pb-[calc(env(safe-area-inset-bottom)+88px)]
          [@supports(-webkit-touch-callout:none)]:[-webkit-overflow-scrolling:touch]
        ">
          <Suspense fallback={<PageLoadingSpinner />}>
            <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={
            <Index 
              onEventSelect={handleEventSelect}
              onCreatePost={() => navigate('/create-post')}
              onCategorySelect={(category) => navigate('/search?category=' + encodeURIComponent(category))}
              onOrganizerSelect={(organizerId, organizerName) => navigate('/search?organizer=' + organizerId)}
            />
          } 
        />
        <Route 
          path="/search" 
          element={
            <SearchPage 
              onBack={() => navigate('/')}
              onEventSelect={handleEventSelect}
            />
          } 
        />
        <Route 
          path="/events/:id" 
          element={<EventDetails />} 
        />
        <Route 
          path="/u/:username" 
          element={<UserProfilePage />} 
        />
        <Route 
          path="/org/:id" 
          element={<OrganizationProfilePage />} 
        />
        <Route 
          path="/feed" 
          element={
            <AuthGuard>
              <MainPostsFeed 
                onEventSelect={(eventId) => navigate('/events/' + eventId)}
              />
            </AuthGuard>
          } 
        />
        <Route 
          path="/event/:id" 
          element={
            selectedEvent ? (
              <EventDetail
                event={selectedEvent}
                user={user ? {
                  id: user.id,
                  name: profile?.display_name || 'User',
                  role: (profile?.role as UserRole) || 'attendee'
                } : null}
                onBack={handleBackToFeed}
              />
            ) : (
              <div>Event not found</div>
            )
          } 
        />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/e/:identifier" element={<EventSlugPage />} />
        <Route path="/e/:identifier/attendees" element={<EventAttendeesPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy onBack={() => navigate('/')} />} />
        <Route path="/terms-of-service" element={<TermsOfService onBack={() => navigate('/')} />} />
        <Route path="/refund-policy" element={<RefundPolicy onBack={() => navigate('/')} />} />

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
                      role: (profile?.role as UserRole) || 'attendee'
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
              <UserDependentRoute>
                {(user, profile) => (
                  <OrganizerDashboard 
                    user={{
                      id: user.id,
                      name: profile?.display_name || 'User',
                      role: (profile?.role as UserRole) || 'attendee'
                    }}
                    onCreateEvent={() => navigate('/create-event')}
                    onEventSelect={(event) => {
                      setSelectedEvent(event);
                      navigate('/event-management/' + event.id);
                    }}
                  />
                )}
              </UserDependentRoute>
            </AuthGuard>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <AuthGuard>
              <UserDependentRoute>
                {(user, profile) => (
                  <UserProfile 
                    user={{
                      id: user.id,
                      name: profile?.display_name || 'User',
                      phone: profile?.phone || '',
                      role: (profile?.role as UserRole) || 'attendee',
                      isVerified: profile?.verification_status === 'verified' || profile?.verification_status === 'pro'
                    }}
                    onRoleToggle={handleRoleToggle}
                    onBack={() => navigate('/')}
                  />
                )}
              </UserDependentRoute>
            </AuthGuard>
          } 
        />
        <Route 
          path="/edit-profile" 
          element={
            <AuthGuard>
              <UserDependentRoute>
                {() => <EditProfilePage />}
              </UserDependentRoute>
            </AuthGuard>
          } 
        />
        <Route 
          path="/tickets" 
          element={
            <AuthGuard>
              <UserDependentRoute>
                {(user, profile) => (
                  <TicketsPage
                    user={{
                      id: user.id,
                      name: profile?.display_name || 'User',
                      role: (profile?.role as UserRole) || 'attendee'
                    }}
                    onBack={() => navigate('/')}
                  />
                )}
              </UserDependentRoute>
            </AuthGuard>
          } 
        />
        <Route 
          path="/scanner" 
          element={
            <AuthGuard>
              <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="text-center">
                  <Scan className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2">No Event Selected</h2>
                  <p className="text-muted-foreground mb-4">
                    Access the scanner from an event management page
                  </p>
                  <Button onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
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
                <EventManagement 
                  event={selectedEvent}
                  onBack={() => navigate('/dashboard')}
                />
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
              <UserDependentRoute>
                {(user, profile) => (
                  <OrganizationDashboard
                    user={{
                      id: user.id,
                      name: profile?.display_name || 'User',
                      role: (profile?.role as UserRole) || 'attendee'
                    }}
                    organizationId={selectedOrganizationId || ''}
                    onBack={() => navigate('/profile')}
                    onCreateEvent={() => navigate('/create-event')}
                  />
                )}
              </UserDependentRoute>
            </AuthGuard>
          } 
        />
        <Route 
          path="/ticket-success" 
          element={
            <AuthGuard>
              <TicketSuccessPage 
                onBack={() => navigate('/')} 
                onViewTickets={() => navigate('/tickets')}
              />
            </AuthGuard>
          } 
        />
        <Route 
          path="/purchase-success" 
          element={
            <AuthGuard>
              <PurchaseSuccessHandler />
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
              <EventAnalytics />
            </AuthGuard>
          } 
        />
        
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        {/* Share Modal */}
        <ShareModal
          isOpen={!!sharePayload}
          onClose={() => setSharePayload(null)}
          payload={sharePayload}
        />

        {/* Navigation - Show on most routes except specific ones */}
        {!location.pathname.startsWith('/event/') && 
         !location.pathname.startsWith('/event-management/') && 
         location.pathname !== '/ticket-success' &&
         location.pathname !== '/auth' && (
          <div className="fixed inset-x-0 bottom-0 z-30">
            <Navigation 
              currentScreen={location.pathname}
              userRole={userRole}
              onNavigate={() => {}} // Navigation component now handles routing internally
            />
          </div>
        )}
      
      {/* Toast notifications */}
      <Toaster />
      
      {/* Share Modal */}
      <ShareModal 
        isOpen={!!sharePayload} 
        onClose={() => setSharePayload(null)} 
        payload={sharePayload} 
      />
      </div>
    </AnalyticsWrapper>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}