import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import { CampaignAnalytics } from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { BarChart3, FileText, Target, TrendingUp } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignAnalytics } from "@/hooks/useCampaignAnalytics";

export const CampaignDashboard = ({ orgId }: { orgId?: string }) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => window.location.hash.replace("#", "") || "campaigns");
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns(orgId);
  const { data: analytics, isLoading: loadingAnalytics } = useCampaignAnalytics(orgId);

  useEffect(() => {
    const onHash = () => setSelectedTab(window.location.hash.replace("#", "") || "campaigns");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (selectedTab) window.location.hash = selectedTab;
  }, [selectedTab]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Campaign Manager</h1>
        <p className="text-muted-foreground">Create and manage your ad campaigns across YardPass</p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns" className="gap-2">
            <Target className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-2">
            <FileText className="h-4 w-4" />
            Creatives
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Create New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignList campaigns={campaigns} loading={loadingCampaigns} />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativeManager />
        </TabsContent>

        <TabsContent value="analytics">
          <CampaignAnalytics
            loading={loadingAnalytics}
            totals={analytics?.totals}
            series={analytics?.series}
          />
        </TabsContent>

        <TabsContent value="create">
          <CampaignCreator orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};