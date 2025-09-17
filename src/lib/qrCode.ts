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
    errorCorrectionLevel: 'H', // High error correction to accommodate logo
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

export async function generateQRCodeWithLogo(data: QRCodeData, size: number = 200): Promise<string> {
  console.log('🔍 Generating QR code with logo, size:', size);
  
  const qrDataString = JSON.stringify({
    ticketId: data.ticketId,
    eventId: data.eventId,
    timestamp: data.timestamp,
    signature: data.signature
  });
  
  // Generate base QR code with high error correction
  const baseSvg = await QRCode.toString(qrDataString, {
    type: 'svg',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H', // High error correction allows for logo overlay
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  
  console.log('✅ Base QR code generated');
  
  // Calculate logo size (approximately 20% of QR code size)
  const logoSize = Math.floor(size * 0.2);
  const logoPosition = (size - logoSize) / 2;
  
  console.log('📐 Logo dimensions:', { logoSize, logoPosition });
  
  // Create logo SVG element with YardPass logo
  const logoSvg = `
    <g transform="translate(${logoPosition}, ${logoPosition})">
      <!-- White background circle for logo -->
      <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2 + 4}" fill="white" stroke="#000000" stroke-width="2"/>
      <!-- YardPass logo with fallback -->
      <foreignObject x="4" y="4" width="${logoSize - 8}" height="${logoSize - 8}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; overflow: hidden; background: #6366f1;">
          <img src="/yardpass-logo.png" style="width: 80%; height: 80%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <div style="display: none; color: white; font-weight: bold; font-size: ${Math.floor(logoSize/6)}px;">YP</div>
        </div>
      </foreignObject>
    </g>
  `;
  
  console.log('🎨 Logo SVG created');
  
  // Insert logo into the QR code SVG
  const svgWithLogo = baseSvg.replace('</svg>', logoSvg + '</svg>');
  
  console.log('✅ QR code with logo generated successfully');
  return svgWithLogo;
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
    errorCorrectionLevel: 'H', // High error correction for logo compatibility
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

export async function generateQRCodeDataURLWithLogo(data: QRCodeData, size: number = 200): Promise<string> {
  // Create a canvas to combine QR code and logo
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  
  canvas.width = size;
  canvas.height = size;
  
  // Generate base QR code
  const qrDataUrl = await generateQRCodeDataURL(data, size);
  
  return new Promise((resolve, reject) => {
    const qrImage = new Image();
    qrImage.onload = () => {
      // Draw QR code
      ctx.drawImage(qrImage, 0, 0, size, size);
      
      // Calculate logo position and size
      const logoSize = Math.floor(size * 0.2);
      const logoPosition = (size - logoSize) / 2;
      
      // Draw white background circle for logo
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(logoPosition + logoSize/2, logoPosition + logoSize/2, logoSize/2 + 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Load and draw the YardPass logo
      const logoImage = new Image();
      logoImage.onload = () => {
        // Create circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoPosition + logoSize/2, logoPosition + logoSize/2, logoSize/2 - 2, 0, 2 * Math.PI);
        ctx.clip();
        
        // Draw logo
        ctx.drawImage(logoImage, logoPosition + 4, logoPosition + 4, logoSize - 8, logoSize - 8);
        ctx.restore();
        
        resolve(canvas.toDataURL('image/png'));
      };
      logoImage.onerror = () => {
        // Fallback to text if logo fails to load
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(logoPosition + logoSize/2, logoPosition + logoSize/2, logoSize/2 - 2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = `bold ${logoSize/4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YP', logoPosition + logoSize/2, logoPosition + logoSize/2);
        
        resolve(canvas.toDataURL('image/png'));
      };
      logoImage.src = '/yardpass-logo.png';
    };
    qrImage.onerror = reject;
    qrImage.src = qrDataUrl;
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
