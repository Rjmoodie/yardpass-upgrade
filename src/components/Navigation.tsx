import { Home, Plus, BarChart3, User, Search, Ticket, Scan, TrendingUp, DollarSign, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useHaptics } from '@/hooks/useHaptics';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';
import { PostCreatorModal } from './PostCreatorModal';
import { PurchaseGateModal } from './PurchaseGateModal';
import { OrganizerMenu } from './OrganizerMenu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { cn } from '@/lib/utils';


export type Screen =
  | 'feed'
  | 'search'
  | 'create-event'
  | 'event-detail'
  | 'dashboard'
  | 'profile'
  | 'create-post'
  | 'event-management'
  | 'create-organization'
  | 'organization-dashboard'
  | 'privacy-policy'
  | 'terms-of-service'
  | 'refund-policy'
  | 'tickets'
  | 'messages'
  | 'social'
  | 'scanner'
  | 'ticket-success'
  | 'posts-test'
  | 'sponsor';

export type UserRole = 'attendee' | 'organizer';

interface NavigationProps {
  currentScreen?: string; // unused but kept for compatibility
  userRole: UserRole;
  onNavigate?: (screen: Screen) => void; // optional callback for host screens
}


// Small helper — paths that require auth
const AUTH_REQUIRED: Record<string, Screen> = {
  '/create-event': 'create-event',
  '/create-post': 'create-post',
  '/dashboard': 'dashboard',
  '/profile': 'profile',
  '/messages': 'messages',
  '/social': 'social',
  '/scanner': 'scanner',
  '/sponsor': 'sponsor',
};

