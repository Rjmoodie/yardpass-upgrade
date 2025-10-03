import { Home, Plus, BarChart3, User, Search, Ticket, Scan, TrendingUp, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useHaptics } from '@/hooks/useHaptics';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';
import { PostCreatorModal } from './PostCreatorModal';
import { PurchaseGateModal } from './PurchaseGateModal';
import { OrganizerMenu } from './OrganizerMenu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { ThemeToggle } from './ThemeToggle';

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

  console.log('Navigation render - user:', user?.id, 'userRole:', userRole);

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
    
    console.log('Navigation items:', items.map(i => ({ id: i.id, label: i.label, show: i.show })));
    return items;
  }, [userRole, sponsorModeEnabled]);

  const requiresAuth = useCallback((path: string) => path in AUTH_REQUIRED, []);

  // Open post creation for any authenticated user
  const handleCreatePost = useCallback(async () => {
    console.log('handleCreatePost called, user:', user?.id);
    
    // Track create post intent
    trackEvent('engagement_create_post_intent', {
      user_role: userRole,
      source: 'navigation'
    });
    
    if (!user) {
      console.log('No user, opening auth modal');
      setAuthModalOpen(true);
      return;
    }
    
    // Always open post creator for authenticated users
    setPostCreatorOpen(true);
  }, [user, userRole, trackEvent]);

  const handleNavigation = useCallback(
    async (path: string, screen: Screen) => {
      console.log('handleNavigation called with:', { path, screen, user: user?.id, userRole });
      
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
        console.log('Posts button clicked, user:', user?.id, 'userRole:', userRole);
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
    <div className="glass-nav px-4 py-2 flex items-center justify-around fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 safe-bottom">
      <div role="tablist" aria-label="Primary navigation" className="flex items-center gap-1 w-full max-w-md mx-auto justify-evenly">
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
              <Icon className={`transition-all duration-200 ${active ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={active ? 2.5 : 2} />
            </NavButton>
          );
        })}
        
        {/* Theme toggle in navigation */}
        <div className="flex items-center justify-center min-w-[56px]">
          <ThemeToggle />
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

function NavButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
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
      className={`group flex flex-col items-center gap-1 flex-1 max-w-[72px] p-2 rounded-2xl transition-all duration-200 active:scale-90 min-h-[56px] min-w-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 relative touch-manipulation ${
        active
          ? 'text-primary bg-primary/10 border border-primary/20 shadow-md'
          : 'text-muted-foreground hover:text-primary hover:bg-muted/50'
      }`}
    >
      {/* Icon with enhanced styling */}
      <div className={`relative z-10 transition-all duration-200 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
        {children}
      </div>
      
      {/* Label with better typography */}
      <span className={`relative z-10 text-xs font-medium leading-none transition-all duration-200 truncate max-w-full ${
        active 
          ? 'font-bold text-primary' 
          : 'group-hover:font-semibold group-hover:text-primary'
      }`}>
        {label}
      </span>
    </button>
  );
}