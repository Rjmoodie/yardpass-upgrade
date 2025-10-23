// Platform upsell components for features not available on current platform
import { BarChart3, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpsellDesktopProps {
  feature?: string;
}

export function UpsellDesktop({ feature = 'This feature' }: UpsellDesktopProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Available on Desktop</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {feature} includes advanced tools like charts, exports, and team management that work best on desktop.
      </p>
      <p className="text-xs text-muted-foreground">
        Visit <strong className="font-semibold">yardpass.tech</strong> from a desktop browser to unlock these features.
      </p>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          window.open('https://yardpass.tech', '_blank');
        }}
      >
        Open on Desktop
      </Button>
    </div>
  );
}

interface UpsellMobileProps {
  feature?: string;
}

export function UpsellMobile({ feature = 'This feature' }: UpsellMobileProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
      <Smartphone className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Designed for Mobile</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {feature} is optimized for the YardPass mobile app with camera access, haptics, and native wallet integration.
      </p>
      <div className="flex gap-3 mt-4">
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => {
            window.open('https://apps.apple.com/yardpass', '_blank');
          }}
        >
          Download on App Store
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            window.open('https://play.google.com/store/apps/yardpass', '_blank');
          }}
        >
          Get on Google Play
        </Button>
      </div>
    </div>
  );
}

