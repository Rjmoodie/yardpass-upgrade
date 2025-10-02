import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import { CampaignAnalytics } from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { BarChart3, FileText, Target, TrendingUp } from "lucide-react";

export const CampaignDashboard = ({ orgId }: { orgId?: string }) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => window.location.hash.replace("#", "") || "campaigns");

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
          <CampaignList orgId={orgId} />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativeManager orgId={orgId} />
        </TabsContent>

        <TabsContent value="analytics">
          <CampaignAnalytics
            loading={false}
            totals={{ impressions: 68600, clicks: 1459, ctr: 0.0213, credits_spent: 3550, trend: { impressions: 0.125, clicks: 0.082, ctr: 0.003 } }}
            series={[
              { date: "2025-09-19", impressions: 1200, clicks: 22, credits_spent: 60 },
              { date: "2025-09-20", impressions: 2100, clicks: 45, credits_spent: 105 },
              // ...map your MV here
            ]}
          />
        </TabsContent>

        <TabsContent value="create">
          <CampaignCreator orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};