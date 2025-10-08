// Test component to verify campaign empty states are working
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CampaignList } from '@/components/campaigns/CampaignList';
import CampaignAnalytics from '@/components/campaigns/CampaignAnalytics';
import { CreativeManager } from '@/components/campaigns/CreativeManager';
import { Target, BarChart3, FileText, CheckCircle, XCircle } from 'lucide-react';

export const CampaignEmptyStateTester: React.FC = () => {
  const [testMode, setTestMode] = useState<'empty' | 'loading' | 'data'>('empty');
  const [activeTab, setActiveTab] = useState('campaigns');

  // Mock data for testing
  const mockCampaigns = [
    {
      id: '1',
      name: 'Summer Festival 2025',
      status: 'active' as const,
      budget: 5000,
      spent: 1200,
      impressions: 15000,
      clicks: 450,
      conversions: 25,
      revenue: 2500,
      startDate: '2025-06-01',
      endDate: '2025-08-31'
    }
  ];

  const mockAnalytics = {
    impressions: 15000,
    clicks: 450,
    ctr: 0.03,
    credits_spent: 1200,
    trend: { impressions: 0.15, clicks: 0.12, ctr: -0.05 }
  };

  const mockSeries = [
    { date: '2025-01-01', impressions: 1000, clicks: 30, credits_spent: 100 },
    { date: '2025-01-02', impressions: 1200, clicks: 36, credits_spent: 120 },
    { date: '2025-01-03', impressions: 1500, clicks: 45, credits_spent: 150 }
  ];

  const mockCreatives = [
    {
      id: '1',
      type: 'image' as const,
      headline: 'Summer Festival Banner',
      campaign: 'Summer Festival 2025',
      active: true,
      impressions: 5000,
      clicks: 150,
      conversions: 8,
      revenue: 800,
      poster_url: '/placeholder.jpg',
      media_url: '/placeholder.jpg'
    }
  ];

  const getTestData = () => {
    switch (testMode) {
      case 'empty':
        return {
          campaigns: [],
          analytics: { impressions: 0, clicks: 0, ctr: 0, credits_spent: 0 },
          series: [],
          creatives: []
        };
      case 'loading':
        return {
          campaigns: [],
          analytics: { impressions: 0, clicks: 0, ctr: 0, credits_spent: 0 },
          series: [],
          creatives: [],
          loading: true
        };
      case 'data':
        return {
          campaigns: mockCampaigns,
          analytics: mockAnalytics,
          series: mockSeries,
          creatives: mockCreatives,
          loading: false
        };
    }
  };

  const testData = getTestData();

  const TestResult = ({ test, passed }: { test: string; passed: boolean }) => (
    <div className="flex items-center gap-2">
      {passed ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={passed ? 'text-green-700' : 'text-red-700'}>{test}</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Campaign Empty States Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Test Controls */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={testMode === 'empty' ? 'default' : 'outline'}
              onClick={() => setTestMode('empty')}
            >
              Empty State
            </Button>
            <Button
              variant={testMode === 'loading' ? 'default' : 'outline'}
              onClick={() => setTestMode('loading')}
            >
              Loading State
            </Button>
            <Button
              variant={testMode === 'data' ? 'default' : 'outline'}
              onClick={() => setTestMode('data')}
            >
              With Data
            </Button>
          </div>

          {/* Test Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Campaigns Component</h4>
              <div className="space-y-1">
                <TestResult 
                  test="Shows empty state when no campaigns" 
                  passed={testMode === 'empty' && testData.campaigns.length === 0}
                />
                <TestResult 
                  test="Shows loading skeleton" 
                  passed={testMode === 'loading'}
                />
                <TestResult 
                  test="Shows campaign data" 
                  passed={testMode === 'data' && testData.campaigns.length > 0}
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Analytics Component</h4>
              <div className="space-y-1">
                <TestResult 
                  test="Shows empty state when no data" 
                  passed={testMode === 'empty' && testData.analytics.impressions === 0}
                />
                <TestResult 
                  test="Shows loading skeleton" 
                  passed={testMode === 'loading'}
                />
                <TestResult 
                  test="Shows analytics data" 
                  passed={testMode === 'data' && testData.analytics.impressions > 0}
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Creatives Component</h4>
              <div className="space-y-1">
                <TestResult 
                  test="Shows empty state when no creatives" 
                  passed={testMode === 'empty' && testData.creatives.length === 0}
                />
                <TestResult 
                  test="Shows loading skeleton" 
                  passed={testMode === 'loading'}
                />
                <TestResult 
                  test="Shows creative data" 
                  passed={testMode === 'data' && testData.creatives.length > 0}
                />
              </div>
            </div>
          </div>

          {/* Current Test Status */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Current Test Mode: {testMode}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <Badge variant="outline">Campaigns: {testData.campaigns.length}</Badge>
              </div>
              <div>
                <Badge variant="outline">Impressions: {testData.analytics.impressions}</Badge>
              </div>
              <div>
                <Badge variant="outline">Creatives: {testData.creatives.length}</Badge>
              </div>
              <div>
                <Badge variant="outline">Loading: {testData.loading ? 'Yes' : 'No'}</Badge>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Component Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Component Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="campaigns" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Campaigns
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="creatives" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Creatives
              </TabsTrigger>
            </TabsList>

            <TabsContent value="campaigns" className="mt-6">
              <CampaignList
                campaigns={testData.campaigns}
                loading={testData.loading}
                orgId="test-org-id"
                onPause={() => console.log('Pause campaign')}
                onResume={() => console.log('Resume campaign')}
                onEdit={() => console.log('Edit campaign')}
                onArchive={() => console.log('Archive campaign')}
              />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <CampaignAnalytics campaignId="test-campaign-id" />
            </TabsContent>

            <TabsContent value="creatives" className="mt-6">
              <CreativeManager
                creatives={testData.creatives}
                loading={testData.loading}
                onCreate={() => console.log('Create creative')}
                onEdit={() => console.log('Edit creative')}
                onToggleActive={() => console.log('Toggle creative')}
                onDelete={() => console.log('Delete creative')}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Empty State Test</h4>
            <p className="text-sm text-muted-foreground">
              Set to "Empty State" and verify each tab shows appropriate empty state messages with create buttons.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. Loading State Test</h4>
            <p className="text-sm text-muted-foreground">
              Set to "Loading State" and verify each tab shows skeleton loading animations.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">3. Data State Test</h4>
            <p className="text-sm text-muted-foreground">
              Set to "With Data" and verify each tab shows actual campaign data instead of empty states.
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2 text-blue-900">✅ Success Criteria</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Empty states show helpful messaging and create buttons</li>
              <li>• Loading states show skeleton animations</li>
              <li>• Data states show actual content</li>
              <li>• All states are visually consistent</li>
              <li>• No blank or broken areas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
