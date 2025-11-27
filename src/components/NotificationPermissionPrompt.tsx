import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, BottomSheetContent } from './ui/dialog';
import { Button } from './ui/button';
import { Bell } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';

interface NotificationPermissionPromptProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'event' | 'follow' | 'ticket' | 'general';
}

export function NotificationPermissionPrompt({ 
  isOpen, 
  onClose, 
  context = 'general' 
}: NotificationPermissionPromptProps) {
  const { requestPermission, permission } = usePushNotifications();

  // Don't show on web or if already granted/denied
  if (!Capacitor.isNativePlatform() || permission.granted || permission.denied) {
    return null;
  }

  const handleEnable = async () => {
    // Close custom dialog first
    onClose();
    // Then show iOS system permission dialog
    await requestPermission();
  };

  const getContextualMessage = () => {
    switch (context) {
      case 'event':
        return 'Get notified when events you\'re interested in start or get updated.';
      case 'follow':
        return 'Stay updated when organizers you follow post new events.';
      case 'ticket':
        return 'Receive reminders before your events start.';
      default:
        return 'Get notified about new comments, likes, and event updates.';
    }
  };

  const getContextualTitle = () => {
    switch (context) {
      case 'event':
        return 'Get Event Updates';
      case 'follow':
        return 'Stay Connected';
      case 'ticket':
        return 'Event Reminders';
      default:
        return 'Enable Notifications';
    }
  };

  // Use BottomSheetContent for mobile, DialogContent for desktop
  const isMobile = window.innerWidth < 640;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isMobile ? (
        <BottomSheetContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-full bg-primary/10 p-2">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-left">{getContextualTitle()}</DialogTitle>
            </div>
            <DialogDescription className="text-left text-base">
              {getContextualMessage()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={handleEnable} className="w-full">
              Enable Notifications
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Not Now
            </Button>
          </div>
        </BottomSheetContent>
      ) : (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-full bg-primary/10 p-2">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle>{getContextualTitle()}</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              {getContextualMessage()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={handleEnable} className="w-full">
              Enable Notifications
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Not Now
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}



