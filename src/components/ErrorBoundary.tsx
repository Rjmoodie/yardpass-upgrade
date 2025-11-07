/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a fallback UI.
 * Use this to wrap Suspense boundaries and other components that may error.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys || [];
      const currentKeys = this.props.resetKeys;
      
      if (prevKeys.length !== currentKeys.length || 
          prevKeys.some((key, index) => key !== currentKeys[index])) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Something went wrong</CardTitle>
                <CardDescription>
                  An error occurred while loading this component
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {this.state.error && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Error details:
                </p>
                <p className="text-sm text-destructive font-mono">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <Button onClick={this.reset} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for error boundary with standard loading fallback
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Simple inline error fallback for Suspense boundaries
 */
export function SuspenseErrorFallback({ error, reset }: { error?: Error; reset?: () => void }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-destructive/50 bg-destructive/5 py-10 text-center">
      <div className="space-y-3">
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-destructive mb-1">
            Failed to load component
          </p>
          {error && (
            <p className="text-xs text-muted-foreground">
              {error.message}
            </p>
          )}
        </div>
        {reset && (
          <Button onClick={reset} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
