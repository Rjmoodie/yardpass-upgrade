// Event Sponsor Matches Component - Shows suggested sponsors for event organizers
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScore, fmtCurrency, fmtDate } from "@/components/ui/Match";
import { Building2, Mail } from "lucide-react";
import { toast } from "sonner";
import type { RecommendedSponsor } from "@/types/sponsorship-ai";

interface EventSponsorMatchesProps {
  eventId: string;
  minScore?: number;
}

export function EventSponsorMatches({ 
  eventId,
  minScore = 0.5
}: EventSponsorMatchesProps) {
  const [sponsors, setSponsors] = useState<RecommendedSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchMatches() {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("v_event_recommended_sponsors")
        .select("*")
        .eq("event_id", eventId)
        .gte("score", minScore)
        .order("score", { ascending: false });

      if (!active) return;
      
      if (error) {
        console.error("Error fetching sponsor matches:", error);
        setError("Could not load sponsor matches.");
        setSponsors([]);
        toast.error("Failed to load sponsor recommendations");
      } else {
        setSponsors(data || []);
      }
      setLoading(false);
    }

    fetchMatches();

    // Real-time subscription for match updates
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
          console.log("Sponsor match updated, refreshing...");
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId, minScore]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Suggested Sponsors</h2>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32 bg-neutral-100/50" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent className="text-center py-8">
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suggested Sponsors</h2>
        <div className="text-sm text-neutral-500">
          {sponsors.length} match{sponsors.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {sponsors.length === 0 ? (
        <Card variant="outlined">
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-600">No sponsor matches yet.</p>
            <p className="text-sm text-neutral-500 mt-2">
              Add event details and audience insights to get recommendations
            </p>
          </CardContent>
        </Card>
      ) : (
        sponsors.map((sponsor) => (
          <SponsorMatchCard 
            key={sponsor.sponsor_id} 
            sponsor={sponsor}
            eventId={eventId}
            onUpdate={() => {
              // Refresh the list
              setSponsors(prev => prev.map(s => 
                s.sponsor_id === sponsor.sponsor_id ? { ...s, contacted_at: new Date().toISOString(), status: 'suggested' } : s
              ));
            }}
          />
        ))
      )}
    </div>
  );
}

interface SponsorMatchCardProps {
  sponsor: RecommendedSponsor;
  eventId: string;
  onUpdate: () => void;
}

function SponsorMatchCard({ sponsor, eventId, onUpdate }: SponsorMatchCardProps) {
  const [contacting, setContacting] = useState(false);

  async function handleContact() {
    setContacting(true);
    
    try {
      const { error } = await supabase
        .from("sponsorship_matches")
        .update({ 
          status: "suggested",
          contacted_at: new Date().toISOString()
        })
        .eq("event_id", eventId)
        .eq("sponsor_id", sponsor.sponsor_id);

      if (error) throw error;

      toast.success(`Contacted ${sponsor.sponsor_name}`);
      onUpdate();
      
      // TODO: Trigger email/notification to sponsor via Edge Function
      // await fetch(`${supabaseUrl}/functions/v1/sponsor-contact-notification`, {
      //   method: 'POST',
      //   body: JSON.stringify({ event_id: eventId, sponsor_id: sponsor.sponsor_id })
      // });
    } catch (err) {
      console.error("Failed to contact sponsor:", err);
      toast.error("Failed to mark as contacted");
    } finally {
      setContacting(false);
    }
  }

  return (
    <Card variant="elevated" className="hover:shadow-lg transition-all duration-200">
      <CardContent className="flex items-center gap-4 p-6">
        {/* Logo */}
        <div className="flex-shrink-0">
          {sponsor.logo_url ? (
            <img 
              src={sponsor.logo_url} 
              alt={sponsor.sponsor_name}
              className="w-20 h-20 rounded-full object-cover border-2 border-neutral-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center">
              <Building2 className="h-10 w-10 text-neutral-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{sponsor.sponsor_name}</h3>
          {sponsor.industry && (
            <p className="text-sm text-neutral-600">{sponsor.industry}</p>
          )}
          {sponsor.annual_budget_cents && (
            <p className="text-xs text-neutral-500 mt-1">
              Annual Budget: {fmtCurrency(sponsor.annual_budget_cents)}
            </p>
          )}
        </div>

        {/* Score & Status */}
        <div className="text-right flex-shrink-0">
          <MatchScore score={sponsor.score} className="text-base mb-2" />
          
          {sponsor.status === 'accepted' && (
            <Badge variant="success" size="sm">Accepted</Badge>
          )}
          {sponsor.status === 'rejected' && (
            <Badge variant="danger" size="sm">Declined</Badge>
          )}
          {sponsor.contacted_at && sponsor.status !== 'accepted' && sponsor.status !== 'rejected' && (
            <p className="text-xs text-neutral-500 mt-2">
              Contacted {fmtDate(sponsor.contacted_at)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          {sponsor.contacted_at ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="opacity-60"
            >
              <Mail className="h-4 w-4 mr-2" />
              Contacted
            </Button>
          ) : (
            <Button
              onClick={handleContact}
              disabled={contacting}
              size="sm"
            >
              {contacting ? (
                "Contacting..."
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default EventSponsorMatches;

