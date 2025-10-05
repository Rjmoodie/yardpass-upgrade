// Debug component to identify why campaign tabs are blank
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
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface DebugIssue {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  details?: string;
}

export const CampaignBlankDebugger: React.FC = () => {
  const { user } = useAuth();
  const [debugIssues, setDebugIssues] = useState<DebugIssue[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { organizations, loading: orgsLoading, error: orgsError } = useOrganizations(user?.id);
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

  const addIssue = (type: DebugIssue['type'], message: string, details?: string) => {
    setDebugIssues(prev => [...prev, { type, message, details }]);
  };

  const clearIssues = () => setDebugIssues([]);

  const runDiagnostics = async () => {
    setIsLoading(true);
    clearIssues();
    
    try {
      // 1. Check authentication
      if (!user) {
        addIssue('error', 'User not authenticated', 'You must be logged in to access campaigns');
        return;
      } else {
        addIssue('success', 'User authenticated', `User ID: ${user.id}`);
      }

      // 2. Check organizations
      if (orgsLoading) {
        addIssue('warning', 'Organizations still loading', 'Wait for organizations to load');
      } else if (orgsError) {
        addIssue('error', 'Failed to load organizations', orgsError.message);
      } else if (organizations.length === 0) {
        addIssue('error', 'No organizations found', 'You need to create or join an organization to access campaigns');
      } else {
        addIssue('success', 'Organizations loaded', `${organizations.length} organizations found`);
        
        // Auto-select first org if none selected
        if (!selectedOrgId && organizations.length > 0) {
          setSelectedOrgId(organizations[0].id);
          addIssue('info', 'Auto-selected first organization', organizations[0].name);
        }
      }

      // 3. Check campaigns for selected org
      if (selectedOrgId) {
        if (campaignsLoading) {
          addIssue('warning', 'Campaigns still loading', 'Wait for campaigns to load');
        } else if (campaignsError) {
          addIssue('error', 'Failed to load campaigns', campaignsError.message);
        } else if (campaigns.length === 0) {
          addIssue('info', 'No campaigns found', 'This is expected - you need to create your first campaign');
        } else {
          addIssue('success', 'Campaigns loaded', `${campaigns.length} campaigns found`);
        }
      }

      // 4. Check analytics
      if (selectedOrgId) {
        if (analyticsLoading) {
          addIssue('warning', 'Analytics still loading', 'Wait for analytics to load');
        } else if (analyticsError) {
          addIssue('error', 'Failed to load analytics', analyticsError.message);
        } else {
          const hasData = totals.impressions > 0 || totals.clicks > 0 || totals.credits_spent > 0;
          if (hasData) {
            addIssue('success', 'Analytics data available', `Impressions: ${totals.impressions}, Clicks: ${totals.clicks}`);
          } else {
            addIssue('info', 'No analytics data', 'Analytics will show data once campaigns are created and running');
          }
        }
      }

      // 5. Test RPC functions directly
      if (selectedOrgId) {
        try {
          const { data, error } = await supabase.rpc("rpc_campaign_analytics_daily", {
            p_org_id: selectedOrgId,
            p_from: "2024-01-01",
            p_to: "2024-12-31",
            p_campaign_ids: null,
          });
          
          if (error) {
            addIssue('error', 'Campaign analytics RPC failed', error.message);
          } else {
            addIssue('success', 'Campaign analytics RPC working', `${data?.length || 0} records returned`);
          }
        } catch (err: any) {
          addIssue('error', 'Campaign analytics RPC error', err.message);
        }

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
            addIssue('error', 'Creative analytics RPC failed', error.message);
          } else {
            addIssue('success', 'Creative analytics RPC working', `${data?.length || 0} records returned`);
          }
        } catch (err: any) {
          addIssue('error', 'Creative analytics RPC error', err.message);
        }
      }

      // 6. Check component rendering
      addIssue('info', 'Component rendering check', 'Check browser console for React errors');

    } catch (error: any) {
      addIssue('error', 'Diagnostic failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [user, organizations, selectedOrgId]);

  const getIssueIcon = (type: DebugIssue['type']) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getIssueColor = (type: DebugIssue['type']) => {
    switch (type) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      case 'success': return 'border-green-200 bg-green-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Campaign Blank Tabs Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Current Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Badge variant={user ? "default" : "destructive"}>
                User: {user ? "Authenticated" : "Not Authenticated"}
              </Badge>
            </div>
            <div className="text-center">
              <Badge variant={orgsLoading ? "outline" : "default"}>
                Orgs: {orgsLoading ? "Loading..." : `${organizations.length}`}
              </Badge>
            </div>
            <div className="text-center">
              <Badge variant={campaignsLoading ? "outline" : "default"}>
                Campaigns: {campaignsLoading ? "Loading..." : `${campaigns.length}`}
              </Badge>
            </div>
            <div className="text-center">
              <Badge variant={analyticsLoading ? "outline" : "default"}>
                Analytics: {analyticsLoading ? "Loading..." : "Loaded"}
              </Badge>
            </div>
          </div>

          {/* Organization Selection */}
          {organizations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Select Organization to Debug</h3>
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
            <Button onClick={runDiagnostics} disabled={isLoading}>
              {isLoading ? "Running Diagnostics..." : "Run Diagnostics"}
            </Button>
            <Button onClick={clearIssues} variant="outline">
              Clear Issues
            </Button>
          </div>

          {/* Issues List */}
          <div className="space-y-2">
            <h3 className="font-semibold">Diagnostic Results</h3>
            {debugIssues.length === 0 ? (
              <p className="text-muted-foreground">Click "Run Diagnostics" to start debugging</p>
            ) : (
              <div className="space-y-2">
                {debugIssues.map((issue, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${getIssueColor(issue.type)}`}>
                    <div className="flex items-start gap-2">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <p className="font-medium">{issue.message}</p>
                        {issue.details && (
                          <p className="text-sm text-muted-foreground mt-1">{issue.details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Common Solutions */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2 text-blue-900">Common Solutions</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>No organizations:</strong> Create an organization first</li>
              <li>• <strong>No campaigns:</strong> Use "Create New" tab to create your first campaign</li>
              <li>• <strong>RPC errors:</strong> Check database migrations and permissions</li>
              <li>• <strong>Component errors:</strong> Check browser console for React errors</li>
              <li>• <strong>Loading forever:</strong> Check network requests in browser dev tools</li>
            </ul>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};
