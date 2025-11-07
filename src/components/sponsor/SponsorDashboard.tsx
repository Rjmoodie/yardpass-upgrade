import { useEffect, useState, useCallback } from "react";
import { Search, DollarSign, UploadCloud, Eye, Users, TrendingUp, CreditCard, Building2, Plus, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSponsorAccounts } from "@/hooks/useSponsorAccounts";
import { useNotifications } from "@/hooks/useNotifications";
import { SponsorSwitcher } from "./SponsorSwitcher";
import { SponsorMarketplace } from "./SponsorMarketplace";
import { SponsorDeals } from "./SponsorDeals";
import { SponsorAssets } from "./SponsorAssets";
import { SponsorBilling } from "./SponsorBilling";
import { SponsorAnalytics } from "./SponsorAnalytics";
import { SponsorTeam } from "./SponsorTeam";
import { SponsorCreateDialog } from "./SponsorCreateDialog";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import LoadingSpinner from "@/components/dashboard/LoadingSpinner";
import type { MarketplaceBrowseStats } from "@/types/marketplace";
import { trackMarketplaceBrowse } from "@/utils/analytics";

type SponsorTab = 'discover' | 'deals' | 'assets' | 'billing' | 'analytics' | 'team';

export default function SponsorDashboard() {
  const { user } = useAuthGuard();
  const { accounts, loading: accountsLoading } = useSponsorAccounts(user?.id);
  const { unreadCount } = useNotifications();
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [tab, setTab] = useState<SponsorTab>('discover');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (!sponsorId && accounts.length > 0) {
      setSponsorId(accounts[0].id);
    }
  }, [accounts, sponsorId]);

  // Handle marketplace stats updates from Discover tab
  const handleSponsorMarketplaceStats = useCallback(
    (stats: MarketplaceBrowseStats) => {
      trackMarketplaceBrowse({
        ...stats,
        source: 'sponsor_dashboard',
      });
    },
    []
  );

  // Show loading state while accounts load
  if (accountsLoading) {
    return <LoadingSpinner />;
  }

  // Show onboarding if no sponsor accounts exist
  if (accounts.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Create Your Sponsor Account</CardTitle>
            <CardDescription>
              Get started by creating your first sponsor profile to discover events and manage sponsorships
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Search className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Discover Events</p>
                  <p className="text-muted-foreground text-xs">Browse sponsorship opportunities</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <DollarSign className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Manage Deals</p>
                  <p className="text-muted-foreground text-xs">Track your sponsorships</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Eye className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Track Performance</p>
                  <p className="text-muted-foreground text-xs">Monitor ROI and engagement</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Team Collaboration</p>
                  <p className="text-muted-foreground text-xs">Work with your team</p>
                </div>
              </div>
            </div>

            <Button onClick={() => setShowCreateDialog(true)} className="w-full" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Sponsor Account
            </Button>
          </CardContent>
        </Card>

        {showCreateDialog && (
          <SponsorCreateDialog 
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onCreated={(id) => {
              setSponsorId(id);
              setShowCreateDialog(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Sponsor Dashboard</h1>
            <Badge variant="brand" size="sm" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Beta
            </Badge>
            {unreadCount > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <Badge 
                  variant="danger" 
                  size="sm" 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            Browse events, buy packages, manage assets and track performance.
          </p>
        </div>
        <SponsorSwitcher 
          userId={user?.id}
          accounts={accounts} 
          value={sponsorId} 
          onSelect={setSponsorId}
          className="w-[260px]" 
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as SponsorTab)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1">
          <TabsTrigger value="discover" className="flex-col h-auto py-2">
            <Search className="h-4 w-4 mb-1" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex-col h-auto py-2">
            <DollarSign className="h-4 w-4 mb-1" />
            My Deals
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex-col h-auto py-2">
            <UploadCloud className="h-4 w-4 mb-1" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex-col h-auto py-2">
            <CreditCard className="h-4 w-4 mb-1" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-col h-auto py-2">
            <Eye className="h-4 w-4 mb-1" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-col h-auto py-2">
            <Users className="h-4 w-4 mb-1" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover">
          {sponsorId ? (
            <SponsorMarketplace 
              sponsorId={sponsorId} 
              onStatsChange={handleSponsorMarketplaceStats}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Select a sponsor account to browse opportunities</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="deals">
          {sponsorId ? (
            <SponsorDeals sponsorId={sponsorId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Select a sponsor account to view your deals</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="assets">
          {sponsorId ? (
            <SponsorAssets sponsorId={sponsorId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Select a sponsor account to manage assets</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="billing">
          {sponsorId ? (
            <SponsorBilling sponsorId={sponsorId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Select a sponsor account to view billing</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="analytics">
          {sponsorId ? (
            <SponsorAnalytics sponsorId={sponsorId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Select a sponsor account to view analytics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="team">
          {sponsorId ? (
            <SponsorTeam sponsorId={sponsorId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Select a sponsor account to manage team</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}