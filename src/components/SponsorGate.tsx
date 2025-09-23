import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorAccounts } from '@/hooks/useSponsorAccounts';
import { SponsorLanding } from '@/pages/SponsorLanding';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface SponsorGateProps {
  children: ReactNode;
}

export function SponsorGate({ children }: SponsorGateProps) {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const { accounts, hasSponsorAccess, loading } = useSponsorAccounts(user?.id);

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Please sign in to access sponsor features.</p>
        </div>
      </div>
    );
  }

  // Not opted-in → show landing (CTA to create brand account)
  if (!hasSponsorAccess) {
    return <SponsorLanding />;
  }

  // Opted-in → render actual sponsor app
  return <>{children}</>;
}