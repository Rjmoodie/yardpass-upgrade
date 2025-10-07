// Simple debug component to check campaign loading issues
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCampaignAnalytics } from '@/hooks/useCampaignAnalytics';
import { addDays } from 'date-fns';

export const CampaignLoadingDebug: React.FC = () => {
  const { user } = useAuth();
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const addLog = (message: string) => {
    console.log(`[CampaignDebug] ${message}`);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);
  const { campaigns, isLoading: campaignsLoading, error: campaignsError } = useCampaigns(selectedOrgId || undefined);
  
  const dateRange = {
    from: addDays(new Date(), -13),
    to: new Date(),
  };
  
  const { 
    isLoading: analyticsLoading, 
    error: analyticsError, 
    totals,
    series 
  } = useCampaignAnalytics({
    orgId: selectedOrgId,
    from: dateRange.from,
    to: dateRange.to,
  });

  useEffect(() => {
    addLog(`User authenticated: ${!!user}`);
    if (user) addLog(`User ID: ${user.id}`);
  }, [user]);

  useEffect(() => {
    addLog(`Organizations loading: ${orgsLoading}`);
    addLog(`Organizations count: ${organizations.length}`);
    organizations.forEach((org, index) => {
      addLog(`Org ${index + 1}: ${org.name} (${org.id})`);
    });
    
    if (organizations.length > 0 && !selectedOrgId) {
      const firstOrgId = organizations[0].id;
      setSelectedOrgId(firstOrgId);
      addLog(`Auto-selecting first org: ${firstOrgId}`);
    }
  }, [organizations, orgsLoading, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      addLog(`Selected org ID: ${selectedOrgId}`);
      addLog(`Campaigns loading: ${campaignsLoading}`);
      addLog(`Campaigns count: ${campaigns.length}`);
      
      if (campaignsError) {
        addLog(`Campaigns error: ${campaignsError.message}`);
      }
      
      campaigns.forEach((campaign, index) => {
        addLog(`Campaign ${index + 1}: ${campaign.name} (${campaign.status})`);
      });
    }
  }, [selectedOrgId, campaigns, campaignsLoading, campaignsError]);

  useEffect(() => {
    if (selectedOrgId) {
      addLog(`Analytics loading: ${analyticsLoading}`);
      addLog(`Analytics error: ${analyticsError?.message || 'None'}`);
      addLog(`Analytics series length: ${series.length}`);
      addLog(`Analytics totals: impressions=${totals.impressions}, clicks=${totals.clicks}`);
    }
  }, [selectedOrgId, analyticsLoading, analyticsError, series, totals]);

  const testRPCFunctions = async () => {
    if (!selectedOrgId) {
      addLog('No org selected for RPC test');
      return;
    }

    addLog('Testing RPC functions...');
    
    // Test campaign analytics RPC
    try {
      const { data, error } = await supabase.rpc("rpc_campaign_analytics_daily", {
        p_org_id: selectedOrgId,
        p_from: "2024-01-01",
        p_to: "2024-12-31",
        p_campaign_ids: null,
      });
      
      if (error) {
        addLog(`Campaign analytics RPC error: ${error.message}`);
      } else {
        addLog(`Campaign analytics RPC success: ${data?.length || 0} records`);
      }
    } catch (err: any) {
      addLog(`Campaign analytics RPC exception: ${err.message}`);
    }

    // Test creative analytics RPC
    try {
      const { data, error } = await supabase.rpc("rpc_creative_analytics_rollup", {
        p_org_id: selectedOrgId,
        p_from: "2024-01-01",
        p_to: "2024-12-31",
        p_campaign_ids: null,
        p_creative_ids: null,
        p_include_series: false,
        p_sort: "impressions",
        p_dir: "desc",
        p_limit: 100,
        p_offset: 0,
      });
      
      if (error) {
        addLog(`Creative analytics RPC error: ${error.message}`);
      } else {
        addLog(`Creative analytics RPC success: ${data?.length || 0} records`);
      }
    } catch (err: any) {
      addLog(`Creative analytics RPC exception: ${err.message}`);
    }
  };

  const clearLog = () => setDebugLog([]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Campaign Loading Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Status Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Status</h3>
              <div className="space-y-1">
                <Badge variant={user ? "default" : "destructive"}>
                  User: {user ? "Authenticated" : "Not Authenticated"}
                </Badge>
                <Badge variant={orgsLoading ? "outline" : "default"}>
                  Orgs: {orgsLoading ? "Loading..." : `${organizations.length} found`}
                </Badge>
                <Badge variant={campaignsLoading ? "outline" : "default"}>
                  Campaigns: {campaignsLoading ? "Loading..." : `${campaigns.length} found`}
                </Badge>
                <Badge variant={analyticsLoading ? "outline" : "default"}>
                  Analytics: {analyticsLoading ? "Loading..." : "Loaded"}
                </Badge>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Errors</h3>
              <div className="space-y-1">
                {campaignsError && (
                  <Badge variant="destructive">Campaigns: {campaignsError.message}</Badge>
                )}
                {analyticsError && (
                  <Badge variant="destructive">Analytics: {analyticsError.message}</Badge>
                )}
                {!campaignsError && !analyticsError && (
                  <Badge variant="secondary">No errors</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Organization Selection */}
          {organizations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Select Organization</h3>
              <div className="flex gap-2 flex-wrap">
                {organizations.map((org) => (
                  <Button
                    key={org.id}
                    size="sm"
                    variant={selectedOrgId === org.id ? "default" : "outline"}
                    onClick={() => setSelectedOrgId(org.id)}
                  >
                    {org.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={testRPCFunctions} variant="outline">
              Test RPC Functions
            </Button>
            <Button onClick={clearLog} variant="outline">
              Clear Log
            </Button>
          </div>

          {/* Debug Log */}
          <div>
            <h3 className="font-semibold mb-2">Debug Log</h3>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md max-h-96 overflow-y-auto">
              {debugLog.length === 0 ? (
                <p className="text-muted-foreground">No debug messages yet...</p>
              ) : (
                <div className="space-y-1">
                  {debugLog.map((log, index) => (
                    <div key={index} className="text-sm font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};
