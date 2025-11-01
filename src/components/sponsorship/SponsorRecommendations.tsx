// Sponsor Recommendations Component - Shows recommended sponsorship packages for sponsors
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchScore, MetricBadge, fmtCurrency, fmtInt } from "@/components/ui/Match";
import { Eye, Ticket, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { RecommendedPackage } from "@/types/sponsorship-ai";

interface SponsorRecommendationsProps {
  sponsorId: string;
  limit?: number;
  minScore?: number;
}

export function SponsorRecommendations({ 
  sponsorId,
  limit = 10,
  minScore = 0.5
}: SponsorRecommendationsProps) {
  const [packages, setPackages] = useState<RecommendedPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("v_sponsor_recommended_packages")
        .select("*")
        .eq("sponsor_id", sponsorId)
        .gte("score", minScore)
        .order("score", { ascending: false })
        .limit(limit);

      if (!isMounted) return;
      
      if (error) {
        console.error("Error fetching recommendations:", error);
        setError("Could not load recommendations.");
        setPackages([]);
        toast.error("Failed to load sponsorship recommendations");
      } else {
        setPackages(data || []);
      }
      setLoading(false);
    }

    fetchRecommendations();
    
    return () => {
      isMounted = false;
    };
  }, [sponsorId, limit, minScore]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Recommended Sponsorships</h2>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-40 bg-neutral-100/50" />
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
        <h2 className="text-2xl font-bold">Recommended Sponsorships</h2>
        <div className="text-sm text-neutral-500">
          {packages.length} match{packages.length !== 1 ? 'es' : ''}
        </div>
      </div>
      
      {packages.length === 0 ? (
        <Card variant="outlined">
          <CardContent className="text-center py-12">
            <Star className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-600">No recommendations yet.</p>
            <p className="text-sm text-neutral-500 mt-2">
              Complete your sponsor profile to get personalized matches
            </p>
          </CardContent>
        </Card>
      ) : (
        packages.map((pkg) => (
          <PackageCard 
            key={pkg.package_id} 
            pkg={pkg}
            onViewDetails={() => navigate(`/events/${pkg.event_id}`)}
          />
        ))
      )}
    </div>
  );
}

interface PackageCardProps {
  pkg: RecommendedPackage;
  onViewDetails: () => void;
}

function PackageCard({ pkg, onViewDetails }: PackageCardProps) {
  const budgetFit = pkg.overlap_metrics?.budget_fit ?? 0;
  const audienceMatch = pkg.overlap_metrics?.audience_overlap?.categories ?? 0;
  const engagement = pkg.overlap_metrics?.engagement_quality ?? 0;

  return (
    <Card variant="elevated" className="hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl">{pkg.title}</CardTitle>
            <p className="text-sm text-neutral-600 mt-1">{pkg.tier} Tier</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{fmtCurrency(pkg.price_cents)}</p>
            <MatchScore score={pkg.score} className="mt-1" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Match Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <MetricBadge label="Budget Fit" value={budgetFit} />
          <MetricBadge label="Audience Match" value={audienceMatch} />
          <MetricBadge label="Engagement" value={engagement} />
        </div>

        {/* Event Stats */}
        <div className="flex gap-6 text-sm text-neutral-600 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>{fmtInt(pkg.total_views)} views</span>
          </div>
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            <span>{fmtInt(pkg.tickets_sold)} sold</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span>{fmtInt(pkg.quality_score_100)}/100</span>
          </div>
        </div>

        {/* Actions */}
        <Button 
          onClick={onViewDetails}
          className="w-full"
          size="lg"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

export default SponsorRecommendations;

