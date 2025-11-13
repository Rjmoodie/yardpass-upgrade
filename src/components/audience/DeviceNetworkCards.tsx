/**
 * Device & Network Performance Cards
 * Shows conversion rates by device type and network quality
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Monitor, Tablet, Wifi, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatMetric } from '@/types/analytics';
import type { DeviceNetworkPerformance } from '@/hooks/useAudienceIntelligence';

interface DeviceNetworkCardsProps {
  data: DeviceNetworkPerformance[] | null;
  loading: boolean;
}

export function DeviceNetworkCards({ data, loading }: DeviceNetworkCardsProps) {
  if (loading || !data) {
    return <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />;
  }

  // Group by device
  const byDevice = data.reduce((acc, row) => {
    if (!acc[row.device]) {
      acc[row.device] = {
        sessions: 0,
        purchases: 0,
        networks: [] as DeviceNetworkPerformance[]
      };
    }
    acc[row.device].sessions += row.sessions;
    acc[row.device].purchases += row.purchases;
    acc[row.device].networks.push(row);
    return acc;
  }, {} as Record<string, { sessions: number; purchases: number; networks: DeviceNetworkPerformance[] }>);

  // Find performance issues
  const slowNetworks = data.filter(d => 
    (d.network === '3g' || d.network === '2g') && 
    d.conversion_rate < 3
  );

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Issues Alert */}
      {slowNetworks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{slowNetworks.length} slow network(s) detected:</strong> 3G users converting {slowNetworks[0].conversion_rate}% 
            (vs {data.find(d => d.network === 'wifi')?.conversion_rate || 0}% on WiFi).
            Consider optimizing page load for slow connections.
          </AlertDescription>
        </Alert>
      )}

      {/* Device Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(byDevice).map(([device, stats]) => {
          const Icon = getDeviceIcon(device);
          const conversionRate = stats.sessions > 0 
            ? (stats.purchases / stats.sessions * 100)
            : 0;
          
          return (
            <Card key={device}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium capitalize">{device}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">conversion</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {stats.purchases.toLocaleString()} / {stats.sessions.toLocaleString()} sessions
                    </div>
                  </div>
                  
                  {/* Network breakdown */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">By Network:</div>
                    {stats.networks
                      .sort((a, b) => b.sessions - a.sessions)
                      .slice(0, 3)
                      .map((network, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <Wifi className="h-3 w-3 text-muted-foreground" />
                            <span className="capitalize">{network.network}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {network.sessions.toLocaleString()}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={
                                network.conversion_rate >= 5 ? 'border-green-500 text-green-700' :
                                network.conversion_rate < 2 ? 'border-red-500 text-red-700' :
                                'border-gray-500 text-gray-700'
                              }
                            >
                              {network.conversion_rate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                  
                  {/* Page load performance */}
                  {stats.networks[0]?.avg_page_load_ms && (
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground">Avg Page Load:</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress 
                          value={Math.min(100, (stats.networks[0].avg_page_load_ms / 3000) * 100)} 
                          className="h-1.5 flex-1"
                        />
                        <span className="text-xs font-mono">
                          {stats.networks[0].avg_page_load_ms}ms
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Network Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Network Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data
              .sort((a, b) => b.sessions - a.sessions)
              .slice(0, 10)
              .map((row, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium capitalize">{row.device}</div>
                    <Badge variant="outline" className="capitalize">
                      {row.network}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="font-mono">{row.sessions.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">sessions</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        row.conversion_rate >= 5 ? 'text-green-600' :
                        row.conversion_rate < 2 ? 'text-red-600' : ''
                      }`}>
                        {row.conversion_rate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">conv</div>
                    </div>
                    {row.avg_page_load_ms && (
                      <div className="text-right">
                        <div className="font-mono text-xs">{row.avg_page_load_ms}ms</div>
                        <div className="text-xs text-muted-foreground">load</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

