/**
 * QR Code Generation Utility
 * Generates QR codes for tickets using the qrcode library
 */
import QRCode from 'qrcode';

export interface QRCodeData {
  ticketId: string;
  eventId: string;
  userId: string;
  timestamp: number;
  signature: string;
}

export function generateQRData(ticket: {
  id: string;
  eventId: string;
  qrCode?: string;
  userId?: string;
}): QRCodeData {
  const timestamp = Date.now();
  const signature = generateSignature(ticket.id, ticket.eventId, timestamp);
  
  return {
    ticketId: ticket.id,
    eventId: ticket.eventId,
    userId: ticket.userId || '', // Will be filled by the backend if not provided
    timestamp,
    signature
  };
}

function generateSignature(ticketId: string, eventId: string, timestamp: number): string {
  // Simple signature generation - in production, use proper cryptographic signing
  const data = `${ticketId}-${eventId}-${timestamp}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function generateQRCodeSVG(data: QRCodeData, size: number = 200): Promise<string> {
  const qrDataString = JSON.stringify({
    ticketId: data.ticketId,
    eventId: data.eventId,
    timestamp: data.timestamp,
    signature: data.signature
  });
  
  return await QRCode.toString(qrDataString, {
    type: 'svg',
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

export async function generateQRCodeDataURL(data: QRCodeData, size: number = 200): Promise<string> {
  const qrDataString = JSON.stringify({
    ticketId: data.ticketId,
    eventId: data.eventId,
    timestamp: data.timestamp,
    signature: data.signature
  });
  
  return await QRCode.toDataURL(qrDataString, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

export function copyQRDataToClipboard(data: QRCodeData): Promise<void> {
  const qrText = `YardPass Ticket\nID: ${data.ticketId}\nEvent: ${data.eventId}\nTime: ${new Date(data.timestamp).toLocaleString()}\nCode: ${data.signature}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(qrText);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = qrText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}

export function shareQRData(data: QRCodeData): Promise<void> {
  const shareData = {
    title: 'YardPass Ticket',
    text: `My ticket for event ${data.eventId}`,
    url: `${window.location.origin}/ticket/${data.ticketId}`
  };
  
  if (navigator.share && navigator.canShare(shareData)) {
    return navigator.share(shareData);
  } else {
    // Fallback to clipboard
    return copyQRDataToClipboard(data);
  }
}
