/**
 * Drillthrough Modal
 * Shows underlying data for any metric with filters
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Download, X, Filter } from 'lucide-react';
import { formatMetric } from '@/types/analytics';

interface DrillthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: string;
  orgId: string;
  from: Date | string;
  to: Date | string;
  eventId?: string;
  channel?: string;
  device?: string;
}

export function DrillthroughModal({
  isOpen,
  onClose,
  metric,
  orgId,
  from,
  to,
  eventId,
  channel,
  device
}: DrillthroughModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();

  useEffect(() => {
    if (isOpen) {
      fetchDrillthroughData();
    }
  }, [isOpen, metric, orgId, fromStr, toStr]);

  const fetchDrillthroughData = async () => {
    setLoading(true);
    try {
      // Get drillthrough metadata
      const { data: metadata, error: metaError } = await supabase.rpc(
        'get_drillthrough_query',
        {
          p_metric: metric,
          p_org_id: orgId,
          p_from: fromStr,
          p_to: toStr,
          p_event_id: eventId || null,
          p_channel: channel || null,
          p_device: device || null
        }
      );

      if (metaError) throw metaError;
      
      setCount(metadata.count_estimate || 0);

      // Fetch actual data based on metric type
      let query;
      
      switch (metric) {
        case 'purchases':
          query = supabase
            .from('ticketing.orders')
            .select(`
              id,
              user_id,
              event_id,
              total_cents,
              status,
              created_at,
              contact_email,
              contact_name,
              events:event_id (title)
            `)
            .eq('status', 'paid')
            .gte('created_at', fromStr)
            .lte('created_at', toStr);
          
          if (eventId) query = query.eq('event_id', eventId);
          break;
        
        case 'awareness':
        case 'engagement':
        case 'intent':
          const eventNames = getEventNamesForStage(metric);
          query = supabase
            .from('analytics.events')
            .select('*')
            .in('event_name', eventNames)
            .gte('ts', fromStr)
            .lte('ts', toStr)
            .eq('org_id', orgId)
            .limit(100);
          break;
        
        default:
          query = supabase
            .from('analytics.events')
            .select('*')
            .gte('ts', fromStr)
            .lte('ts', toStr)
            .eq('org_id', orgId)
            .limit(100);
      }

      const { data: results, error } = await query;
      
      if (error) throw error;
      setData(results || []);
    } catch (err) {
      console.error('Drillthrough fetch error:', err);
      toast({
        title: 'Failed to load data',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => JSON.stringify(row[h] || '')).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metric}-drillthrough-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'CSV exported' });
  };

  const getMetricTitle = () => {
    const titles: Record<string, string> = {
      awareness: 'Awareness Events',
      engagement: 'Engagement Events',
      intent: 'Intent Events',
      purchases: 'Purchase Orders',
      revenue: 'Revenue Orders'
    };
    return titles[metric] || metric;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{getMetricTitle()}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{count} total</Badge>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Underlying data for this metric
          </DialogDescription>
        </DialogHeader>

        {/* Active filters */}
        <div className="flex flex-wrap gap-2 py-2">
          <Badge variant="secondary">
            <Filter className="h-3 w-3 mr-1" />
            {new Date(fromStr).toLocaleDateString()} - {new Date(toStr).toLocaleDateString()}
          </Badge>
          {eventId && <Badge variant="secondary">Specific Event</Badge>}
          {channel && <Badge variant="secondary">Channel: {channel}</Badge>}
          {device && <Badge variant="secondary">Device: {device}</Badge>}
        </div>

        {/* Data table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              No data found for these filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(data[0]).slice(0, 8).map(key => (
                    <TableHead key={key} className="capitalize">
                      {key.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 100).map((row, idx) => (
                  <TableRow key={idx}>
                    {Object.entries(row).slice(0, 8).map(([key, value], cellIdx) => (
                      <TableCell key={cellIdx} className="font-mono text-xs">
                        {formatCellValue(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            Showing {Math.min(100, data.length)} of {count} records
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions
function getEventNamesForStage(stage: string): string[] {
  const stages: Record<string, string[]> = {
    awareness: ['page_view', 'event_impression', 'post_view'],
    engagement: ['event_view', 'click_event_card', 'post_click'],
    intent: ['ticket_cta_click', 'get_tickets_click'],
    checkout: ['checkout_started'],
    purchase: ['purchase']
  };
  
  return stages[stage] || [];
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 50);
  if (typeof value === 'string' && value.length > 50) return value.slice(0, 47) + '...';
  return String(value);
}

