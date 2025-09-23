import { useState } from "react";
import { Search, Filter, MapPin, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMarketplaceSponsorships } from "@/hooks/useMarketplaceSponsorships";
import { SponsorshipCheckoutModal } from "./SponsorshipCheckoutModal";
import { SponsorshipPackage } from "@/hooks/useMarketplaceSponsorships";

interface SponsorMarketplaceProps {
  sponsorId: string | null;
}

export function SponsorMarketplace({ sponsorId }: SponsorMarketplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [selectedPackage, setSelectedPackage] = useState<SponsorshipPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const filters = {
    search: searchTerm || undefined,
    city: cityFilter || undefined,
    category: categoryFilter || undefined,
    min_price: minPrice ? minPrice * 100 : undefined, // Convert to cents
    max_price: maxPrice ? maxPrice * 100 : undefined, // Convert to cents
  };

  const { data: items = [], isLoading: loading } = useMarketplaceSponsorships(filters);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Discover Sponsorship Opportunities</h2>
          <p className="text-muted-foreground">Browse events looking for sponsors and find the perfect match for your brand.</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Opportunities</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <label className="text-sm font-medium mb-2 block">City</label>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any city</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any category</SelectItem>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sponsorship opportunities found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{item.event_title}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {item.event_start_at ? new Date(item.event_start_at).toLocaleDateString() : 'TBD'}
                  </div>
                  {item.event_city && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {item.event_city}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{item.title}</Badge>
                  <div className="flex items-center gap-1 font-semibold">
                    <DollarSign className="h-4 w-4" />
                    {(item.price_cents / 100).toLocaleString()}
                  </div>
                </div>
                
                {item.event_category && (
                  <Badge variant="outline">{item.event_category}</Badge>
                )}
                
                <div className="text-sm text-muted-foreground">
                  {item.inventory - item.sold} of {item.inventory} spots available
                </div>

                {item.benefits && Array.isArray(item.benefits) && item.benefits.length > 0 && (
                  <div className="text-xs">
                    <div className="font-medium mb-1">Benefits include:</div>
                    <div className="text-muted-foreground">
                      {item.benefits.slice(0, 3).map((benefit, index) => (
                        <div key={index}>• {String(benefit)}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleBuyPackage(item)}
                    disabled={!sponsorId || (item.inventory - item.sold) === 0}
                    className="flex-1"
                  >
                    {(item.inventory - item.sold) === 0 ? 'Sold Out' : 'Buy Now'}
                  </Button>
                  <Button size="sm" variant="outline">
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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