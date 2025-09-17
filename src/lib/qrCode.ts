/**
 * QR Code Generation Utility (Enhanced)
 * - Supports custom logo (SVG & Canvas)
 * - Safer defaults and better compatibility
 */

import QRCode from 'qrcode';

/* =====================
 * Types & Config
 * ===================== */
export interface QRCodeData {
  ticketId: string;
  eventId: string;
  userId: string;
  timestamp: number;
  signature: string;
}

export type LogoShape = 'circle' | 'square';

export interface QRVisualOptions {
  /** Overall size in px (edge length) */
  size?: number;                 // default 200
  /** Quiet zone around QR */
  margin?: number;               // default 2
  /** QR dark module color */
  darkColor?: string;            // default '#000000'
  /** QR light module color */
  lightColor?: string;           // default '#FFFFFF'
  /** Ratio of logo size to QR size (0.10 - 0.30 recommended) */
  logoSizeRatio?: number;        // default 0.20
  /** Render logo as 'circle' (with optional border) or 'square' */
  logoShape?: LogoShape;         // default 'circle'
  /** Optional border around logo (px) */
  logoBorder?: number;           // default 2 (only visible with contrasting color)
  /** Border color for logo trim/backer */
  logoBorderColor?: string;      // default '#000000'
  /** Backer color behind logo (helps readability) */
  logoBackerColor?: string;      // default '#FFFFFF'
  /** Optional override for error correction (H recommended when using a logo) */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; // default 'H'
}

export interface LogoOptions extends QRVisualOptions {
  /** The logo URL or data URI. E.g. '/brand-logo.png' or 'data:image/png;base64,...' */
  logoUrl?: string;
}

/* =====================
 * Data payload helpers
 * ===================== */

/**
 * Minimal deterministic signature (original).
 * NOTE: For production, move to server & use HMAC (see notes at bottom).
 */
function generateSignature(ticketId: string, eventId: string, timestamp: number): string {
  const data = `${ticketId}-${eventId}-${timestamp}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
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
    userId: ticket.userId || '',
    timestamp,
    signature
  };
}

/* =====================
 * Internal utilities
 * ===================== */

function toPayloadString(data: QRCodeData): string {
  // Keep payload lean; scanners prefer shorter strings
  return JSON.stringify({
    t: data.ticketId,
    e: data.eventId,
    ts: data.timestamp,
    s: data.signature
  });
}

function withDefaults(opts?: QRVisualOptions): Required<QRVisualOptions> {
  return {
    size: opts?.size ?? 200,
    margin: opts?.margin ?? 2,
    darkColor: opts?.darkColor ?? '#000000',
    lightColor: opts?.lightColor ?? '#FFFFFF',
    logoSizeRatio: clamp(opts?.logoSizeRatio ?? 0.20, 0.1, 0.35),
    logoShape: opts?.logoShape ?? 'circle',
    logoBorder: opts?.logoBorder ?? 2,
    logoBorderColor: opts?.logoBorderColor ?? '#000000',
    logoBackerColor: opts?.logoBackerColor ?? '#FFFFFF',
    errorCorrectionLevel: opts?.errorCorrectionLevel ?? 'H',
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/* =====================
 * Base QR (no logo)
 * ===================== */

export async function generateQRCodeSVG(
  data: QRCodeData,
  size: number = 200
): Promise<string> {
  const payload = toPayloadString(data);
  return await QRCode.toString(payload, {
    type: 'svg',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' }
  });
}

export async function generateQRCodeDataURL(
  data: QRCodeData,
  size: number = 200
): Promise<string> {
  const payload = toPayloadString(data);
  return await QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' }
  });
}

/* =====================
 * SVG with logo (enhanced)
 * ===================== */

export async function generateQRCodeWithLogo(
  data: QRCodeData,
  options?: LogoOptions
): Promise<string> {
  const cfg = withDefaults(options);
  const payload = toPayloadString(data);

  // 1) Base QR SVG
  const baseSvg = await QRCode.toString(payload, {
    type: 'svg',
    width: cfg.size,
    margin: cfg.margin,
    errorCorrectionLevel: cfg.errorCorrectionLevel,
    color: { dark: cfg.darkColor, light: cfg.lightColor }
  });

  const logoSize = Math.floor(cfg.size * cfg.logoSizeRatio);

  // 2) We add <defs> + <clipPath> + <image>. Avoid foreignObject for compatibility.
  //    We also render an underlying backer (white) and optional border.
  const half = logoSize / 2;
  const center = cfg.size / 2;
  const clipId = `clip-${Math.random().toString(36).slice(2, 10)}`;

  const backer = cfg.logoShape === 'circle'
    ? `<circle cx="${center}" cy="${center}" r="${half + cfg.logoBorder}" fill="${cfg.logoBackerColor}" stroke="${cfg.logoBorderColor}" stroke-width="${cfg.logoBorder}"/>`
    : `<rect x="${center - half - cfg.logoBorder}" y="${center - half - cfg.logoBorder}" width="${logoSize + cfg.logoBorder * 2}" height="${logoSize + cfg.logoBorder * 2}" rx="${cfg.logoShape === 'circle' ? half + cfg.logoBorder : 4}" fill="${cfg.logoBackerColor}" stroke="${cfg.logoBorderColor}" stroke-width="${cfg.logoBorder}"/>`;

  const clipDef = cfg.logoShape === 'circle'
    ? `<clipPath id="${clipId}"><circle cx="${center}" cy="${center}" r="${half}"/></clipPath>`
    : `<clipPath id="${clipId}"><rect x="${center - half}" y="${center - half}" width="${logoSize}" height="${logoSize}" rx="4"/></clipPath>`;

  // Use xlink:href+hRef pair for broad SVG reader support
  const imageEl = options?.logoUrl
    ? `<image x="${center - half}" y="${center - half}" width="${logoSize}" height="${logoSize}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid meet" href="${options.logoUrl}" xlink:href="${options.logoUrl}"/>`
    : '';

  // Simple fallback “YP” if no logo is provided
  const fallbackText = !options?.logoUrl
    ? `<text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.floor(logoSize/3)}" font-weight="bold" fill="#6366f1">YP</text>`
    : '';

  const sticker = `
    <defs>${clipDef}</defs>
    ${backer}
    ${imageEl || fallbackText}
  `;

  // Insert right before </svg>
  const svgWithLogo = baseSvg.replace('</svg>', `${sticker}</svg>`);
  return svgWithLogo;
}

