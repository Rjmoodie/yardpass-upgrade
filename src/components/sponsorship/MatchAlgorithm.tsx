// Match Algorithm Frontend - AI-powered event-sponsor matching
// Displays match scores, explanations, and feedback system

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Star, 
  TrendingUp, 
  Users, 
  MapPin, 
  DollarSign, 
  Target, 
  CheckCircle, 
  XCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  BarChart3,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import { sponsorshipClient, formatCurrency, getStatusColor } from '@/integrations/supabase/sponsorship-client';
import type { 
  SponsorshipMatch, 
  SponsorRecommendation, 
  EventRecommendation,
  MatchFeature,
  MatchFeedback,
  UpdateMatchStatusRequest 
} from '@/types/sponsorship-complete';

interface MatchAlgorithmProps {
  eventId?: string;
  sponsorId?: string;
  onMatchSelect?: (matchId: string) => void;
  onMatchAction?: (matchId: string, action: string) => void;
}

export const MatchAlgorithm: React.FC<MatchAlgorithmProps> = ({
  eventId,
  sponsorId,
  onMatchSelect,
  onMatchAction
}) => {
  const [matches, setMatches] = useState<SponsorshipMatch[]>([]);
  const [features, setFeatures] = useState<MatchFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMatch, setSelectedMatch] = useState<SponsorshipMatch | null>(null);

  useEffect(() => {
    loadMatches();
  }, [eventId, sponsorId]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await sponsorshipClient.getMatches(eventId, sponsorId);
      
      if (response.success && response.data) {
        setMatches(response.data);
        if (response.data.length > 0) {
          setSelectedMatch(response.data[0]);
        }
      } else {
        setError(response.error || 'Failed to load matches');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchAction = async (matchId: string, action: string) => {
    try {
      let updates: UpdateMatchStatusRequest;
      
      switch (action) {
        case 'accept':
          updates = { status: 'accepted' };
          break;
        case 'reject':
          updates = { status: 'rejected', declined_reason: 'Not interested' };
          break;
        case 'contact':
          updates = { status: 'suggested' };
          break;
        default:
          return;
      }

      const response = await sponsorshipClient.updateMatchStatus(matchId, updates);
      
      if (response.success) {
        // Reload matches to get updated data
        loadMatches();
        onMatchAction?.(matchId, action);
      } else {
        setError(response.error || 'Failed to update match');
      }
    } catch (err) {
      setError('Failed to update match');
      console.error('Error updating match:', err);
    }
  };

  const submitFeedback = async (matchId: string, label: 'good_fit' | 'bad_fit' | 'later', reasonCodes: string[]) => {
    try {
      // This would be implemented with a feedback API endpoint
      console.log('Submitting feedback:', { matchId, label, reasonCodes });
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  const MatchScoreBreakdown: React.FC<{ match: SponsorshipMatch }> = ({ match }) => {
    const metrics = match.overlap_metrics as any;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Budget Fit</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(metrics.budget_fit * 100)}%
              </span>
            </div>
            <Progress value={metrics.budget_fit * 100} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Audience Overlap</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(metrics.audience_overlap.categories * 100)}%
              </span>
            </div>
            <Progress value={metrics.audience_overlap.categories * 100} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Geographic Fit</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(metrics.geo_fit * 100)}%
              </span>
            </div>
            <Progress value={metrics.geo_fit * 100} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Engagement Quality</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(metrics.engagement_quality * 100)}%
              </span>
            </div>
            <Progress value={metrics.engagement_quality * 100} className="h-2" />
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Detailed Analysis</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Category Alignment</span>
              <Badge variant="outline">
                {Math.round(metrics.audience_overlap.categories * 100)}% match
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Geographic Reach</span>
              <Badge variant="outline">
                {Math.round(metrics.geo_fit * 100)}% coverage
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Objectives Similarity</span>
              <Badge variant="outline">
                {Math.round(metrics.objectives_similarity * 100)}% aligned
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MatchCard: React.FC<{ match: SponsorshipMatch }> = ({ match }) => {
    const isSelected = selectedMatch?.id === match.id;
    const metrics = match.overlap_metrics as any;

    return (
      <Card 
        className={`cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
        }`}
        onClick={() => {
          setSelectedMatch(match);
          onMatchSelect?.(match.id);
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">
                {eventId ? 'Sponsor Match' : 'Event Match'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {match.status === 'suggested' ? 'AI Suggested' : 
                 match.status === 'accepted' ? 'Accepted' :
                 match.status === 'rejected' ? 'Declined' : 'Pending'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {Math.round(match.score * 100)}
              </div>
              <div className="text-xs text-muted-foreground">Match Score</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                Budget: {Math.round(metrics.budget_fit * 100)}% fit
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm">
                Audience: {Math.round(metrics.audience_overlap.categories * 100)}% overlap
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-purple-600" />
              <span className="text-sm">
                Geo: {Math.round(metrics.geo_fit * 100)}% coverage
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span className="text-sm">
                Engagement: {Math.round(metrics.engagement_quality * 100)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Badge className={getStatusColor(match.status)}>
              {match.status}
            </Badge>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMatchAction(match.id, 'contact');
                }}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Contact
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMatchAction(match.id, 'accept');
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Accept
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const FeedbackSection: React.FC<{ match: SponsorshipMatch }> = ({ match }) => {
    const [feedback, setFeedback] = useState<{
      label: 'good_fit' | 'bad_fit' | 'later' | null;
      reasonCodes: string[];
    }>({ label: null, reasonCodes: [] });

    const reasonOptions = [
      'Budget mismatch',
      'Wrong audience',
      'Geographic mismatch',
      'Timing issues',
      'Brand alignment',
      'Competitor conflict',
      'Not ready yet',
      'Other'
    ];

    const handleFeedbackSubmit = () => {
      if (feedback.label && feedback.reasonCodes.length > 0) {
        submitFeedback(match.id, feedback.label, feedback.reasonCodes);
        setFeedback({ label: null, reasonCodes: [] });
      }
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5" />
            <span>Help Us Improve</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Your feedback helps us improve our matching algorithm
            </p>
            
            <div className="flex space-x-2 mb-4">
              <Button
                variant={feedback.label === 'good_fit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedback(prev => ({ ...prev, label: 'good_fit' }))}
              >
                <ThumbsUp className="h-4 w-4 mr-1" />
                Good Fit
              </Button>
              <Button
                variant={feedback.label === 'bad_fit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedback(prev => ({ ...prev, label: 'bad_fit' }))}
              >
                <ThumbsDown className="h-4 w-4 mr-1" />
                Not a Fit
              </Button>
              <Button
                variant={feedback.label === 'later' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedback(prev => ({ ...prev, label: 'later' }))}
              >
                Maybe Later
              </Button>
            </div>

            {feedback.label && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Why? (Select all that apply)</p>
                <div className="grid grid-cols-2 gap-2">
                  {reasonOptions.map((reason) => (
                    <label key={reason} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={feedback.reasonCodes.includes(reason)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...feedback.reasonCodes, reason]
                            : feedback.reasonCodes.filter(r => r !== reason);
                          setFeedback(prev => ({ ...prev, reasonCodes: updated }));
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{reason}</span>
                    </label>
                  ))}
                </div>

                <Button 
                  onClick={handleFeedbackSubmit}
                  disabled={feedback.reasonCodes.length === 0}
                  className="w-full"
                >
                  Submit Feedback
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
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
          <div className="text-red-600 mb-2">Error loading matches</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadMatches}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI-Powered Matching</h2>
          <p className="text-muted-foreground">
            {matches.length} matches found using advanced algorithms
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Star className="h-3 w-3" />
            <span>AI Powered</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matches List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold">Matches ({matches.length})</h3>
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>

        {/* Match Details */}
        <div className="lg:col-span-2">
          {selectedMatch ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="feedback">Feedback</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Match Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Match Score</h4>
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary mb-2">
                            {Math.round(selectedMatch.score * 100)}
                          </div>
                          <div className="text-sm text-muted-foreground">Overall Match</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3">Quick Stats</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Status</span>
                            <Badge className={getStatusColor(selectedMatch.status)}>
                              {selectedMatch.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Created</span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(selectedMatch.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MatchScoreBreakdown match={selectedMatch} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="feedback" className="space-y-4">
                <FeedbackSection match={selectedMatch} />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground mb-4">No match selected</div>
                <p className="text-sm text-muted-foreground">
                  Select a match from the list to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchAlgorithm;
