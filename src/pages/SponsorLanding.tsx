import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Sparkles, CheckCircle, TrendingUp, Target, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SponsorCreateDialog } from '@/components/sponsor/SponsorCreateDialog';

export function SponsorLanding() {
  const [user, setUser] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const handleSponsorCreated = (sponsorId: string) => {
    setShowCreateDialog(false);
    toast({ 
      title: 'Sponsor account created successfully!',
      description: 'You can now browse and purchase sponsorship packages.'
    });
    // Reload to let SponsorGate re-check accounts
    window.location.reload();
  };

  const benefits = [
    {
      icon: Target,
      title: 'Targeted Exposure',
      description: 'Reach engaged audiences at live events in your target markets'
    },
    {
      icon: TrendingUp,
      title: 'Performance Analytics',
      description: 'Track engagement, reach, and ROI for all your sponsorships'
    },
    {
      icon: Shield,
      title: 'Secure Payments',
      description: 'Escrowed payments with organizer verification and dispute protection'
    },
    {
      icon: CheckCircle,
      title: 'Simple Management',
      description: 'Browse packages, purchase placements, and manage campaigns in one place'
    }
  ];

  return (
    <>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Become a Sponsor</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your brand with engaged audiences at live events. 
            Create targeted sponsorship campaigns that drive real results.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {benefits.map((benefit, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-center">Ready to Get Started?</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-6">
              Create your sponsor account to browse available sponsorship packages 
              and start connecting with event organizers.
            </p>
            <Button 
              onClick={() => setShowCreateDialog(true)} 
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Building2 className="mr-2 h-5 w-5" />
              Create Sponsor Account
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Questions? Contact our sponsorship team for guidance on packages and pricing.
          </p>
        </div>
      </div>

      <SponsorCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        userId={user?.id}
        onCreated={handleSponsorCreated}
      />
    </>
  );
}