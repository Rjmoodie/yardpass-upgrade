/**
 * Acquisition Quality Table
 * Sortable table showing source/medium/campaign performance with LTV
 */

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { formatMetric } from '@/types/analytics';
import type { AcquisitionQuality } from '@/hooks/useAudienceIntelligence';

interface AcquisitionQualityTableProps {
  data: AcquisitionQuality[] | null;
  loading: boolean;
  onExport?: () => void;
}

type SortField = keyof AcquisitionQuality;
type SortDirection = 'asc' | 'desc';

export function AcquisitionQualityTable({
  data,
  loading,
  onExport
}: AcquisitionQualityTableProps) {
  const [sortField, setSortField] = useState<SortField>('revenue_cents');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    if (!data) return [];
    
    return [...data].sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-30" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acquisition Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Acquisition Quality</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Which channels drive high-value buyers
          </p>
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('source')}>
                  <div className="flex items-center gap-2">
                    Source <SortIcon field="source" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('medium')}>
                  <div className="flex items-center gap-2">
                    Medium <SortIcon field="medium" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('visitors')}>
                  <div className="flex items-center justify-end gap-2">
                    Visitors <SortIcon field="visitors" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('ctr')}>
                  <div className="flex items-center justify-end gap-2">
                    CTR <SortIcon field="ctr" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('purchase_rate')}>
                  <div className="flex items-center justify-end gap-2">
                    Conv % <SortIcon field="purchase_rate" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('revenue_cents')}>
                  <div className="flex items-center justify-end gap-2">
                    Revenue <SortIcon field="revenue_cents" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('aov_cents')}>
                  <div className="flex items-center justify-end gap-2">
                    AOV <SortIcon field="aov_cents" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('ltv_cents')}>
                  <div className="flex items-center justify-end gap-2">
                    LTV <SortIcon field="ltv_cents" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No acquisition data available for this period
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, idx) => {
                  // Calculate quality score (0-100)
                  const qualityScore = Math.min(100, Math.round(
                    (row.purchase_rate || 0) * 3 +  // 30% weight
                    (row.ctr || 0) * 2 +              // 20% weight
                    (100 - (row.refund_rate || 0)) * 0.5  // 5% weight (low refunds = good)
                  ));
                  
                  const isHighQuality = qualityScore >= 70;
                  const isMediumQuality = qualityScore >= 40;
                  
                  return (
                    <TableRow key={`${row.source}-${row.medium}-${idx}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {row.source}
                          {row.source === 'direct' && (
                            <Badge variant="secondary" className="text-xs">Organic</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.medium}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.visitors.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={row.ctr >= 25 ? 'text-green-600 font-semibold' : ''}>
                          {row.ctr.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.purchase_rate >= 5 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : row.purchase_rate < 2 ? (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          ) : null}
                          <span className={
                            row.purchase_rate >= 5 ? 'text-green-600 font-semibold' :
                            row.purchase_rate < 2 ? 'text-red-600' : ''
                          }>
                            {row.purchase_rate.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMetric(row.revenue_cents / 100, 'currency')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMetric(row.aov_cents / 100, 'currency')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {row.ltv_cents > 0 ? formatMetric(row.ltv_cents / 100, 'currency') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={isHighQuality ? 'default' : isMediumQuality ? 'secondary' : 'outline'}
                          className={
                            isHighQuality ? 'bg-green-500/10 text-green-700 border-green-500' :
                            isMediumQuality ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500' :
                            'bg-gray-500/10 text-gray-700 border-gray-500'
                          }
                        >
                          {qualityScore}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {sortedData.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div>Quality Score = (Conv% × 3) + (CTR × 2) + (100 - Refund%) × 0.5</div>
              <Badge variant="outline" className="bg-green-500/10 text-green-700">High ≥70</Badge>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">Med 40-69</Badge>
              <Badge variant="outline" className="bg-gray-500/10 text-gray-700">Low <40</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

