// Debug component for Campaign Components and Organization User Flow
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useCampaigns } from '@/hooks/useCampaigns';

interface DebugInfo {
  user: any;
  organizations: any[];
  selectedOrgId: string | null;
  campaigns: any[];
  orgMemberships: any[];
  errors: string[];
  warnings: string[];
}

export const CampaignFlowDebugger: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    user: null,
    organizations: [],
    selectedOrgId: null,
    campaigns: [],
    orgMemberships: [],
    errors: [],
    warnings: []
  });

  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { campaigns, isLoading: campaignsLoading } = useCampaigns(selectedOrgId || undefined);

  useEffect(() => {
    const gatherDebugInfo = async () => {
      const errors: string[] = [];
      const warnings: string[] = [];

      try {
        // Check user authentication
        if (!user) {
          errors.push('User not authenticated');
        }

        // Check organizations
        if (orgsLoading) {
          warnings.push('Organizations are still loading');
        }

        if (organizations.length === 0 && !orgsLoading) {
          warnings.push('User has no organizations');
        }

        // Check organization memberships
        let orgMemberships: any[] = [];
        if (user) {
          const { data: memberships, error: membershipError } = await supabase
            .from('organizations.org_memberships')
            .select(`
              role,
              organizations!fk_org_memberships_org_id (
                id,
                name,
                handle,
                logo_url
              )
            `)
            .eq('user_id', user.id)
            .in('role', ['owner', 'admin', 'editor']);

          if (membershipError) {
            errors.push(`Failed to load org memberships: ${membershipError.message}`);
          } else {
            orgMemberships = memberships || [];
          }
        }

        // Check campaigns for selected org
        if (selectedOrgId) {
          if (campaignsLoading) {
            warnings.push('Campaigns are still loading');
          }

          if (campaigns.length === 0 && !campaignsLoading) {
            warnings.push('Selected organization has no campaigns');
          }
        }

        // Check localStorage for last org
        const lastOrgId = localStorage.getItem('organizer.lastOrgId');
        if (lastOrgId && !organizations.some(org => org.id === lastOrgId)) {
          warnings.push(`Last org ID in localStorage (${lastOrgId}) not found in user's organizations`);
        }

        setDebugInfo({
          user,
          organizations,
          selectedOrgId,
          campaigns,
          orgMemberships,
          errors,
          warnings
        });

      } catch (error) {
        errors.push(`Debug info gathering failed: ${error}`);
      }
    };

    gatherDebugInfo();
  }, [user, organizations, orgsLoading, selectedOrgId, campaigns, campaignsLoading]);

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    localStorage.setItem('organizer.lastOrgId', orgId);
  };

  const clearLocalStorage = () => {
    localStorage.removeItem('organizer.lastOrgId');
    localStorage.removeItem('yp:lastOrgId');
    setSelectedOrgId(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Campaign Flow Debugger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* User Status */}
          <div>
            <h3 className="font-semibold mb-2">User Status</h3>
            <div className="flex items-center gap-2">
              <Badge variant={user ? "default" : "destructive"}>
                {user ? "Authenticated" : "Not Authenticated"}
              </Badge>
              {user && (
                <span className="text-sm text-muted-foreground">
                  ID: {user.id}
                </span>
              )}
            </div>
          </div>

          {/* Organizations */}
          <div>
            <h3 className="font-semibold mb-2">Organizations</h3>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={organizations.length > 0 ? "default" : "secondary"}>
                {organizations.length} organizations
              </Badge>
              {orgsLoading && <Badge variant="outline">Loading...</Badge>}
            </div>
            
            {organizations.length > 0 && (
              <div className="space-y-2">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="font-medium">{org.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">@{org.id.slice(0, 8)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedOrgId === org.id ? "default" : "outline"}
                      onClick={() => handleSelectOrg(org.id)}
                    >
                      {selectedOrgId === org.id ? "Selected" : "Select"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Organization Memberships */}
          <div>
            <h3 className="font-semibold mb-2">Organization Memberships</h3>
            <Badge variant="outline">
              {debugInfo.orgMemberships.length} memberships
            </Badge>
            
            {debugInfo.orgMemberships.length > 0 && (
              <div className="mt-2 space-y-1">
                {debugInfo.orgMemberships.map((membership, index) => (
                  <div key={index} className="text-sm">
                    <Badge variant="secondary" className="mr-2">{membership.role}</Badge>
                    {membership.organizations?.name || 'Unknown Org'}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaigns */}
          {selectedOrgId && (
            <div>
              <h3 className="font-semibold mb-2">Campaigns</h3>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={campaigns.length > 0 ? "default" : "secondary"}>
                  {campaigns.length} campaigns
                </Badge>
                {campaignsLoading && <Badge variant="outline">Loading...</Badge>}
              </div>
              
              {campaigns.length > 0 && (
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="p-2 border rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{campaign.name}</span>
                        <Badge variant="outline">{campaign.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Budget: {campaign.total_budget_credits} credits
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {debugInfo.errors.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-destructive">Errors</h3>
              <div className="space-y-1">
                {debugInfo.errors.map((error, index) => (
                  <div key={index} className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {debugInfo.warnings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-yellow-600">Warnings</h3>
              <div className="space-y-1">
                {debugInfo.warnings.map((warning, index) => (
                  <div key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={clearLocalStorage} variant="outline">
              Clear localStorage
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Component Flow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Component Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div><strong>1. User Authentication:</strong> useAuth() → user object</div>
            <div><strong>2. Organization Loading:</strong> useOrganizations(user.id) → organizations[]</div>
            <div><strong>3. Organization Selection:</strong> localStorage → selectedOrgId</div>
            <div><strong>4. Campaign Loading:</strong> useCampaigns(orgId) → campaigns[]</div>
            <div><strong>5. Campaign Dashboard:</strong> CampaignDashboard({`{orgId}`})</div>
            <div><strong>6. Campaign Creation:</strong> CampaignCreator({`{orgId}`})</div>
            <div><strong>7. Campaign Management:</strong> CampaignList, pause/resume/archive</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
