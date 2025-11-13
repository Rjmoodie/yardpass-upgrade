// Mobile layout - Bottom navigation with safe-area support
import React from 'react';
import Navigation from '@/components/NavigationNewDesign';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="min-h-dvh bg-background no-page-bounce flex flex-col">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto scroll-area pb-nav">
        {children}
      </main>

      {/* Bottom Navigation */}
      <Navigation />
    </div>
  );
}

export default MobileLayout;

