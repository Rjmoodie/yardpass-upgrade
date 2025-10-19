// src/components/QRCodeModal.tsx - Premium QR Code Modal
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Share, Palette, Check } from 'lucide-react';
import { generateStyledQRDataURL } from '@/lib/styledQr';
import { getQrTheme, getAllThemes, type QrThemeName } from '@/lib/qrTheme';
import { UserTicket } from '@/hooks/useTickets';
import { toast } from '@/hooks/use-toast';
import { YardpassSpinner } from '@/components/LoadingSpinner';

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

  const availableThemes = useMemo(() => getAllThemes(), []);

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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      {/* Close hint for mobile */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-neutral-800/90 px-4 py-2 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm md:hidden">
        Tap outside to close
      </div>

      <Card className="w-full max-w-sm relative animate-in zoom-in duration-200 shadow-2xl border-0 bg-white dark:bg-neutral-900 max-h-[90vh] overflow-y-auto">
        {/* Prominent Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-600 hover:text-red-600 transition-all shadow-sm hover:shadow-md"
          aria-label="Close QR code viewer"
        >
          <X className="w-5 h-5" />
        </Button>

        <CardHeader className="text-center pb-3 pt-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM16 13h2v2h-2v-2zM16 17h2v2h-2v-2zM20 13h2v2h-2v-2zM20 17h2v2h-2v-2z"/>
              </svg>
            </div>
            <CardTitle id="qr-modal-title" className="text-base font-semibold text-accent">
              Event Ticket
            </CardTitle>
          </div>

        </CardHeader>

        <CardContent className="space-y-3 px-4 pb-4">
          {/* Event Information - Compact */}
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-sm leading-tight text-accent">
              {ticket.eventTitle}
            </h3>
            <p className="text-xs text-accent-muted">
              {ticket.eventDate} • {ticket.eventTime}
            </p>
            <Badge variant="secondary" className="text-xs mt-1">
              {ticket.ticketType || 'General Admission'}
            </Badge>
          </div>

          {/* QR Code Display - More Compact */}
          <div className="flex items-center justify-center py-2">
            {loading && (
              <div className="flex flex-col items-center gap-2 py-8">
                <YardpassSpinner size="md" />
                <p className="text-xs text-accent-muted">
                  Loading QR code…
                </p>
              </div>
            )}

            {!loading && failed && (
              <div className="flex flex-col items-center gap-2 py-8">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <X className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-xs text-accent-muted text-center">
                  Failed to load QR code
                </p>
              </div>
            )}

            {!loading && !failed && qrPng && (
              <div className="w-64 h-64 flex items-center justify-center bg-white rounded-lg p-2 shadow-inner">
                <img
                  src={qrPng}
                  alt="Ticket QR code"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            )}
          </div>

          {/* Ticket Information - Minimal */}
          <div className="text-center text-[10px] text-accent-muted">
            <p>Show at entry • ID: {ticket.id.slice(0, 8)}…</p>
          </div>

          {/* Action Buttons - Compact Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
              onClick={handleCopy}
              disabled={loading || failed}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
              onClick={handleShare}
              disabled={loading || failed}
            >
              <Share className="w-3.5 h-3.5 mr-1.5" />
              Share
            </Button>
          </div>

          {/* Collapsible Theme Selector */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowThemeSelector((prev) => !prev)}
            className="w-full h-8 text-xs"
          >
            <Palette className="w-3 h-3 mr-1.5" />
            {showThemeSelector ? 'Hide' : 'Change'} Theme
          </Button>

          {showThemeSelector && (
            <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 dark:bg-neutral-800 rounded-lg">
              {availableThemes.slice(0, 3).map((theme) => (
                <Button
                  key={theme.id}
                  variant={currentTheme === theme.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange(theme.id)}
                  className="h-8 text-xs"
                >
                  {theme.info.icon}
                  {currentTheme === theme.id && (
                    <Check className="w-3 h-3 ml-1" />
                  )}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeModal;