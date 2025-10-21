// components/examples/ResponsiveExample.tsx
import React from 'react';
import { ResponsiveDebugger, useResponsive } from '@/components/ResponsiveDebugger';
import { ResponsiveBottomSheet, ResponsiveGrid, ResponsiveCard } from '@/components/ui/responsive-bottom-sheet';
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { FeedActionRail } from '@/components/feed/FeedActionRail';
import { Heart, MessageCircle, Share, Plus, Flag, VolumeX } from 'lucide-react';

/**
 * Example component demonstrating comprehensive responsive design
 * Shows how to use all the responsive components and utilities
 */
export function ResponsiveExample() {
  const { viewport, isMobile, isTablet, isDesktop } = useResponsive();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Sample engagement buttons for FeedActionRail
  const engagementButtons = [
    {
      icon: <Heart className="w-5 h-5" />,
      label: "0",
      onClick: () => console.log('Like clicked'),
      title: "Like"
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      label: "2",
      onClick: () => console.log('Comment clicked'),
      title: "Comment"
    },
    {
      icon: <Share className="w-5 h-5" />,
      label: "0",
      onClick: () => console.log('Share clicked'),
      title: "Share"
    },
    {
      icon: <Plus className="w-5 h-5" />,
      label: undefined,
      onClick: () => console.log('Create clicked'),
      title: "Create"
    },
    {
      icon: <Flag className="w-5 h-5" />,
      label: undefined,
      onClick: () => console.log('Report clicked'),
      title: "Report"
    },
    {
      icon: <VolumeX className="w-5 h-5" />,
      label: undefined,
      onClick: () => console.log('Mute clicked'),
      title: "Mute"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {/* Development Debugger */}
      <ResponsiveDebugger />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">
            Responsive Design System
          </h1>
          <p className="text-xl text-gray-300">
            Comprehensive device-responsive components for all screen sizes
          </p>
          {viewport && (
            <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-white">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              {viewport.deviceType} • {viewport.breakpoint} • {viewport.width}×{viewport.height}
            </div>
          )}
        </div>

        {/* Engagement Buttons Demo */}
        <div className="relative">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 min-h-[400px] flex items-center justify-center">
            <div className="text-center text-white space-y-4">
              <h2 className="text-2xl font-semibold">Sample Post</h2>
              <p className="text-gray-300">This demonstrates the responsive engagement buttons</p>
            </div>
            
            {/* FeedActionRail positioned absolutely */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <FeedActionRail items={engagementButtons} />
            </div>
          </div>
        </div>

        {/* Responsive Grid Demo */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Responsive Grid</h2>
          <ResponsiveGrid>
            <ResponsiveCard>
              <h3 className="font-semibold text-lg mb-2">Card 1</h3>
              <p className="text-gray-600">This card adapts to different screen sizes using our responsive grid system.</p>
            </ResponsiveCard>
            <ResponsiveCard>
              <h3 className="font-semibold text-lg mb-2">Card 2</h3>
              <p className="text-gray-600">Fluid scaling ensures optimal layout across all devices.</p>
            </ResponsiveCard>
            <ResponsiveCard>
              <h3 className="font-semibold text-lg mb-2">Card 3</h3>
              <p className="text-gray-600">From iPhone X to ultrawide monitors, everything scales perfectly.</p>
            </ResponsiveCard>
          </ResponsiveGrid>
        </div>

        {/* Dialog and Sheet Demos */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Button 
            onClick={() => setDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Open Responsive Dialog
          </Button>
          
          <Button 
            onClick={() => setSheetOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            Open Responsive Sheet
          </Button>
        </div>

        {/* Device-specific content */}
        <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 text-white">
          <h3 className="text-xl font-semibold mb-4">Device-Specific Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Mobile ({isMobile ? 'Active' : 'Inactive'})</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Touch-optimized buttons</li>
                <li>• Safe area handling</li>
                <li>• Full-height sheets</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Tablet ({isTablet ? 'Active' : 'Inactive'})</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Responsive grids</li>
                <li>• Adaptive spacing</li>
                <li>• Optimized dialogs</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Desktop ({isDesktop ? 'Active' : 'Inactive'})</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Large touch targets</li>
                <li>• Hover states</li>
                <li>• Keyboard navigation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Responsive Dialog</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              This dialog adapts to different screen sizes:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Mobile: Full-width with rounded corners</li>
              <li>• Tablet: Centered modal with medium sizing</li>
              <li>• Desktop: Larger modal with full features</li>
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>
                Confirm
              </Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Responsive Bottom Sheet */}
      <ResponsiveBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Responsive Bottom Sheet"
        description="This sheet adapts to different screen sizes and orientations"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This bottom sheet provides different experiences:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Mobile: Full-height slide-up sheet</li>
            <li>• Tablet: Modal dialog with responsive sizing</li>
            <li>• Desktop: Centered modal dialog</li>
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </ResponsiveBottomSheet>
    </div>
  );
}
