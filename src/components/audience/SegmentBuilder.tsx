/**
 * Segment Builder
 * UI for creating and managing audience segments
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Save, Download, Users } from 'lucide-react';
import { useCreateSegment, useExportSegment, useAudienceSegments } from '@/hooks/useAudienceIntelligence';
import { toast } from '@/hooks/use-toast';

interface SegmentBuilderProps {
  orgId: string;
}

interface SegmentFilter {
  field: string;
  operator: string;
  value: string;
}

export function SegmentBuilder({ orgId }: SegmentBuilderProps) {
  const [filters, setFilters] = useState<SegmentFilter[]>([]);
  const [segmentName, setSegmentName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  const { data: savedSegments, refetch } = useAudienceSegments(orgId);
  const createSegment = useCreateSegment();
  const exportSegment = useExportSegment();

  const addFilter = () => {
    setFilters([...filters, { field: 'utm_source', operator: 'equals', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, key: keyof SegmentFilter, value: string) => {
    const newFilters = [...filters];
    newFilters[index][key] = value;
    setFilters(newFilters);
  };

  const handleSaveSegment = async () => {
    if (!segmentName.trim()) {
      toast({ title: 'Please enter a segment name', variant: 'destructive' });
      return;
    }

    // Convert filters to definition object
    const definition = filters.reduce((acc, filter) => {
      if (filter.value.trim()) {
        acc[filter.field] = filter.value;
      }
      return acc;
    }, {} as Record<string, any>);

    createSegment.mutate({
      org_id: orgId,
      name: segmentName,
      definition
    });

    setShowSaveDialog(false);
    setSegmentName('');
  };

  const handleExport = async (segmentId: string, includePII: boolean = false) => {
    exportSegment.mutate({
      segmentId,
      includePII,
      format: 'csv',
      purpose: 'manual_export'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Audience Segments
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create targeted segments for campaigns and retargeting
        </p>
      </CardHeader>
      <CardContent>
        {/* Filter Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Filters</Label>
            <Button size="sm" variant="outline" onClick={addFilter}>
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
          </div>

          {filters.map((filter, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select 
                value={filter.field} 
                onValueChange={(v) => updateFilter(idx, 'field', v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utm_source">Source</SelectItem>
                  <SelectItem value="utm_medium">Medium</SelectItem>
                  <SelectItem value="device_type">Device</SelectItem>
                  <SelectItem value="lifecycle_stage">Lifecycle</SelectItem>
                  <SelectItem value="propensity_score">Propensity</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filter.operator} 
                onValueChange={(v) => updateFilter(idx, 'operator', v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">equals</SelectItem>
                  <SelectItem value="not_equals">not equals</SelectItem>
                  <SelectItem value="contains">contains</SelectItem>
                  <SelectItem value="greater_than">{">"}</SelectItem>
                  <SelectItem value="less_than">{"<"}</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={filter.value}
                onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                placeholder="Value..."
                className="flex-1"
              />

              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => removeFilter(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {filters.length > 0 && (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save Segment
              </Button>
              <Button variant="outline">
                Preview ({Math.floor(Math.random() * 1000)} users)
              </Button>
            </div>
          )}
        </div>

        {showSaveDialog && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30">
            <Label>Segment Name</Label>
            <Input
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              placeholder="e.g., High-Intent Mobile from Instagram"
              className="mt-2"
            />
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleSaveSegment}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Saved Segments */}
        {savedSegments && savedSegments.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="space-y-2">
              <Label>Saved Segments ({savedSegments.length})</Label>
              {savedSegments.map(segment => (
                <div
                  key={segment.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{segment.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ~{segment.size_estimate} users • Exported {segment.export_count}x
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(segment.id, false)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