/* =====================
 * Canvas/DataURL with logo (enhanced)
 * ===================== */

export async function generateQRCodeDataURLWithLogo(
  data: QRCodeData,
  options?: LogoOptions
): Promise<string> {
  if (!isBrowser) {
    // In SSR environments we can’t draw to canvas
    return generateQRCodeDataURL(data, options?.size ?? 200);
  }

  const cfg = withDefaults(options);
  const size = cfg.size;

  // Prepare canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  canvas.width = size;
  canvas.height = size;

  // Generate base QR
  const qrDataUrl = await QRCode.toDataURL(toPayloadString(data), {
    width: size,
    margin: cfg.margin,
    errorCorrectionLevel: cfg.errorCorrectionLevel,
    color: { dark: cfg.darkColor, light: cfg.lightColor }
  });

  // Draw QR
  const qrImage = await loadImage(qrDataUrl);
  ctx.drawImage(qrImage, 0, 0, size, size);

  // Logo prep
  const logoSize = Math.floor(size * cfg.logoSizeRatio);
  const x = (size - logoSize) / 2;
  const y = x;
  const r = logoSize / 2;

  // Backer
  ctx.save();
  ctx.fillStyle = cfg.logoBackerColor;
  if (cfg.logoShape === 'circle') {
    ctx.beginPath();
    ctx.arc(x + r, y + r, r + cfg.logoBorder, 0, Math.PI * 2);
    ctx.fill();
    if (cfg.logoBorder > 0) {
      ctx.strokeStyle = cfg.logoBorderColor;
      ctx.lineWidth = cfg.logoBorder;
      ctx.stroke();
    }
  } else {
    const w = logoSize + cfg.logoBorder * 2;
    const h = w;
    const bx = x - cfg.logoBorder;
    const by = y - cfg.logoBorder;
    roundRect(ctx, bx, by, w, h, 6);
    ctx.fill();
    if (cfg.logoBorder > 0) {
      ctx.strokeStyle = cfg.logoBorderColor;
      ctx.lineWidth = cfg.logoBorder;
      ctx.stroke();
    }
  }
  ctx.restore();

  // Draw logo (clip)
  ctx.save();
  if (cfg.logoShape === 'circle') {
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.clip();
  } else {
    roundRect(ctx, x, y, logoSize, logoSize, 6);
    ctx.clip();
  }

  if (options?.logoUrl) {
    try {
      const logoImg = await loadImage(options.logoUrl, /*crossOrigin*/ 'anonymous');
      ctx.drawImage(logoImg, x, y, logoSize, logoSize);
    } catch {
      // Fallback to monogram
      drawYP(ctx, x, y, logoSize);
    }
  } else {
    drawYP(ctx, x, y, logoSize);
  }
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/* =====================
 * Clipboard / Share (unchanged)
 * ===================== */

export function copyQRDataToClipboard(data: QRCodeData): Promise<void> {
  const qrText =
    `YardPass Ticket\n` +
    `ID: ${data.ticketId}\n` +
    `Event: ${data.eventId}\n` +
    `Time: ${new Date(data.timestamp).toLocaleString()}\n` +
    `Code: ${data.signature}`;

  if (isBrowser && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(qrText);
  } else if (isBrowser) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = qrText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
  return Promise.resolve();
}

export function shareQRData(data: QRCodeData): Promise<void> {
  if (!isBrowser) return Promise.resolve();
  const shareData = {
    title: 'YardPass Ticket',
    text: `My ticket for event ${data.eventId}`,
    url: `${window.location.origin}/ticket/${data.ticketId}`
  };

  // SAFETY: navigator.canShare may throw in some browsers if shape mismatches
  try {
    if ((navigator as any).share && (navigator as any).canShare?.(shareData)) {
      return (navigator as any).share(shareData);
    }
  } catch {
    // ignore and fallback
  }
  return copyQRDataToClipboard(data);
}

/* =====================
 * Small drawing helpers
 * ===================== */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawYP(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#6366f1';
  roundRect(ctx, x, y, size, size, size / 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.floor(size / 3)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YP', x + size / 2, y + size / 2);
}

function loadImage(src: string, crossOrigin: 'anonymous' | undefined = undefined): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}