import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { BrandedSpinner } from '../BrandedSpinner';

interface QrDisplayProps {
  ticketId: string;
  eventId: string;
  token: string | null;
  isLoading?: boolean;
  errored?: boolean;
}

const BRIGHTNESS_CLASS = 'qr-brightness-boost';

export function QrDisplay({
  ticketId,
  eventId,
  token,
  isLoading,
  errored,
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

  return (
    <Card className="relative flex flex-col items-center gap-4 rounded-3xl border border-border/60 bg-background/95 p-6 shadow-xl">
      <div className="flex w-full items-center justify-center text-xs uppercase tracking-wide text-muted-foreground">
        <span>Your Ticket QR Code</span>
      </div>
      <div className="relative flex aspect-square w-full max-w-xs items-center justify-center rounded-3xl bg-white p-6 shadow-inner">
        {(rendering || isLoading) && (
          <BrandedSpinner size="lg" className="absolute text-primary" />
        )}
        {errored && !rendering && !isLoading && (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-destructive">
            <AlertCircle className="h-6 w-6" aria-hidden />
            <span>Unable to load QR code.</span>
          </div>
        )}
        {!errored && !dataUrl && !rendering && !isLoading && (
          <div className="text-center text-sm text-muted-foreground">
            Loading ticket code…
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
          Present this code at the entrance for quick scanning.
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {eventId?.slice(0, 8) || 'Event'}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs" aria-label="Ticket identifier">
            #{ticketId?.slice(-6) || 'Ticket'}
          </span>
        </div>
      </div>
    </Card>
  );
}

