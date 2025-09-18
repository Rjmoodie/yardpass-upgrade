// src/components/QRCodeModal.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Copy, Share, Loader2, Download } from 'lucide-react';
import { generateQRData } from '@/lib/qrCode';
import { generateStyledQRDataURL } from '@/lib/styledQr';
import { getQrTheme, type QrThemeName } from '@/lib/qrTheme';
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
  logoUrl?: string;
  theme?: QrThemeName;     // 'classic' | 'brand' | 'night'
  brandHex?: string;       // accent color for 'brand' theme
}

export function QRCodeModal({
  ticket,
  user,
  onClose,
  onCopy,
  onShare,
  logoUrl = '/yardpass-logo.png',
  theme = 'brand',
  brandHex = '#ff5a3c',
}: QRCodeModalProps) {
  const [qrPng, setQrPng] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    try { (navigator as any)?.vibrate?.(10); } catch {}
  }, []);

  const opts = useMemo(() => getQrTheme(theme, brandHex), [theme, brandHex]);

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

        // PNG (for on-screen display)
        const pngUrl = await generateStyledQRDataURL(qrData, {
          ...opts,
          logoUrl,
          format: 'png',
          // If you added dotsOptionsGradient, map it:
          // @ts-ignore
          ...(opts as any).dotsOptionsGradient && {
            // will be read inside generateStyledQRDataURL as gradient
          },
        });

        // SVG (optional download)
        const svgUrl = await generateStyledQRDataURL(qrData, {
          ...opts,
          logoUrl,
          format: 'svg',
          // @ts-ignore
          ...(opts as any).dotsOptionsGradient && {},
        });

        if (!cancelled) {
          setQrPng(pngUrl);
          setQrSvg(svgUrl);
        }
      } catch (err) {
        console.error('Failed to generate QR code:', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [ticket, user, logoUrl, opts]);

  const download = useCallback((dataUrl: string, ext: 'png' | 'svg') => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ticket-${ticket.id}.${ext}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [ticket.id]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <Card className="w-full max-w-md relative animate-in fade-in zoom-in duration-300 shadow-2xl border-0 bg-white dark:bg-neutral-900">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center" aria-hidden>
              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM16 13h2v2h-2v-2zM16 17h2v2h-2v-2zM20 13h2v2h-2v-2zM20 17h2v2h-2v-2z"/>
              </svg>
            </div>
            <CardTitle id="qr-modal-title" className="text-lg font-semibold">Event Ticket</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="font-semibold leading-tight">{ticket.eventTitle}</h3>
            <p className="text-sm text-muted-foreground">{ticket.eventDate} at {ticket.eventTime}</p>
            <p className="text-sm text-muted-foreground">{ticket.eventLocation}</p>
          </div>

          {/* VISUAL WRAPPER */}
          <div className="qr-card">
            <div className="qr-grid">
              {loading && (
                <div className="qr-box">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground mt-3">Generating QR code…</p>
                </div>
              )}

              {!loading && failed && (
                <div className="qr-box">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">Couldn’t render QR code</p>
                  <p className="text-xs text-muted-foreground">Please try again</p>
                </div>
              )}

              {!loading && !failed && (
                <div className="qr-img-wrap">
                  <img src={qrPng} alt="Ticket QR code" className="qr-img" draggable={false} />
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>Ticket ID: {ticket.id.slice(0, 8)}…</p>
            <p>Show this QR at entry</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all" onClick={() => onCopy(ticket)} disabled={loading || failed}>
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>

            <Button variant="outline" className="flex-1 h-10 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all" onClick={() => onShare(ticket)} disabled={loading || failed}>
              <Share className="w-4 h-4 mr-2" /> Share
            </Button>

            <Button variant="outline" className="flex-1 h-10 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all" onClick={() => download(qrPng, 'png')} disabled={loading || failed}>
              <Download className="w-4 h-4 mr-2" /> PNG
            </Button>

            {/* Optional SVG export */}
            <Button variant="outline" className="flex-1 h-10 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all" onClick={() => download(qrSvg, 'svg')} disabled={loading || failed}>
              <Download className="w-4 h-4 mr-2" /> SVG
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeModal;