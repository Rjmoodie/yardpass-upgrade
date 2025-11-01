// useEventSponsors - Hook to fetch sponsors for an event
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EventSponsor {
  id: string;
  sponsor_id: string;
  name: string;
  logo_url: string | null;
  tier: string;
  status: string;
  benefits: Record<string, unknown>;
}

export function useEventSponsors(eventId: string | null) {
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setSponsors([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSponsors() {
      setLoading(true);
      setError(null);

      try {
        // Query active sponsorship orders
        const { data, error } = await supabase
          .from("sponsorship_orders")
          .select(`
            id,
            sponsor_id,
            status,
            sponsors:sponsors!sponsorship_orders_sponsor_id_fkey (
              id,
              name,
              logo_url
            ),
            sponsorship_packages:sponsorship_packages!sponsorship_orders_package_id_fkey (
              tier,
              benefits
            )
          `)
          .eq("event_id", eventId)
          .in("status", ["accepted", "live", "completed"]);

        if (cancelled) return;
        
        if (error) throw error;

        const sponsorData: EventSponsor[] = (data || [])
          .filter(order => order.sponsors && order.sponsorship_packages)
          .map(order => ({
            id: order.id,
            sponsor_id: order.sponsor_id,
            name: order.sponsors.name,
            logo_url: order.sponsors.logo_url,
            tier: order.sponsorship_packages?.tier || "Bronze",
            status: order.status,
            benefits: order.sponsorship_packages?.benefits || {}
          }));

        // Sort by tier priority (Gold > Silver > Bronze)
        const tierOrder: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
        sponsorData.sort((a, b) => 
          (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99)
        );

        setSponsors(sponsorData);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error("Error fetching event sponsors:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSponsors();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { sponsors, loading, error, hasSponsor: sponsors.length > 0 };
}

