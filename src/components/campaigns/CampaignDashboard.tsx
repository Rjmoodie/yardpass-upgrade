import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import CampaignAnalytics from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText, Target, TrendingUp, Wallet, ShieldAlert } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignAnalytics } from "@/hooks/useCampaignAnalytics";
import { useCreativeRollup } from "@/hooks/useCreativeRollup";
import { useOrgWallet } from "@/hooks/useOrgWallet";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";

export const CampaignDashboard = ({ orgId }: { orgId?: string }) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const hash = window.location.hash.replace("#", "");
    return ["campaigns", "creatives", "analytics", "create"].includes(hash) ? hash : "campaigns";
  });

  const { toast } = useToast();

  // Require org context for campaigns
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
  
  const { campaigns, isLoading: loadingCampaigns, pause, resume, archive } = useCampaigns(orgId);
  const { wallet, isLoading: walletLoading, isLowBalance, isFrozen } = useOrgWallet(orgId);

  const dateRange = {
    from: addDays(new Date(), -13),
    to: new Date(),
  };
  
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
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        budget: c.total_budget_credits,
        spent: c.spent_credits,
        impressions: stats?.impressions ?? 0,
        clicks: stats?.clicks ?? 0,
        conversions: stats?.conversions ?? 0,
        revenue: stats?.revenue_cents ?? 0,
        startDate: c.start_date.slice(0, 10),
        endDate: c.end_date?.slice(0, 10) ?? undefined,
        remainingCredits,
      };
    });
  }, [campaigns, totalsByCampaign]);

  const resumeDisabledReasons = useMemo(() => {
    return campaignsWithStats.reduce<Record<string, string>>((acc, campaign) => {
      if (campaign.status !== "active" && campaign.remainingCredits > availableCreditsNumber) {
        acc[campaign.id] = `Reserve ${campaign.remainingCredits.toLocaleString()} credits but only ${availableCreditsNumber.toLocaleString()} are available.`;
      }
      if (isFrozen) {
        acc[campaign.id] = "Wallet is frozen. Resolve billing to resume.";
      }
      return acc;
    }, {});
  }, [campaignsWithStats, availableCreditsNumber, isFrozen]);

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
              <CardDescription>Credits power delivery similar to TikTok's credit pacing.</CardDescription>
            </div>
            <Badge variant="secondary">1 credit ≈ ${creditUsdRate.toFixed(2)} USD</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold">
              {walletLoading ? "—" : availableCreditsNumber.toLocaleString()} credits
            </div>
            <p className="text-sm text-muted-foreground">
              Estimated reach: ~{Math.max(0, Math.round((availableCreditsNumber / CREDIT_BASELINE_CPM) * 1000)).toLocaleString()} impressions remaining at {CREDIT_BASELINE_CPM} credits/1k.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Button asChild size="sm" variant="outline">
                <a href={`/wallet?org=${orgId ?? ""}`}>Manage credits</a>
              </Button>
              <span>
                Benchmark pacing: {CREDIT_BASELINE_CPM} credits ≈ 1k impressions (mirrors TikTok credit systems).
              </span>
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
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Campaign Manager</h1>
        <p className="text-muted-foreground">Create and manage your ad campaigns across YardPass</p>

        {/* TODO: Campaign Manager UI - Still under review and development */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>🚧 Campaign Manager UI - Still Under Review</strong><br/>
            This interface is currently in development. Features may be limited and data may not reflect production values.
          </p>
        </div>
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
            campaigns={campaignsWithStats}
            loading={loadingCampaigns || loadingAnalytics}
            onPause={pause}
            onResume={handleResume}
            onArchive={archive}
            orgId={orgId}
            resumeDisabledReasons={resumeDisabledReasons}
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
          />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="p-4 text-center text-muted-foreground">
            Select a campaign from the Campaigns tab to view analytics
          </div>
        </TabsContent>

        <TabsContent value="create">
          <CampaignCreator
            orgId={orgId}
            availableCredits={wallet?.balance_credits}
            creditUsdRate={creditUsdRate}
            baselineCpm={CREDIT_BASELINE_CPM}
            walletFrozen={isFrozen}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};