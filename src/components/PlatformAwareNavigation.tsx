// Platform-aware navigation based on your strategic breakdown
// Implements the mobile vs web feature distribution strategy

import React, { useMemo } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import Navigation from './Navigation';

interface PlatformAwareNavigationProps {
  userRole?: 'attendee' | 'organizer' | 'admin';
  currentScreen?: string;
  onNavigate?: (screen: string) => void;
}

export const PlatformAwareNavigation: React.FC<PlatformAwareNavigationProps> = ({
  userRole = 'attendee',
  currentScreen,
  onNavigate
}) => {
  const { isWeb, isMobile, platform } = usePlatform();

  // Define navigation items based on your strategic breakdown
  const getNavigationItems = () => {
    if (isWeb) {
      // Web-only features: Management, analytics, admin
      return [
        { id: 'feed', path: '/', label: 'Feed', show: true },
        { id: 'search', path: '/search', label: 'Search', show: true },
        { id: 'sponsorship', path: '/sponsorship', label: 'Sponsorship', show: true },
        { id: 'analytics', path: '/analytics', label: 'Analytics', show: userRole === 'organizer' },
        { id: 'dashboard', path: '/dashboard', label: 'Dashboard', show: userRole === 'organizer' },
        { id: 'admin', path: '/admin', label: 'Admin', show: userRole === 'admin' },
        { id: 'profile', path: '/profile', label: 'Profile', show: true }
      ];
    } else {
      // Mobile features: Consumer-focused, social, discovery
      return [
        { id: 'feed', path: '/', label: 'Feed', show: true },
        { id: 'search', path: '/search', label: 'Search', show: true },
        { id: 'tickets', path: '/tickets', label: 'Tickets', show: true },
        { id: 'scanner', path: '/scanner', label: 'Scanner', show: true },
        { id: 'social', path: '/social', label: 'Social', show: true },
        { id: 'notifications', path: '/notifications', label: 'Notifications', show: true },
        { id: 'profile', path: '/profile', label: 'Profile', show: true }
      ];
    }
  };

  const navigationItems = useMemo(() => getNavigationItems(), [isWeb, userRole]);

  return (
    <Navigation 
      userRole={userRole}
      currentScreen={currentScreen}
      onNavigate={onNavigate}
      platform={platform}
      items={navigationItems}
    />
  );
};

export default PlatformAwareNavigation;
