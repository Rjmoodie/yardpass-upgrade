// Test Sponsorship Page - Import components one by one to isolate issues
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, DollarSign, TrendingUp, Bell, Settings } from 'lucide-react';

// Import components one by one to test
import SponsorshipMarketplace from '@/components/sponsorship/SponsorshipMarketplace';
// import SponsorProfileManager from '@/components/sponsorship/SponsorProfileManager';
// import MatchAlgorithm from '@/components/sponsorship/MatchAlgorithm';
// import ProposalNegotiation from '@/components/sponsorship/ProposalNegotiation';
// import PaymentEscrowManager from '@/components/sponsorship/PaymentEscrowManager';
// import AnalyticsDashboard from '@/components/sponsorship/AnalyticsDashboard';
// import NotificationSystem from '@/components/sponsorship/NotificationSystem';

interface SponsorshipPageProps {
  userRole?: 'organizer' | 'sponsor' | 'admin';
  eventId?: string;
  sponsorId?: string;
}

export const SponsorshipPageTest: React.FC<SponsorshipPageProps> = ({
  userRole = 'organizer',
  eventId,
  sponsorId
}) => {
  const [activeTab, setActiveTab] = useState('marketplace');

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Sponsorship Platform - Test
        </h1>
        <p className="text-muted-foreground mt-2">
          Testing component imports one by one
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          <SponsorshipMarketplace />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Track sponsorship performance and ROI
              </p>
              <Button>View Analytics</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proposal Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Manage sponsorship proposals and negotiations
              </p>
              <Button>View Proposals</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>User Role:</strong> {userRole}</p>
                {eventId && <p><strong>Event ID:</strong> {eventId}</p>}
                {sponsorId && <p><strong>Sponsor ID:</strong> {sponsorId}</p>}
                <p><strong>Status:</strong> Testing component imports</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SponsorshipPageTest;
