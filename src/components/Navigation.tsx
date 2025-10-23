import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useHaptics } from '@/hooks/useHaptics';
import { useCallback, useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';
import { PostCreatorModal } from './PostCreatorModal';
import { PurchaseGateModal } from './PurchaseGateModal';
import { OrganizerMenu } from './OrganizerMenu';
import { toast } from '@/hooks/use-toast';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import {
  Home,
  Search,
  Plus,
  Ticket,
  BarChart3,
  DollarSign,
  Building2,
  Users,
  User,
  QrCode,
  Bell,
  LayoutDashboard,
  ShieldCheck,
  Landmark,
  MessageCircle
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  | 'sponsor'
  | 'sponsorship'
  | 'analytics'
  | 'admin'
  | 'payments'
  | 'notifications';

export type UserRole = 'attendee' | 'organizer' | 'admin';

type NavigationItem = {
  id: Screen;
  path: string;
  label: string;
  icon?: LucideIcon;
  show?: boolean;
  badge?: string;
  description?: string;
};

interface NavigationProps {
  currentScreen?: string; // unused but kept for compatibility
  userRole: UserRole;
  onNavigate?: (screen: Screen) => void; // optional callback for host screens
  platform?: 'web' | 'mobile';
  items?: NavigationItem[];
}

const AUTH_REQUIRED: Record<string, Screen> = {
  '/create-event': 'create-event',
  '/create-post': 'create-post',
  '/dashboard': 'dashboard',
  '/profile': 'profile',
  '/messages': 'messages',
  '/social': 'social',
  '/scanner': 'scanner',
  '/sponsor': 'sponsor',
  '/sponsorship': 'sponsorship',
  '/analytics': 'analytics',
  '/payments': 'payments',
  '/admin': 'admin',
  '/notifications': 'notifications'
};

const DEFAULT_ICON_MAP: Partial<Record<Screen, LucideIcon>> = {
  feed: Home,
  search: Search,
  'create-post': Plus,
  tickets: Ticket,
  dashboard: LayoutDashboard,
  profile: User,
  social: Users,
  scanner: QrCode,
  sponsor: DollarSign,
  sponsorship: Building2,
  analytics: BarChart3,
  payments: Landmark,
  admin: ShieldCheck,
  notifications: Bell,
  messages: MessageCircle
};

export function Navigation({ userRole, onNavigate, platform = 'mobile', items }: NavigationProps) {
  const { user } = useAuth();

  // Ensure role is properly derived from user state
  const effectiveUserRole: UserRole = user ? userRole : 'attendee';
  const { trackEvent } = useAnalyticsIntegration();
  const { selectionChanged, impactLight } = useHaptics();
  const navigate = useNavigate();
  const location = useLocation();
  const { sponsorModeEnabled } = useSponsorMode();

  const isWebPlatform = platform === 'web';

  // Navigation render
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<Screen | null>(null);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [purchaseGateOpen, setPurchaseGateOpen] = useState(false);
  const [organizerMenuOpen, setOrganizerMenuOpen] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Build nav items from role
  const navItems = useMemo(() => {
    if (items && items.length > 0) {
      return items.filter((item) => item.show !== false);
    }

    const defaults: NavigationItem[] = [
      { id: 'feed', path: '/', icon: Home, label: 'Feed', show: true },
      { id: 'search', path: '/search', icon: Search, label: 'Search', show: true },
      { id: 'posts-test', path: '/posts-test', icon: Plus, label: 'Posts', show: effectiveUserRole === 'attendee' },
      { id: 'tickets', path: '/tickets', icon: Ticket, label: 'Tickets', show: true },
      { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: effectiveUserRole !== 'attendee' },
      { id: 'sponsor', path: '/sponsor', icon: DollarSign, label: 'Sponsor', show: sponsorModeEnabled },
      { id: 'sponsorship', path: '/sponsorship', icon: Building2, label: 'Sponsorship', show: sponsorModeEnabled },
      { id: 'social', path: '/social', icon: Users, label: 'Social', show: true },
      { id: 'profile', path: '/profile', icon: User, label: 'Profile', show: true }
    ];

    return defaults.filter((item) => item.show !== false);
  }, [items, effectiveUserRole, sponsorModeEnabled]);

  const isDenseLayout = navItems.length >= (isWebPlatform ? 6 : 5);

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
        path,
        user_role: userRole
      });

      // Special handling for tickets - allow guest access
      if (screen === 'tickets' && !user) {
        navigate('/tickets');
        onNavigate?.(screen);
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
      onNavigate?.(screen);
    },
    [navigate, requiresAuth, user, userRole, handleCreatePost, trackEvent, selectionChanged, onNavigate]
  );

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);
    if (!pendingNavigation) return;
    const pathMap: Partial<Record<Screen, string>> = {
      'create-event': '/create-event',
      'create-post': '/create-post',
      dashboard: '/dashboard',
      profile: '/profile',
      tickets: '/tickets',
      scanner: '/scanner',
      sponsor: '/sponsor',
      sponsorship: '/sponsorship',
      analytics: '/analytics',
      payments: '/payments',
      admin: '/admin',
      notifications: '/notifications'
    };
    const path = pathMap[pendingNavigation];
    if (path) {
      navigate(path);
      onNavigate?.(pendingNavigation);
    }
    setPendingNavigation(null);
  }, [pendingNavigation, navigate, onNavigate]);

  const isActive = useCallback(
    (path: string) =>
      location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`)),
    [location.pathname]
  );

  const containerClass = cn(
    'z-50 pointer-events-auto',
    isWebPlatform
      ? 'sticky top-0 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70'
      : 'fixed inset-x-0 bottom-0 border-t border-border/60 bg-black/90 backdrop-blur'
  );

  const navBarClass = cn(
    'relative flex items-center',
    isWebPlatform
      ? 'mx-auto w-full max-w-5xl justify-between gap-1 px-4 py-3 sm:px-6'
      : 'justify-evenly px-0 py-2.5 sm:py-3'
  );

  const navStyle: CSSProperties | undefined = isWebPlatform
    ? undefined
    : {
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))'
      };

  return (
    <div className={containerClass} style={isWebPlatform ? undefined : { margin: 0, padding: 0 }}>
      <nav
        role="tablist"
        aria-label="Primary navigation"
        className={navBarClass}
        style={navStyle}
      >
        {navItems.map((item) => {
          const Icon = item.icon ?? DEFAULT_ICON_MAP[item.id] ?? Home;
          const active = isActive(item.path);

          return (
            <NavButton
              key={item.id}
              active={active}
              label={item.label}
              onClick={() => handleNavigation(item.path, item.id)}
              badge={item.badge}
              description={item.description}
              platform={isWebPlatform ? 'web' : 'mobile'}
              dense={isDenseLayout}
            >
              <Icon className={cn('transition-all duration-300', active ? 'h-5 w-5' : 'h-5 w-5')} strokeWidth={active ? 2.4 : 2} />
            </NavButton>
          );
        })}
      </nav>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingNavigation(null);
        }}
        onSuccess={() => {
          handleAuthSuccess();
          if (pendingNavigation === 'tickets') {
            navigate('/tickets');
            onNavigate?.('tickets');
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
  badge,
  description,
  platform,
  dense
}: {
  children: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  description?: string;
  platform: 'web' | 'mobile';
  dense?: boolean;
}) {
  const { impactLight } = useHaptics();
  const isWeb = platform === 'web';

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
      className={cn(
        'group relative flex items-center transition-all duration-300 ease-out touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isWeb
          ? 'min-h-[48px] gap-3 rounded-xl px-3 py-2'
          : 'flex-1 flex-col gap-1 rounded-2xl px-3 py-2 min-h-[60px] sm:min-h-[64px]',
        active ? 'text-primary' : 'text-muted-foreground hover:text-primary/90'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl border transition-all duration-300',
          isWeb ? 'rounded-xl' : 'rounded-2xl',
          active
            ? 'border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 opacity-100'
            : 'border-transparent bg-transparent opacity-0 group-hover:opacity-100 group-hover:border-border/40 group-hover:bg-muted/30'
        )}
      />
      <span
        className={cn(
          'relative z-10 flex items-center justify-center rounded-xl transition-all duration-300',
          isWeb ? 'h-9 w-9' : 'h-9 w-9',
          active ? 'bg-primary/15' : 'bg-muted/20 group-hover:bg-muted/40'
        )}
      >
        <span className={cn('transition-transform duration-300', active ? 'scale-110' : 'group-hover:scale-105')}>{children}</span>
      </span>

      <span
        className={cn(
          'relative z-10 font-medium leading-none transition-all duration-300',
          isWeb ? 'text-sm' : dense ? 'text-[10px]' : 'text-xs',
          active ? 'font-semibold text-primary' : 'text-muted-foreground group-hover:text-primary'
        )}
      >
        {label}
      </span>

      {badge && (
        <Badge
          variant="secondary"
          className={cn(
            'relative z-10 uppercase tracking-wide',
            isWeb ? 'ml-auto text-[10px]' : 'mt-1 text-[9px]'
          )}
        >
          {badge}
        </Badge>
      )}

      {isWeb && description && (
        <span className="relative z-10 hidden text-[11px] text-muted-foreground sm:block">
          {description}
        </span>
      )}
    </button>
  );
}

export default Navigation;
