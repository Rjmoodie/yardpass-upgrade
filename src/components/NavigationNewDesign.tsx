import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Ticket, User, MessageCircle, LayoutDashboard, ScanLine } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function NavigationNewDesign() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [userRole, setUserRole] = useState<'attendee' | 'organizer'>('attendee');
  
  // Fetch user role from profile - refetch whenever needed
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) {
        setUserRole('attendee');
        return;
      }
      
      // Always fetch fresh from database to ensure latest role
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (data?.role) {
        console.log('[Navigation] Role updated to:', data.role);
        setUserRole(data.role as 'attendee' | 'organizer');
      }
    };
    
    fetchUserRole();
  }, [user?.id, profile?.role, location.pathname]);
  
  // Dynamic nav items based on user role
  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed', path: '/' },
    { id: 'search', icon: Search, label: 'Search', path: '/search' },
    // Show Scanner for organizers, Tickets for attendees
    userRole === 'organizer'
      ? { id: 'scanner', icon: ScanLine, label: 'Scanner', path: '/scanner', authRequired: true }
      : { id: 'tickets', icon: Ticket, label: 'Tickets', path: '/tickets', authRequired: true },
    { id: 'messages', icon: MessageCircle, label: 'Messages', path: '/messages', authRequired: true },
    // Show Dashboard for organizers, Profile for attendees
    userRole === 'organizer'
      ? { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', authRequired: true }
      : { id: 'profile', icon: User, label: 'Profile', path: '/profile', authRequired: true },
  ];

  const handleNavigate = (path: string, authRequired: boolean) => {
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
    <nav className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border/20 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2 sm:px-4">
        {/* Main Navigation Items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path, item.authRequired || false)}
              className={`relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all active:scale-95 sm:px-4 ${
                isActive
                  ? 'bg-gradient-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/50'
                  : 'hover:bg-muted/40'
              }`}
            >
              {/* Glow effect for active state */}
              {isActive && (
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" aria-hidden="true" />
              )}
              
              <Icon className={`relative h-5 w-5 sm:h-6 sm:w-6 transition-all ${
                isActive ? 'text-primary-foreground drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-foreground/60'
              }`} />
              <span className={`relative text-[10px] font-bold sm:text-xs transition-all ${
                isActive ? 'text-primary-foreground drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]' : 'text-foreground/60'
              }`}>
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

