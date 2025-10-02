import { useState, useEffect } from "react";
import { CampaignDashboard } from "@/components/campaigns/CampaignDashboard";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { useOrganizations } from "@/hooks/useOrganizations";
import { Card } from "@/components/ui/card";

const CampaignDashboardPage = () => {
  const { organizations, loading } = useOrganizations();
  
  // Get orgId from URL query parameter first, then fall back to first org
  const params = new URLSearchParams(location.search);
  const urlOrgId = params.get("org");
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(urlOrgId);

  // Update selectedOrgId when organizations load
  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      console.log("[CampaignDashboardPage] Setting org to first available:", organizations[0].id);
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  console.log("[CampaignDashboardPage] State:", {
    loading,
    orgsCount: organizations.length,
    selectedOrgId,
    urlOrgId
  });

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

  if (organizations.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-2">No Organizations</h2>
          <p className="text-muted-foreground">
            You need to be a member of an organization to manage campaigns.
          </p>
        </Card>
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
