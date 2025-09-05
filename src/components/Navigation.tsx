import { Home, Plus, BarChart3, User, Search, Ticket, Scan, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';
import { PostCreatorModal } from './PostCreatorModal';
import { PurchaseGateModal } from './PurchaseGateModal';
import { OrganizerMenu } from './OrganizerMenu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Screen = 'feed' | 'search' | 'create-event' | 'event-detail' | 'dashboard' | 'profile' | 'create-post' | 'event-management' | 'create-organization' | 'organization-dashboard' | 'privacy-policy' | 'terms-of-service' | 'refund-policy' | 'tickets' | 'scanner' | 'ticket-success' | 'posts-test' | 'analytics';
type UserRole = 'attendee' | 'organizer';

interface NavigationProps {
  currentScreen: string;
  userRole: UserRole;
  onNavigate: (screen: Screen) => void;
}

export default function Navigation({ userRole }: NavigationProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<Screen | null>(null);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [purchaseGateOpen, setPurchaseGateOpen] = useState(false);
  const [organizerMenuOpen, setOrganizerMenuOpen] = useState(false);

  const requiresAuth = (path: string) => {
    return ['/create-event', '/create-post', '/dashboard', '/profile', '/tickets', '/scanner', '/analytics'].includes(path);
  };

  const handleNavigation = (path: string, screen: Screen) => {
    if (requiresAuth(path) && !user) {
      setPendingNavigation(screen);
      setAuthModalOpen(true);
    } else if (screen === 'create-post') {
      handleCreatePost();
    } else {
      navigate(path);
    }
  };

  const handleCreatePost = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    try {
      // Check if user has any tickets
      console.log('Checking user tickets for posting eligibility...');
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, event_id')
        .eq('owner_user_id', user.id)
        .in('status', ['issued', 'transferred', 'redeemed']);

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }

      console.log('User tickets:', tickets);

      // Check if user is an organizer (has events or org memberships)
      console.log('Checking if user is organizer...');
      const { data: ownedEvents } = await supabase
        .from('events')
        .select('id')
        .eq('owner_context_type', 'individual')
        .eq('owner_context_id', user.id)
        .limit(1);

      console.log('Owned events:', ownedEvents);

      const { data: orgMemberships } = await supabase
        .from('org_memberships')
        .select('id')
        .eq('user_id', user.id)
        .in('role', ['editor', 'admin', 'owner'])
        .limit(1);

      console.log('Org memberships:', orgMemberships);

      const isOrganizer = (ownedEvents && ownedEvents.length > 0) || (orgMemberships && orgMemberships.length > 0);

      console.log('Posting eligibility check:', { isOrganizer, hasTickets: tickets && tickets.length > 0 });

      if (isOrganizer) {
        console.log('Opening organizer menu');
        setOrganizerMenuOpen(true);
      } else if (tickets && tickets.length > 0) {
        console.log('Opening post creator');
        setPostCreatorOpen(true);
      } else {
        console.log('Opening purchase gate');
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
      const pathMap: { [key in Screen]?: string } = {
        'create-event': '/create-event',
        'create-post': '/create-post',
        'dashboard': '/dashboard',
        'profile': '/profile',
        'tickets': '/tickets',
        'scanner': '/scanner',
        'analytics': '/analytics'
      };
      const path = pathMap[pendingNavigation];
      if (path) navigate(path);
      setPendingNavigation(null);
    }
  };
  const navItems = [
    {
      id: 'feed' as Screen,
      path: '/',
      icon: Home,
      label: 'Feed',
      show: true
    },
    {
      id: 'search' as Screen,
      path: '/search',
      icon: Search,
      label: 'Search',
      show: true
    },
    {
      id: 'create-event' as Screen,
      path: '/create-event',
      icon: Plus,
      label: 'Create',
      show: userRole === 'organizer'
    },
    {
      id: 'posts-test' as Screen,
      path: '/posts-test',
      icon: Plus,
      label: 'Posts',
      show: userRole === 'attendee'
    },
    {
      // Ticket button for attendees, Scan button for organizers
      id: userRole === 'organizer' ? 'scanner' as Screen : 'tickets' as Screen,
      path: userRole === 'organizer' ? '/scanner' : '/tickets',
      icon: userRole === 'organizer' ? Scan : Ticket,
      label: userRole === 'organizer' ? 'Scan' : 'Tickets',
      show: true
    },
    {
      id: 'dashboard' as Screen,
      path: '/dashboard',
      icon: BarChart3,
      label: 'Dashboard',
      show: userRole === 'organizer'
    },
    {
      id: 'analytics' as Screen,
      path: '/analytics',
      icon: TrendingUp,
      label: 'Analytics',
      show: userRole === 'organizer'
    },
    {
      id: 'profile' as Screen,
      path: '/profile',
      icon: User,
      label: 'Profile',
      show: true
    },
  ].filter(item => item.show);

  return (
    <div className="glass-nav px-6 py-4 flex items-center justify-around fixed bottom-0 left-0 right-0 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.path, item.id)}
            aria-label={`Navigate to ${item.label}`}
            aria-current={isActive ? 'page' : undefined}
            role="tab"
            tabIndex={0}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 active:scale-95 min-h-[56px] min-w-[56px] touch-manipulation ${
              isActive 
                ? 'text-primary bg-primary/20 backdrop-blur-sm border border-primary/30 shadow-lg golden-glow scale-110' 
                : 'text-muted-foreground hover:text-primary hover:bg-white/10 hover:backdrop-blur-sm hover:border hover:border-white/20 hover:scale-105'
            }`}
          >
            <Icon className={`transition-all duration-300 ${isActive ? 'w-7 h-7' : 'w-6 h-6'}`} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-xs font-medium transition-all duration-300 ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
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
          navigate('/search');
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
          navigate('/create-event');
        }}
      />
    </div>
  );
}