// src/components/QRCodeModal.tsx - Premium QR Code Modal
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Share, Palette, Check } from 'lucide-react';
import { BrandedSpinner } from './BrandedSpinner';
import { generateStyledQRDataURL } from '@/lib/styledQr';
import { getQrTheme, getAllThemes, type QrThemeName } from '@/lib/qrTheme';
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
  theme?: QrThemeName;
  brandHex?: string;
}

export function QRCodeModal({
  ticket,
  user,
  onClose,
  onCopy,
  onShare,
  logoUrl = '/yardpass-qr-logo.png',
  theme: initialTheme = 'brand',
  brandHex = '#ffb400',
}: QRCodeModalProps) {
  const [qrPng, setQrPng] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<QrThemeName>(initialTheme);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const availableThemes = getAllThemes();

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Haptic feedback on open
  useEffect(() => {
    try {
      (navigator as any)?.vibrate?.(10);
    } catch {
      // Ignore vibration errors
    }
  }, []);

  // Memoize QR options to prevent unnecessary regeneration
  const qrOptions = useMemo(() => ({
    ...getQrTheme(currentTheme, brandHex),
    logoUrl,
  }), [currentTheme, brandHex, logoUrl]);

  // Generate QR codes when options change
  useEffect(() => {
    let cancelled = false;

    const generateQRCodes = async () => {
      console.log('🎯 Starting QR generation for ticket:', ticket.qrCode);
      setLoading(true);
      setFailed(false);

      try {
        if (!ticket.qrCode) {
          throw new Error('No QR code available for this ticket');
        }

        // Use the simple static QR code from the database
        const pngDataUrl = await generateStyledQRDataURL(ticket.qrCode, { ...qrOptions, format: 'png' });
        
        if (!cancelled) {
          setQrPng(pngDataUrl);
          console.log('✅ QR code generated successfully');
        }
      } catch (error) {
        console.error('❌ Failed to generate QR code:', error);
        if (!cancelled) {
          setFailed(true);
          toast({
            title: "QR Generation Failed",
            description: "Could not generate QR code. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    generateQRCodes();
    return () => {
      cancelled = true;
    };
  }, [ticket.qrCode, qrOptions, toast]);

  // Enhanced copy handler with QR data
  const handleCopy = useCallback(() => {
    onCopy(ticket);
    toast({
      title: "Copied!",
      description: "Ticket information copied to clipboard",
    });
  }, [ticket, onCopy, toast]);

  // Enhanced share handler
  const handleShare = useCallback(() => {
    onShare(ticket);
    toast({
      title: "Shared!",
      description: "Ticket shared successfully",
    });
  }, [ticket, onShare, toast]);

  // Theme change handler
  const handleThemeChange = useCallback((newTheme: QrThemeName) => {
    setCurrentTheme(newTheme);
    setShowThemeSelector(false);
    toast({
      title: "Theme Changed",
      description: `Switched to ${newTheme} theme`,
    });
  }, [toast]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <Card className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border/50 bg-background shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <CardHeader className="space-y-2 pb-2 pt-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">Scanner ready</span>
            <CardTitle id="qr-modal-title" className="text-base font-semibold">
              {ticket.eventTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {ticket.eventDate} · {ticket.eventTime}
            </p>
          </div>
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowThemeSelector((prev) => !prev)}
              className="h-8 gap-2 rounded-full bg-muted px-3 text-xs font-medium text-foreground hover:bg-muted/80"
            >
              <Palette className="h-3.5 w-3.5" />
              Theme
            </Button>
          </div>
          {showThemeSelector && (
            <div className="mx-auto mt-2 flex max-w-xs flex-wrap justify-center gap-2 rounded-2xl bg-muted/50 p-2">
              {availableThemes.map((theme) => (
                <Button
                  key={theme.id}
                  variant={currentTheme === theme.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange(theme.id)}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  <span>{theme.info.icon}</span>
                  <span className="ml-2">{theme.info.name}</span>
                  {currentTheme === theme.id && <Check className="ml-1 h-3 w-3" />}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-6">
          <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
            {ticket.eventLocation && <p className="text-sm text-foreground/80">{ticket.eventLocation}</p>}
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium uppercase">
              {ticket.ticketType || 'General Admission'}
            </Badge>
          </div>

          <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-3xl bg-white p-5 shadow-inner dark:bg-white">
            {loading && (
              <div className="flex flex-col items-center gap-3 text-center">
                <BrandedSpinner size="lg" className="text-primary" />
                <p className="text-xs text-muted-foreground">Preparing your QR code…</p>
              </div>
            )}
            {!loading && failed && (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <X className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-xs text-muted-foreground">QR code unavailable. Try again shortly.</p>
              </div>
            )}
            {!loading && !failed && qrPng && (
              <img
                src={qrPng}
                alt="Ticket QR code"
                className="h-full w-full select-none object-contain"
                draggable={false}
              />
            )}
          </div>

          <div className="space-y-1 text-center text-[11px] text-muted-foreground">
            <p>Ticket ID • {ticket.id.slice(0, 8)}…</p>
            <p>Present this code at entry</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="secondary"
              className="h-11 rounded-full bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20"
              onClick={handleCopy}
              disabled={loading || failed}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy code
            </Button>
            <Button
              className="h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={handleShare}
              disabled={loading || failed}
            >
              <Share className="mr-2 h-4 w-4" /> Share pass
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">Tap outside to close</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeModal;