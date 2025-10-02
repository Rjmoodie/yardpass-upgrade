import { useState } from "react";
import { CampaignDashboard } from "@/components/campaigns/CampaignDashboard";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { useOrganizations } from "@/hooks/useOrganizations";
import { Card } from "@/components/ui/card";

const CampaignDashboardPage = () => {
  const { organizations, loading } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    organizations[0]?.id || null
  );

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-64" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Campaign Manager</h1>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Organization:</label>
          <OrgSwitcher
            organizations={organizations}
            value={selectedOrgId}
            onSelect={setSelectedOrgId}
            className="w-[300px]"
          />
        </div>
      </div>
      <CampaignDashboard orgId={selectedOrgId || undefined} />
    </div>
  );
};

export default CampaignDashboardPage;
