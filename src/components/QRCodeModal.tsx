import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Copy, Share, Loader2 } from 'lucide-react';
import { generateQRData, generateQRCodeSVG } from '@/lib/qrCode';
import { UserTicket } from '@/hooks/useTickets';

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
}

export function QRCodeModal({ ticket, user, onClose, onCopy, onShare }: QRCodeModalProps) {
  const [qrCodeSVG, setQrCodeSVG] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrData = generateQRData({
          id: ticket.id,
          eventId: ticket.eventId,
          qrCode: ticket.qrCode,
          userId: user.id
        });
        
        const svg = await generateQRCodeSVG(qrData, 200);
        setQrCodeSVG(svg);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, [ticket, user]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Event Ticket</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="font-semibold">{ticket.eventTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(ticket.eventDate).toLocaleDateString()} at {ticket.eventTime}
            </p>
            <p className="text-sm text-muted-foreground">{ticket.eventLocation}</p>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-lg">
            {loading ? (
              <Loader2 className="w-16 h-16 animate-spin text-muted-foreground" />
            ) : (
              <div
                className="w-[200px] h-[200px]"
                dangerouslySetInnerHTML={{ __html: qrCodeSVG }}
              />
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>Ticket ID: {ticket.id.slice(0, 8)}...</p>
            <p>Show this QR code at entry</p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onCopy(ticket)}
              disabled={loading}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onShare(ticket)}
              disabled={loading}
            >
              <Share className="w-3 h-3 mr-1" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}