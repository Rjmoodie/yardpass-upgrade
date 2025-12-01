/**
 * Example component showing how to use Stripe Connect embedded components
 * with dark mode support.
 * 
 * To use this:
 * 1. Install @stripe/connect-js: npm install @stripe/connect-js
 * 2. Replace this example with your actual implementation
 * 3. Use the useStripeConnectAppearance hook for theme support
 */

import { useEffect, useRef } from 'react';
import { useStripeConnectAppearance } from '@/lib/stripeConnectTheme';
import { useTheme } from 'next-themes';

// Uncomment when you install @stripe/connect-js:
// import { loadConnectAndInitialize } from '@stripe/connect-js';

interface StripeConnectEmbeddedProps {
  fetchClientSecret: () => Promise<string>;
}

export function StripeConnectEmbedded({ fetchClientSecret }: StripeConnectEmbeddedProps) {
  const { appearance, isDarkMode } = useStripeConnectAppearance();
  const { theme, resolvedTheme } = useTheme();
  const connectRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const initializeConnect = async () => {
      try {
        // Uncomment and configure when ready:
        /*
        const stripeConnect = await loadConnectAndInitialize({
          publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
          fetchClientSecret,
          appearance: {
            variables: appearance.variables,
          },
        });

        if (mounted) {
          connectRef.current = stripeConnect;
        }
        */
      } catch (error) {
        console.error('Failed to initialize Stripe Connect:', error);
      }
    };

    initializeConnect();

    return () => {
      mounted = false;
      // Cleanup if needed
    };
  }, [fetchClientSecret, appearance.variables]);

  // Update appearance when theme changes
  useEffect(() => {
    if (connectRef.current) {
      connectRef.current.update({
        appearance: {
          variables: appearance.variables,
        },
      });
    }
  }, [appearance.variables, theme, resolvedTheme]);

  return (
    <div>
      {/* Your Connect embedded component will go here */}
      {/* Example: <ConnectEmbeddedAccountOnboarding /> */}
      <p className="text-muted-foreground text-sm">
        Stripe Connect embedded components will appear here.
        Current theme: {isDarkMode ? 'dark' : 'light'}
      </p>
    </div>
  );
}