export default function Navigation({ userRole }: NavigationProps) {
  const { user } = useAuth();
  
  // Ensure role is properly derived from user state
  const effectiveUserRole = user ? userRole : 'attendee';
  const { trackEvent } = useAnalyticsIntegration();
  const { selectionChanged, impactLight } = useHaptics();
  const navigate = useNavigate();
  const location = useLocation();
  const { sponsorModeEnabled } = useSponsorMode();

  // Navigation render

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<Screen | null>(null);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [purchaseGateOpen, setPurchaseGateOpen] = useState(false);
  const [organizerMenuOpen, setOrganizerMenuOpen] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Build nav items from role
  const navItems = useMemo(() => {
    const items = (
      [
        { id: 'feed' as Screen, path: '/', icon: Home, label: 'Feed', show: true },
        { id: 'search' as Screen, path: '/search', icon: Search, label: 'Search', show: true },
        { id: 'posts-test' as Screen, path: '/posts-test', icon: Plus, label: 'Posts', show: effectiveUserRole === 'attendee' },
        { id: 'tickets' as Screen, path: '/tickets', icon: Ticket, label: 'Tickets', show: true },
        { id: 'dashboard' as Screen, path: '/dashboard', icon: BarChart3, label: 'Dashboard', show: effectiveUserRole === 'organizer' },
        { id: 'sponsor' as Screen, path: '/sponsor', icon: DollarSign, label: 'Sponsor', show: sponsorModeEnabled },
        { id: 'social' as Screen, path: '/social', icon: Users, label: 'Network', show: true },
        { id: 'messages' as Screen, path: '/messages', icon: MessageCircle, label: 'Messages', show: true },
        { id: 'profile' as Screen, path: '/profile', icon: User, label: 'Profile', show: true },
      ] as const
    ).filter((i) => i.show);

    return items;
  }, [effectiveUserRole, sponsorModeEnabled]);

  const isDenseLayout = navItems.length >= 6;

  const requiresAuth = useCallback((path: string) => path in AUTH_REQUIRED, []);

  // Open post creation for any authenticated user
  const handleCreatePost = useCallback(async () => {
    // Track create post intent
    trackEvent('engagement_create_post_intent', {
      user_role: userRole,
      source: 'navigation'
    });
    
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    
    // Always open post creator for authenticated users
    setPostCreatorOpen(true);
  }, [user, userRole, trackEvent]);

  const handleNavigation = useCallback(
    async (path: string, screen: Screen) => {
      
      // Haptic feedback for navigation
      await selectionChanged();
      
      // Track navigation click
      trackEvent('engagement_navigation_click', {
        destination: screen,
        path: path,
        user_role: userRole
      });
      
      // Special handling for tickets - allow guest access
      if (screen === 'tickets' && !user) {
        // Navigate directly to tickets - TicketsRoute will handle guest access
        navigate('/tickets');
        return;
      }
      
      if (requiresAuth(path) && !user) {
        setPendingNavigation(screen);
        setAuthModalOpen(true);
        return;
      }
      if (screen === 'posts-test') {
        void handleCreatePost();
        return;
      }
      navigate(path);
    },
    [navigate, requiresAuth, user, userRole, handleCreatePost, trackEvent, selectionChanged]
  );

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);
    if (!pendingNavigation) return;
    const pathMap: Partial<Record<Screen, string>> = {
      'create-event': '/create-event',
      'create-post': '/create-post',
      'dashboard': '/dashboard',
      'profile': '/profile',
      'tickets': '/tickets',
      'scanner': '/scanner',
      'sponsor': '/sponsor',
    };
    const path = pathMap[pendingNavigation];
    if (path) navigate(path);
    setPendingNavigation(null);
  }, [pendingNavigation, navigate]);

  const isActive = useCallback(
    (path: string) =>
      location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/')),
    [location.pathname]
  );

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50"
      style={{ 
        margin: 0, 
        padding: 0,
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)'
      }}
    >
      <div
        className="w-full bg-black/95 backdrop-blur-xl"
      >
        <div
          role="tablist"
          aria-label="Primary navigation"
          className="relative flex items-center justify-evenly px-0 py-2.5 sm:py-3"
          style={{ 
            paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))'
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavButton
                key={item.id}
                active={active}
                label={item.label}
                onClick={() => handleNavigation(item.path, item.id)}
              >
                <Icon className={`transition-all duration-300 ${active ? 'h-6 w-6' : 'h-5 w-5'}`} strokeWidth={active ? 2.5 : 2} />
              </NavButton>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingNavigation(null);
        }}
        onSuccess={() => {
          handleAuthSuccess();
          // If user was trying to access tickets and completed guest verification, navigate to tickets
          if (pendingNavigation === 'tickets') {
            navigate('/tickets');
          }
        }}
        title="Sign in to continue"
        description="You need to be signed in to access this feature"
        allowGuestTicketAccess={true}
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        onSuccess={() => toast({ title: 'Success', description: 'Your post has been created!' })}
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

      {/* Lightweight feedback when checking post eligibility */}
      {checkingEligibility && (
        <div className="absolute bottom-[72px] inset-x-0 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-black/70 text-xs text-white border border-white/10">Checking posting eligibility…</div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { impactLight } = useHaptics();

  const handleClick = async () => {
    await impactLight();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      aria-label={`Navigate to ${label}`}
      aria-current={active ? 'page' : undefined}
      role="tab"
      tabIndex={0}
      className={`group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-all duration-300 ease-out touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-h-[60px] sm:min-h-[64px] ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-primary/90'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl border transition-all duration-300 ${
          active
            ? 'border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 opacity-100'
            : 'border-transparent bg-transparent opacity-0 group-hover:opacity-100 group-hover:border-border/40 group-hover:bg-muted/30'
        }`}
      />
      <span
        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${
          active
            ? 'bg-primary/15'
            : 'bg-muted/20 group-hover:bg-muted/40'
        }`}
      >
        <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>{children}</span>
      </span>

      <span
        className={`relative z-10 text-[10px] font-medium leading-none transition-all duration-300 ${
          active
            ? 'font-semibold text-primary'
            : 'text-muted-foreground group-hover:text-primary'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
