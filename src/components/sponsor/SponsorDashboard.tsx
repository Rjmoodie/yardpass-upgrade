import { useEffect, useState } from "react";
import { Search, DollarSign, UploadCloud, Eye, Users, TrendingUp, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSponsorAccounts } from "@/hooks/useSponsorAccounts";
import { SponsorSwitcher } from "./SponsorSwitcher";
import { SponsorMarketplace } from "./SponsorMarketplace";
import { SponsorDeals } from "./SponsorDeals";
import { SponsorAssets } from "./SponsorAssets";
import { SponsorBilling } from "./SponsorBilling";
import { SponsorAnalytics } from "./SponsorAnalytics";
import { SponsorTeam } from "./SponsorTeam";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function SponsorDashboard() {
  const { user } = useAuthGuard();
  const { accounts } = useSponsorAccounts(user?.id);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [tab, setTab] = useState<'discover' | 'deals' | 'assets' | 'billing' | 'analytics' | 'team'>('discover');

  useEffect(() => {
    if (!sponsorId && accounts.length > 0) {
      setSponsorId(accounts[0].id);
    }
  }, [accounts, sponsorId]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Sponsor Dashboard</h1>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Beta
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Browse events, buy packages, manage assets and track performance.
          </p>
        </div>
        <SponsorSwitcher accounts={accounts} value={sponsorId} onSelect={setSponsorId} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="space-y-6">
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
          <SponsorMarketplace sponsorId={sponsorId} />
        </TabsContent>
        <TabsContent value="deals">
          <SponsorDeals sponsorId={sponsorId} />
        </TabsContent>
        <TabsContent value="assets">
          <SponsorAssets sponsorId={sponsorId} />
        </TabsContent>
        <TabsContent value="billing">
          <SponsorBilling sponsorId={sponsorId} />
        </TabsContent>
        <TabsContent value="analytics">
          <SponsorAnalytics sponsorId={sponsorId} />
        </TabsContent>
        <TabsContent value="team">
          <SponsorTeam sponsorId={sponsorId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}