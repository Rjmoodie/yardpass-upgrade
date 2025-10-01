import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import { CampaignAnalytics } from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { BarChart3, FileText, Target, TrendingUp } from "lucide-react";

export const CampaignDashboard = () => {
  const [selectedTab, setSelectedTab] = useState("campaigns");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Campaign Manager</h1>
        <p className="text-muted-foreground">
          Create and manage your ad campaigns across YardPass
        </p>
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
          <CampaignList />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativeManager />
        </TabsContent>

        <TabsContent value="analytics">
          <CampaignAnalytics />
        </TabsContent>

        <TabsContent value="create">
          <CampaignCreator />
        </TabsContent>
      </Tabs>
    </div>
  );
};
