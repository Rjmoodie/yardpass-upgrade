// Sponsorship Marketplace Page - Browse and filter available sponsorship packages
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MatchScore, MetricBadge, fmtCurrency, fmtInt } from "@/components/ui/Match";
import { Eye, Ticket, Star, Search, Filter, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { PackageCard } from "@/types/sponsorship-ai";

type PackageCardRow = PackageCard;

interface MarketplaceFilters {
  minScore: number;
  maxPrice: number | null;
  tier: string | null;
  searchQuery: string;
}

export default function SponsorshipMarketplacePage() {
  const [packages, setPackages] = useState<PackageCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MarketplaceFilters>({
    minScore: 0.5,
    maxPrice: null,
    tier: null,
    searchQuery: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadPackages() {
      setLoading(true);
      
      try {
        let query = supabase
          .from("v_sponsorship_package_cards")
          .select("*")
          .order("quality_score_100", { ascending: false });

        if (filters.maxPrice) {
          query = query.lte("price_cents", filters.maxPrice);
        }
        
        if (filters.tier) {
          query = query.eq("tier", filters.tier);
        }
        
        if (filters.minScore && typeof filters.minScore === 'number') {
          query = query.gte("score", filters.minScore);
        }
        
        if (filters.searchQuery) {
          query = query.ilike("title", `%${filters.searchQuery}%`);
        }

        const { data, error } = await query;
        
        if (cancelled) return;
        
        if (error) throw error;

        setPackages(data || []);
      } catch (err) {
        console.error("Failed to load packages:", err);
        toast.error("Failed to load sponsorship packages");
        setPackages([]);
      } finally {
        setLoading(false);
      }
    }

    loadPackages();
    
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Sponsorship Marketplace</h1>
        <p className="text-neutral-600">
          Discover and invest in sponsorship opportunities that match your brand
        </p>
      </div>

      {/* Search & Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search events..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {showFilters && <span className="ml-2 text-xs">(Active)</span>}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Minimum Match</label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={filters.minScore}
                  onChange={(e) => setFilters({ ...filters, minScore: Number(e.target.value) })}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {Math.round(filters.minScore * 100)}%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Max Price</label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="No limit"
                  value={filters.maxPrice ? filters.maxPrice / 100 : ""}
                  onChange={(e) => 
                    setFilters({ 
                      ...filters, 
                      maxPrice: e.target.value ? Number(e.target.value) * 100 : null 
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tier</label>
                <Select
                  value={filters.tier || "all"}
                  onValueChange={(value) => 
                    setFilters({ ...filters, tier: value === "all" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Tier</SelectItem>
                    <SelectItem value="Gold">Gold</SelectItem>
                    <SelectItem value="Silver">Silver</SelectItem>
                    <SelectItem value="Bronze">Bronze</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-64 bg-neutral-100/50" />
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && packages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <MarketplacePackageCard 
              key={pkg.package_id} 
              pkg={pkg}
              onViewDetails={() => navigate(`/events/${pkg.event_id}`)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && packages.length === 0 && (
        <Card variant="outlined">
          <CardContent className="text-center py-16">
            <Filter className="h-16 w-16 mx-auto text-neutral-300 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No packages found</h3>
            <p className="text-neutral-600">Try adjusting your filters to see more results</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MarketplacePackageCardProps {
  pkg: PackageCardRow;
  onViewDetails: () => void;
}

function MarketplacePackageCard({ pkg, onViewDetails }: MarketplacePackageCardProps) {
  const budgetFit = pkg.overlap_metrics?.budget_fit ?? 0;
  const audienceMatch = pkg.overlap_metrics?.audience_overlap?.categories ?? 0;
  const engagement = pkg.overlap_metrics?.engagement_quality ?? 0;

  return (
    <Card variant="elevated" className="hover:shadow-xl transition-all duration-200 flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-2">{pkg.title}</CardTitle>
          </div>
          {pkg.tier && (
            <Badge variant="brand" size="sm" className="ml-2 flex-shrink-0">
              {pkg.tier}
            </Badge>
          )}
        </div>
        <div className="flex justify-between items-end">
          <p className="text-2xl font-bold">{fmtCurrency(pkg.price_cents)}</p>
          {typeof pkg.score === "number" && <MatchScore score={pkg.score} />}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MetricBadge label="Budget" value={budgetFit} />
          <MetricBadge label="Audience" value={audienceMatch} />
          <MetricBadge label="Engagement" value={engagement} />
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-neutral-600 mb-4 pb-4 border-b">
          {typeof pkg.total_views === "number" && (
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span>{fmtInt(pkg.total_views)}</span>
            </div>
          )}
          {typeof pkg.tickets_sold === "number" && (
            <div className="flex items-center gap-1">
              <Ticket className="h-3.5 w-3.5" />
              <span>{fmtInt(pkg.tickets_sold)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            <span>{fmtInt(pkg.quality_score_100)}/100</span>
          </div>
        </div>

        {/* Action */}
        <Button 
          onClick={onViewDetails}
          className="w-full mt-auto"
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

