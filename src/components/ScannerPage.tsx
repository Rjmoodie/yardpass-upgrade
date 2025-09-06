import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera, Keyboard, Ban, QrCode, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cooldownRef = useRef<number>(0);
  const lastTokensRef = useRef<Set<string>>(new Set()); // prevent dup in rapid sequence
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    checkAuthorization();
    fetchEvent();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkAuthorization = async () => {
    if (!user) {
      setAuthorized(false);
      return;
    }
    if (!eventId?.trim()) {
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

  const validateTicket = useCallback(async (qrToken: string) => {
    // Cooldown to avoid spamming
    const now = Date.now();
    if (now - cooldownRef.current < 1200) return; // 1.2s guard
    cooldownRef.current = now;

    // Prevent same token burst
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
        id: Date.now().toString(),
        ...data,
        timestamp: new Date().toISOString()
      };

      setScanHistory(prev => [result, ...prev.slice(0, 49)]);
      setLastResult(result);

      // Feedback
      if ('vibrate' in navigator) {
        try { navigator.vibrate?.(result.success ? 20 : [10, 60, 10]); } catch {}
      }
      if (soundOn) {
        // tiny beep using WebAudio
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = result.success ? 880 : 220;
          o.connect(g); g.connect(ctx.destination);
          g.gain.value = 0.03;
          o.start();
          setTimeout(() => { o.stop(); ctx.close(); }, 120);
        } catch {}
      }

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
  }, [eventId, soundOn, toast]);

  const handleManualScan = async () => {
    const token = manualCode.trim();
    if (!token) {
      toast({ title: "Enter a code", description: "Please enter a ticket code", variant: "destructive" });
      return;
    }
    await validateTicket(token);
    setManualCode('');
  };

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();

        // Try BarcodeDetector first
        // @ts-ignore
        const Supported = ('BarcodeDetector' in window);
        if (Supported) {
          // @ts-ignore
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const detect = async () => {
            if (!videoRef.current) return;
            try {
              // @ts-ignore
              const codes = await detector.detect(videoRef.current);
              const qr = codes?.[0]?.rawValue;
              if (qr) await validateTicket(qr);
            } catch {}
            rafRef.current = requestAnimationFrame(detect);
          };
          rafRef.current = requestAnimationFrame(detect);
        } else {
          // Fallback: manual only (no jsQR dependency here)
          toast({
            title: 'Camera scanning not supported',
            description: 'Your browser lacks QR detection. Use Manual mode.',
          });
          setScanMode('manual');
          stopCamera();
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Check permissions.",
        variant: "destructive"
      });
      setScanMode('manual');
    }
  }, [toast, validateTicket]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleModeChange = (mode: 'manual' | 'camera') => {
    setScanMode(mode);
    if (mode === 'camera') startCamera();
    else stopCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Stats
  const totalScans = scanHistory.length;
  const validScans = scanHistory.filter(s => s.result === 'valid').length;
  const duplicateScans = scanHistory.filter(s => s.result === 'duplicate').length;
  const invalidScans = totalScans - validScans - duplicateScans;

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
          <div className="flex items-center justify-between">
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
              <Button
                variant="ghost"
                size="icon"
                aria-label={soundOn ? 'Disable sound' : 'Enable sound'}
                onClick={() => setSoundOn(s => !s)}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Last result banner */}
        {lastResult && (
          <div
            className={`rounded-lg p-3 text-sm ${
              lastResult.success ? 'bg-green-500/15 text-green-200 border border-green-500/30' : 'bg-red-500/15 text-red-200 border border-red-500/30'
            }`}
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
            <div className="flex items-center justify-between">
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
          <CardContent>
            {scanMode === 'manual' ? (
              <div className="space-y-4">
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
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                    muted
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Point your camera at a QR code to scan.
                </p>
              </div>
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
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            {scanHistory.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No scans yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.slice(0, 10).map((scan) => (
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
                      />
                      <div>
                        <p className="font-medium">{scan.ticket ? scan.ticket.attendee_name : 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{scan.message}</span>
                          {scan.ticket?.badge_label && (
                            <Badge variant="outline" className="text-xs">
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
