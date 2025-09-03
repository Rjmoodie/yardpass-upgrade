import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import AuthModal from '@/components/AuthModal';
import Index from '@/pages/Index';
import EventDetail from '@/components/EventDetail';
import EventCreator from '@/components/EventCreator';
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
import ScannerPage from '@/components/ScannerPage';

type Screen = 'feed' | 'search' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post' | 'event-management' | 'create-organization' | 'organization-dashboard' | 'privacy-policy' | 'terms-of-service' | 'refund-policy' | 'tickets' | 'scanner';
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

function AppContent() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('feed');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  const userRole: UserRole = user?.user_metadata?.role || 'attendee';

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setCurrentScreen('event-detail');
  };

  const handleBackToFeed = () => {
    setCurrentScreen('feed');
    setSelectedEvent(null);
  };

  const handleRoleToggle = () => {
    // Mock role toggle functionality
    console.log('Role toggle clicked');
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
      {/* Main Content */}
      {currentScreen === 'feed' && (
        <Index 
          onEventSelect={handleEventSelect}
          onCreatePost={() => setCurrentScreen('create-post')}
        />
      )}

      {currentScreen === 'search' && (
        <SearchPage 
          onBack={() => setCurrentScreen('feed')}
          onEventSelect={handleEventSelect}
        />
      )}
      
      {currentScreen === 'create-event' && user && (
        <EventCreator 
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          }}
          onBack={() => setCurrentScreen(userRole === 'organizer' ? 'dashboard' : 'feed')}
          onCreate={() => {
            // After creating event, go to event management
            setCurrentScreen('event-management');
          }}
        />
      )}
      
      {currentScreen === 'event-detail' && selectedEvent && (
        <EventDetail 
          event={selectedEvent}
          user={user ? {
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          } : null}
          onBack={handleBackToFeed}
        />
      )}

      {currentScreen === 'event-management' && selectedEvent && user && (
        <EventManagement 
          event={selectedEvent}
          onBack={() => setCurrentScreen('dashboard')}
        />
      )}
      
      {currentScreen === 'dashboard' && user && (
        <OrganizerDashboard 
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          }}
          onCreateEvent={() => setCurrentScreen('create-event')}
          onEventSelect={(event) => {
            setSelectedEvent(event);
            setCurrentScreen('event-management');
          }}
        />
      )}
      
      {currentScreen === 'profile' && user && (
        <UserProfile 
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            phone: user.phone || '',
            role: userRole,
            isVerified: true
          }}
          onRoleToggle={handleRoleToggle}
          onBack={() => setCurrentScreen('feed')}
        />
      )}
      
      {currentScreen === 'create-post' && user && (
        <PostCreator 
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          }}
          onBack={() => setCurrentScreen('feed')}
          onPost={handleBackToFeed}
        />
      )}

      {currentScreen === 'create-organization' && user && (
        <OrganizationCreator
          onBack={() => setCurrentScreen('profile')}
          onSuccess={(orgId) => {
            setSelectedOrganizationId(orgId);
            setCurrentScreen('organization-dashboard');
          }}
        />
      )}

      {currentScreen === 'organization-dashboard' && user && selectedOrganizationId && (
        <OrganizationDashboard
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          }}
          organizationId={selectedOrganizationId}
          onBack={() => setCurrentScreen('profile')}
          onCreateEvent={() => setCurrentScreen('create-event')}
        />
      )}

      {currentScreen === 'privacy-policy' && (
        <PrivacyPolicy onBack={() => setCurrentScreen('feed')} />
      )}

      {currentScreen === 'terms-of-service' && (
        <TermsOfService onBack={() => setCurrentScreen('feed')} />
      )}

      {currentScreen === 'refund-policy' && (
        <RefundPolicy onBack={() => setCurrentScreen('feed')} />
      )}

      {currentScreen === 'tickets' && user && (
        <TicketsPage
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          }}
          onBack={() => setCurrentScreen('feed')}
        />
      )}

      {currentScreen === 'scanner' && user && (
        <ScannerPage
          user={{
            id: user.id,
            name: user.user_metadata?.full_name || 'User',
            role: userRole
          }}
          onBack={() => setCurrentScreen('feed')}
        />
      )}
      
      {/* Navigation - Only show for main screens */}
      {!['event-detail', 'event-management'].includes(currentScreen) && (
        <Navigation 
          currentScreen={currentScreen}
          userRole={userRole}
          onNavigate={setCurrentScreen}
        />
      )}
      
      {/* Auth Modal */}
      <AuthModal isOpen={false} onClose={() => {}} />
      
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