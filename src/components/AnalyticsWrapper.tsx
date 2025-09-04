import React, { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

interface AnalyticsWrapperProps {
  children: React.ReactNode;
}

export const AnalyticsWrapper: React.FC<AnalyticsWrapperProps> = ({ children }) => {
  const { track } = useAnalytics();

  useEffect(() => {
    // Track page views
    const handleRouteChange = () => {
      track('page_view', {
        path: window.location.pathname,
        url: window.location.href,
      });
    };

    // Track initial page load
    handleRouteChange();

    // Listen for route changes (for SPAs)
    window.addEventListener('popstate', handleRouteChange);
    
    // Track clicks on external links
    const handleLinkClick = (event: Event) => {
      const target = event.target as HTMLAnchorElement;
      if (target.tagName === 'A' && target.href && !target.href.startsWith(window.location.origin)) {
        track('external_link_click', {
          url: target.href,
          text: target.textContent,
        });
      }
    };

    document.addEventListener('click', handleLinkClick);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      document.removeEventListener('click', handleLinkClick);
    };
  }, [track]);

  return <>{children}</>;
};