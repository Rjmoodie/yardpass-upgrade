// src/lib/styledQr.ts - Premium QR Code Generation with Branded Styling
import type { QRCodeData } from './qrCode';

const isBrowser = typeof window !== 'undefined';

type DotType =
  | 'dots' | 'rounded' | 'classy' | 'classy-rounded'
  | 'square' | 'extra-rounded';

/**
 * Gradient configuration for QR code dots
 */
export type StyledQrGradient = {
  type?: 'linear' | 'radial';
  rotation?: number; // for linear, in radians
  colorStops: { offset: number; color: string }[];
};

/**
 * Comprehensive options for styled QR code generation
 */
export type StyledQrOptions = {
  // Base QR settings
  size?: number;                    // default 512px (retina quality)
  margin?: number;                  // default 16px (quiet zone)
  darkColor?: string;               // default '#111111'
  lightColor?: string;              // default '#ffffff'
  
  // Premium styling
  dotsGradient?: StyledQrGradient;  // gradient for modules
  dotsType?: DotType;               // default 'rounded'
  cornersSquareType?: 'dot' | 'square' | 'extra-rounded'; // finder eye squares
  cornersDotType?: 'dot' | 'square'; // finder eye centers
  cornersColor?: string;            // override finder eye color
  
  // Logo badge configuration
  logoUrl?: string;                 // brand logo (PNG/SVG/data URI)
  logoMargin?: number;              // padding inside badge (default 8px)
  logoSizeRatio?: number;           // 0.18–0.24 of QR width (default 0.22)
  logoBackerShape?: 'circle' | 'squircle'; // badge shape
  logoBackerFill?: string;          // badge background (default white)
  logoBackerStroke?: string;        // badge border (default subtle gray)
  logoBackerStrokeWidth?: number;   // border width (default 1.5px)
  logoShadow?: boolean;             // soft drop shadow (default true)
  
  // Export format
  format?: 'png' | 'svg';           // output format
};

/**
 * Creates an inline SVG badge containing the logo with proper styling
 * Returns a data URI that can be used directly in qr-code-styling
 */
