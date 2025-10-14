import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { BrandedSpinner } from '../BrandedSpinner';

interface QrDisplayProps {
  ticketId: string;
  eventId: string;
  token: string | null;
  secondsRemaining?: number;
  isRefreshing?: boolean;
  errored?: boolean;
  onRefresh?: () => void;
}

const BRIGHTNESS_CLASS = 'qr-brightness-boost';

export function QrDisplay({
  ticketId,
  eventId,
  token,
  secondsRemaining,
  isRefreshing,
  errored,
  onRefresh,
}: QrDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = meta?.getAttribute('content');
    document.documentElement.classList.add(BRIGHTNESS_CLASS);
    if (meta) meta.setAttribute('content', '#ffffff');
    return () => {
      document.documentElement.classList.remove(BRIGHTNESS_CLASS);
      if (meta && previousTheme) meta.setAttribute('content', previousTheme);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setDataUrl(null);
      return undefined;
    }

    setRendering(true);
    QRCode.toDataURL(token, {
      width: 320,
      margin: 0,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
        }
      })
      .catch((error) => {
        console.error('Failed to render QR code', error);
        if (!cancelled) {
          setDataUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const countdownLabel = useMemo(() => {
    if (!secondsRemaining || secondsRemaining <= 0) return 'Refresh required';
    if (secondsRemaining <= 5) return `Refreshing in ${secondsRemaining}s`;
    return `Auto refresh in ${secondsRemaining}s`;
  }, [secondsRemaining]);

  return (
    <Card className="relative flex flex-col items-center gap-4 rounded-3xl border border-border/60 bg-background/95 p-6 shadow-xl">
      <div className="flex w-full items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Secure QR</span>
        <Badge variant="outline" className="border-dashed px-2 text-[10px]">
          {countdownLabel}
        </Badge>
      </div>
      <div className="relative flex aspect-square w-full max-w-xs items-center justify-center rounded-3xl bg-white p-6 shadow-inner">
        {rendering && (
          <BrandedSpinner size="lg" className="absolute text-primary" />
        )}
        {errored && !rendering && (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-destructive">
            <AlertCircle className="h-6 w-6" aria-hidden />
            <span>Unable to refresh QR code.</span>
          </div>
        )}
        {!errored && !dataUrl && !rendering && (
          <div className="text-center text-sm text-muted-foreground">
            Generating secure code…
          </div>
        )}
        {!errored && dataUrl && !rendering && (
          <img
            src={dataUrl}
            alt={`Ticket QR code for ticket ${ticketId}`}
            className="h-full w-full object-contain"
            aria-describedby={`qr-meta-${ticketId}`}
          />
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <p id={`qr-meta-${ticketId}`}>
          Present this code at the entrance. We regenerate it every few seconds to prevent screenshots.
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {eventId}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs" aria-label="Ticket identifier">
            #{ticketId.slice(-6)}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onRefresh?.()}
          disabled={isRefreshing}
          aria-label="Refresh QR code manually"
        >
          <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden />
          Refresh now
        </Button>
        <span className="text-xs text-muted-foreground">
          {isRefreshing ? 'Updating code…' : 'Token rotates every 20 seconds'}
        </span>
      </div>
    </Card>
  );
}

