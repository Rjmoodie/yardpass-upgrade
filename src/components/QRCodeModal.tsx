// src/components/QRCodeModal.tsx - Premium QR Code Modal
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Share, Loader2, Download, Palette, Check } from 'lucide-react';
import { generateQRData } from '@/lib/qrCode';
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
  const [qrSvg, setQrSvg] = useState<string>('');
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
      console.log('🎯 Starting QR generation with options:', qrOptions);
      setLoading(true);
      setFailed(false);

      try {
        const qrData = generateQRData({
          id: ticket.id,
          eventId: ticket.eventId,
          qrCode: ticket.qrCode,
          userId: user.id,
        });

        // Generate PNG first for display, SVG on demand
        const pngDataUrl = await generateStyledQRDataURL(qrData, { ...qrOptions, format: 'png' });
        
        // Generate SVG lazily - only when needed for download
        const svgDataUrl = '';

        if (!cancelled) {
          setQrPng(pngDataUrl);
          setQrSvg(svgDataUrl);
          console.log('✅ QR codes generated successfully');
        }
      } catch (error) {
        console.error('❌ Failed to generate QR codes:', error);
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
  }, [ticket, user, qrOptions, toast]);

  // Download handler with lazy SVG generation
  const handleDownload = useCallback(async (dataUrl: string, format: 'png' | 'svg') => {
    let finalDataUrl = dataUrl;
    
    // Generate SVG on-demand if needed
    if (format === 'svg' && !dataUrl) {
      try {
        const qrData = generateQRData({
          id: ticket.id,
          eventId: ticket.eventId,
          qrCode: ticket.qrCode,
          userId: user.id,
        });
        finalDataUrl = await generateStyledQRDataURL(qrData, { ...qrOptions, format: 'svg' });
      } catch (error) {
        console.error('Failed to generate SVG:', error);
        toast({
          title: "Download Failed",
          description: "Could not generate SVG QR code",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!finalDataUrl) {
      toast({
        title: "Download Failed",
        description: "QR code not ready for download",
        variant: "destructive",
      });
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `yardpass-ticket-${ticket.id.slice(0, 8)}.${format}`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download Started",
        description: `QR code saved as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Could not download QR code",
        variant: "destructive",
      });
    }
  }, [ticket.id, toast]);

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <Card className="w-full max-w-md relative animate-in fade-in zoom-in duration-300 shadow-2xl border-0 bg-white dark:bg-neutral-900">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border border-accent">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM16 13h2v2h-2v-2zM16 17h2v2h-2v-2zM20 13h2v2h-2v-2zM20 17h2v2h-2v-2z"/>
                </svg>
              </div>
              <div>
                <CardTitle id="qr-modal-title" className="text-lg font-semibold text-accent">
                  Event Ticket
                </CardTitle>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Theme selector toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowThemeSelector(!showThemeSelector)}
                className="hover:bg-gray-100 dark:hover:bg-neutral-800 btn-enhanced"
                aria-label="Change theme"
              >
                <Palette className="w-4 h-4" />
              </Button>
              
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-gray-100 dark:hover:bg-neutral-800 btn-enhanced"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Theme selector */}
          {showThemeSelector && (
            <div className="flex gap-2 justify-center mt-3 p-2 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-accent">
              {availableThemes.map((theme) => (
                <Button
                  key={theme.id}
                  variant={currentTheme === theme.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange(theme.id)}
                  className="btn-enhanced relative"
                >
                  <span className="mr-2">{theme.info.icon}</span>
                  {theme.info.name}
                  {currentTheme === theme.id && (
                    <Check className="w-3 h-3 ml-1" />
                  )}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Event Information */}
          <div className="text-center space-y-2">
            <h3 className="font-semibold leading-tight text-accent">
              {ticket.eventTitle}
            </h3>
            <p className="text-sm text-accent-muted">
              {ticket.eventDate} at {ticket.eventTime}
            </p>
            <p className="text-sm text-accent-muted">
              {ticket.eventLocation}
            </p>
            <Badge variant="secondary" className="badge-enhanced">
              {ticket.ticketType || 'General Admission'}
            </Badge>
          </div>

          {/* QR Code Display */}
          <div className="qr-card qr-size-md">
            <div className="qr-grid">
              {loading && (
                <div className="qr-box">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-accent-muted mt-3">
                    Generating premium QR code…
                  </p>
                </div>
              )}

              {!loading && failed && (
                <div className="qr-box">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto border border-accent">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="text-sm text-accent-muted mt-3">
                    QR code generation failed
                  </p>
                  <p className="text-xs text-accent-muted">
                    Please try refreshing or contact support
                  </p>
                </div>
              )}

              {!loading && !failed && qrPng && (
                <div className="qr-img-wrap">
                  <img
                    src={qrPng}
                    alt="Premium ticket QR code"
                    className="qr-img"
                    draggable={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Ticket Information */}
          <div className="text-center text-xs text-accent-muted space-y-1">
            <p>Ticket ID: {ticket.id.slice(0, 8)}…</p>
            <p>Show this QR code at event entry</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="btn-enhanced border-accent hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
              onClick={handleCopy}
              disabled={loading || failed}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>

            <Button
              variant="outline"
              className="btn-enhanced border-accent hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all"
              onClick={handleShare}
              disabled={loading || failed}
            >
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>

            <Button
              variant="outline"
              className="btn-enhanced border-accent hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all"
              onClick={() => handleDownload(qrPng, 'png')}
              disabled={loading || failed || !qrPng}
            >
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>

            <Button
              variant="outline"
              className="btn-enhanced border-accent hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all"
              onClick={() => handleDownload(qrSvg, 'svg')}
              disabled={loading || failed || !qrSvg}
            >
              <Download className="w-4 h-4 mr-2" />
              SVG
            </Button>
          </div>

          {/* YardPass branding */}
          <div className="text-center pt-2">
            <p className="text-xs text-accent-muted">
              Made for YardPass
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeModal;