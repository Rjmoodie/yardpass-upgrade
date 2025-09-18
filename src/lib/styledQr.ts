// src/lib/styledQr.ts
import type { QRCodeData } from './qrCode';

const isBrowser = typeof window !== 'undefined';

type DotType =
  | 'dots' | 'rounded' | 'classy' | 'classy-rounded'
  | 'square' | 'extra-rounded';

export type StyledQrOptions = {
  size?: number;              // px
  margin?: number;            // quiet zone
  darkColor?: string;         // modules
  lightColor?: string;        // background
  logoUrl?: string;           // center icon
  logoMargin?: number;        // white padding around logo
  logoSizeRatio?: number;     // 0.18–0.28 is safe
  dotsType?: DotType;         // 'rounded' matches your example
  cornersSquareType?: 'dot' | 'square' | 'extra-rounded';
  cornersDotType?: 'dot' | 'square';
  format?: 'png' | 'svg';     // export format
};

function payloadString(d: QRCodeData) {
  return JSON.stringify({ t: d.ticketId, e: d.eventId, ts: d.timestamp, s: d.signature });
}

/**
 * Generates a styled QR as data URL (PNG or SVG).
 * Falls back to your plain generator if not in browser.
 */
export async function generateStyledQRDataURL(
  data: QRCodeData,
  {
    size = 512,
    margin = 16,
    darkColor = '#000000',
    lightColor = '#FFFFFF',
    logoUrl,
    logoMargin = 6,
    logoSizeRatio = 0.22,
    dotsType = 'rounded',
    cornersSquareType = 'extra-rounded',
    cornersDotType = 'dot',
    format = 'png',
  }: StyledQrOptions = {}
): Promise<string> {
  if (!isBrowser) {
    // fallback to the basic png from your enhanced lib
    const { generateQRCodeDataURL } = await import('./qrCode');
    return generateQRCodeDataURL(data, size);
  }

  // dynamic import to avoid SSR issues
  const QRCodeStyling = (await import('qr-code-styling')).default;

  const qr = new QRCodeStyling({
    width: size,
    height: size,
    margin,
    // type: format, // 'png' or 'svg' - removed as this conflicts with DrawType
    data: payloadString(data),
    image: logoUrl,
    qrOptions: {
      errorCorrectionLevel: 'H',
    },
    backgroundOptions: {
      color: lightColor,
    },
    dotsOptions: {
      type: dotsType,           // rounded dots
      color: darkColor,
    },
    cornersSquareOptions: {
      type: cornersSquareType,  // thick rounded finder squares
      color: darkColor,
    },
    cornersDotOptions: {
      type: cornersDotType,     // center dot in finder eyes
      color: darkColor,
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: logoMargin,
      imageSize: logoSizeRatio, // portion of QR width
      hideBackgroundDots: false // set true if contrast is low
    },
  });

  // Render to an offscreen canvas/svg and export as data URL
  const el = document.createElement('div');
  await qr.append(el);

  if (format === 'svg') {
    const blob = await qr.getRawData('svg') as Blob;
    return await blobToDataUrl(blob);
  } else {
    const blob = await qr.getRawData('png') as Blob;
    return await blobToDataUrl(blob);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}