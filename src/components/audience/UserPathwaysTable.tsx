/**
 * User Pathways Table
 * Shows common user journeys to purchase
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, Users } from 'lucide-react';
import type { UserPath } from '@/hooks/useAudienceIntelligence';

interface UserPathwaysTableProps {
  data: UserPath[] | null;
  loading: boolean;
}

export function UserPathwaysTable({ data, loading }: UserPathwaysTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Pathways</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Pathways</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Not enough journey data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Common Pathways to Purchase</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Most frequent user journeys
            </p>
          </div>
          <Badge variant="outline">
            {data.length} patterns
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((pathway, idx) => {
            const isHighConversion = pathway.conversion_rate >= 60;
            const isFastPath = pathway.avg_time_to_purchase_minutes <= 15;
            
            return (
              <div
                key={idx}
                className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Pathway visualization */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {pathway.path.split(' → ').map((step, stepIdx) => (
                        <React.Fragment key={stepIdx}>
                          <Badge variant="secondary" className="text-xs">
                            {step.replace(/_/g, ' ')}
                          </Badge>
                          {stepIdx < pathway.path.split(' → ').length - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    
                    {/* Metrics */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{pathway.users} users</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{pathway.avg_time_to_purchase_minutes}min avg</span>
                        {isFastPath && <Badge variant="outline" className="ml-1 bg-blue-500/10 text-blue-700 text-xs">Fast</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>{pathway.conversion_rate.toFixed(1)}% convert</span>
                        {isHighConversion && <Badge variant="outline" className="ml-1 bg-green-500/10 text-green-700 text-xs">High</Badge>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Rank badge */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-muted-foreground/30">
                      #{idx + 1}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Insights */}
        {data.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              💡 <strong>Insight:</strong> The top pathway has {data[0].users} users and {data[0].conversion_rate.toFixed(1)}% conversion. 
              {data[0].avg_time_to_purchase_minutes < 20 
                ? ' Fast decision-making indicates strong intent!' 
                : ' Consider optimizing for faster checkout.'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

