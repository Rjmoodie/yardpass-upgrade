// Analytics Dashboard - Comprehensive sponsorship analytics
// Real-time metrics, performance tracking, and business intelligence

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Target, 
  Calendar,
  Download,
  RefreshCw,
  Eye,
  Filter,
  Download as DownloadIcon,
  Share2,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  MapPin,
  Building2,
  Activity
} from 'lucide-react';
import { sponsorshipClient, formatCurrency, formatDate } from '@/integrations/supabase/sponsorship-client';
import type { 
  SponsorshipAnalytics,
  EventSponsorshipMetrics,
  SponsorshipPackageCardComplete 
} from '@/types/sponsorship-complete';

interface AnalyticsDashboardProps {
  eventId?: string;
  sponsorId?: string;
  dateRange?: { from: string; to: string };
  onExport?: (data: any) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  eventId,
  sponsorId,
  dateRange,
  onExport
}) => {
  const [analytics, setAnalytics] = useState<SponsorshipAnalytics | null>(null);
  const [eventMetrics, setEventMetrics] = useState<EventSponsorshipMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  useEffect(() => {
    // Don't auto-load if feature not deployed
    // loadAnalytics();
    setLoading(false);
  }, [eventId, sponsorId, dateRange, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const response = await sponsorshipClient.getSponsorshipAnalytics(
        eventId,
        sponsorId,
        dateRange
      );
      
      if (response.success && response.data) {
        setAnalytics(response.data);
      } else {
        setError(response.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (analytics) {
      const exportData = {
        analytics,
        eventMetrics,
        timestamp: new Date().toISOString(),
        timeRange
      };
      onExport?.(exportData);
    }
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    change?: number;
    icon: React.ReactNode;
    color?: string;
  }> = ({ title, value, change, icon, color = 'blue' }) => {
    const isPositive = change && change > 0;
    const isNegative = change && change < 0;
    
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              {change !== undefined && (
                <div className={`flex items-center mt-1 ${
                  isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : isNegative ? (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  ) : (
                    <Activity className="h-4 w-4 mr-1" />
                  )}
                  <span className="text-sm">
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className={`p-3 rounded-full bg-${color}-100`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const PerformanceChart: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No performance data available</p>
          </div>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Performance Trends</h4>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{data.length} periods</Badge>
          </div>
        </div>
        
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.period}</span>
                <span className="text-sm text-muted-foreground">{item.value}</span>
              </div>
              <Progress 
                value={(item.value / maxValue) * 100} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CategoryBreakdown: React.FC<{ categories: Array<{ category: string; count: number }> }> = ({ 
    categories 
  }) => {
    if (!categories || categories.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No category data available</p>
        </div>
      );
    }

    const total = categories.reduce((sum, cat) => sum + cat.count, 0);

    return (
      <div className="space-y-3">
        {categories.map((category, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium capitalize">{category.category}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{category.count}</span>
                <Badge variant="outline">
                  {((category.count / total) * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Progress 
              value={(category.count / total) * 100} 
              className="h-2"
            />
          </div>
        ))}
      </div>
    );
  };

  const TopPerformers: React.FC<{ 
    title: string;
    data: Array<{ name: string; value: number; metric: string }>;
    icon: React.ReactNode;
  }> = ({ title, data, icon }) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {icon}
          <p className="mt-2">No {title.toLowerCase()} data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">#{index + 1}</span>
              </div>
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.metric}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatCurrency(item.value)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600 mb-2">Error loading analytics</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadAnalytics}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive sponsorship performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <DownloadIcon className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(analytics.total_revenue_cents)}
          change={12.5}
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          color="green"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${(analytics.conversion_rate * 100).toFixed(1)}%`}
          change={8.2}
          icon={<Target className="h-5 w-5 text-blue-600" />}
          color="blue"
        />
        <MetricCard
          title="Total Matches"
          value={analytics.total_matches}
          change={-2.1}
          icon={<Users className="h-5 w-5 text-purple-600" />}
          color="purple"
        />
        <MetricCard
          title="Avg Deal Size"
          value={formatCurrency(analytics.avg_deal_size_cents)}
          change={15.3}
          icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
          color="orange"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Revenue Trends</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart data={analytics.performance_trends} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Category Breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown categories={analytics.top_categories} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Geographic Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown categories={analytics.top_regions} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Match Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Accepted Matches</span>
                    <Badge variant="outline">{analytics.accepted_matches}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Match Score</span>
                    <Badge variant="outline">{(analytics.avg_match_score * 100).toFixed(1)}%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conversion Rate</span>
                    <Badge variant="outline">{(analytics.conversion_rate * 100).toFixed(1)}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {formatCurrency(analytics.total_revenue_cents)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {(analytics.conversion_rate * 100).toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analytics.total_matches}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Matches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart data={analytics.performance_trends} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown categories={analytics.top_categories} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Regions</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown categories={analytics.top_regions} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sponsors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Sponsors</CardTitle>
            </CardHeader>
            <CardContent>
              <TopPerformers
                title="Top Sponsors"
                data={[]} // This would be populated from actual data
                icon={<Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;
