// Sponsor Badge - Display sponsor branding on events
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  tier: string;
}

interface SponsorBadgeProps {
  eventId: string;
  variant?: "compact" | "full" | "overlay";
  className?: string;
}

export function SponsorBadge({ eventId, variant = "compact", className }: SponsorBadgeProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSponsors() {
      try {
        // Query active sponsorships for this event
        const { data, error } = await supabase
          .from("sponsorship_orders")
          .select("*")
          .eq("event_id", eventId)
          .in("status", ["accepted", "live", "completed"]);

        console.log('[SponsorBadge] Query result for event', eventId, ':', { data, error });

        if (error) {
          console.error("[SponsorBadge] Error fetching sponsors:", error);
          setSponsors([]);
        } else if (!data || data.length === 0) {
          console.log('[SponsorBadge] No sponsors found for this event');
          setSponsors([]);
        } else {
          console.log('[SponsorBadge] Found sponsorships:', data.length);
          
          // Fetch related sponsor and package data
          const sponsorData = await Promise.all(
            data.map(async (order: any) => {
              const [sponsorResult, packageResult] = await Promise.all([
                supabase.from('sponsors').select('id, name, logo_url').eq('id', order.sponsor_id).single(),
                supabase.from('sponsorship_packages').select('tier').eq('id', order.package_id).single()
              ]);
              
              return {
                id: sponsorResult.data?.id || order.sponsor_id,
                name: sponsorResult.data?.name || 'Unknown Sponsor',
                logo_url: sponsorResult.data?.logo_url || null,
                tier: packageResult.data?.tier || 'Bronze'
              };
            })
          );
          
          console.log('[SponsorBadge] Processed sponsor data:', sponsorData);
          setSponsors(sponsorData);
        }
      } catch (err) {
        console.error('[SponsorBadge] Unexpected error:', err);
        setSponsors([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSponsors();
  }, [eventId]);

  if (loading) {
    console.log('[SponsorBadge] Still loading for event:', eventId);
    return null;
  }
  
  if (sponsors.length === 0) {
    console.log('[SponsorBadge] No sponsors to display for event:', eventId);
    return null;
  }
  
  console.log('[SponsorBadge] Rendering badge for event:', eventId, 'variant:', variant, 'sponsors:', sponsors.length);

  // Sort by tier (Gold > Silver > Bronze)
  const tierOrder = { Gold: 0, Silver: 1, Bronze: 2 };
  const sortedSponsors = sponsors.sort((a, b) => 
    (tierOrder[a.tier as keyof typeof tierOrder] || 99) - 
    (tierOrder[b.tier as keyof typeof tierOrder] || 99)
  );

  const primarySponsor = sortedSponsors[0];

  if (variant === "compact") {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/30 to-green-600/30 border border-emerald-400/40 px-2.5 py-1 text-[10px] font-bold text-emerald-200",
        className
      )}>
        {primarySponsor.logo_url ? (
          <img 
            src={primarySponsor.logo_url} 
            alt={primarySponsor.name}
            className="h-3 w-3 rounded-full object-cover"
          />
        ) : (
          <Building2 className="h-3 w-3" />
        )}
        <span>Sponsored by {primarySponsor.name}</span>
      </span>
    );
  }

  if (variant === "overlay") {
    console.log('[SponsorBadge] Rendering overlay badge for:', primarySponsor.name);
    return (
      <div className={cn(
        "absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 z-50",
        className
      )}>
        {primarySponsor.logo_url && (
          <img 
            src={primarySponsor.logo_url} 
            alt={primarySponsor.name}
            className="h-5 w-5 rounded-full object-cover"
          />
        )}
        <span className="text-white text-xs font-medium">
          Sponsored
        </span>
      </div>
    );
  }

  // variant === "full"
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
        Event Sponsors
      </p>
      <div className="flex flex-wrap gap-3">
        {sortedSponsors.map(sponsor => (
          <div 
            key={sponsor.id}
            className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2 border"
          >
            {sponsor.logo_url ? (
              <img 
                src={sponsor.logo_url} 
                alt={sponsor.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-neutral-500" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{sponsor.name}</p>
              <div className="flex items-center gap-1">
                {sponsor.tier === "Gold" && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                <p className="text-xs text-neutral-500">{sponsor.tier}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SponsorBadge;

