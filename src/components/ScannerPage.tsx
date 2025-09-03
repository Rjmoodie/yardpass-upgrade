import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  ArrowLeft,
  ScanLine,
  Search,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  AlertCircle
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface ScannerPageProps {
  user: User;
  onBack: () => void;
}

// Mock scanning data
const mockScanResults = [
  {
    id: '1',
    ticketCode: 'VIP-SMF2024-001',
    attendeeName: 'John Smith',
    eventTitle: 'Summer Music Festival 2024',
    tierName: 'VIP Experience',
    badge: 'VIP',
    scanTime: new Date().toISOString(),
    status: 'valid',
    checkInTime: null
  },
  {
    id: '2',
    ticketCode: 'GA-SMF2024-456',
    attendeeName: 'Sarah Johnson',
    eventTitle: 'Summer Music Festival 2024',
    tierName: 'General Admission',
    badge: 'GA',
    scanTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    status: 'already_checked_in',
    checkInTime: new Date(Date.now() - 300000).toISOString()
  }
];

export function ScannerPage({ user, onBack }: ScannerPageProps) {
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [scanHistory, setScanHistory] = useState(mockScanResults);
  const [scanning, setScanning] = useState(false);

  const handleManualScan = () => {
    if (!manualCode.trim()) return;
    
    setScanning(true);
    
    // Mock scan processing
    setTimeout(() => {
      const newScan = {
        id: Date.now().toString(),
        ticketCode: manualCode,
        attendeeName: 'Unknown Attendee',
        eventTitle: 'Current Event',
        tierName: 'Unknown Tier',
        badge: 'TBD',
        scanTime: new Date().toISOString(),
        status: Math.random() > 0.3 ? 'valid' : 'invalid',
        checkInTime: null
      };
      
      setScanHistory([newScan, ...scanHistory]);
      setManualCode('');
      setScanning(false);
    }, 1500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-600';
      case 'invalid':
        return 'text-red-600';
      case 'already_checked_in':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'invalid':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'already_checked_in':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Valid - Check In Successful';
      case 'invalid':
        return 'Invalid Ticket';
      case 'already_checked_in':
        return 'Already Checked In';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Event Scanner</h1>
            <p className="text-sm text-muted-foreground">
              Scan tickets for event check-in
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            Scanner Mode
          </Badge>
        </div>
      </div>

      {/* Scanner Interface */}
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Ticket Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scanner Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={scanMode === 'manual' ? 'default' : 'outline'}
                onClick={() => setScanMode('manual')}
                className="flex-1"
              >
                Manual Entry
              </Button>
              <Button
                variant={scanMode === 'camera' ? 'default' : 'outline'}
                onClick={() => setScanMode('camera')}
                className="flex-1"
              >
                Camera Scan
              </Button>
            </div>

            {scanMode === 'manual' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter ticket code..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                    className="flex-1"
                  />
                  <Button onClick={handleManualScan} disabled={scanning || !manualCode.trim()}>
                    {scanning ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Type or scan the ticket code to check attendee in
                </p>
              </div>
            )}

            {scanMode === 'camera' && (
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <ScanLine className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Camera scanner would appear here
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Point camera at QR code to scan
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {scanHistory.filter(s => s.status === 'valid').length}
              </div>
              <div className="text-xs text-muted-foreground">Valid Scans</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {scanHistory.filter(s => s.status === 'already_checked_in').length}
              </div>
              <div className="text-xs text-muted-foreground">Duplicates</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {scanHistory.filter(s => s.status === 'invalid').length}
              </div>
              <div className="text-xs text-muted-foreground">Invalid</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scan History */}
      <div className="flex-1 overflow-auto">
        <Card className="m-4">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanHistory.map((scan) => (
                <div key={scan.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getStatusIcon(scan.status)}
                  </div>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                      {scan.attendeeName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scan.attendeeName}</span>
                      <Badge variant="outline" className="text-xs">
                        {scan.badge}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className={getStatusColor(scan.status)}>
                        {getStatusText(scan.status)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(scan.scanTime).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {scan.ticketCode}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ScannerPage;