import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ProfileViewMode = 'attendee' | 'organizer';

interface ProfileViewContextType {
  activeView: ProfileViewMode;
  setActiveView: (view: ProfileViewMode) => void;
}

const ProfileViewContext = createContext<ProfileViewContextType | undefined>(undefined);

const STORAGE_KEY = 'yardpass-profile-view-mode';

export function ProfileViewProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or default to 'attendee'
  const [activeView, setActiveView] = useState<ProfileViewMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === 'attendee' || stored === 'organizer')) {
        return stored as ProfileViewMode;
      }
    }
    return 'attendee';
  });

  // Persist to localStorage whenever activeView changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, activeView);
    }
  }, [activeView]);

  return (
    <ProfileViewContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </ProfileViewContext.Provider>
  );
}

export function useProfileView() {
  const context = useContext(ProfileViewContext);
  if (context === undefined) {
    throw new Error('useProfileView must be used within a ProfileViewProvider');
  }
  return context;
}
