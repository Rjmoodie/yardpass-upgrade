import { useState, useEffect, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMarketplaceSponsorships } from "@/hooks/useMarketplaceSponsorships";
import { SponsorshipCheckoutModal } from "./SponsorshipCheckoutModal";
import { SponsorshipPackage } from "@/hooks/useMarketplaceSponsorships";
import { PackageGrid, type PackageGridItem } from "@/components/sponsorship/shared/PackageGrid";
import type { MarketplaceBrowseStats } from "@/types/marketplace";

interface SponsorMarketplaceProps {
  sponsorId: string | null;
  onStatsChange?: (stats: MarketplaceBrowseStats) => void;
}

export function SponsorMarketplace({ sponsorId, onStatsChange }: SponsorMarketplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [selectedPackage, setSelectedPackage] = useState<SponsorshipPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const filters = {
    search: searchTerm || undefined,
    city: cityFilter && cityFilter !== 'all' ? cityFilter : undefined,
    category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
    min_price: minPrice ? minPrice * 100 : undefined, // Convert to cents
    max_price: maxPrice ? maxPrice * 100 : undefined, // Convert to cents
  };

  const { data: items = [], isLoading: loading } = useMarketplaceSponsorships(filters);

  // Determine if any filters are applied
  const hasFilters = useMemo(() => {
    return !!(
      (cityFilter && cityFilter !== 'all') || 
      (categoryFilter && categoryFilter !== 'all') || 
      minPrice || 
      maxPrice
    );
  }, [cityFilter, categoryFilter, minPrice, maxPrice]);

  // Notify parent of stats changes
  useEffect(() => {
    if (!onStatsChange) return;

    onStatsChange({
      resultsCount: items.length,
      searchQuery: searchTerm || undefined,
      filtersApplied: hasFilters,
      selectedCategory: categoryFilter || undefined,
      priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : undefined,
      location: cityFilter || undefined,
    });
  }, [items.length, searchTerm, hasFilters, categoryFilter, minPrice, maxPrice, cityFilter, onStatsChange]);

  const handleBuyPackage = (item: SponsorshipPackage) => {
    if (!sponsorId) {
      alert("Please select a sponsor account first");
      return;
    }
    setSelectedPackage(item);
    setShowCheckout(true);
  };

  const categories = ["Conference", "Festival", "Workshop", "Networking", "Sports", "Music", "Tech"];
  const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia"];

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 shrink-0">
              <Filter className="h-4 w-4" />
              Filters
              {hasFilters && (
                <Badge variant="brand" size="sm" className="ml-1">
                  {[cityFilter, categoryFilter, minPrice, maxPrice].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Opportunities</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <label className="text-sm font-medium mb-2 block">City</label>
                <Select value={cityFilter || 'all'} onValueChange={setCityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any city</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={categoryFilter || 'all'} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any category</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Price ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minPrice || ""}
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Price ($)</label>
                  <Input
                    type="number"
                    placeholder="10000"
                    value={maxPrice || ""}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Results */}
      <PackageGrid
        items={items as PackageGridItem[]}
        loading={loading}
        primaryAction={{
          label: 'Buy Now',
          onClick: (item) => handleBuyPackage(item as SponsorshipPackage),
          disabled: (item) => !sponsorId || (item.inventory - item.sold) === 0,
        }}
        secondaryAction={{
          label: 'Preview',
          onClick: (item) => {
            // Track preview interaction
            if (typeof window !== 'undefined' && (window as any).gtag) {
              (window as any).gtag('event', 'package_preview', {
                package_id: item.id,
                event_title: item.event_title,
              });
            }
            // TODO: Implement preview modal
            console.log('Preview package:', item);
          },
          variant: 'outline',
        }}
        emptyMessage="No sponsorship opportunities found"
        emptyDescription="Try adjusting your filters or search terms."
        compactAnalytics={true}
      />

      {/* Checkout Modal */}
      {selectedPackage && (
        <SponsorshipCheckoutModal
          open={showCheckout}
          onOpenChange={setShowCheckout}
          package={selectedPackage}
          sponsorId={sponsorId!}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedPackage(null);
          }}
        />
      )}
    </div>
  );
}