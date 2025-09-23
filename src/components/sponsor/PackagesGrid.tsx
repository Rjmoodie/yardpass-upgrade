import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SponsorCheckoutButton } from './SponsorCheckoutButton';

interface SponsorshipPackage {
  id: string;
  title: string;
  description?: string;
  price_cents: number;
  inventory: number;
  sold: number;
  currency: string;
  benefits: any;
}

interface PackagesGridProps {
  packages: SponsorshipPackage[];
  sponsorId: string;
  onPackagePurchased?: () => void;
}

export function PackagesGrid({
  packages,
  sponsorId,
  onPackagePurchased
}: PackagesGridProps) {
  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getBenefitsList = (benefits: any) => {
    if (!benefits || typeof benefits !== 'object') return [];
    if (Array.isArray(benefits)) return benefits;
    return Object.values(benefits).filter(Boolean);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {packages.map((pkg) => {
        const soldOut = pkg.sold >= pkg.inventory;
        const benefitsList = getBenefitsList(pkg.benefits);

        return (
          <Card key={pkg.id} className={`relative ${soldOut ? 'opacity-60' : ''}`}>
            {soldOut && (
              <Badge variant="destructive" className="absolute top-4 right-4">
                Sold Out
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-lg">{pkg.title}</CardTitle>
              <div className="text-2xl font-bold text-primary">
                {formatPrice(pkg.price_cents, pkg.currency)}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {pkg.description && (
                <p className="text-sm text-muted-foreground">
                  {pkg.description}
                </p>
              )}

              {benefitsList.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Package Benefits:</h4>
                  <ul className="text-sm space-y-1">
                    {benefitsList.map((benefit, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>{String(benefit)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Available: {pkg.inventory - pkg.sold} of {pkg.inventory}
              </div>

              {soldOut ? (
                <Button variant="outline" disabled className="w-full">
                  Sold Out
                </Button>
              ) : (
                <SponsorCheckoutButton
                  packageId={pkg.id}
                  sponsorId={sponsorId}
                  onSuccess={onPackagePurchased}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}