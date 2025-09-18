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
  logoUrl?: string;        // your brand mark (PNG/SVG/data URI)
  logoMargin?: number;     // px "padding" around logo inside badge
  logoSizeRatio?: number;  // 0.18–0.28 of QR width
  dotsType?: DotType;
  cornersSquareType?: 'dot' | 'square' | 'extra-rounded';
  cornersDotType?: 'dot' | 'square';
  /** Optional corner colors (finder eyes) */
  cornersColor?: string;
  format?: 'png' | 'svg';

  // NEW: backer badge behind logo
  logoBackerShape?: 'circle' | 'squircle';
  logoBackerFill?: string;         // default white
  logoBackerStroke?: string;       // default #0000001A (subtle)
  logoBackerStrokeWidth?: number;  // default 1.5
  logoShadow?: boolean;            // soft drop shadow
};

// Build an SVG badge that contains the logo clipped inside a circle/squircle
function buildLogoBadgeDataUri(opts: {
  logoUrl: string;
  sizePx: number;              // canvas for the badge (we'll scale anyway)
  marginPx: number;            // inner padding
  shape: 'circle' | 'squircle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadow: boolean;
}) {
  try {
    const { logoUrl, sizePx, marginPx, shape, fill, stroke, strokeWidth, shadow } = opts;
    const s = sizePx;
    const inner = s - marginPx * 2;
    const radius = s / 2;

    const clip =
      shape === 'circle'
        ? `<clipPath id="clip"><circle cx="${radius}" cy="${radius}" r="${radius - marginPx}"/></clipPath>`
        : `<clipPath id="clip"><rect x="${marginPx}" y="${marginPx}" width="${inner}" height="${inner}" rx="${Math.round(inner * 0.22)}"/></clipPath>`;

    const backer =
      shape === 'circle'
        ? `<circle cx="${radius}" cy="${radius}" r="${radius - strokeWidth/2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
        : `<rect x="${strokeWidth/2}" y="${strokeWidth/2}" width="${s - strokeWidth}" height="${s - strokeWidth}" rx="${Math.round((s - strokeWidth)*0.25)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

    const filter = shadow
      ? `<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
           <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
         </filter>`
      : '';

    const filterAttr = shadow ? 'filter="url(#shadow)"' : '';

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <defs>
        ${clip}
        ${filter}
      </defs>
      <g ${filterAttr}>
        ${backer}
        <image href="${logoUrl}" x="${marginPx}" y="${marginPx}" width="${inner}" height="${inner}" clip-path="url(#clip)" preserveAspectRatio="xMidYMid meet" />
      </g>
    </svg>`.trim();

    const encoded = typeof window === 'undefined'
      ? Buffer.from(svg).toString('base64')
      : btoa(unescape(encodeURIComponent(svg)));
    
    const result = `data:image/svg+xml;base64,${encoded}`;
    console.log('✅ Badge generated successfully, length:', result.length);
    return result;
  } catch (error) {
    console.error('❌ Failed to generate badge:', error);
    return undefined;
  }
}

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
    darkColor = '#111',
    lightColor = '#fff',
    dotsGradient,
    logoUrl,
    logoMargin = 8,           // ↑ give logo more breathing room
    logoSizeRatio = 0.24,     // ↑ slightly larger but still safe
    dotsType = 'rounded',
    cornersSquareType = 'extra-rounded',
    cornersDotType = 'dot',
    cornersColor,
    format = 'png',
    // backer defaults
    logoBackerShape = 'circle',
    logoBackerFill = '#ffffff',
    logoBackerStroke = '#0000001A',
    logoBackerStrokeWidth = 1.5,
    logoShadow = true,
  }: StyledQrOptions = {}
): Promise<string> {
  if (!isBrowser) {
    // fallback to the basic png from your enhanced lib
    const { generateQRCodeDataURL } = await import('./qrCode');
    return generateQRCodeDataURL(data, size);
  }

  // dynamic import to avoid SSR issues
  const QRCodeStyling = (await import('qr-code-styling')).default;

  // Build a badge-wrapped logo (data URI), so it always has a white backer
  const badgeDataUri = logoUrl
    ? buildLogoBadgeDataUri({
        logoUrl,
        sizePx: 256,
        marginPx: logoMargin,
        shape: logoBackerShape,
        fill: logoBackerFill,
        stroke: logoBackerStroke,
        strokeWidth: logoBackerStrokeWidth,
        shadow: logoShadow,
      })
    : undefined;

  console.log('🎯 QR Badge Debug:', { logoUrl, badgeDataUri: badgeDataUri?.slice(0, 50) + '...' });

  const qr = new QRCodeStyling({
    width: size,
    height: size,
    margin,
    // type: format, // 'png' or 'svg' - removed as this conflicts with DrawType
    data: payloadString(data),
    image: badgeDataUri,           // use badge (not raw logo)
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
      margin: 0,                    // padding handled inside badge
      imageSize: logoSizeRatio,
      hideBackgroundDots: true,     // ← clear modules behind the logo
    },
  });

  // Render to an offscreen canvas/svg and export as data URL
  const el = document.createElement('div');
  await qr.append(el);

  const blob = (await qr.getRawData(format)) as Blob;
  return await new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
}
