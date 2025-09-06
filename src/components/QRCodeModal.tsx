import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Copy, Share, Loader2, Download } from 'lucide-react';
import { generateQRData, generateQRCodeSVG } from '@/lib/qrCode';
import { UserTicket } from '@/hooks/useTickets';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  role: string;
}

interface QRCodeModalProps {
  ticket: UserTicket;
  user: User;
  onClose: () => void;
  onCopy: (ticket: UserTicket) => void;
  onShare: (ticket: UserTicket) => void;
}

export function QRCodeModal({ ticket, user, onClose, onCopy, onShare }: QRCodeModalProps) {
  const [qrCodeSVG, setQrCodeSVG] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Close on ESC / backdrop click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // subtle haptic for mobile when opening
    if ('vibrate' in navigator) {
      try { navigator.vibrate?.(10); } catch {}
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const qrData = generateQRData({
          id: ticket.id,
          eventId: ticket.eventId,
          qrCode: ticket.qrCode,
          userId: user.id
        });

        const svg = await generateQRCodeSVG(qrData, 256);
        if (!cancelled) setQrCodeSVG(svg);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [ticket, user]);

  const downloadPng = useCallback(async () => {
    try {
      if (!qrCodeSVG) return;
      // Create image from SVG
      const svgBlob = new Blob([qrCodeSVG], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      const size = 512;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // white bg so dark mode prints well
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `ticket-${ticket.id}.png`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Download failed',
        description: 'Could not export PNG. Try again.',
        variant: 'destructive'
      });
    }
  }, [qrCodeSVG, ticket.id]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-sm relative">
        <CardHeader className="text-center">
          <CardTitle>Event Ticket</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="font-semibold leading-tight">{ticket.eventTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(ticket.eventDate).toLocaleDateString()} at {ticket.eventTime}
            </p>
            <p className="text-sm text-muted-foreground">{ticket.eventLocation}</p>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-lg">
            {loading && (
              <div className="w-[200px] h-[200px] grid place-items-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && failed && (
              <div className="w-[200px] h-[200px] grid place-items-center text-center text-sm text-muted-foreground">
                Couldn’t render QR. Try again.
              </div>
            )}

            {!loading && !failed && (
              <div
                className="w-[200px] h-[200px] select-none"
                dangerouslySetInnerHTML={{ __html: qrCodeSVG }}
              />
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>Ticket ID: {ticket.id.slice(0, 8)}…</p>
            <p>Show this QR at entry</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onCopy(ticket)}
              disabled={loading || failed}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>

            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onShare(ticket)}
              disabled={loading || failed}
            >
              <Share className="w-4 h-4 mr-1" />
              Share
            </Button>

            <Button
              variant="outline"
              className="flex-1"
              onClick={downloadPng}
              disabled={loading || failed}
            >
              <Download className="w-4 h-4 mr-1" />
              PNG
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeModal;
