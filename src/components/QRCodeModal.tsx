// src/components/QRCodeModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Copy, Share, Loader2, Download } from 'lucide-react';
import { generateQRData, generateQRCodeWithLogo } from '@/lib/qrCode';
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

  // Trap close on ESC / backdrop click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // subtle haptic for mobile when opening
    if ('vibrate' in navigator) {
      try { (navigator as any).vibrate?.(10); } catch {}
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

        const svg = await generateQRCodeWithLogo(qrData, 256);
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

      // White bg so dark mode prints well
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <Card className="w-full max-w-md relative animate-in fade-in zoom-in duration-300 shadow-2xl border-0 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
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
            {/* Use the already formatted strings instead of reparsing */}
            <p className="text-sm text-muted-foreground">
              {ticket.eventDate} at {ticket.eventTime}
            </p>
            <p className="text-sm text-muted-foreground">{ticket.eventLocation}</p>
          </div>

          <div className="flex justify-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
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
              <div
                className="w-[240px] h-[240px] select-none flex items-center justify-center"
                aria-label="Ticket QR code"
                dangerouslySetInnerHTML={{ __html: qrCodeSVG }}
              />
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
