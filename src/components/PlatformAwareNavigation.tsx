// Platform-aware navigation based on your strategic breakdown
// Implements the mobile vs web feature distribution strategy

import React, { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Search,
  Ticket,
  QrCode,
  Users,
  Bell,
  User,
  Handshake,
  BarChart3,
  LayoutDashboard,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';
import Navigation, { type Screen } from './Navigation';

type PlatformAwareNavigationProps = {
  userRole?: 'attendee' | 'organizer' | 'admin';
  currentScreen?: string;
  onNavigate?: (screen: string) => void;
};

type PlatformNavigationItem = {
  id: Screen;
  path: string;
  label: string;
  icon: LucideIcon;
  show: boolean;
  description?: string;
  badge?: string;
};

export const PlatformAwareNavigation: React.FC<PlatformAwareNavigationProps> = ({
  userRole = 'attendee',
  currentScreen,
  onNavigate
}) => {
  const { isWeb, platform } = usePlatform();
  const isOrganizer = userRole === 'organizer';
  const isAdmin = userRole === 'admin';

  const navigationItems = useMemo<PlatformNavigationItem[]>(() => {
    if (isWeb) {
      return [
        {
          id: 'feed',
          path: '/',
          label: 'Feed',
          icon: Home,
          show: true,
          description: 'Live updates across events'
        },
        {
          id: 'search',
          path: '/search-new',
          label: 'Search',
          icon: Search,
          show: true,
          description: 'Find events, people, and sponsors'
        },
        {
          id: 'sponsorship',
          path: '/sponsorship',
          label: 'Sponsorship',
          icon: Handshake,
          show: true,
          description: 'Marketplace & proposals'
        },
        {
          id: 'analytics',
          path: '/analytics',
          label: 'Analytics',
          icon: BarChart3,
          show: isOrganizer || isAdmin,
          description: 'Deep performance reporting',
          badge: 'Web'
        },
        {
          id: 'dashboard',
          path: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          show: isOrganizer || isAdmin,
          description: 'Manage events & teams'
        },
        {
          id: 'payments',
          path: '/payments',
          label: 'Payments',
          icon: Landmark,
          show: isOrganizer || isAdmin,
          description: 'Disbursements & escrow'
        },
        {
          id: 'admin',
          path: '/admin',
          label: 'Admin',
          icon: ShieldCheck,
          show: isAdmin,
          description: 'Platform controls'
        },
        {
          id: 'profile',
          path: '/profile',
          label: 'Profile',
          icon: User,
          show: true,
          description: 'Account preferences'
        }
      ].filter((item) => item.show);
    }

    // Mobile: ONLY core consumer features (profile, social, tickets, search, feed)
    return [
      {
        id: 'feed',
        path: '/',
        label: 'Feed',
        icon: Home,
        show: true,
        description: 'Curated updates near you'
      },
      {
        id: 'search',
        path: '/search-new',
        label: 'Search',
        icon: Search,
        show: true,
        description: 'Explore events & hosts'
      },
      {
        id: 'tickets',
        path: '/tickets-new',
        label: 'Tickets',
        icon: Ticket,
        show: true,
        description: 'Wallet & purchases'
      },
      {
        id: 'social',
        path: '/social',
        label: 'Social',
        icon: Users,
        show: true,
        description: 'Connect with attendees'
      },
      {
        id: 'profile',
        path: '/profile-new',
        label: 'Profile',
        icon: User,
        show: true,
        description: 'Your preferences'
      }
    ];
  }, [isWeb, isAdmin, isOrganizer]);

  return (
    <Navigation
      userRole={isAdmin ? 'admin' : userRole}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate?.(screen)}
      platform={platform}
      items={navigationItems}
    />
  );
};

export default PlatformAwareNavigation;
