/**
 * QR Code Generation Utility
 * Generates QR codes for tickets using a simple pattern-based approach
 * In production, you would use a library like 'qrcode' or 'react-qr-code'
 */

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

export function generateQRCodeSVG(data: QRCodeData, size: number = 200): string {
  // Generate a simple QR-like pattern
  // In production, use a proper QR code library
  const pattern = generateQRPattern(data);
  
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="white"/>
      ${pattern}
    </svg>
  `;
}

function generateQRPattern(data: QRCodeData): string {
  const size = 25; // 25x25 grid
  const cellSize = 8;
  const pattern: string[] = [];
  
  // Generate a deterministic pattern based on the data
  const seed = data.signature;
  let seedNum = parseInt(seed, 16);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Use seed to determine if cell should be black
      seedNum = (seedNum * 1103515245 + 12345) & 0x7fffffff;
      const isBlack = (seedNum % 3) === 0;
      
      if (isBlack) {
        pattern.push(
          `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`
        );
      }
    }
  }
  
  return pattern.join('');
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
