import { Home, Plus, BarChart3, User, Search, Ticket, ScanLine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import AuthModal from './AuthModal';
import { PostCreatorModal } from './PostCreatorModal';
import { PurchaseGateModal } from './PurchaseGateModal';
import { OrganizerMenu } from './OrganizerMenu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Screen = 'feed' | 'search' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post' | 'event-management' | 'create-organization' | 'organization-dashboard' | 'privacy-policy' | 'terms-of-service' | 'refund-policy' | 'tickets' | 'scanner' | 'ticket-success';
type UserRole = 'attendee' | 'organizer';

interface NavigationProps {
  currentScreen: Screen;
  userRole: UserRole;
  onNavigate: (screen: Screen) => void;
}

export default function Navigation({ currentScreen, userRole, onNavigate }: NavigationProps) {
  const { user, profile } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<Screen | null>(null);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [purchaseGateOpen, setPurchaseGateOpen] = useState(false);
  const [organizerMenuOpen, setOrganizerMenuOpen] = useState(false);

  const requiresAuth = (screen: Screen) => {
    return ['create-event', 'create-post', 'dashboard', 'profile', 'tickets', 'scanner'].includes(screen);
  };

  const handleNavigation = (screen: Screen) => {
    if (requiresAuth(screen) && !user) {
      setPendingNavigation(screen);
      setAuthModalOpen(true);
    } else if (screen === 'create-post') {
      handleCreatePost();
    } else {
      onNavigate(screen);
    }
  };

  const handleCreatePost = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    try {
      // Check if user has any tickets
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, event_id')
        .eq('owner_user_id', user.id)
        .in('status', ['issued', 'transferred', 'redeemed']);

      if (error) throw error;

      // Check if user is an organizer (has events or org memberships)
      const { data: ownedEvents } = await supabase
        .from('events')
        .select('id')
        .eq('owner_context_type', 'individual')
        .eq('owner_context_id', user.id)
        .limit(1);

      const { data: orgMemberships } = await supabase
        .from('org_memberships')
        .select('id')
        .eq('user_id', user.id)
        .in('role', ['editor', 'admin', 'owner'])
        .limit(1);

      const isOrganizer = (ownedEvents && ownedEvents.length > 0) || (orgMemberships && orgMemberships.length > 0);

      if (isOrganizer) {
        setOrganizerMenuOpen(true);
      } else if (tickets && tickets.length > 0) {
        setPostCreatorOpen(true);
      } else {
        setPurchaseGateOpen(true);
      }
    } catch (error) {
      console.error('Error checking user eligibility:', error);
      toast({
        title: "Error",
        description: "Failed to check posting eligibility",
        variant: "destructive",
      });
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    if (pendingNavigation) {
      onNavigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };
  const navItems = [
    {
      id: 'feed' as Screen,
      icon: Home,
      label: 'Feed',
      show: true
    },
    {
      id: 'search' as Screen,
      icon: Search,
      label: 'Search',
      show: true
    },
    {
      id: 'create-event' as Screen,
      icon: Plus,
      label: 'Create',
      show: userRole === 'organizer'
    },
    {
      id: 'create-post' as Screen,
      icon: Plus,
      label: 'Post',
      show: userRole === 'attendee'
    },
    {
      // Ticket button for attendees, Scan button for organizers
      id: userRole === 'organizer' ? 'scanner' as Screen : 'tickets' as Screen,
      icon: userRole === 'organizer' ? ScanLine : Ticket,
      label: userRole === 'organizer' ? 'Scan' : 'Tickets',
      show: true
    },
    {
      id: 'dashboard' as Screen,
      icon: BarChart3,
      label: 'Dashboard',
      show: userRole === 'organizer'
    },
    {
      id: 'profile' as Screen,
      icon: User,
      label: 'Profile',
      show: true
    }
  ].filter(item => item.show);

  return (
    <div className="bg-card border-t border-border px-4 py-2 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              isActive 
                ? 'text-primary bg-primary/10' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </button>
        );
      })}
      
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingNavigation(null);
        }}
        onSuccess={handleAuthSuccess}
        title="Sign in to continue"
        description="You need to be signed in to access this feature"
      />
      
      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        onSuccess={() => {
          toast({
            title: "Success",
            description: "Your post has been created!",
          });
        }}
      />
      
      <PurchaseGateModal
        isOpen={purchaseGateOpen}
        onClose={() => setPurchaseGateOpen(false)}
        onDiscoverEvents={() => {
          setPurchaseGateOpen(false);
          onNavigate('search');
        }}
      />
      
      <OrganizerMenu
        isOpen={organizerMenuOpen}
        onClose={() => setOrganizerMenuOpen(false)}
        onPostAsCrew={() => {
          setOrganizerMenuOpen(false);
          setPostCreatorOpen(true);
        }}
        onRecreateEvent={() => {
          setOrganizerMenuOpen(false);
          onNavigate('create-event');
        }}
      />
    </div>
  );
}