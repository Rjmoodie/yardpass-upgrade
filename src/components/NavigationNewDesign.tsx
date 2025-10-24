import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Ticket, User, Bell, MessageCircle } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

export function NavigationNewDesign() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed', path: '/' },
    { id: 'search', icon: Search, label: 'Search', path: '/search-new' },
    { id: 'tickets', icon: Ticket, label: 'Tickets', path: '/tickets-new', authRequired: true },
    { id: 'messages', icon: MessageCircle, label: 'Messages', path: '/messages-new', authRequired: true },
    { id: 'profile', icon: User, label: 'Profile', path: '/profile-new', authRequired: true },
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
    if (path.includes('/tickets')) return 'tickets';
    if (path.includes('/messages')) return 'messages';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/notifications')) return 'notifications';
    return '';
  };

  const currentScreen = getCurrentScreen();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2 sm:px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path, item.authRequired || false)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all active:scale-95 sm:px-4 ${
                isActive
                  ? 'bg-white/10'
                  : 'hover:bg-white/5'
              }`}
            >
              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${
                isActive ? 'text-[#FF8C00]' : 'text-white/60'
              }`} />
              <span className={`text-[10px] font-medium sm:text-xs ${
                isActive ? 'text-[#FF8C00]' : 'text-white/60'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notification Badge */}
      {user && (
        <button
          onClick={() => navigate('/notifications-new')}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 sm:right-4 sm:h-10 sm:w-10"
        >
          <Bell className={`h-4 w-4 sm:h-5 sm:w-5 ${
            currentScreen === 'notifications' ? 'text-[#FF8C00]' : 'text-white/60'
          }`} />
          {/* Unread indicator - connect to real notification count */}
          <div className="absolute right-0 top-0 h-2 w-2 rounded-full bg-[#FF8C00]" />
        </button>
      )}
    </nav>
  );
}

export default NavigationNewDesign;

