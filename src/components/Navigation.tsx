import { Home, Plus, BarChart3, User, Search, Ticket, Scan, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';
import { PostCreatorModal } from './PostCreatorModal';
import { PurchaseGateModal } from './PurchaseGateModal';
import { OrganizerMenu } from './OrganizerMenu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  | 'analytics';

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
  '/analytics': 'analytics',
};

export default function Navigation({ userRole }: NavigationProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        { id: 'create-event' as Screen, path: '/create-event', icon: Plus, label: 'Create', show: userRole === 'organizer' },
        { id: 'posts-test' as Screen, path: '/posts-test', icon: Plus, label: 'Posts', show: userRole === 'attendee' },
        // Attendees see Tickets; organizers see Scan
        {
          id: (userRole === 'organizer' ? 'scanner' : 'tickets') as Screen,
          path: userRole === 'organizer' ? '/scanner' : '/tickets',
          icon: userRole === 'organizer' ? Scan : Ticket,
          label: userRole === 'organizer' ? 'Scan' : 'Tickets',
          show: true,
        },
        { id: 'dashboard' as Screen, path: '/dashboard', icon: BarChart3, label: 'Dashboard', show: userRole === 'organizer' },
        { id: 'analytics' as Screen, path: '/analytics', icon: TrendingUp, label: 'Analytics', show: userRole === 'organizer' },
        { id: 'profile' as Screen, path: '/profile', icon: User, label: 'Profile', show: true },
      ] as const
    ).filter((i) => i.show);
    
    console.log('Navigation items:', items.map(i => ({ id: i.id, label: i.label, show: i.show })));
    return items;
  }, [userRole]);

  const requiresAuth = useCallback((path: string) => path in AUTH_REQUIRED, []);

  // Open post creation for any authenticated user
  const handleCreatePost = useCallback(async () => {
    console.log('handleCreatePost called, user:', user?.id);
    if (!user) {
      console.log('No user, opening auth modal');
      setAuthModalOpen(true);
      return;
    }
    
    // Always open post creator for authenticated users
    setPostCreatorOpen(true);
  }, [user]);

  const handleNavigation = useCallback(
    (path: string, screen: Screen) => {
      console.log('handleNavigation called with:', { path, screen, user: user?.id, userRole });
      
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
    [navigate, requiresAuth, user, userRole, handleCreatePost]
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
      'analytics': '/analytics',
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
    <div className="glass-nav px-2 sm:px-6 py-2 sm:py-4 flex items-center justify-around fixed bottom-0 left-0 right-0 z-50 border-t border-white/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 shadow-lg shadow-black/5">
      <div role="tablist" aria-label="Primary navigation" className="flex items-center gap-0.5 sm:gap-2 w-full max-w-3xl mx-auto justify-evenly">
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
              <Icon className={`transition-all duration-300 ${active ? 'w-7 h-7' : 'w-6 h-6'}`} strokeWidth={active ? 2.5 : 2} />
            </NavButton>
          );
        })}
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
  return (
    <button
      onClick={onClick}
      aria-label={`Navigate to ${label}`}
      aria-current={active ? 'page' : undefined}
      role="tab"
      tabIndex={0}
      className={`group flex flex-col items-center gap-1 sm:gap-1.5 flex-1 max-w-[80px] sm:max-w-[92px] p-1.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-300 active:scale-95 min-h-[48px] sm:min-h-[56px] min-w-[48px] sm:min-w-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 relative overflow-hidden ${
        active
          ? 'text-primary bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/40 shadow-lg shadow-primary/20 scale-105'
          : 'text-muted-foreground hover:text-primary hover:bg-gradient-to-br hover:from-white/15 hover:to-white/5 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-md'
      }`}
    >
      {/* Subtle background glow for active state */}
      {active && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl" />
      )}
      
      {/* Icon with enhanced styling */}
      <div className={`relative z-10 transition-all duration-300 ${active ? 'drop-shadow-sm' : 'group-hover:drop-shadow-sm'}`}>
        {children}
      </div>
      
      {/* Label with better typography */}
      <span className={`relative z-10 text-[9px] sm:text-xs font-medium leading-none transition-all duration-300 truncate max-w-full ${
        active 
          ? 'font-bold text-primary drop-shadow-sm' 
          : 'group-hover:font-semibold group-hover:text-primary'
      }`}>
        {label}
      </span>
    </button>
  );
}