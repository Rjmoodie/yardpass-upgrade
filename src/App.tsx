import { useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { MainFeed } from './components/MainFeed';
import { EventCreator } from './components/EventCreator';
import { EventDetail } from './components/EventDetail';
import { OrganizerDashboard } from './components/OrganizerDashboard';
import { UserProfile } from './components/UserProfile';
import { PostCreator } from './components/PostCreator';
import { Navigation } from './components/Navigation';

type Screen = 'auth' | 'feed' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post';
type UserRole = 'attendee' | 'organizer';

interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  isVerified: boolean;
}

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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [user, setUser] = useState<User | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Mock authentication
  const handleAuth = (phone: string, name: string) => {
    const newUser: User = {
      id: '1',
      phone,
      name,
      role: 'attendee',
      isVerified: true
    };
    setUser(newUser);
    setCurrentScreen('feed');
  };

  const handleRoleToggle = () => {
    if (user) {
      setUser({
        ...user,
        role: user.role === 'attendee' ? 'organizer' : 'attendee'
      });
    }
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setCurrentScreen('event-detail');
  };

  const handleBackToFeed = () => {
    setCurrentScreen('feed');
    setSelectedEvent(null);
  };

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {currentScreen === 'feed' && (
        <MainFeed 
          user={user}
          onEventSelect={handleEventSelect}
          onCreatePost={() => setCurrentScreen('create-post')}
        />
      )}
      
      {currentScreen === 'create-event' && (
        <EventCreator 
          user={user}
          onBack={() => setCurrentScreen(user.role === 'organizer' ? 'dashboard' : 'feed')}
          onCreate={handleBackToFeed}
        />
      )}
      
      {currentScreen === 'event-detail' && selectedEvent && (
        <EventDetail 
          event={selectedEvent}
          user={user}
          onBack={handleBackToFeed}
        />
      )}
      
      {currentScreen === 'dashboard' && (
        <OrganizerDashboard 
          user={user}
          onCreateEvent={() => setCurrentScreen('create-event')}
          onEventSelect={handleEventSelect}
        />
      )}
      
      {currentScreen === 'profile' && (
        <UserProfile 
          user={user}
          onRoleToggle={handleRoleToggle}
          onBack={() => setCurrentScreen('feed')}
        />
      )}
      
      {currentScreen === 'create-post' && (
        <PostCreator 
          user={user}
          onBack={() => setCurrentScreen('feed')}
          onPost={handleBackToFeed}
        />
      )}
      
      <Navigation 
        currentScreen={currentScreen}
        userRole={user.role}
        onNavigate={setCurrentScreen}
      />
    </div>
  );
}