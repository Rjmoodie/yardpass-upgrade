/**
 * Analytics Selector Component
 * 
 * Allows organizers to select which analytics metrics to showcase to sponsors
 * when they're browsing sponsorship packages.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target,
  Image,
  Plus,
  X,
  Info
} from 'lucide-react';
import { 
  AnalyticsMetric, 
  AnalyticsShowcase, 
  AnalyticsCategory,
  ANALYTICS_METRIC_CONFIGS,
  getMetricsByCategory 
} from '@/types/analytics';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AnalyticsSelectorProps {
  value: AnalyticsShowcase;
  onChange: (value: AnalyticsShowcase) => void;
  currentEventId: string;
  availablePastEvents?: Array<{ id: string; title: string; start_at: string }>;
}

export function AnalyticsSelector({ 
  value, 
  onChange, 
  currentEventId,
  availablePastEvents = [] 
}: AnalyticsSelectorProps) {
  const metricsByCategory = getMetricsByCategory();

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({ ...value, enabled });
  };

  const handleToggleMetric = (metricId: AnalyticsMetric, checked: boolean) => {
    const newMetrics = checked
      ? [...value.metrics, metricId]
      : value.metrics.filter(m => m !== metricId);
    
    onChange({ ...value, metrics: newMetrics });
  };

  const handleSourceChange = (source: 'current' | 'reference') => {
    onChange({ ...value, source });
  };

  const handleReferenceEventChange = (referenceEventId: string) => {
    // This will be handled by the parent component
    // We just update the source
    onChange({ ...value, source: 'reference' });
  };

  const handleAddCustomStat = () => {
    const customStats = value.customStats || [];
    onChange({
      ...value,
      customStats: [...customStats, { label: '', value: '' }]
    });
  };

  const handleRemoveCustomStat = (index: number) => {
    const customStats = (value.customStats || []).filter((_, i) => i !== index);
    onChange({ ...value, customStats });
  };

  const handleUpdateCustomStat = (index: number, field: 'label' | 'value', newValue: string) => {
    const customStats = [...(value.customStats || [])];
    customStats[index] = { ...customStats[index], [field]: newValue };
    onChange({ ...value, customStats });
  };

  const getCategoryIcon = (category: AnalyticsCategory | string) => {
    switch (category) {
      case 'attendance': return Users;
      case 'engagement': return TrendingUp;
      case 'demographics': return Target;
      case 'financial': return DollarSign;
      case 'sponsor': return BarChart3;
      case 'media': return Image;
      default: return BarChart3;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics Showcase
            </CardTitle>
            <CardDescription>
              Select metrics to display to sponsors when they browse your package
            </CardDescription>
          </div>
          <Switch
            checked={value.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>
      </CardHeader>

      {value.enabled && (
        <CardContent className="space-y-6">
          {/* Data Source Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Data Source</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={value.source === 'current' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSourceChange('current')}
                className="flex-1"
              >
                Current Event
              </Button>
              <Button
                type="button"
                variant={value.source === 'reference' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSourceChange('reference')}
                className="flex-1"
                disabled={availablePastEvents.length === 0}
              >
                Past Event
              </Button>
            </div>
            {value.source === 'reference' && availablePastEvents.length > 0 && (
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a past event" />
                </SelectTrigger>
                <SelectContent>
                  {availablePastEvents.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} ({new Date(event.start_at).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {value.source === 'current' 
                ? 'Show analytics from this event (only available after event completes)'
                : 'Show analytics from a past event to demonstrate proven performance'
              }
            </p>
          </div>

          {/* Metrics Selection by Category */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Select Metrics to Display</Label>
            
            {Object.entries(metricsByCategory).map(([category, metrics]) => {
              if (metrics.length === 0) return null;
              
              const Icon = getCategoryIcon(category);
              const selectedInCategory = metrics.filter(m => value.metrics.includes(m.id)).length;
              
              return (
                <div key={category} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium capitalize">{category}</span>
                      {selectedInCategory > 0 && (
                        <Badge variant="brand" className="text-xs">
                          {selectedInCategory} selected
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {metrics.map(metric => (
                      <div key={metric.id} className="flex items-start gap-2">
                        <Checkbox
                          id={metric.id}
                          checked={value.metrics.includes(metric.id)}
                          onCheckedChange={(checked) => handleToggleMetric(metric.id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={metric.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                          >
                            {metric.label}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">{metric.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {metric.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Custom Statistics (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomStat}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Custom Stat
              </Button>
            </div>
            
            {value.customStats && value.customStats.length > 0 && (
              <div className="space-y-2">
                {value.customStats.map((stat, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Label (e.g., Past Sponsor ROI)"
                      value={stat.label}
                      onChange={(e) => handleUpdateCustomStat(index, 'label', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value (e.g., 250%)"
                      value={stat.value}
                      onChange={(e) => handleUpdateCustomStat(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCustomStat(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Add custom metrics that aren't automatically calculated (e.g., media coverage, influencer reach)
            </p>
          </div>

          {/* Preview */}
          {value.metrics.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium mb-2 text-muted-foreground">PREVIEW: Sponsors will see</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {value.metrics.slice(0, 6).map(metricId => {
                  const config = ANALYTICS_METRIC_CONFIGS[metricId];
                  return (
                    <div key={metricId} className="rounded bg-background p-2 text-center">
                      <p className="text-xs text-muted-foreground">{config.label}</p>
                      <p className="text-sm font-semibold">...</p>
                    </div>
                  );
                })}
                {value.metrics.length > 6 && (
                  <div className="rounded bg-background p-2 text-center flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">+{value.metrics.length - 6} more</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

