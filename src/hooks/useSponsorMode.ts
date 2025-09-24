import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSponsorMode() {
  const [sponsorModeEnabled, setSponsorModeEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSponsorMode = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('sponsor_mode_enabled')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setSponsorModeEnabled(profile?.sponsor_mode_enabled || false);
      } catch (err) {
        console.error('Error fetching sponsor mode:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch sponsor mode');
      } finally {
        setLoading(false);
      }
    };

    fetchSponsorMode();
  }, []);

  const enableSponsorMode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ sponsor_mode_enabled: true })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      setSponsorModeEnabled(true);
      toast({
        title: 'Sponsor mode enabled',
        description: 'You now have access to sponsor tools and features.',
      });
    } catch (err) {
      console.error('Error enabling sponsor mode:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable sponsor mode';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const disableSponsorMode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ sponsor_mode_enabled: false })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      setSponsorModeEnabled(false);
      toast({
        title: 'Sponsor mode disabled',
        description: 'You no longer have access to sponsor tools.',
      });
    } catch (err) {
      console.error('Error disabling sponsor mode:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable sponsor mode';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return {
    sponsorModeEnabled,
    loading,
    error,
    enableSponsorMode,
    disableSponsorMode,
  };
}