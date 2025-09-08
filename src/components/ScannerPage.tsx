import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Camera, Keyboard, Ban, QrCode, Volume2, VolumeX,
  Pause, Play, Flashlight, RefreshCw, Smartphone, Upload, Download
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface ScannerPageProps {
  eventId: string;
  onBack: () => void;
}

type ScanOutcome = 'valid' | 'duplicate' | 'expired' | 'invalid' | 'wrong_event' | 'refunded' | 'void';

interface ScanResult {
  id: string;
  success: boolean;
  result: ScanOutcome;
  ticket?: {
    id: string;
    tier_name: string;
    attendee_name: string;
    badge_label?: string;
  };
  message: string;
  timestamp: string;
}

interface AuthorizeResponse {
  allowed: boolean;
  role: 'owner' | 'editor' | 'scanner' | 'none';
}

const RESULT_LABEL: Record<ScanOutcome, string> = {
  valid: 'Valid',
  duplicate: 'Already Scanned',
  expired: 'Expired',
  wrong_event: 'Wrong Event',
  refunded: 'Refunded',
  void: 'Void',
  invalid: 'Invalid',
};

// Shape Detection API TS shim
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export function ScannerPage({ eventId, onBack }: ScannerPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('none');
  const [event, setEvent] = useState<any>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [paused, setPaused] = useState(false);

  // Camera / device controls
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cooldownRef = useRef<number>(0);
  const lastTokensRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard wedge aggregation (hardware scanners)
  const wedgeBufferRef = useRef<string>('');
  const wedgeTimerRef = useRef<number | null>(null);

  // Persist history per-event
  const historyKey = useMemo(() => `scannerHistory:${eventId}`, [eventId]);

  /* ------------------------------ Effects ------------------------------ */
  useEffect(() => {
    // Load persisted history
    try {
      const raw = localStorage.getItem(historyKey);
      if (raw) setScanHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [historyKey]);

  useEffect(() => {
    localStorage.setItem(historyKey, JSON.stringify(scanHistory.slice(0, 200)));
  }, [scanHistory, historyKey]);

  useEffect(() => {
    checkAuthorization();
    fetchEvent();
    enumerateVideoDevices();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('keydown', handleWedgeKeydown, true);
    window.addEventListener('paste', handlePaste, true);
    return () => {
      stopCamera();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handleWedgeKeydown, true);
      window.removeEventListener('paste', handlePaste, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // When switching devices while camera mode is active
    if (scanMode === 'camera') {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  /* --------------------------- Authorization --------------------------- */
  const checkAuthorization = async () => {
    if (!user || !eventId?.trim()) {
      setAuthorized(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('scanner-authorize', {
        body: { event_id: eventId }
      });
      if (error) throw error;
      const response: AuthorizeResponse = data;
      setAuthorized(response.allowed);
      setUserRole(response.role);
    } catch (err) {
      console.error('Authorization error:', err);
      setAuthorized(false);
    }
  };

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_at, end_at')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      setEvent(data);
    } catch (err) {
      console.error('Error fetching event:', err);
    }
  };

  /* ------------------------------ Utilities ---------------------------- */
  const beep = (ok: boolean) => {
    if (!soundOn) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = ok ? 880 : 220;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 120);
    } catch { /* ignore */ }
  };

  const vibrate = (ok: boolean) => {
    try {
      (navigator as any).vibrate?.(ok ? 20 : [10, 60, 10]);
    } catch { /* ignore */ }
  };

  /* ------------------------------ Scanning ----------------------------- */
  const validateTicket = useCallback(async (qrToken: string) => {
    const now = Date.now();
    if (now - cooldownRef.current < 800) return; // throttle
    cooldownRef.current = now;

    if (lastTokensRef.current.has(qrToken)) return;
    lastTokensRef.current.add(qrToken);
    setTimeout(() => lastTokensRef.current.delete(qrToken), 10_000);

    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scanner-validate', {
        body: { event_id: eventId, qr_token: qrToken }
      });
      if (error) throw error;

      const result: ScanResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...data,
        timestamp: new Date().toISOString()
      };

      setScanHistory(prev => [result, ...prev].slice(0, 200));
      setLastResult(result);
      vibrate(result.success);
      beep(result.success);

      toast({
        title: result.success ? '✅ Valid Ticket' : `❗ ${RESULT_LABEL[result.result] || 'Invalid'}`,
        description: result.message,
        variant: result.success ? 'default' : 'destructive'
      });
    } catch (err) {
      console.error('Validate error:', err);
      toast({
        title: "Error",
        description: "Failed to validate ticket",
        variant: "destructive"
      });
    } finally {
      setScanning(false);
    }
  }, [eventId, toast, soundOn]);

  const handleManualScan = async () => {
    const token = manualCode.trim();
    if (!token) {
      toast({ title: "Enter a code", description: "Please enter a ticket code", variant: "destructive" });
      return;
    }
    await validateTicket(token);
    setManualCode('');
  };

  /* --------------------------- Camera Handling ------------------------- */
  const enumerateVideoDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      const devs = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devs.filter(d => d.kind === 'videoinput');
      setDevices(videoDevs);
      // Prefer back camera
      const back = videoDevs.find(d => /back|rear|environment/i.test(d.label));
      setSelectedDeviceId(prev => prev ?? back?.deviceId ?? videoDevs[0]?.deviceId);
    } catch {
      // ignore
    }
  };

  const applyTorch = async (on: boolean) => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      // @ts-ignore
      const capabilities = track?.getCapabilities?.();
      // @ts-ignore
      const supportsTorch = capabilities?.torch;
      setTorchSupported(!!supportsTorch);
      if (!supportsTorch) return;
      await track?.applyConstraints?.({ advanced: [{ torch: on }] as any });
      setTorchOn(on);
    } catch {
      setTorchOn(false);
    }
  };

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Torch support probe
      await applyTorch(torchOn);

      // Use BarcodeDetector if available
      const Supported = 'BarcodeDetector' in window;
      if (!Supported) {
        toast({
          title: 'Camera scanning not supported',
          description: 'Your browser lacks QR detection. Use Manual mode or Upload Image.',
        });
        setScanMode('manual');
        stopCamera();
        return;
      }

      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

      const detect = async () => {
        if (!videoRef.current || paused) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const qr = codes?.[0]?.rawValue;
          if (qr) await validateTicket(qr);
        } catch { /* ignore frame */ }
        rafRef.current = requestAnimationFrame(detect);
      };
      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      console.error('Camera error:', err);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Check permissions.",
        variant: "destructive"
      });
      setScanMode('manual');
    }
  }, [toast, validateTicket, selectedDeviceId, paused, torchOn]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  }, []);

  const handleModeChange = (mode: 'manual' | 'camera') => {
    setScanMode(mode);
    if (mode === 'camera') startCamera();
    else stopCamera();
  };

  const handleVisibility = () => {
    if (document.hidden) {
      stopCamera();
    } else if (scanMode === 'camera') {
      startCamera();
    }
  };

  /* ----------------------- Keyboard Wedge Capture ---------------------- */
  const handleWedgeKeydown = (e: KeyboardEvent) => {
    // Ignore if focused in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;

    const isChar = e.key.length === 1;
    if (!isChar && e.key !== 'Enter') return;

    // Start/continue capture window (typical scanners type fast)
    if (wedgeTimerRef.current) window.clearTimeout(wedgeTimerRef.current);
    if (isChar) wedgeBufferRef.current += e.key;

    if (e.key === 'Enter') {
      const token = wedgeBufferRef.current.trim();
      wedgeBufferRef.current = '';
      if (token) validateTicket(token);
      return;
    }

    wedgeTimerRef.current = window.setTimeout(() => {
      const token = wedgeBufferRef.current.trim();
      wedgeBufferRef.current = '';
      if (token) validateTicket(token);
    }, 80); // small gap = end of scan
  };

  /* ------------------------------ Paste Hook --------------------------- */
  const handlePaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text')?.trim();
    if (text && scanMode === 'manual' && !document.activeElement) {
      setManualCode(text);
    }
  };

  /* --------------------------- Upload from Image ----------------------- */
  const scanFromImage = async (file: File) => {
    try {
      if (!('BarcodeDetector' in window)) {
        toast({
          title: 'QR detection unavailable',
          description: 'Try manual entry or camera mode in a supported browser.',
          variant: 'destructive'
        });
        return;
      }
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(bmp, 0, 0);
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(canvas as any);
      const qr = codes?.[0]?.rawValue;
      if (!qr) {
        toast({ title: 'No QR found', description: 'Try a clearer image.', variant: 'destructive' });
        return;
      }
      await validateTicket(qr);
    } catch (e) {
      console.error(e);
      toast({ title: 'Scan failed', description: 'Could not read QR from image.', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ------------------------------ Derived ------------------------------ */
  const totalScans = scanHistory.length;
  const validScans = scanHistory.filter(s => s.result === 'valid').length;
  const duplicateScans = scanHistory.filter(s => s.result === 'duplicate').length;
  const invalidScans = totalScans - validScans - duplicateScans;

  const exportCSV = () => {
    try {
      const rows = [
        ['Time', 'Result', 'Success', 'Attendee', 'Tier', 'TicketID', 'Message'],
        ...scanHistory.map(s => [
          new Date(s.timestamp).toISOString(),
          RESULT_LABEL[s.result] || s.result,
          s.success ? 'yes' : 'no',
          s.ticket?.attendee_name || '',
          s.ticket?.tier_name || '',
          s.ticket?.id || '',
          s.message.replace(/\n/g, ' ')
        ])
      ];
      const csv = rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan_history_${eventId}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not generate CSV file.', variant: 'destructive' });
    }
  };

  /* ------------------------------- UI --------------------------------- */
  if (authorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Checking authorization…</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Ban className="h-16 w-16 text-destructive mx-auto" />
            <p className="text-muted-foreground">You don’t have permission to scan tickets for this event.</p>
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button onClick={onBack} variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Ticket Scanner</h1>
                {event && <p className="text-sm text-muted-foreground">{event.title}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {userRole === 'owner' ? 'Organizer' : userRole === 'editor' ? 'Editor' : 'Scanner'}
              </Badge>

              {/* Sound toggle */}
              <Button
                variant="ghost"
                size="icon"
                aria-label={soundOn ? 'Disable sound' : 'Enable sound'}
                onClick={() => setSoundOn(s => !s)}
                title={soundOn ? 'Sound on' : 'Sound off'}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>

              {/* Pause/Resume */}
              {scanMode === 'camera' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPaused(p => !p)}
                  title={paused ? 'Resume scanning' : 'Pause scanning'}
                  aria-pressed={paused}
                >
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              )}

              {/* Torch */}
              {scanMode === 'camera' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => applyTorch(!torchOn)}
                  disabled={!torchSupported}
                  title={!torchSupported ? 'Torch not supported' : torchOn ? 'Turn torch off' : 'Turn torch on'}
                >
                  <Flashlight className={`h-4 w-4 ${torchOn ? 'text-yellow-500' : ''}`} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Last Result Banner */}
        {lastResult && (
          <div
            className={`rounded-lg p-3 text-sm ${
              lastResult.success ? 'bg-green-500/15 text-green-200 border border-green-500/30' : 'bg-red-500/15 text-red-200 border border-red-500/30'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">
                  {lastResult.success ? 'Valid Ticket' : RESULT_LABEL[lastResult.result] || 'Invalid'}
                </div>
                <div className="opacity-80">{lastResult.message}</div>
              </div>
              <Badge variant="outline" className="text-xs">
                {new Date(lastResult.timestamp).toLocaleTimeString()}
              </Badge>
            </div>
          </div>
        )}

        {/* Scanner Interface */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Scan Tickets
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={scanMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('manual')}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Manual
                </Button>
                <Button
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('camera')}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanMode === 'manual' ? (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter ticket code manually"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
                    disabled={scanning}
                  />
                  <Button onClick={handleManualScan} disabled={scanning || !manualCode.trim()}>
                    {scanning ? 'Validating…' : 'Scan'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="w-3.5 h-3.5" />
                  Tip: paste a code (Ctrl/Cmd+V) or use a hardware scanner—input is captured automatically.
                </div>
              </>
            ) : (
              <>
                {/* Device picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="border rounded-md px-2 py-1 text-sm"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                  >
                    {devices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(-4)}`}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => enumerateVideoDevices().then(() => startCamera())}
                    title="Refresh cameras"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Cameras
                  </Button>

                  <div className="ml-auto flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) scanFromImage(f);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      title="Scan a QR from an image"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      From Image
                    </Button>
                  </div>
                </div>

                <div className="bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                    muted
                    aria-label="Camera preview"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Point your camera at a QR code to scan.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-primary">{totalScans}</div><p className="text-xs text-muted-foreground">Total Scans</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-green-600">{validScans}</div><p className="text-xs text-muted-foreground">Valid</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-yellow-600">{duplicateScans}</div><p className="text-xs text-muted-foreground">Duplicates</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-destructive">{invalidScans}</div><p className="text-xs text-muted-foreground">Invalid</p></CardContent></Card>
        </div>

        {/* Scan History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Scans</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setScanHistory([]);
                    localStorage.removeItem(historyKey);
                  }}
                  title="Clear history"
                >
                  Clear
                </Button>
                <Button size="sm" variant="outline" onClick={exportCSV} title="Export CSV">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {scanHistory.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No scans yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.slice(0, 12).map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          scan.result === 'valid'
                            ? 'bg-green-600'
                            : scan.result === 'duplicate'
                            ? 'bg-yellow-600'
                            : scan.result === 'expired'
                            ? 'bg-orange-600'
                            : 'bg-destructive'
                        }`}
                        aria-hidden
                      />
                      <div>
                        <p className="font-medium">{scan.ticket ? scan.ticket.attendee_name : 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="truncate max-w-[52vw] md:max-w-[38rem]">{scan.message}</span>
                          {scan.ticket?.badge_label && (
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {scan.ticket.badge_label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {RESULT_LABEL[scan.result] || 'Invalid'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(scan.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ScannerPage;