import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Flashlight,
  QrCode,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { BrandedSpinner } from '../BrandedSpinner';
import { validateTicket } from '@/lib/ticketApi';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { LiventixSpinner } from '@/components/LoadingSpinner';

interface ScannerViewProps {
  eventId: string;
  onBack: () => void;
}

type ScanResultType = 'valid' | 'duplicate' | 'invalid' | 'expired' | 'wrong_event' | 'refunded' | 'void';

interface ScanHistoryItem {
  id: string;
  code: string;
  status: ScanResultType;
  message: string;
  timestamp: string;
}

// Scan cooldown to prevent double-scans and give operator time to react
const SCAN_COOLDOWN_MS = 2200; // 2.2s feels natural for human reaction time

const RESULT_COPY: Record<ScanResultType, { label: string }> = {
  valid: { label: 'Checked in' },
  duplicate: { label: 'Already scanned' },
  invalid: { label: 'Invalid ticket' },
  expired: { label: 'Expired ticket' },
  wrong_event: { label: 'Wrong event' },
  refunded: { label: 'Refunded' },
  void: { label: 'Voided' },
};

async function triggerHaptic(success: boolean) {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: success ? ImpactStyle.Medium : ImpactStyle.Heavy });
    } else if (window.navigator.vibrate) {
      window.navigator.vibrate(success ? 40 : 100);
    }
  } catch (err) {
    console.warn('Unable to trigger haptic', err);
  }
}

