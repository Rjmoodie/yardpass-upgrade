import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import { CampaignAnalytics } from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { BarChart3, FileText, Target, TrendingUp } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignAnalytics } from "@/hooks/useCampaignAnalytics";
import { addDays } from "date-fns";

export const CampaignDashboard = ({ orgId }: { orgId?: string }) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => window.location.hash.replace("#", "") || "campaigns");
  const { campaigns, isLoading: loadingCampaigns, pause, resume, archive } = useCampaigns(orgId);
  const { totals, series, isLoading: loadingAnalytics } = useCampaignAnalytics({
    orgId,
    from: addDays(new Date(), -13),
    to: new Date(),
  });

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
          <CampaignList 
            campaigns={campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              budget: c.total_budget_credits,
              spent: c.spent_credits,
              impressions: 0,
              clicks: 0,
              startDate: c.start_date.slice(0, 10),
              endDate: c.end_date?.slice(0, 10),
            }))}
            loading={loadingCampaigns}
            onPause={pause}
            onResume={resume}
            onArchive={archive}
            orgId={orgId}
          />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativeManager />
        </TabsContent>

        <TabsContent value="analytics">
          <CampaignAnalytics
            loading={loadingAnalytics}
            totals={totals}
            series={series}
          />
        </TabsContent>

        <TabsContent value="create">
          <CampaignCreator orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};