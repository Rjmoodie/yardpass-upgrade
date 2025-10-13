// Bundle optimization and code splitting utilities
import { lazy, Suspense, Component, ReactNode } from 'react';
import { YardpassSpinner } from '@/components/LoadingSpinner';

/**
 * Enhanced lazy loading with retry mechanism
 */
export function lazyWithRetry(
  importFunc: () => Promise<{ default: React.ComponentType<any> }>,
  maxRetries = 3
) {
  return lazy(async () => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await importFunc();
      } catch (error) {
        lastError = error as Error;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    
    throw lastError;
  });
}

/**
 * Optimized Suspense wrapper with error boundary
 */
interface OptimizedSuspenseProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

export class OptimizedSuspense extends Component<OptimizedSuspenseProps, { hasError: boolean }> {
  constructor(props: OptimizedSuspenseProps) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">
            Failed to load component. Please refresh the page.
          </div>
        </div>
      );
    }
    
    return (
      <Suspense 
        fallback={
          this.props.fallback || (
            <div className="flex items-center justify-center p-4">
              <YardpassSpinner size="sm" />
            </div>
          )
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}

/**
 * Code splitting boundaries for different app sections
 */
export const AppSections = {
  // Core feed components
  Feed: lazyWithRetry(() => import('../pages/Index')),
  EventCard: lazyWithRetry(() => import('../components/EventCard')),
  UserPostCard: lazyWithRetry(() => import('../components/UserPostCard')),
  
  // Dashboard and management
  Dashboard: lazyWithRetry(() => import('../components/OrganizerDashboard')),
  EventManagement: lazyWithRetry(() => import('../components/EventManagement')),
  Analytics: lazyWithRetry(() => import('../components/AnalyticsHub')),
  
  // User flows
  Auth: lazyWithRetry(() => import('../pages/AuthPage')),
  Profile: lazyWithRetry(() => import('../components/UserProfile')),
  CreateEvent: lazyWithRetry(() => import('../components/CreateEventFlow')),
  
  // Secondary features
  Scanner: lazyWithRetry(() => import('../components/ScannerPage')),
  Search: lazyWithRetry(() => import('../components/SearchPage')),
  Tickets: lazyWithRetry(() => import('../components/TicketsPage')),
};