import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera, Keyboard, CheckCircle, XCircle, AlertTriangle, Clock, Ban, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScannerPageProps {
  eventId: string;
  onBack: () => void;
}

interface ScanResult {
  id: string;
  success: boolean;
  result: 'valid' | 'duplicate' | 'expired' | 'invalid' | 'wrong_event' | 'refunded' | 'void';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    checkAuthorization();
    fetchEvent();
    return () => {
      stopCamera();
    };
  }, [eventId]);

  const checkAuthorization = async () => {
    if (!user) {
      setAuthorized(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('scanner-authorize', {
        body: { event_id: eventId }
      });

      if (error) {
        console.error('Authorization error:', error);
        setAuthorized(false);
        return;
      }

      const response: AuthorizeResponse = data;
      setAuthorized(response.allowed);
      setUserRole(response.role);
    } catch (error) {
      console.error('Error checking authorization:', error);
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

      if (error) {
        console.error('Error fetching event:', error);
        return;
      }

      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const handleManualScan = async () => {
    if (!manualCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a ticket code",
        variant: "destructive"
      });
      return;
    }

    await validateTicket(manualCode.trim());
    setManualCode('');
  };

  const validateTicket = async (qrToken: string) => {
    setScanning(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('scanner-validate', {
        body: { 
          event_id: eventId,
          qr_token: qrToken
        }
      });

      if (error) {
        console.error('Validation error:', error);
        toast({
          title: "Error",
          description: "Failed to validate ticket",
          variant: "destructive"
        });
        return;
      }

      const result: ScanResult = {
        id: Date.now().toString(),
        ...data,
        timestamp: new Date().toISOString()
      };

      setScanHistory(prev => [result, ...prev.slice(0, 49)]); // Keep last 50 scans

      // Show toast with result
      const isSuccess = result.success;
      toast({
        title: isSuccess ? "✅ Valid Ticket" : getResultIcon(result.result) + " " + getResultTitle(result.result),
        description: result.message,
        variant: isSuccess ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Error validating ticket:', error);
      toast({
        title: "Error",
        description: "Failed to validate ticket",
        variant: "destructive"
      });
    } finally {
      setScanning(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleModeChange = (mode: 'manual' | 'camera') => {
    setScanMode(mode);
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'valid': return '✅';
      case 'duplicate': return '⚠️';
      case 'expired': return '⏳';
      case 'wrong_event': return '⛔';
      case 'refunded': case 'void': return '❌';
      default: return '❌';
    }
  };

  const getResultTitle = (result: string) => {
    switch (result) {
      case 'valid': return 'Valid';
      case 'duplicate': return 'Already Scanned';
      case 'expired': return 'Expired';
      case 'wrong_event': return 'Wrong Event';
      case 'refunded': return 'Refunded';
      case 'void': return 'Void';
      default: return 'Invalid';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'valid': return 'bg-green-500';
      case 'duplicate': return 'bg-yellow-500';
      case 'expired': return 'bg-orange-500';
      case 'wrong_event': case 'refunded': case 'void': case 'invalid': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Calculate stats
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Checking authorization...</p>
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
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Ban className="h-16 w-16 text-red-500 mx-auto" />
            <p className="text-muted-foreground">
              You don't have permission to scan tickets for this event.
            </p>
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
                {event && (
                  <p className="text-sm text-muted-foreground">{event.title}</p>
                )}
              </div>
            </div>
            <Badge variant="secondary">
              {userRole === 'owner' ? 'Organizer' : userRole === 'editor' ? 'Editor' : 'Scanner'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
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
                    onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                    disabled={scanning}
                  />
                  <Button 
                    onClick={handleManualScan} 
                    disabled={scanning || !manualCode.trim()}
                  >
                    {scanning ? 'Validating...' : 'Scan'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Point your camera at a QR code to scan
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalScans}</div>
                <p className="text-xs text-muted-foreground">Total Scans</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{validScans}</div>
                <p className="text-xs text-muted-foreground">Valid</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{duplicateScans}</div>
                <p className="text-xs text-muted-foreground">Duplicates</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{invalidScans}</div>
                <p className="text-xs text-muted-foreground">Invalid</p>
              </div>
            </CardContent>
          </Card>
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
                      <div className={`w-3 h-3 rounded-full ${getResultColor(scan.result)}`} />
                      <div>
                        <p className="font-medium">
                          {scan.ticket ? scan.ticket.attendee_name : 'Unknown'}
                        </p>
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
                        {getResultIcon(scan.result)} {getResultTitle(scan.result)}
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