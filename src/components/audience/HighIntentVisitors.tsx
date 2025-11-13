/**
 * High-Intent Visitors Widget
 * Real-time display of visitors with high propensity scores
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Flame, Mail, MessageSquare, Clock } from 'lucide-react';
import { formatDistance } from 'date-fns';
import type { HighIntentVisitor } from '@/hooks/useAudienceIntelligence';

interface HighIntentVisitorsProps {
  data: HighIntentVisitor[] | null;
  loading: boolean;
  onContactUser?: (userId: string) => void;
}

export function HighIntentVisitors({ data, loading, onContactUser }: HighIntentVisitorsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[#1171c0]" />
            Hot Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[#1171c0]" />
            Hot Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-sm">
            No high-intent visitors in the last 24 hours
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[#1171c0] animate-pulse" />
            Hot Leads ({data.length})
          </CardTitle>
          <Badge variant="destructive" className="animate-pulse">
            Live
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          High-propensity visitors in the last 24 hours
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 10).map((visitor, idx) => (
            <div
              key={visitor.user_id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {visitor.display_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <div className="font-medium">{visitor.display_name || 'Anonymous'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      Score: {visitor.propensity_score}/10
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistance(new Date(visitor.last_activity), new Date(), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {visitor.recent_events.slice(0, 3).map((event, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {event.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              {onContactUser && (
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onContactUser(visitor.user_id)}
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onContactUser(visitor.user_id)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Message
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {data.length > 10 && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm">
              View all {data.length} hot leads
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

