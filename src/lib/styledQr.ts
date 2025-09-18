// src/lib/styledQr.ts
import type { QRCodeData } from './qrCode';

const isBrowser = typeof window !== 'undefined';

type DotType =
  | 'dots' | 'rounded' | 'classy' | 'classy-rounded'
  | 'square' | 'extra-rounded';

export type StyledQrGradient = {
  type?: 'linear' | 'radial';
  rotation?: number; // for linear, radians
  colorStops: { offset: number; color: string }[];
};

export type StyledQrOptions = {
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  /** BRAND: module (dots) gradient */
  dotsGradient?: StyledQrGradient;
  logoUrl?: string;
  logoMargin?: number;
  logoSizeRatio?: number;
  dotsType?: DotType;
  cornersSquareType?: 'dot' | 'square' | 'extra-rounded';
  cornersDotType?: 'dot' | 'square';
  /** Optional corner colors (finder eyes) */
  cornersColor?: string;
  format?: 'png' | 'svg';
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
    darkColor = '#000',
    lightColor = '#fff',
    dotsGradient,
    logoUrl,
    logoMargin = 6,
    logoSizeRatio = 0.22,
    dotsType = 'rounded',
    cornersSquareType = 'extra-rounded',
    cornersDotType = 'dot',
    cornersColor,
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
      ...(dotsGradient ? { gradient: dotsGradient } : {}),
    } as any,
    cornersSquareOptions: {
      type: cornersSquareType,  // thick rounded finder squares
      color: cornersColor ?? darkColor,
    },
    cornersDotOptions: {
      type: cornersDotType,     // center dot in finder eyes
      color: cornersColor ?? darkColor,
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