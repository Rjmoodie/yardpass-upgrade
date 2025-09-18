// src/components/QRCodeModal.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Copy, Share, Loader2, Download } from 'lucide-react';
import { generateQRData } from '@/lib/qrCode';
import { generateStyledQRDataURL } from '@/lib/styledQr';
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
  /** Optional brand logo override (URL or data URI). Defaults to YardPass mark. */
  logoUrl?: string;
}

export function QRCodeModal({
  ticket,
  user,
  onClose,
  onCopy,
  onShare,
  logoUrl = '/yardpass-logo.png',
}: QRCodeModalProps) {
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);


  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // subtle haptic for mobile when opening
  useEffect(() => {
    try {
      (navigator as any)?.vibrate?.(10);
    } catch {}
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
          userId: user.id,
        });

        // Generate styled QR code
        const dataUrl = await generateStyledQRDataURL(qrData, {
          size: 512,
          margin: 20,
          darkColor: '#1a1b3e',
          lightColor: '#FFFFFF',
          dotsType: 'rounded',
          cornersSquareType: 'extra-rounded',
          cornersDotType: 'dot',
          logoUrl: '/yardpass-qr-logo.png',
          logoSizeRatio: 0.26,
          logoMargin: 8,
          format: 'png'
        });

        if (!cancelled) setQrPngDataUrl(dataUrl);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [ticket, user, logoUrl]);

  const downloadPng = useCallback(async () => {
    try {
      if (!qrPngDataUrl) return;
      const a = document.createElement('a');
      a.href = qrPngDataUrl;
      a.download = `ticket-${ticket.id}.png`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Download failed',
        description: 'Could not export PNG. Try again.',
        variant: 'destructive',
      });
    }
  }, [qrPngDataUrl, ticket.id]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <Card className="w-full max-w-md relative animate-in fade-in zoom-in duration-300 shadow-2xl border-0 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center" aria-hidden>
              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM16 13h2v2h-2v-2zM16 17h2v2h-2v-2zM20 13h2v2h-2v-2zM20 17h2v2h-2v-2z"/>
              </svg>
            </div>
            <CardTitle id="qr-modal-title" className="text-lg font-semibold">Event Ticket</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 hover:bg-gray-100 transition-colors"
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
              {ticket.eventDate} at {ticket.eventTime}
            </p>
            <p className="text-sm text-muted-foreground">{ticket.eventLocation}</p>
          </div>

          <div className="qr-grid flex justify-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            {loading && (
              <div className="w-[240px] h-[240px] grid place-items-center">
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Generating QR code...</p>
                </div>
              </div>
            )}

            {!loading && failed && (
              <div className="w-[240px] h-[240px] grid place-items-center text-center text-sm text-muted-foreground">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <p>Couldn't render QR code</p>
                  <p className="text-xs">Please try again</p>
                </div>
              </div>
            )}

            {!loading && !failed && (
              <div className="w-[240px] h-[240px] select-none flex items-center justify-center">
                {/* We render at higher internal resolution (opts.size); <img> downscales crisply */}
                <img
                  src={qrPngDataUrl}
                  alt="Ticket QR code"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>Ticket ID: {ticket.id.slice(0, 8)}…</p>
            <p>Show this QR at entry</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-10 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all duration-200"
              onClick={() => onCopy(ticket)}
              disabled={loading || failed}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>

            <Button
              variant="outline"
              className="flex-1 h-10 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all duration-200"
              onClick={() => onShare(ticket)}
              disabled={loading || failed}
            >
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>

            <Button
              variant="outline"
              className="flex-1 h-10 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all duration-200"
              onClick={downloadPng}
              disabled={loading || failed}
            >
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeModal;