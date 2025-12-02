import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationPreferences } from '@/components/NotificationPreferences';
import { FullScreenSafeArea } from '@/components/layout/FullScreenSafeArea';

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <FullScreenSafeArea>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center gap-4 p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-6">
          <NotificationPreferences />
        </div>
      </div>
    </FullScreenSafeArea>
  );
}

