import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Brain,
  TrendingUp,
  DollarSign,
  Users,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Target
} from 'lucide-react';

interface Insight {
  title: string;
  description: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  category: 'revenue' | 'attendance' | 'engagement' | 'marketing';
}

interface Prediction {
  metric: string;
  current_value: number;
  predicted_value: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  timeframe: string;
}

interface Optimization {
  area: string;
  current_state: string;
  suggested_change: string;
  expected_impact: string;
  ease_of_implementation: 'easy' | 'medium' | 'hard';
}

interface AIInsightsPanelProps {
  analyticsData: any;
  orgId: string;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ analyticsData, orgId }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'predictions' | 'optimizations'>('insights');

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-ai-insights', {
        body: {
          analytics_data: analyticsData,
          action: 'generate_insights'
        }
      });

      if (error) throw error;
      setInsights(data.insights || []);
      toast({ title: "Insights generated successfully" });
    } catch (error) {
      console.error('Error generating insights:', error);
      toast({ 
        title: "Failed to generate insights", 
        description: "Please try again",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePredictions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-ai-insights', {
        body: {
          analytics_data: analyticsData,
          action: 'predict_performance'
        }
      });

      if (error) throw error;
      setPredictions(data.predictions || []);
      toast({ title: "Predictions generated successfully" });
    } catch (error) {
      console.error('Error generating predictions:', error);
      toast({ 
        title: "Failed to generate predictions", 
        description: "Please try again",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const generateOptimizations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-ai-insights', {
        body: {
          analytics_data: analyticsData,
          action: 'optimization_suggestions'
        }
      });

      if (error) throw error;
      setOptimizations(data.optimizations || []);
      toast({ title: "Optimizations generated successfully" });
    } catch (error) {
      console.error('Error generating optimizations:', error);
      toast({ 
        title: "Failed to generate optimizations", 
        description: "Please try again",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'medium': return <Target className="h-4 w-4 text-yellow-500" />;
      case 'low': return <ArrowDown className="h-4 w-4 text-blue-500" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'revenue': return <DollarSign className="h-4 w-4" />;
      case 'attendance': return <Users className="h-4 w-4" />;
      case 'engagement': return <TrendingUp className="h-4 w-4" />;
      case 'marketing': return <Zap className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImplementationColor = (ease: string) => {
    switch (ease) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    if (analyticsData && Object.keys(analyticsData).length > 0) {
      generateInsights();
    }
  }, [analyticsData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Analytics Assistant</CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'insights' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('insights')}
            >
              Insights
            </Button>
            <Button
              variant={activeTab === 'predictions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTab('predictions');
                if (predictions.length === 0) generatePredictions();
              }}
            >
              Predictions
            </Button>
            <Button
              variant={activeTab === 'optimizations' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTab('optimizations');
                if (optimizations.length === 0) generateOptimizations();
              }}
            >
              Optimizations
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {activeTab === 'insights' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Smart Insights</h3>
                <Button
                  onClick={generateInsights}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {insights.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Click "Refresh" to generate AI insights from your analytics data</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Analyzing your data...</p>
                </div>
              )}

              {insights.map((insight, index) => (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(insight.category)}
                        <h4 className="font-semibold">{insight.title}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getImpactIcon(insight.impact)}
                        <Badge variant="outline" className="capitalize">
                          {insight.impact} impact
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                    <div className="bg-blue-50 p-3 rounded-md">
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">Recommendation</p>
                          <p className="text-sm text-blue-700">{insight.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Performance Predictions</h3>
                <Button
                  onClick={generatePredictions}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {predictions.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No predictions generated yet</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Generating predictions...</p>
                </div>
              )}

              {predictions.map((prediction, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{prediction.metric}</h4>
                      <Badge className={getConfidenceColor(prediction.confidence)}>
                        {prediction.confidence} confidence
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Current</p>
                        <p className="text-lg font-semibold">{prediction.current_value.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Predicted ({prediction.timeframe})</p>
                        <p className="text-lg font-semibold text-primary">{prediction.predicted_value.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{prediction.reasoning}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'optimizations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Optimization Opportunities</h3>
                <Button
                  onClick={generateOptimizations}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {optimizations.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No optimizations generated yet</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Finding optimization opportunities...</p>
                </div>
              )}

              {optimizations.map((optimization, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold capitalize">{optimization.area}</h4>
                      <Badge className={getImplementationColor(optimization.ease_of_implementation)}>
                        {optimization.ease_of_implementation} to implement
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Current State</p>
                        <p className="text-sm">{optimization.current_state}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Suggested Change</p>
                        <p className="text-sm">{optimization.suggested_change}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-md">
                        <p className="text-sm font-medium text-green-800">Expected Impact</p>
                        <p className="text-sm text-green-700">{optimization.expected_impact}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};