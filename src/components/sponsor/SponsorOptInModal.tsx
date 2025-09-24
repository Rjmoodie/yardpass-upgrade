import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Target, TrendingUp, DollarSign, Check } from 'lucide-react';
import { useSponsorMode } from '@/hooks/useSponsorMode';

interface SponsorOptInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SponsorOptInModal({ open, onOpenChange }: SponsorOptInModalProps) {
  const { enableSponsorMode } = useSponsorMode();
  const [isEnabling, setIsEnabling] = useState(false);

  const handleOptIn = async () => {
    setIsEnabling(true);
    try {
      await enableSponsorMode();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to enable sponsor mode:', error);
    } finally {
      setIsEnabling(false);
    }
  };

  const features = [
    {
      icon: Building2,
      title: 'Sponsor Dashboard',
      description: 'Manage your sponsorship campaigns and track performance'
    },
    {
      icon: Target,
      title: 'Event Targeting',
      description: 'Find and sponsor events that align with your brand'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Track ROI and engagement metrics for your sponsorships'
    },
    {
      icon: DollarSign,
      title: 'Flexible Packages',
      description: 'Choose from various sponsorship tiers and packages'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Enable Sponsor Mode</DialogTitle>
          <DialogDescription>
            Unlock powerful sponsorship tools to promote your brand at events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-muted">
                <CardContent className="flex items-start gap-3 pt-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  <Check className="h-5 w-5 text-green-600" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">Important</Badge>
                Sponsor Mode Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• Access to sponsor marketplace and event discovery</p>
              <p>• Ability to create and manage sponsorship campaigns</p>
              <p>• Real-time analytics and performance tracking</p>
              <p>• Direct communication tools with event organizers</p>
              <p>• You can disable sponsor mode at any time in your settings</p>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Not Now
            </Button>
            <Button onClick={handleOptIn} disabled={isEnabling}>
              {isEnabling ? 'Enabling...' : 'Enable Sponsor Mode'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}