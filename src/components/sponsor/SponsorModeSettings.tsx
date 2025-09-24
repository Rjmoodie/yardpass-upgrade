import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Building2, Target, TrendingUp, DollarSign } from 'lucide-react';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { SponsorOptInModal } from '@/components/sponsor/SponsorOptInModal';

export function SponsorModeSettings() {
  const { sponsorModeEnabled, loading, enableSponsorMode, disableSponsorMode } = useSponsorMode();
  const [showOptInModal, setShowOptInModal] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      setShowOptInModal(true);
    } else {
      await disableSponsorMode();
    }
  };

  const features = [
    { icon: Building2, text: 'Sponsor Dashboard Access' },
    { icon: Target, text: 'Event Targeting Tools' },
    { icon: TrendingUp, text: 'Analytics & Insights' },
    { icon: DollarSign, text: 'Sponsorship Packages' }
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Sponsor Mode
                {sponsorModeEnabled && <Badge variant="secondary">Enabled</Badge>}
              </CardTitle>
              <CardDescription>
                Access sponsor tools and features to promote your brand at events
              </CardDescription>
            </div>
            <Switch
              checked={sponsorModeEnabled}
              onCheckedChange={handleToggle}
              disabled={loading}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sponsorModeEnabled ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You have access to all sponsor features. You can manage your sponsorships,
                discover events, and track performance metrics.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <feature.icon className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enable sponsor mode to access sponsorship tools and promote your brand at events.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowOptInModal(true)}
                disabled={loading}
              >
                Learn More About Sponsor Mode
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SponsorOptInModal
        open={showOptInModal}
        onOpenChange={setShowOptInModal}
      />
    </>
  );
}