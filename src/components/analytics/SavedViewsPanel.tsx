/**
 * Saved Views Panel
 * Allows organizers to save and quickly recall filter combinations
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSavedViews } from '@/hooks/useAnalyticsQuery';
import { Bookmark, Save, Share2, Trash2, MoreVertical } from 'lucide-react';
import type { SavedView, AnalyticsFilter } from '@/types/analytics';

interface SavedViewsPanelProps {
  orgId: string;
  currentFilters: AnalyticsFilter;
  onLoadView: (filters: AnalyticsFilter) => void;
}

export function SavedViewsPanel({ orgId, currentFilters, onLoadView }: SavedViewsPanelProps) {
  const { data: savedViews, refetch } = useSavedViews(orgId);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewDescription, setViewDescription] = useState('');
  const [isShared, setIsShared] = useState(false);

  const handleSaveView = async () => {
    if (!viewName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('analytics.saved_views')
        .insert({
          org_id: orgId,
          user_id: user.id,
          name: viewName,
          description: viewDescription || null,
          filters: currentFilters,
          active_tab: currentFilters.activeTab || 'overview',
          is_shared: isShared
        });

      if (error) throw error;

      toast({ title: 'View saved successfully' });
      setSaveDialogOpen(false);
      setViewName('');
      setViewDescription('');
      setIsShared(false);
      refetch();
    } catch (err) {
      console.error('Failed to save view:', err);
      toast({ 
        title: 'Failed to save view',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const handleLoadView = async (view: SavedView) => {
    // Update access stats
    await supabase
      .from('analytics.saved_views')
      .update({
        access_count: view.access_count + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', view.id);

    // Load the view
    onLoadView(view.filters as AnalyticsFilter);
    
    toast({ title: `Loaded view: ${view.name}` });
  };

  const handleDeleteView = async (viewId: string) => {
    try {
      const { error } = await supabase
        .from('analytics.saved_views')
        .delete()
        .eq('id', viewId);

      if (error) throw error;

      toast({ title: 'View deleted' });
      refetch();
    } catch (err) {
      toast({ 
        title: 'Failed to delete view',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick access dropdown */}
      {savedViews && savedViews.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved Views ({savedViews.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Your Saved Views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {savedViews.map((view: any) => (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between cursor-pointer group"
                onSelect={(e) => {
                  e.preventDefault();
                  handleLoadView(view);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{view.name}</div>
                  {view.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {view.description}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    {view.is_shared && (
                      <Badge variant="secondary" className="text-xs">
                        <Share2 className="h-2.5 w-2.5 mr-1" />
                        Shared
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Used {view.access_count}x
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteView(view.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Save current view */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save View
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Analytics View</DialogTitle>
            <DialogDescription>
              Save your current filters and settings for quick access later
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                placeholder="e.g., Monthly Revenue Review"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="view-description">Description (Optional)</Label>
              <Textarea
                id="view-description"
                placeholder="What this view shows..."
                value={viewDescription}
                onChange={(e) => setViewDescription(e.target.value)}
                rows={2}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="share-view"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="share-view" className="font-normal cursor-pointer">
                Share with team members
              </Label>
            </div>

            {/* Preview of saved filters */}
            <div className="rounded-lg border p-3 bg-muted/50 text-xs space-y-1">
              <div className="font-medium">Filters to save:</div>
              <div>Date Range: {currentFilters.dateRange}</div>
              {currentFilters.compareType && (
                <div>Comparison: {currentFilters.compareType}</div>
              )}
              {currentFilters.attribution && (
                <div>Attribution: {currentFilters.attribution}</div>
              )}
              <div>Net Revenue: {currentFilters.showNetRevenue ? 'Yes' : 'No'}</div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveView}>
              <Save className="h-4 w-4 mr-2" />
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

