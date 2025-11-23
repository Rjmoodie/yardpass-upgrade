import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  Ticket,
  User,
  MessageCircle,
  LayoutDashboard,
  ScanLine,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'attendee' | 'organizer';

export function NavigationNewDesign() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // ✅ Use role from AuthContext directly (no redundant fetch)
  const userRole: UserRole = (profile?.role as UserRole) || 'attendee';

  // ✅ Log only when role actually changes
  const prevRoleRef = useRef<string | null>(null);
  useEffect(() => {
    if (profile?.role && profile.role !== prevRoleRef.current) {
      console.log('[Navigation] Role updated to:', profile.role);
      prevRoleRef.current = profile.role;
    }
  }, [profile?.role]);

  // Dynamic nav items based on user role
  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed', path: '/' },
    { id: 'search', icon: Search, label: 'Search', path: '/search' },
    userRole === 'organizer'
      ? {
          id: 'scanner',
          icon: ScanLine,
          label: 'Scanner',
          path: '/scanner',
          authRequired: true,
        }
      : {
          id: 'tickets',
          icon: Ticket,
          label: 'Tickets',
          path: '/tickets',
          authRequired: true,
        },
    {
      id: 'messages',
      icon: MessageCircle,
      label: 'Messages',
      path: '/messages',
      authRequired: true,
    },
    userRole === 'organizer'
      ? {
          id: 'dashboard',
          icon: LayoutDashboard,
          label: 'Dashboard',
          path: '/dashboard',
          authRequired: true,
        }
      : {
          id: 'profile',
          icon: User,
          label: 'Profile',
          path: '/profile',
          authRequired: true,
        },
  ];

  const handleNavigate = (path: string, authRequired: boolean | undefined) => {
    if (authRequired && !user) {
      navigate('/auth');
      return;
    }
    navigate(path);
  };

  // Determine current screen from pathname
  const getCurrentScreen = () => {
    const path = location.pathname;
    if (path === '/') return 'feed';
    if (path.includes('/search')) return 'search';
    if (path.includes('/scanner')) return 'scanner';
    if (path.includes('/tickets')) return 'tickets';
    if (path.includes('/messages')) return 'messages';
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/notifications')) return 'notifications';
    return '';
  };

  const currentScreen = getCurrentScreen();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border/60 bg-background/85 backdrop-blur-xl shadow-[var(--shadow-sm)]"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2 sm:px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.path, item.authRequired)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex flex-col items-center gap-1 rounded-[var(--radius-md)] px-3 py-2 transition-all active:scale-95 sm:px-4 ${
                isActive
                  ? 'bg-primary/15 text-primary shadow-[var(--shadow-sm)]'
                  : 'text-foreground/80 hover:bg-foreground/5'
              }`}
            >
              <Icon
                className={`relative h-5 w-5 sm:h-6 sm:w-6 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-foreground/75 group-hover:text-foreground'
                }`}
              />
              <span
                className={`relative text-[10px] font-medium sm:text-xs transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-foreground/75 group-hover:text-foreground'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default NavigationNewDesign;
