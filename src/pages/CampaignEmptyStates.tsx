import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignList } from '@/components/campaigns/CampaignList';
import { CampaignAnalytics } from '@/components/campaigns/CampaignAnalytics';
import { CreativeManager } from '@/components/campaigns/CreativeManager';

export default function CampaignEmptyStates() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Campaign Empty States Preview</h1>
        <p className="text-muted-foreground">
          These are the improved empty states for the campaign components
        </p>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Campaigns Tab - Empty State</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignList 
              campaigns={[]} 
              loading={false}
              orgId="test-org-id"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics Tab - Empty State</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignAnalytics 
              loading={false}
              totals={{ impressions: 0, clicks: 0, ctr: 0, credits_spent: 0 }}
              series={[]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Creatives Tab - Empty State</CardTitle>
          </CardHeader>
          <CardContent>
            <CreativeManager 
              creatives={[]}
              loading={false}
              onCreate={() => console.log('Create creative')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
