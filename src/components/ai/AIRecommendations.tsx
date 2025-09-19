import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Clock, 
  DollarSign,
  MapPin,
  Calendar,
  RefreshCw,
  Lightbulb,
  Target,
  BarChart3
} from 'lucide-react';

interface AIRecommendationsProps {
  eventData?: {
    title?: string;
    description?: string;
    category?: string;
    startDate?: string;
    location?: {
      city: string;
      country: string;
    };
    ticketTiers?: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
  };
}

interface Recommendation {
  type: 'pricing' | 'timing' | 'marketing' | 'engagement' | 'logistics';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestion?: string;
}

const typeIcons = {
  pricing: <DollarSign className="w-4 h-4" />,
  timing: <Clock className="w-4 h-4" />,
  marketing: <TrendingUp className="w-4 h-4" />,
  engagement: <Users className="w-4 h-4" />,
  logistics: <MapPin className="w-4 h-4" />
};

const typeColors = {
  pricing: 'bg-green-100 text-green-800 border-green-200',
  timing: 'bg-blue-100 text-blue-800 border-blue-200',
  marketing: 'bg-purple-100 text-purple-800 border-purple-200',
  engagement: 'bg-orange-100 text-orange-800 border-orange-200',
  logistics: 'bg-gray-100 text-gray-800 border-gray-200'
};

const impactColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

export function AIRecommendations({ eventData }: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  const generateRecommendations = async () => {
    if (!eventData) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-event-recommendations', {
        body: {
          eventData,
          requestType: 'recommendations'
        }
      });

      if (error) throw error;

      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
      
      if (data.insights) {
        setInsights(data.insights);
      }

      toast({
        title: "AI insights generated",
        description: "Smart recommendations are ready for your event"
      });
    } catch (error: any) {
      console.error('AI recommendations error:', error);
      toast({
        title: "Analysis failed",
        description: error.message || "Could not generate recommendations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate when event data changes
  useEffect(() => {
    if (eventData?.title && eventData?.category) {
      generateRecommendations();
    }
  }, [eventData?.title, eventData?.category, eventData?.startDate]);

  if (!eventData?.title) {
    return (
      <Card className="p-6 text-center">
        <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Add event details to see AI-powered recommendations
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Event Insights
            <Badge variant="secondary" className="text-xs">Powered by AI</Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={generateRecommendations}
            disabled={isLoading}
            className="w-fit"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Lightbulb className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Analyzing...' : 'Refresh Insights'}
          </Button>
        </CardHeader>
        
        {insights && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {insights.predictedAttendance && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-semibold">{insights.predictedAttendance}</div>
                  <div className="text-xs text-muted-foreground">Predicted Attendance</div>
                </div>
              )}
              
              {insights.optimalPrice && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-semibold">${insights.optimalPrice}</div>
                  <div className="text-xs text-muted-foreground">Suggested Price</div>
                </div>
              )}
              
              {insights.engagementScore && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <BarChart3 className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-semibold">{insights.engagementScore}/10</div>
                  <div className="text-xs text-muted-foreground">Engagement Score</div>
                </div>
              )}
              
              {insights.competitionLevel && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-semibold capitalize">{insights.competitionLevel}</div>
                  <div className="text-xs text-muted-foreground">Competition</div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Smart Recommendations ({recommendations.length})
          </h3>
          
          {recommendations.map((rec, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${typeColors[rec.type]}`}>
                  {typeIcons[rec.type]}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{rec.title}</h4>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${impactColors[rec.impact]}`}
                    >
                      {rec.impact} impact
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                  
                  {rec.suggestion && (
                    <div className="p-2 bg-muted/50 rounded text-xs">
                      <strong>Suggestion:</strong> {rec.suggestion}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>AI is analyzing your event...</span>
          </div>
        </div>
      )}
    </div>
  );
}