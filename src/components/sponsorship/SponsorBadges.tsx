// Multi-Sponsor Badge - Adaptive display for 1 or many sponsors
"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventSponsor {
  sponsor_id: string;
  sponsor_name: string;
  logo_url: string | null;
  tier: string;
}

export type SponsorBadgeVariant = "auto" | "compact" | "pill";

interface SponsorBadgesProps {
  eventId: string;
  /** auto: adapts based on count; compact: always avatars; pill: always name */
  variant?: SponsorBadgeVariant;
  className?: string;
  /** How many logos to show before +N counter */
  maxVisible?: number;
  /** Optional preloaded sponsors to avoid fetching */
  sponsors?: EventSponsor[];
}

export function SponsorBadges({
  eventId,
  variant = "auto",
  className,
  maxVisible = 4,
  sponsors: sponsorsProp,
}: SponsorBadgesProps) {
  const [sponsors, setSponsors] = useState<EventSponsor[] | null>(sponsorsProp ?? null);
  const [loading, setLoading] = useState(!sponsorsProp);

  useEffect(() => {
    if (sponsorsProp) return; // Already have data

    let active = true;

    async function loadSponsors() {
      try {
        // Query active sponsorships for this event
        const { data, error } = await supabase
          .from("sponsorship_orders")
          .select("sponsor_id, package_id")
          .eq("event_id", eventId)
          .in("status", ["accepted", "live", "completed"]);

        if (!active) return;

        if (error) {
          console.error("[SponsorBadges] Load error:", error);
          setSponsors([]);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setSponsors([]);
          setLoading(false);
          return;
        }

        // Fetch related sponsor and package data
        const sponsorData = await Promise.all(
          data.map(async (order: any) => {
            const [sponsorResult, packageResult] = await Promise.all([
              supabase.from('sponsors').select('id, name, logo_url').eq('id', order.sponsor_id).single(),
              supabase.from('sponsorship_packages').select('tier').eq('id', order.package_id).single()
            ]);
            
            return {
              sponsor_id: sponsorResult.data?.id || order.sponsor_id,
              sponsor_name: sponsorResult.data?.name || 'Unknown Sponsor',
              logo_url: sponsorResult.data?.logo_url || null,
              tier: packageResult.data?.tier || 'Bronze'
            };
          })
        );
        
        // Sort by tier: Gold > Silver > Bronze
        const tierOrder = { Gold: 0, Silver: 1, Bronze: 2 };
        sponsorData.sort(
          (a, b) =>
            (tierOrder[a.tier as keyof typeof tierOrder] || 99) -
            (tierOrder[b.tier as keyof typeof tierOrder] || 99)
        );
        
        setSponsors(sponsorData);
      } catch (err) {
        console.error("[SponsorBadges] Unexpected error:", err);
        setSponsors([]);
      } finally {
        setLoading(false);
      }
    }

    loadSponsors();
    return () => {
      active = false;
    };
  }, [eventId, sponsorsProp]);

  // Don't render while loading or if no sponsors
  if (loading || !sponsors || sponsors.length === 0) return null;

  const count = sponsors.length;
  
  // Auto mode: single sponsor shows pill with name, multiple shows compact avatars
  const displayMode: SponsorBadgeVariant =
    variant === "auto" ? (count === 1 ? "pill" : "compact") : variant;

  // Pill mode: Show full name (best for single sponsor)
  if (displayMode === "pill" && count === 1) {
    const sponsor = sponsors[0];
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/30 to-green-600/30 border border-emerald-400/40 px-2.5 py-1 text-[10px] font-bold text-emerald-200",
          className
        )}
        title={`Sponsored by ${sponsor.sponsor_name}`}
      >
        {sponsor.logo_url && !sponsor.logo_url.includes('placeholder') ? (
          <img
            src={sponsor.logo_url}
            alt={sponsor.sponsor_name}
            className="h-3 w-3 rounded-full object-cover"
            onError={(e) => {
              // Fallback to icon if image fails
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <Building2 className="h-3 w-3" />
        )}
        <span className="truncate max-w-[10rem]">Sponsored by {sponsor.sponsor_name}</span>
      </span>
    );
  }

  // Compact mode: Overlapping avatar circles (best for multiple sponsors)
  const visible = sponsors.slice(0, maxVisible);
  const overflow = Math.max(0, count - visible.length);

  return (
    <div
      className={cn("inline-flex -space-x-2 items-center", className)}
      aria-label={`Sponsored by ${sponsors.map((s) => s.sponsor_name).join(", ")}`}
      title={`Sponsored by ${sponsors.map((s) => s.sponsor_name).join(", ")}`}
    >
      {visible.map((sponsor) => (
        <span
          key={sponsor.sponsor_id}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-black/60 bg-white/90 overflow-hidden hover:ring-emerald-400/60 transition-all"
          title={`${sponsor.sponsor_name} (${sponsor.tier})`}
        >
          {sponsor.logo_url && !sponsor.logo_url.includes('placeholder') ? (
            <img
              src={sponsor.logo_url}
              alt={sponsor.sponsor_name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<svg class="h-3 w-3 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>';
              }}
            />
          ) : (
            <Building2 className="h-3 w-3 text-gray-600" />
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-black/60 bg-gradient-to-br from-emerald-500 to-green-600 text-[10px] font-bold text-white"
          title={`+${overflow} more sponsor${overflow > 1 ? "s" : ""}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export default SponsorBadges;

