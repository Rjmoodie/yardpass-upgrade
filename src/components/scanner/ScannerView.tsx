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
import { YardpassSpinner } from '@/components/LoadingSpinner';

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

  const detectorSupported = useMemo(() => typeof window !== 'undefined' && 'BarcodeDetector' in window, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const toggleTorch = useCallback(async () => {
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
  }, [torchOn, toast]);

  const analyseFrame = useCallback(async () => {
    if (!detectorSupported || !videoRef.current || videoRef.current.readyState < 2) {
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
  }, [detectorSupported]);

  const startCamera = useCallback(async () => {
    if (!detectorSupported) {
      setCameraError('Camera scanning is not supported on this device. Switch to manual entry.');
      setMode('manual');
      return;
    }
    setInitializing(true);
    setCameraError(null);
    try {
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
    } catch (err) {
      console.error('Camera start failed', err);
      setCameraError('We could not access the camera. Check permissions or use manual entry.');
    } finally {
      setInitializing(false);
    }
  }, [analyseFrame, detectorSupported]);

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
    if (!payload) return;
    const now = Date.now();
    duplicateCache.current.forEach((timestamp, key) => {
      if (now - timestamp > 10 * 60 * 1000) {
        duplicateCache.current.delete(key);
      }
    });
    if (now < cooldownRef.current) return;
    cooldownRef.current = now + 1200;

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
    }
  }, [appendHistory, eventId]);

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    void handlePayload(code);
  };

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2" aria-label="Back to event">
            <X className="h-4 w-4" aria-hidden />
            Close
          </Button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Event</p>
            <p className="text-sm font-semibold">{eventId}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
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
          <Card className="overflow-hidden border-border/60 bg-background/90">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold">Live scanner</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                Auto verify
              </div>
            </CardHeader>
            <CardContent className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {initializing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                  <BrandedSpinner size="lg" className="text-white" />
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-sm text-white">
                  <AlertCircle className="h-6 w-6" aria-hidden />
                  <p className="max-w-xs">{cameraError}</p>
                </div>
              )}
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/40">
                <div className="absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-pulse" />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Aim the camera at the QR. We prevent duplicate scans automatically.
              </span>
              {torchSupported && (
                <Button variant={torchOn ? 'default' : 'outline'} size="sm" className="gap-2" onClick={toggleTorch}>
                  <Flashlight className="h-4 w-4" aria-hidden />
                  {torchOn ? 'Torch on' : 'Torch off'}
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-border/60 bg-background/90">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Manual entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="Scan or paste code"
                  aria-label="Ticket code"
                  autoFocus
                  className="text-base"
                />
                <Button type="submit" className="gap-2">
                  <CheckCircle className="h-4 w-4" aria-hidden />
                  Verify
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
          <Card className="border-border/60 bg-background/70">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Recent scans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground/80">{entry.code}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      entry.status === 'valid'
                        ? 'border-emerald-500 text-emerald-600'
                        : entry.status === 'duplicate' || entry.status === 'wrong_event' || entry.status === 'refunded'
                          ? 'border-amber-500 text-amber-600'
                          : 'border-red-500 text-red-600'
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