export function ScannerView({ eventId, onBack }: ScannerViewProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();
  const detectorRef = useRef<any>();
  const cooldownRef = useRef<number>(0);
  const duplicateCache = useRef<Map<string, number>>(new Map());

  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [status, setStatus] = useState<ScanHistoryItem | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanLocked, setScanLocked] = useState(false);

  const isNative = Capacitor.isNativePlatform();
  const detectorSupported = useMemo(() => {
    if (isNative) return true; // Capacitor BarcodeScanner works on native
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }, [isNative]);

  const stopCamera = useCallback(async () => {
    // Clear scan loop reference
    scanLoopRef.current = null;
    
    // Note: @capacitor/barcode-scanner v2.2.0 doesn't have stopScan/hideBackground
    // The scanner UI is managed by the native plugin and closes automatically
    if (!isNative) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, [isNative]);

  const toggleTorch = useCallback(async () => {
    // Note: @capacitor/barcode-scanner v2.2.0 doesn't have toggleTorch
    // Torch control is handled by the native scanner UI
    if (!isNative) {
      const track = streamRef.current?.getVideoTracks()?.[0];
      if (!track) return;
      const capabilities = (track.getCapabilities?.() as MediaTrackCapabilities | undefined) ?? {};
      if (!capabilities.torch) return;
      try {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn((prev) => !prev);
      } catch (err) {
        console.error('Torch toggle failed', err);
        toast({ title: 'Torch unavailable', description: 'Unable to toggle flashlight on this device.' });
      }
    }
  }, [torchOn, toast, isNative]);

  const analyseFrame = useCallback(async () => {
    if (scanLocked || !detectorSupported || !videoRef.current || videoRef.current.readyState < 2) {
      rafRef.current = requestAnimationFrame(analyseFrame);
      return;
    }
    try {
      const detector = (detectorRef.current ??= new (window as any).BarcodeDetector({ formats: ['qr_code'] }));
      const codes = await detector.detect(videoRef.current);
      const qr = codes?.[0]?.rawValue;
      if (qr) {
        await handlePayload(qr.trim());
      }
    } catch (err) {
      console.error('Frame analysis error', err);
    } finally {
      rafRef.current = requestAnimationFrame(analyseFrame);
    }
  }, [detectorSupported, scanLocked]);

  const startCamera = useCallback(async () => {
    if (!detectorSupported) {
      setCameraError('Camera scanning is not supported on this device. Switch to manual entry.');
      setMode('manual');
      return;
    }
    setInitializing(true);
    setCameraError(null);
    try {
      // Use Capacitor BarcodeScanner on native platforms
      if (isNative) {
        // Continuous scanning loop using the new API
        // Note: scanBarcode is one-shot, so we call it repeatedly
        const scanLoop = async () => {
          // Check if we should continue scanning
          if (mode !== 'camera' || scanLocked) {
            return;
          }

          try {
            // Use the new API: scanBarcode opens native scanner UI
            const result = await CapacitorBarcodeScanner.scanBarcode({
              hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
              scanInstructions: 'Position the QR code within the frame',
              scanButton: true,
              scanText: 'Scan QR Code',
              cameraDirection: 1, // BACK camera
            });

            if (result?.ScanResult && !scanLocked) {
              await handlePayload(result.ScanResult.trim());
              // After processing, restart scan loop (with cooldown)
              setTimeout(() => {
                if (mode === 'camera' && !scanLocked) {
                  scanLoopRef.current?.();
                }
              }, SCAN_COOLDOWN_MS);
            } else {
              // No result, restart immediately
              if (mode === 'camera' && !scanLocked) {
                scanLoopRef.current?.();
              }
            }
          } catch (err: any) {
            // User cancelled or error occurred
            const errMsg = err?.message?.toLowerCase() || '';
            if (errMsg.includes('cancel') || errMsg.includes('dismiss') || errMsg.includes('user')) {
              // User cancelled, switch to manual mode
              setMode('manual');
            } else {
              console.error('Scan error:', err);
              // Retry after error (only if still in camera mode)
              if (mode === 'camera' && !scanLocked) {
                setTimeout(() => {
                  if (mode === 'camera') {
                    scanLoopRef.current?.();
                  }
                }, 1000);
              }
            }
          }
        };

        // Store scan loop reference
        scanLoopRef.current = scanLoop;

        // Start the scan loop
        void scanLoop();

        // Torch is handled by native scanner UI, so we don't need to check
        setTorchSupported(false); // Not available via API in v2.2.0
      } else {
        // Web fallback: use getUserMedia
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities?.() as MediaTrackCapabilities | undefined) ?? {};
        setTorchSupported(Boolean(capabilities.torch));
        rafRef.current = requestAnimationFrame(analyseFrame);
      }
    } catch (err: any) {
      console.error('Camera start failed', err);
      setCameraError(err.message || 'We could not access the camera. Check permissions or use manual entry.');
      setMode('manual');
    } finally {
      setInitializing(false);
    }
  }, [detectorSupported, isNative, mode, scanLocked, handlePayload]);

  useEffect(() => {
    if (mode === 'camera') {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode, startCamera, stopCamera]);

  const appendHistory = useCallback((entry: ScanHistoryItem) => {
    setHistory((prev) => [entry, ...prev].slice(0, 25));
    setStatus(entry);
  }, []);

  const handlePayload = useCallback(async (payload: string) => {
    if (!payload || scanLocked) return;
    
    // Set lock immediately to prevent double-scans
    setScanLocked(true);
    
    const now = Date.now();
    duplicateCache.current.forEach((timestamp, key) => {
      if (now - timestamp > 10 * 60 * 1000) {
        duplicateCache.current.delete(key);
      }
    });
    if (now < cooldownRef.current) {
      // Unlock if we're still in cooldown from a previous scan
      setTimeout(() => setScanLocked(false), 300);
      return;
    }
    cooldownRef.current = now + SCAN_COOLDOWN_MS;

    const cached = duplicateCache.current.get(payload);
    if (cached && now - cached < 10_000) {
      const entry: ScanHistoryItem = {
        id: crypto.randomUUID(),
        code: payload,
        status: 'duplicate',
        message: 'Already scanned recently',
        timestamp: new Date().toISOString(),
      };
      appendHistory(entry);
      await triggerHaptic(false);
      return;
    }

    try {
      const result = await validateTicket({ qr: payload, event_id: eventId });
      const status = result.result as ScanResultType;
      const copy = RESULT_COPY[status] ?? RESULT_COPY.invalid;
      const message = result.message || copy.label;
      const entry: ScanHistoryItem = {
        id: crypto.randomUUID(),
        code: payload,
        status,
        message,
        timestamp: result.timestamp || new Date().toISOString(),
      };
      appendHistory(entry);
      duplicateCache.current.set(payload, Date.now());
      await triggerHaptic(status === 'valid');
    } catch (err) {
      console.error('Validation error', err);
      const entry: ScanHistoryItem = {
        id: crypto.randomUUID(),
        code: payload,
        status: 'invalid',
        message: 'Unable to verify. Check connection.',
        timestamp: new Date().toISOString(),
      };
      appendHistory(entry);
      await triggerHaptic(false);
    } finally {
      // Unlock after cooldown period to give operator time to see result
      setTimeout(() => setScanLocked(false), SCAN_COOLDOWN_MS);
    }
  }, [appendHistory, eventId, scanLocked]);

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    void handlePayload(code);
  };

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Scanner Mode Header - Distinctive Design */}
      <header className="sticky top-0 z-10 border-b border-primary/30 bg-slate-950/95 backdrop-blur-xl shadow-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="gap-2 text-white hover:bg-white/10" 
            aria-label="Exit scanner mode"
          >
            <X className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Exit</span>
          </Button>
          
          {/* Scanner Mode Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1.5 ring-2 ring-primary/50">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Scanner Mode</span>
            </div>
            <div className="hidden sm:block text-center">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Event ID</p>
              <p className="text-xs font-mono font-semibold text-white">{eventId}</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 bg-primary/10 text-white hover:bg-primary/20"
            onClick={() => setMode((prev) => (prev === 'camera' ? 'manual' : 'camera'))}
            aria-label="Toggle scanning mode"
          >
            {mode === 'camera' ? <QrCode className="h-4 w-4" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {mode === 'camera' ? 'Manual' : 'Camera'}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        {offline && (
          <Alert variant="destructive" className="border-amber-500/60 bg-amber-50 text-amber-900 dark:border-amber-500/80 dark:bg-amber-400/10 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            <AlertTitle>Offline mode</AlertTitle>
            <AlertDescription>
              We&apos;ll keep scanning but cannot verify tickets until you&apos;re back online.
            </AlertDescription>
          </Alert>
        )}

        {mode === 'camera' ? (
          <Card className="overflow-hidden border-primary/30 bg-slate-900/50 backdrop-blur-sm shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2 bg-gradient-to-r from-primary/10 to-transparent">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Live Camera Scanner
              </CardTitle>
              <div className="flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                <span className="text-xs font-semibold text-primary">Auto Verify</span>
              </div>
            </CardHeader>
            <CardContent className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {initializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80">
                  <BrandedSpinner size="lg" className="text-primary" />
                  <p className="text-sm font-medium text-white">Initializing camera...</p>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6">
                  <div className="rounded-full bg-red-500/20 p-4">
                    <AlertCircle className="h-8 w-8 text-red-500" aria-hidden />
                  </div>
                  <p className="max-w-xs text-sm font-medium text-white">{cameraError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMode('manual')}
                    className="mt-2 border-primary/50 text-white hover:bg-primary/20"
                  >
                    Switch to Manual Entry
                  </Button>
                </div>
              )}
              <video 
                ref={videoRef} 
                className={`h-full w-full object-cover transition-all duration-300 ${
                  scanLocked && status?.status === 'valid' 
                    ? 'ring-4 ring-green-500/80 ring-offset-4 ring-offset-black' 
                    : scanLocked && status?.status && status.status !== 'valid'
                    ? 'ring-4 ring-red-500/80 ring-offset-4 ring-offset-black'
                    : ''
                }`}
                playsInline 
                muted 
              />
              
              {/* Scan Lock Indicator */}
              {scanLocked && (
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 backdrop-blur-sm">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-semibold text-white">Processing...</span>
                </div>
              )}
              
              {/* Enhanced Scanning Overlay */}
              <div className="pointer-events-none absolute inset-0">
                {/* Corner Brackets */}
                <div className="absolute inset-8">
                  {/* Top Left */}
                  <div className="absolute left-0 top-0 h-12 w-12 border-l-4 border-t-4 border-primary rounded-tl-2xl" />
                  {/* Top Right */}
                  <div className="absolute right-0 top-0 h-12 w-12 border-r-4 border-t-4 border-primary rounded-tr-2xl" />
                  {/* Bottom Left */}
                  <div className="absolute bottom-0 left-0 h-12 w-12 border-l-4 border-b-4 border-primary rounded-bl-2xl" />
                  {/* Bottom Right */}
                  <div className="absolute bottom-0 right-0 h-12 w-12 border-r-4 border-b-4 border-primary rounded-br-2xl" />
                  
                  {/* Animated Scan Line */}
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2">
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse shadow-lg shadow-primary/50" />
                  </div>
                </div>
                
                {/* Instructions */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <div className="rounded-full bg-black/70 px-4 py-2 backdrop-blur-sm">
                    <p className="text-xs font-medium text-white text-center">
                      Position QR code within frame
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between bg-slate-900/30">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-green-500/20 p-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                </div>
                <span className="text-xs text-slate-300">
                  Duplicate protection active
                </span>
              </div>
              {torchSupported && (
                <Button 
                  variant={torchOn ? 'default' : 'outline'} 
                  size="sm" 
                  className={torchOn ? "gap-2 bg-primary hover:bg-primary/90" : "gap-2 border-primary/30 text-white hover:bg-primary/20"} 
                  onClick={toggleTorch}
                >
                  <Flashlight className="h-4 w-4" aria-hidden />
                  {torchOn ? 'On' : 'Off'}
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-primary/30 bg-slate-900/50 backdrop-blur-sm shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Manual Entry Mode
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">Enter ticket code manually or scan from device</p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="Enter or paste ticket code..."
                  aria-label="Ticket code"
                  autoFocus
                  className="text-base bg-slate-800/50 border-primary/30 text-white placeholder:text-slate-500 focus:border-primary"
                />
                <Button 
                  type="submit" 
                  className="gap-2 bg-primary hover:bg-primary/90 whitespace-nowrap"
                  disabled={!manualCode.trim()}
                >
                  <CheckCircle className="h-4 w-4" aria-hidden />
                  Verify Ticket
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {status && (
          <Card
            key={status.id}
            className={
              status.status === 'valid'
                ? 'border-emerald-500/60 bg-emerald-50 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-400/10 dark:text-emerald-100'
                : status.status === 'duplicate' || status.status === 'wrong_event' || status.status === 'refunded'
                  ? 'border-amber-500/60 bg-amber-50 text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/10 dark:text-amber-100'
                  : 'border-red-500/60 bg-red-50 text-red-900 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-100'
            }
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">{RESULT_COPY[status.status].label}</CardTitle>
              <Badge variant="outline" className="bg-white/60 text-xs">
                {new Date(status.timestamp).toLocaleTimeString()}
              </Badge>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-mono text-xs text-muted-foreground">{status.code}</p>
              <p className="mt-2 text-sm">{status.message}</p>
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="border-primary/20 bg-slate-900/40 backdrop-blur-sm shadow-xl">
            <CardHeader className="bg-gradient-to-r from-slate-800/50 to-transparent">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Scan History ({history.length})
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">Last {history.length} scans</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-3 transition-all hover:bg-slate-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                    <p className="font-mono text-xs text-slate-500 truncate mt-0.5">{entry.code}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      entry.status === 'valid'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-semibold'
                        : entry.status === 'duplicate' || entry.status === 'wrong_event' || entry.status === 'refunded'
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 font-semibold'
                          : 'border-red-500/50 bg-red-500/10 text-red-400 font-semibold'
                    }
                  >
                    {RESULT_COPY[entry.status].label}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

