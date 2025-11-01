import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import CampaignAnalytics from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { CreativeEditDialog } from "./CreativeEditDialog";
import { CampaignEditDialog } from "./CampaignEditDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText, Lightbulb, ShieldAlert, Target, TrendingUp, Wallet, Calendar, Clock } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignAnalytics } from "@/hooks/useCampaignAnalytics";
import { useCreativeRollup } from "@/hooks/useCreativeRollup";
import { useCreatives } from "@/hooks/useCreatives";
import { useOrgWallet } from "@/hooks/useOrgWallet";
import { useToast } from "@/hooks/use-toast";
import { addDays, format, differenceInDays } from "date-fns";
import { generateCampaignInsights, PACING_THRESHOLDS, type Insight } from "@/lib/campaignInsights";
import { CampaignCreatorWizard } from "./CampaignCreatorWizard";

export const CampaignDashboard = ({ orgId }: { orgId?: string }) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const hash = window.location.hash.replace("#", "");
    return ["create", "creatives", "campaigns"].includes(hash) ? hash : "create";
  });

  const { toast } = useToast();
  
  // Call all hooks unconditionally (even if orgId is undefined)
  const { campaigns, isLoading: loadingCampaigns, pause, resume, archive, updateCampaign, isUpdating } = useCampaigns(orgId);
  const { wallet, isLoading: walletLoading, isLowBalance, isFrozen } = useOrgWallet(orgId);
  const { creatives, toggleActive, updateCreative, deleteCreative } = useCreatives(orgId);
  
  // State for editing creatives
  const [editingCreativeId, setEditingCreativeId] = useState<string | null>(null);
  
  // State for editing campaigns
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const dateRange = useMemo(() => ({
    from: addDays(new Date(), -13),
    to: new Date(),
  }), []); // Empty deps = only create once on mount
  
  const { totals, series, isLoading: loadingAnalytics, error: analyticsError, totalsByCampaign } = useCampaignAnalytics({
    orgId,
    from: dateRange.from,
    to: dateRange.to,
  });

  // Format dates as YYYY-MM-DD strings for the RPC
  const { data: creativeData, isLoading: loadingCreatives, error: creativesError } = useCreativeRollup({
    orgId: orgId || "",
    from: format(dateRange.from, "yyyy-MM-dd"),
    to: format(dateRange.to, "yyyy-MM-dd"),
    includeSeries: false,
    sort: "impressions",
    limit: 100,
  });

  // All hooks must be called BEFORE any early returns
  const availableCreditsNumber = wallet?.balance_credits ?? 0;
  const creditUsdRate = useMemo(() => {
    if (!wallet) return 1;
    if (wallet.balance_credits > 0) {
      return wallet.usd_equiv / wallet.balance_credits;
    }
    // fall back to current usd_equiv for zero balance orgs
    return wallet.usd_equiv || 1;
  }, [wallet]);

  const CREDIT_BASELINE_CPM = 65; // credits per 1k impressions, mirroring TikTok-style pacing

  const campaignsWithStats = useMemo(() => {
    return campaigns.map((c) => {
      const stats = totalsByCampaign?.find((t) => t.campaign_id === c.id);
      const remainingCredits = Math.max(0, (c.total_budget_credits ?? 0) - (c.spent_credits ?? 0));
      const conversions = stats?.conversions ?? 0;
      const endDate = c.end_date?.slice(0, 10) ?? undefined;
      
      // Check expiration status
      const now = new Date();
      const hasExpired = endDate && new Date(endDate) < now;
      const daysUntilExpiry = endDate ? differenceInDays(new Date(endDate), now) : null;
      const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
      
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        budget: c.total_budget_credits,
        spent: c.spent_credits,
        impressions: stats?.impressions ?? 0,
        clicks: stats?.clicks ?? 0,
        conversions,
        // ✅ FIX: Revenue should be 0 if there are no conversions
        revenue: conversions > 0 ? (stats?.revenue_cents ?? 0) : 0,
        startDate: c.start_date.slice(0, 10),
        endDate,
        remainingCredits,
        deliveryStatus: c.delivery_status,
        pacingHealth: c.pacing_health,
        credits7d: c.credits_last_7d ?? 0,
        impressions7d: c.impressions_last_7d ?? 0,
        clicks7d: c.clicks_last_7d ?? 0,
        activeCreatives: c.active_creatives,
        hasExpired,
        isExpiringSoon,
        daysUntilExpiry,
      };
    });
  }, [campaigns, totalsByCampaign]);

  const resumeDisabledReasons = useMemo(() => {
    return campaignsWithStats.reduce<Record<string, string>>((acc, campaign) => {
      if (campaign.status !== "active" && campaign.remainingCredits > availableCreditsNumber) {
        acc[campaign.id] = `Reserve ${campaign.remainingCredits.toLocaleString()} credits but only ${availableCreditsNumber.toLocaleString()} are available.`;
      }
      if (!acc[campaign.id] && campaign.status !== "active" && (campaign.activeCreatives ?? 0) === 0) {
        acc[campaign.id] = "Add an active creative before resuming delivery.";
      }
      if (isFrozen) {
        acc[campaign.id] = "Wallet is frozen. Resolve billing to resume.";
      }
      return acc;
    }, {});
  }, [campaignsWithStats, availableCreditsNumber, isFrozen]);

  const insights = useMemo<Insight[]>(
    () =>
      generateCampaignInsights(
        campaignsWithStats,
        {
          availableCredits: availableCreditsNumber,
          isFrozen,
          isLowBalance,
        },
        orgId ?? ""
      ),
    [availableCreditsNumber, campaignsWithStats, isFrozen, isLowBalance, orgId]
  );

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace("#", "") || "campaigns";
      // Only update if different to prevent loop
      setSelectedTab(prev => prev === hash ? prev : hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // Only update hash if it's different from current to prevent loop
    const currentHash = window.location.hash.replace("#", "");
    if (selectedTab && selectedTab !== currentHash) {
      window.location.hash = selectedTab;
    }
  }, [selectedTab]);

  // NOW check if org is required and return early (AFTER all hooks)
  if (!orgId) {
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <Target className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Organization Required</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Campaigns are organization-scoped. Please select or create an organization to manage advertising campaigns.
        </p>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            You need to be part of an organization to create and manage campaigns
          </p>
        </div>
      </Card>
    );
  }

  const handleResume = (id: string) => {
    const campaign = campaignsWithStats.find((c) => c.id === id);
    if (!campaign) return;

    const reason = resumeDisabledReasons[id];
    if (reason) {
      toast({
        title: "Cannot resume campaign",
        description: reason,
        variant: "destructive",
      });
      return;
    }

    resume(id);
  };

  const handleEdit = (id: string) => {
    setEditingCampaignId(id);
  };

  const handleSaveCampaign = async (id: string, updates: any) => {
    try {
      await updateCampaign({ id, updates });
      toast({
        title: "Campaign Updated",
        description: "Your campaign has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleArchive = (id: string) => {
    const campaign = campaignsWithStats.find((c) => c.id === id);
    if (!campaign) return;

    if (window.confirm(`Are you sure you want to archive "${campaign.name}"? This will stop delivery and hide it from the active campaigns list.`)) {
      archive(id);
      toast({
        title: "Campaign Archived",
        description: `"${campaign.name}" has been archived successfully.`,
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Ad Credits
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold">
              {walletLoading ? "—" : availableCreditsNumber.toLocaleString()} credits
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                asChild 
                size="sm" 
                variant="outline"
                className="touch-manipulation min-h-[36px]"
              >
                <a href={`/wallet?org=${orgId ?? ""}`}>Manage credits</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {isFrozen && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Wallet frozen</AlertTitle>
              <AlertDescription>
                Campaign delivery is paused until billing issues are resolved. Update your payment method on the wallet page.
              </AlertDescription>
            </Alert>
          )}
          {isLowBalance && !isFrozen && (
            <Alert>
              <AlertTitle>Low balance</AlertTitle>
              <AlertDescription>
                You have {availableCreditsNumber.toLocaleString()} credits remaining. Top up to avoid pacing slowdowns.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Campaign Expiration Warnings */}
          {campaignsWithStats.filter(c => c.hasExpired && c.status === 'active').length > 0 && (
            <Alert variant="destructive">
              <Calendar className="h-4 w-4" />
              <AlertTitle>Campaigns Expired</AlertTitle>
              <AlertDescription>
                {campaignsWithStats.filter(c => c.hasExpired && c.status === 'active').length} active campaign(s) have expired and stopped serving ads. Edit them to extend the end date.
              </AlertDescription>
            </Alert>
          )}
          
          {campaignsWithStats.filter(c => c.isExpiringSoon && c.status === 'active').length > 0 && (
            <Alert className="border-yellow-500 bg-yellow-500/10">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-600">Campaigns Expiring Soon</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                {campaignsWithStats.filter(c => c.isExpiringSoon && c.status === 'active').length} active campaign(s) will expire within 7 days. Consider extending them to continue serving ads.
              </AlertDescription>
            </Alert>
          )}
          
          {insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Actionable insights
                </CardTitle>
                <CardDescription>Recommendations informed by 7-day delivery performance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {insights.map((insight, idx) => (
                  <div key={`${insight.title}-${idx}`} className="flex flex-col sm:flex-row items-start gap-3">
                    <div className="mt-1">{insight.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium leading-tight">{insight.title}</p>
                      <p className="text-sm text-muted-foreground">{insight.detail}</p>
                    </div>
                    {insight.cta && (
                      <Button 
                        asChild 
                        size="sm" 
                        variant="outline"
                        className="touch-manipulation min-h-[36px] whitespace-nowrap shrink-0 w-full sm:w-auto"
                      >
                        <a href={insight.cta.href}>{insight.cta.label}</a>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Campaign Manager</h1>
        <p className="text-muted-foreground">Create and manage your ad campaigns across YardPass</p>
      </div>

      {/* Error Banner */}
      {(analyticsError || creativesError) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 mb-6 text-sm">
          <p className="font-semibold mb-1">Failed to load campaign data</p>
          <p className="text-muted-foreground">
            {analyticsError ? "Analytics: " + (analyticsError as any)?.message : ""}
            {creativesError ? "Creatives: " + (creativesError as any)?.message : ""}
          </p>
          <p className="text-muted-foreground mt-2">Please check that you have access to this organization.</p>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[480px]">
          <TabsTrigger value="create" className="gap-1 sm:gap-2 text-xs sm:text-sm touch-manipulation">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Create New</span>
            <span className="sm:hidden">New</span>
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-1 sm:gap-2 text-xs sm:text-sm touch-manipulation">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Creatives</span>
            <span className="xs:hidden">Create</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1 sm:gap-2 text-xs sm:text-sm touch-manipulation">
            <Target className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Campaigns</span>
            <span className="xs:hidden">Camp.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <CampaignCreatorWizard
            orgId={orgId}
            availableCredits={wallet?.balance_credits}
            creditUsdRate={creditUsdRate}
            baselineCpm={CREDIT_BASELINE_CPM}
            walletFrozen={isFrozen}
            onSuccess={() => {
              setSelectedTab("campaigns");
              window.location.hash = "campaigns";
            }}
          />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativeManager 
            creatives={(creativeData ?? []).map((cr: any) => ({
              id: cr.creative_id,
              type: cr.media_type,
              headline: cr.headline || "Untitled",
              campaign: cr.campaign_name || "Unknown Campaign",
              active: cr.active,
              impressions: Number(cr.impressions) || 0,
              clicks: Number(cr.clicks) || 0,
              conversions: Number(cr.conversions) || 0,
              revenue: Number(cr.revenue_cents) || 0,
              poster_url: cr.poster_url,
              media_url: cr.media_url,
            }))}
            loading={loadingCreatives}
            organizationId={orgId}
            onEdit={(id) => {
              setEditingCreativeId(id);
            }}
            onToggleActive={async (id, next) => {
              try {
                await toggleActive({ id, next });
                toast({ 
                  title: next ? "Creative activated" : "Creative deactivated",
                  description: `Successfully ${next ? "activated" : "deactivated"} the creative.`
                });
              } catch (error: any) {
                toast({ 
                  title: "Error",
                  description: error.message || "Failed to update creative status",
                  variant: "destructive"
                });
              }
            }}
            onDelete={async (id) => {
              try {
                await deleteCreative(id);
                toast({ 
                  title: "Creative deleted",
                  description: "Successfully deleted the creative."
                });
              } catch (error: any) {
                toast({ 
                  title: "Error",
                  description: error.message || "Failed to delete creative",
                  variant: "destructive"
                });
              }
            }}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">
                <Target className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <TrendingUp className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CampaignList
                campaigns={campaignsWithStats}
                loading={loadingCampaigns || loadingAnalytics}
                onPause={pause}
                onResume={handleResume}
                onEdit={handleEdit}
                onArchive={handleArchive}
                orgId={orgId}
                resumeDisabledReasons={resumeDisabledReasons}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <CampaignAnalytics
                campaigns={campaigns}
                totals={totals}
                series={series}
                isLoading={loadingAnalytics}
                error={analyticsError}
                dateRange={dateRange}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Creative Edit Dialog */}
      <CreativeEditDialog
        isOpen={editingCreativeId !== null}
        onClose={() => setEditingCreativeId(null)}
        creative={editingCreativeId ? creatives.find(c => c.id === editingCreativeId) : null}
        onSave={async (id, updates) => {
          try {
            await updateCreative({ id, updates });
            toast({
              title: "Creative updated",
              description: "Successfully updated the creative."
            });
          } catch (error: any) {
            toast({
              title: "Error",
              description: error.message || "Failed to update creative",
              variant: "destructive"
            });
            throw error;
          }
        }}
      />

      {/* Campaign Edit Dialog */}
      <CampaignEditDialog
        isOpen={editingCampaignId !== null}
        onClose={() => setEditingCampaignId(null)}
        campaign={editingCampaignId ? campaignsWithStats.find(c => c.id === editingCampaignId) : null}
        onSave={handleSaveCampaign}
        isSaving={isUpdating}
      />
    </div>
  );
};