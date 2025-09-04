import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import AuthModal from '@/components/AuthModal';
import AuthPage from '@/pages/AuthPage';
import Index from '@/pages/Index';
import EventDetail from '@/components/EventDetail';
import { CreateEventFlow } from '@/components/CreateEventFlow';
import OrganizerDashboard from '@/components/OrganizerDashboard';
import UserProfile from '@/components/UserProfile';
import PostCreator from '@/components/PostCreator';
import SearchPage from '@/components/SearchPage';
import EventManagement from '@/components/EventManagement';
import Navigation from '@/components/Navigation';
import OrganizationCreator from '@/components/OrganizationCreator';
import OrganizationDashboard from '@/components/OrganizationDashboard';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import RefundPolicy from '@/pages/RefundPolicy';
import TicketsPage from '@/components/TicketsPage';
import TicketSuccessPage from '@/components/TicketSuccessPage';
import { PostsTestPage } from '@/components/PostsTestPage';
import { PostsDebugPage } from '@/components/PostsDebugPage';
import { ScannerPage } from '@/components/ScannerPage';
import AnalyticsHub from '@/components/AnalyticsHub';
import EventAnalytics from '@/components/EventAnalytics';
import { AnalyticsWrapper } from '@/components/AnalyticsWrapper';
import NotFound from '@/pages/NotFound';
import { ScanLine } from 'lucide-react';

type Screen = 'feed' | 'search' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post' | 'event-management' | 'create-organization' | 'organization-dashboard' | 'privacy-policy' | 'terms-of-service' | 'refund-policy' | 'tickets' | 'scanner' | 'ticket-success' | 'posts-test';
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
          <ScanLine className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
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

// Protected route wrapper component - only redirects if user tries to access without auth
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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

  if (!user) {
    // Show auth page instead of the protected content
    return <AuthPage />;
  }

  return <>{children}</>;
}

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

  const userRole: UserRole = profile?.role || 'attendee';

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    navigate('/event/' + event.id);
  };

  const handleBackToFeed = () => {
    navigate('/');
    setSelectedEvent(null);
  };

  const handleRoleToggle = async () => {
    console.log('handleRoleToggle called', { user: !!user, profile: !!profile, currentRole: userRole });
    if (!user || !profile) {
      console.error('Missing user or profile:', { user: !!user, profile: !!profile });
      return;
    }
    
    const newRole = userRole === 'attendee' ? 'organizer' : 'attendee';
    console.log('Updating role from', userRole, 'to', newRole);
    const { error } = await updateRole(newRole);
    
    if (error) {
      console.error('Failed to update role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } else {
      console.log('Role updated successfully to:', newRole);
      toast({
        title: "Role Updated",
        description: `You are now ${newRole === 'organizer' ? 'an organizer' : 'an attendee'}`,
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
      <div className="h-screen bg-background flex flex-col">
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
          path="/event/:id" 
          element={
            selectedEvent ? (
              <EventDetail 
                event={selectedEvent}
                user={user ? {
                  id: user.id,
                  name: profile?.display_name || 'User',
                  role: userRole
                } : null}
                onBack={handleBackToFeed}
              />
            ) : (
              <div>Event not found</div>
            )
          } 
        />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy onBack={() => navigate('/')} />} />
        <Route path="/terms-of-service" element={<TermsOfService onBack={() => navigate('/')} />} />
        <Route path="/refund-policy" element={<RefundPolicy onBack={() => navigate('/')} />} />
        <Route path="/posts-debug" element={<PostsDebugPage />} />

        {/* Protected Routes */}
        <Route 
          path="/create-event" 
          element={
            <ProtectedRoute>
              <UserDependentRoute>
                {(user, profile) => (
                  <CreateEventFlow
                    onBack={() => navigate((profile?.role as UserRole) === 'organizer' ? '/dashboard' : '/')}
                    onCreate={() => navigate('/')}
                  />
                )}
              </UserDependentRoute>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/create-post" 
          element={
            <ProtectedRoute>
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
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
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
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
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
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tickets" 
          element={
            <ProtectedRoute>
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
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/scanner" 
          element={
            <ProtectedRoute>
              <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="text-center">
                  <ScanLine className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2">No Event Selected</h2>
                  <p className="text-muted-foreground mb-4">
                    Access the scanner from an event management page
                  </p>
                  <Button onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/scanner/:eventId" 
          element={
            <ProtectedRoute>
              <ScannerRouteComponent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/event-management/:id" 
          element={
            <ProtectedRoute>
              {selectedEvent ? (
                <EventManagement 
                  event={selectedEvent}
                  onBack={() => navigate('/dashboard')}
                />
              ) : (
                <div>Event not found</div>
              )}
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/create-organization" 
          element={
            <ProtectedRoute>
              <OrganizationCreator
                onBack={() => navigate('/profile')}
                onSuccess={(orgId) => {
                  setSelectedOrganizationId(orgId);
                  navigate('/organization-dashboard/' + orgId);
                }}
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/organization-dashboard/:id" 
          element={
            <ProtectedRoute>
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
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/posts-test" 
          element={
            <ProtectedRoute>
              <PostsTestPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ticket-success" 
          element={
            <ProtectedRoute>
              <TicketSuccessPage onBack={() => navigate('/')} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <AnalyticsHub />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics/event/:eventId" 
          element={
            <ProtectedRoute>
              <EventAnalytics />
            </ProtectedRoute>
          } 
        />
        
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Navigation - Show on most routes except specific ones */}
      {!location.pathname.startsWith('/event/') && 
       !location.pathname.startsWith('/event-management/') && 
       location.pathname !== '/ticket-success' &&
       location.pathname !== '/auth' && (
        <Navigation 
          currentScreen={location.pathname}
          userRole={userRole}
          onNavigate={() => {}} // Navigation component now handles routing internally
        />
      )}
      
      {/* Toast notifications */}
      <Toaster />
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