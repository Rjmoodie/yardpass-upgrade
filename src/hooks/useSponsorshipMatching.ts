// useSponsorshipMatching - Hook for sponsor-event AI matching
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  computeMatchScore, 
  triggerRecalculation,
  processMatchQueue,
  getQueueStatus
} from "@/lib/sponsorship";
import type { 
  RecommendedPackage,
  RecommendedSponsor,
  MatchBreakdown
} from "@/types/sponsorship-ai";
import { toast } from "sonner";

/**
 * Hook for fetching recommended packages for a sponsor
 */
export function useSponsorRecommendations(sponsorId: string | null, minScore = 0.5) {
  const [packages, setPackages] = useState<RecommendedPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sponsorId) {
      setPackages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("v_sponsor_recommended_packages")
          .select("*")
          .eq("sponsor_id", sponsorId)
          .gte("score", minScore)
          .order("score", { ascending: false });

        if (cancelled) return;
        if (error) throw error;
        
        setPackages(data || []);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error("Error fetching sponsor recommendations:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [sponsorId, minScore]);

  return { packages, loading, error, refetch: () => {} };
}

/**
 * Hook for fetching recommended sponsors for an event
 */
export function useEventSponsorMatches(eventId: string | null, minScore = 0.5) {
  const [sponsors, setSponsors] = useState<RecommendedSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setSponsors([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("v_event_recommended_sponsors")
          .select("*")
          .eq("event_id", eventId)
          .gte("score", minScore)
          .order("score", { ascending: false });

        if (cancelled) return;
        if (error) throw error;
        
        setSponsors(data || []);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error("Error fetching event sponsor matches:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();

    // Real-time subscription
    const channel = supabase
      .channel(`sponsor_matches_${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sponsorship_matches",
          filter: `event_id=eq.${eventId}`
        },
        () => {
          console.log("Match updated, refreshing...");
          fetch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, minScore]);

  return { sponsors, loading, error };
}

/**
 * Hook for computing live match scores
 */
export function useMatchScore(eventId: string | null, sponsorId: string | null) {
  const [score, setScore] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<MatchBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const calculate = async () => {
    if (!eventId || !sponsorId) {
      toast.error("Event ID and Sponsor ID required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await computeMatchScore(eventId, sponsorId);
      setScore(result.score);
      setBreakdown(result.breakdown as MatchBreakdown);
      toast.success(`Match: ${Math.round(result.score * 100)}%`);
    } catch (err) {
      setError(err as Error);
      toast.error("Failed to compute match");
      console.error("Match calculation error:", err);
    } finally {
      setLoading(false);
    }
  };

  return { score, breakdown, loading, error, calculate };
}

/**
 * Hook for monitoring the recalculation queue
 */
export function useQueueMonitor(refreshInterval = 30000) {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const status = await getQueueStatus();
        setPendingCount(status.pendingCount);
      } catch (err) {
        console.error("Failed to fetch queue status:", err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
    const interval = setInterval(fetch, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { pendingCount, loading };
}

/**
 * Hook for managing sponsor profiles
 */
export function useSponsorProfile(sponsorId: string | null) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sponsorId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("sponsor_profiles")
          .select("*")
          .eq("sponsor_id", sponsorId)
          .single();

        if (cancelled) return;
        if (error) throw error;
        
        setProfile(data);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error("Error fetching sponsor profile:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [sponsorId]);

  const updateProfile = async (updates: Partial<any>) => {
    if (!sponsorId) return;

    try {
      const { error } = await supabase
        .from("sponsor_profiles")
        .update(updates)
        .eq("sponsor_id", sponsorId);

      if (error) throw error;

      // Trigger recalculation
      await triggerRecalculation({ sponsor_id: sponsorId });
      
      toast.success("Profile updated! Recalculating matches...");
      
      // Refresh local state
      setProfile((prev: any) => ({ ...prev, ...updates }));
    } catch (err) {
      toast.error("Failed to update profile");
      throw err;
    }
  };

  return { profile, loading, error, updateProfile };
}

