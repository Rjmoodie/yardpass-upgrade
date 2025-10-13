import { Home, Plus, BarChart3, User, Search, Ticket, Scan, TrendingUp, DollarSign } from 'lucide-react';
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
  '/tickets': 'tickets',
  '/scanner': 'scanner',
  '/sponsor': 'sponsor',
};

export default function Navigation({ userRole }: NavigationProps) {
  const { user } = useAuth();
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
        { id: 'posts-test' as Screen, path: '/posts-test', icon: Plus, label: 'Posts', show: userRole === 'attendee' },
        // Attendees see Tickets
        { id: 'tickets' as Screen, path: '/tickets', icon: Ticket, label: 'Tickets', show: userRole === 'attendee' },
        { id: 'dashboard' as Screen, path: '/dashboard', icon: BarChart3, label: 'Dashboard', show: userRole === 'organizer' },
        { id: 'sponsor' as Screen, path: '/sponsor', icon: DollarSign, label: 'Sponsor', show: sponsorModeEnabled },
        { id: 'profile' as Screen, path: '/profile', icon: User, label: 'Profile', show: true },
      ] as const
    ).filter((i) => i.show);

    return items;
  }, [userRole, sponsorModeEnabled]);

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
    <div className="fixed inset-x-0 bottom-0 z-rail flex justify-center">
      <div className="w-full">
        <div
          role="tablist"
          aria-label="Primary navigation"
          className="relative flex items-center justify-evenly gap-1 overflow-hidden bg-background/95 px-3 py-2.5 shadow-[0_-2px_20px_rgba(0,0,0,0.15)] backdrop-blur-xl sm:gap-1.5"
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
        onSuccess={handleAuthSuccess}
        title="Sign in to continue"
        description="You need to be signed in to access this feature"
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
      className={`group relative flex flex-1 max-w-[80px] flex-col items-center gap-1 rounded-3xl px-2.5 py-2 transition-all duration-300 ease-out touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-3 sm:py-2.5 min-h-[68px] sm:min-h-[72px] ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-primary/90'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-3xl border transition-all duration-300 ${
          active
            ? 'border-primary/40 bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 opacity-100 shadow-[0_12px_28px_-14px_rgba(59,130,246,0.55)]'
            : 'border-transparent bg-transparent opacity-0 group-hover:opacity-100 group-hover:border-border/60 group-hover:bg-muted/40'
        }`}
      />
      <span
        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 sm:h-11 sm:w-11 ${
          active
            ? 'bg-primary/15 shadow-[0_10px_24px_-12px_rgba(59,130,246,0.65)]'
            : 'bg-muted/30 group-hover:bg-muted/60'
        }`}
      >
        <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>{children}</span>
      </span>

      <span
        className={`relative z-10 text-[10px] font-medium leading-none transition-all duration-300 sm:text-xs ${
          active
            ? 'font-semibold text-primary'
            : 'text-muted-foreground group-hover:text-primary'
        }`}
      >
        {label}
      </span>

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full transition-all duration-300 ${
          active
            ? 'scale-100 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-100'
            : 'scale-50 bg-muted/60 opacity-0 group-hover:scale-100 group-hover:opacity-60'
        }`}
      />
    </button>
  );
}
