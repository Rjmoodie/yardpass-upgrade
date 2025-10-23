// Sponsorship Marketplace - Main marketplace component
// Comprehensive marketplace with filtering, search, and package management

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Star, Users, MapPin, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { sponsorshipClient, formatCurrency, getQualityTierColor } from '@/integrations/supabase/sponsorship-client';
import type { 
  SponsorshipPackageCardComplete, 
  SponsorshipSearchResponse,
  SponsorshipMarketplaceProps 
} from '@/types/sponsorship-complete';

interface FilterState {
  search: string;
  category: string;
  priceRange: [number, number];
  location: string;
  qualityTier: string;
  packageType: string;
  sortBy: 'price' | 'quality' | 'relevance' | 'date';
}

const defaultFilters: FilterState = {
  search: '',
  category: '',
  priceRange: [0, 100000],
  location: '',
  qualityTier: '',
  packageType: '',
  sortBy: 'relevance'
};

export const SponsorshipMarketplace: React.FC<SponsorshipMarketplaceProps> = ({
  filters: initialFilters,
  sortBy: initialSortBy,
  onPackageSelect
}) => {
  const [packages, setPackages] = useState<SponsorshipPackageCardComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters, ...initialFilters });
  const [searchResults, setSearchResults] = useState<SponsorshipSearchResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load packages on component mount and filter changes
  useEffect(() => {
    loadPackages();
  }, [filters, currentPage]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await sponsorshipClient.getPackages(
        {
          category: filters.category || undefined,
          priceRange: filters.priceRange,
          qualityTier: filters.qualityTier || undefined
        },
        { page: currentPage, limit: 12 }
      );

      if (response.success && response.data) {
        setPackages(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        setError(response.error || 'Failed to load packages');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!filters.search.trim()) {
      loadPackages();
      return;
    }

    try {
      setLoading(true);
      const response = await sponsorshipClient.searchSponsorships(
        filters.search,
        {
          category: filters.category || undefined,
          priceRange: filters.priceRange,
          location: filters.location || undefined,
          qualityTier: filters.qualityTier || undefined
        },
        { page: currentPage, limit: 12 }
      );

      if (response.success && response.data) {
        setSearchResults(response.data);
        setPackages(response.data.packages);
        setTotalPages(Math.ceil(response.data.total / 12));
      } else {
        setError(response.error || 'Search failed');
      }
    } catch (err) {
      setError('Search failed');
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSortChange = (sortBy: FilterState['sortBy']) => {
    handleFilterChange('sortBy', sortBy);
  };

  const sortedPackages = useMemo(() => {
    const sorted = [...packages];
    
    switch (filters.sortBy) {
      case 'price':
        return sorted.sort((a, b) => a.price_cents - b.price_cents);
      case 'quality':
        return sorted.sort((a, b) => (b.final_quality_score || 0) - (a.final_quality_score || 0));
      case 'date':
        return sorted.sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
      case 'relevance':
      default:
        return sorted;
    }
  }, [packages, filters.sortBy]);

  const resetFilters = () => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  };

  const PackageCard: React.FC<{ pkg: SponsorshipPackageCardComplete }> = ({ pkg }) => (
    <Card 
      className="h-full cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onPackageSelect?.(pkg.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-2">
              {pkg.title || `${pkg.tier} Package`}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {pkg.event_title}
            </p>
          </div>
          <Badge className={getQualityTierColor(pkg.quality_tier || 'low')}>
            {pkg.quality_tier || 'Low'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(pkg.price_cents)}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {pkg.sold} / {pkg.inventory} sold
            </div>
            <div className="text-xs text-muted-foreground">
              {pkg.inventory - pkg.sold} remaining
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(pkg.start_at).toLocaleDateString()}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{pkg.category || 'General'}</span>
          </div>

          <div className="flex items-center space-x-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{pkg.total_views.toLocaleString()} views</span>
          </div>
        </div>

        {pkg.final_quality_score && (
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">
              Quality Score: {pkg.final_quality_score.toFixed(1)}/100
            </span>
          </div>
        )}

        <div className="pt-2">
          <Button className="w-full" onClick={(e) => {
            e.stopPropagation();
            onPackageSelect?.(pkg.id);
          }}>
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sponsorship Marketplace</h1>
        <p className="text-muted-foreground">
          Discover sponsorship opportunities and connect with events
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events, categories, or keywords..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} className="sm:w-auto">
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:w-auto"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => handleFilterChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      <SelectItem value="tech">Technology</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="music">Music</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Quality Tier</label>
                  <Select
                    value={filters.qualityTier}
                    onValueChange={(value) => handleFilterChange('qualityTier', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Tiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Tiers</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Package Type</label>
                  <Select
                    value={filters.packageType}
                    onValueChange={(value) => handleFilterChange('packageType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Types</SelectItem>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Input
                    placeholder="City, State"
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm font-medium mb-2 block">
                  Price Range: {formatCurrency(filters.priceRange[0])} - {formatCurrency(filters.priceRange[1])}
                </label>
                <Slider
                  value={filters.priceRange}
                  onValueChange={(value) => handleFilterChange('priceRange', value as [number, number])}
                  max={100000}
                  min={0}
                  step={1000}
                  className="w-full"
                />
              </div>

              <div className="flex justify-between items-center mt-4">
                <Button variant="outline" onClick={resetFilters}>
                  Reset Filters
                </Button>
                <div className="text-sm text-muted-foreground">
                  {packages.length} packages found
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sort Options */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Sort by:</span>
          <Select value={filters.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="quality">Quality Score</SelectItem>
              <SelectItem value="date">Event Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-red-600 mb-2">Error loading packages</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadPackages}>Try Again</Button>
          </CardContent>
        </Card>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground mb-4">No packages found</div>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or search terms
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SponsorshipMarketplace;