function buildLogoBadgeDataUri(opts: {
  logoUrl: string;
  sizePx: number;              // canvas size for the badge
  marginPx: number;            // inner padding around logo
  shape: 'circle' | 'squircle';
  fill: string;                // background color
  stroke: string;              // border color
  strokeWidth: number;         // border width
  shadow: boolean;             // drop shadow
}): string | undefined {
  try {
    const { logoUrl, sizePx, marginPx, shape, fill, stroke, strokeWidth, shadow } = opts;
    const s = sizePx;
    const inner = s - marginPx * 2;
    const radius = s / 2;
    const cornerRadius = shape === 'squircle' ? Math.round(inner * 0.22) : 0;

    // Clipping path for logo
    const clipPath = shape === 'circle'
      ? `<clipPath id="logoClip"><circle cx="${radius}" cy="${radius}" r="${radius - marginPx}"/></clipPath>`
      : `<clipPath id="logoClip"><rect x="${marginPx}" y="${marginPx}" width="${inner}" height="${inner}" rx="${cornerRadius}"/></clipPath>`;

    // Badge background with border
    const backgroundShape = shape === 'circle'
      ? `<circle cx="${radius}" cy="${radius}" r="${radius - strokeWidth/2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
      : `<rect x="${strokeWidth/2}" y="${strokeWidth/2}" width="${s - strokeWidth}" height="${s - strokeWidth}" rx="${Math.round((s - strokeWidth)*0.25)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

    // Optional drop shadow filter
    const shadowFilter = shadow
      ? `<filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
           <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.15"/>
         </filter>`
      : '';

    const filterAttr = shadow ? 'filter="url(#dropShadow)"' : '';

    // Complete SVG badge
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <defs>
        ${clipPath}
        ${shadowFilter}
      </defs>
      <g ${filterAttr}>
        ${backgroundShape}
        <image href="${logoUrl}" x="${marginPx}" y="${marginPx}" width="${inner}" height="${inner}" 
               clip-path="url(#logoClip)" preserveAspectRatio="xMidYMid meet" />
      </g>
    </svg>`.trim();

    // Encode to base64 data URI
    const encoded = isBrowser
      ? btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg).toString('base64');
    
    const dataUri = `data:image/svg+xml;base64,${encoded}`;
    console.log('✅ Premium QR badge generated successfully');
    return dataUri;
  } catch (error) {
    console.error('❌ Failed to generate QR badge:', error);
    return undefined;
  }
}

/**
 * Converts QR data to compact JSON payload
 */
function createQRPayload(data: QRCodeData): string {
  return JSON.stringify({
    t: data.ticketId,
    e: data.eventId,
    ts: data.timestamp,
    s: data.signature
  });
}

/**
 * Generates a premium styled QR code with branded elements
 * 
 * Features:
 * - Rounded dots with optional gradients
 * - Extra-rounded finder eyes for premium look
 * - Center logo badge with white backer and subtle shadow
 * - Error correction level H for maximum reliability
 * - Proper quiet zone and contrast ratios
 * - PNG (retina) and SVG export support
 * 
 * @param data QR code data payload
 * @param options Styling and branding options
 * @returns Promise<string> Data URL of the generated QR code
 */
export async function generateStyledQRDataURL(
  data: QRCodeData,
  options: StyledQrOptions = {}
): Promise<string> {
  // Apply safe defaults optimized for scanability
  const {
    size = 512,                    // Retina quality for crisp display
    margin = 16,                   // Adequate quiet zone
    darkColor = '#111111',         // High contrast dark
    lightColor = '#ffffff',        // Pure white background
    dotsGradient,                  // Optional brand gradient
    logoUrl,                       // Brand logo
    logoMargin = 8,                // Breathing room around logo
    logoSizeRatio = 0.22,          // Safe size ratio
    dotsType = 'rounded',          // Premium rounded dots
    cornersSquareType = 'extra-rounded', // Distinctive finder eyes
    cornersDotType = 'dot',        // Clean center dots
    cornersColor,                  // Optional finder eye color override
    format = 'png',                // Default to PNG for display
    logoBackerShape = 'circle',    // Clean circular badge
    logoBackerFill = '#ffffff',    // White background
    logoBackerStroke = '#0000001A', // Subtle border
    logoBackerStrokeWidth = 1.5,   // Thin stroke
    logoShadow = true,             // Soft shadow for depth
  } = options;

  // Fallback for non-browser environments
  if (!isBrowser) {
    console.log('🔄 Falling back to basic QR generation (SSR)');
    const { generateQRCodeDataURL } = await import('./qrCode');
    return generateQRCodeDataURL(data, size);
  }

  try {
    // Dynamic import to avoid SSR issues
    const QRCodeStyling = (await import('qr-code-styling')).default;

    // Generate logo badge if logo URL is provided
    const logoBadge = logoUrl
      ? buildLogoBadgeDataUri({
          logoUrl,
          sizePx: 256,                    // High resolution badge
          marginPx: logoMargin,
          shape: logoBackerShape,
          fill: logoBackerFill,
          stroke: logoBackerStroke,
          strokeWidth: logoBackerStrokeWidth,
          shadow: logoShadow,
        })
      : undefined;

    console.log('🎯 Generating premium QR with options:', {
      size,
      margin,
      dotsType,
      cornersSquareType,
      logoSizeRatio,
      hasBadge: !!logoBadge,
      hasGradient: !!dotsGradient,
    });

    // Configure QR code styling with premium options
    const qrConfig = {
      width: size,
      height: size,
      margin,
      data: createQRPayload(data),
      image: logoBadge,                   // Use badge instead of raw logo
      qrOptions: {
        errorCorrectionLevel: 'H',        // Maximum error correction
      },
      backgroundOptions: {
        color: lightColor,
      },
      dotsOptions: {
        type: dotsType,
        color: darkColor,
        ...(dotsGradient ? { gradient: dotsGradient } : {}),
      } as any, // Type assertion for gradient support
      cornersSquareOptions: {
        type: cornersSquareType,
        color: cornersColor ?? darkColor, // Keep finder eyes high contrast
      },
      cornersDotOptions: {
        type: cornersDotType,
        color: cornersColor ?? darkColor,
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 0,                        // Padding handled in badge
        imageSize: Math.min(Math.max(logoSizeRatio, 0.18), 0.24), // Clamp to safe range
        hideBackgroundDots: true,         // Clear area behind logo
      },
    };

    // Generate QR code
    const qr = new QRCodeStyling(qrConfig);
    
    // Render to temporary DOM element
    const container = document.createElement('div');
    await qr.append(container);

    // Export as data URL
    const blob = await qr.getRawData(format) as Blob;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    console.log('✅ Premium QR code generated successfully');
    return dataUrl;

  } catch (error) {
    console.error('❌ QR generation failed, using fallback:', error);
    
    // Fallback to basic QR generation
    const { generateQRCodeDataURL } = await import('./qrCode');
    return generateQRCodeDataURL(data, size);
  }
}

/**
 * Validates QR code options for scanability
 * Ensures compliance with scanning requirements
 */
export function validateQROptions(options: StyledQrOptions): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check logo size ratio
  if (options.logoSizeRatio && (options.logoSizeRatio < 0.18 || options.logoSizeRatio > 0.24)) {
    warnings.push('Logo size ratio should be between 0.18-0.24 for optimal scanning');
  }
  
  // Check margin size
  if (options.margin && options.margin < 16) {
    warnings.push('Margin should be at least 16px for proper quiet zone');
  }
  
  // Check contrast
  if (options.darkColor === options.lightColor) {
    warnings.push('Dark and light colors must be different for contrast');
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}

export default generateStyledQRDataURL;