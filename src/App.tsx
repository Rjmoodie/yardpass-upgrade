import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
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
import NotFound from '@/pages/NotFound';

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

// Protected route wrapper component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Store the attempted route to redirect back after login
      const redirectTo = location.pathname + location.search;
      navigate('/auth', { state: { redirectTo } });
    }
  }, [user, loading, navigate, location]);

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
    return null; // Will redirect to auth
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, profile, loading, updateRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [screenData, setScreenData] = useState<any>(null);

  const userRole: UserRole = profile?.role || 'attendee';

  // Handle redirect after auth
  useEffect(() => {
    if (user && location.pathname === '/auth') {
      const redirectTo = location.state?.redirectTo || '/';
      navigate(redirectTo, { replace: true });
    }
  }, [user, location, navigate]);

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    navigate('/event/' + event.id);
  };

  const handleBackToFeed = () => {
    navigate('/');
    setSelectedEvent(null);
  };

  const handleRoleToggle = async () => {
    if (!user || !profile) return;
    
    const newRole = userRole === 'attendee' ? 'organizer' : 'attendee';
    const { error } = await updateRole(newRole);
    
    if (error) {
      console.error('Failed to update role:', error);
    } else {
      console.log('Role updated successfully to:', newRole);
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
              <CreateEventFlow
                onBack={() => navigate(userRole === 'organizer' ? '/dashboard' : '/')}
                onCreate={() => navigate('/')}
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/create-post" 
          element={
            <ProtectedRoute>
              <PostCreator 
                user={{
                  id: user!.id,
                  name: profile?.display_name || 'User',
                  role: userRole
                }}
                onBack={() => navigate('/')}
                onPost={() => navigate('/')}
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <OrganizerDashboard 
                user={{
                  id: user!.id,
                  name: profile?.display_name || 'User',
                  role: userRole
                }}
                onCreateEvent={() => navigate('/create-event')}
                onEventSelect={(event) => {
                  setSelectedEvent(event);
                  navigate('/event-management/' + event.id);
                }}
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <UserProfile 
                user={{
                  id: user!.id,
                  name: profile?.display_name || 'User',
                  phone: profile?.phone || '',
                  role: userRole,
                  isVerified: profile?.verification_status !== 'basic'
                }}
                onRoleToggle={handleRoleToggle}
                onBack={() => navigate('/')}
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tickets" 
          element={
            <ProtectedRoute>
              <TicketsPage
                user={{
                  id: user!.id,
                  name: profile?.display_name || 'User',
                  role: userRole
                }}
                onBack={() => navigate('/')}
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/scanner" 
          element={
            <ProtectedRoute>
              <ScannerPage
                eventId={screenData?.eventId || ''}
                onBack={() => navigate('/')}
              />
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
              <OrganizationDashboard
                user={{
                  id: user!.id,
                  name: profile?.display_name || 'User',
                  role: userRole
                }}
                organizationId={selectedOrganizationId || ''}
                onBack={() => navigate('/profile')}
                onCreateEvent={() => navigate('/create-event')}
              />
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
        
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Navigation - Show on most routes except specific ones */}
      {!location.pathname.startsWith('/event/') && 
       !location.pathname.startsWith('/event-management/') && 
       location.pathname !== '/ticket-success' &&
       location.pathname !== '/auth' && (
        <Navigation 
          currentScreen={location.pathname as Screen}
          userRole={userRole}
          onNavigate={(screen: Screen) => {
            if (screen === 'feed') navigate('/');
            else if (screen === 'search') navigate('/search');
            else if (screen === 'create-event') navigate('/create-event');
            else if (screen === 'dashboard') navigate('/dashboard');
            else if (screen === 'profile') navigate('/profile');
            else if (screen === 'create-post') navigate('/create-post');
            else if (screen === 'tickets') navigate('/tickets');
            else if (screen === 'scanner') navigate('/scanner');
            else if (screen === 'posts-test') navigate('/posts-test');
            else navigate('/' + screen);
          }}
        />
      )}
      
      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}