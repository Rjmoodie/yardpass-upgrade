// src/lib/qrCache.ts - QR Code caching for performance
import type { QRCodeData } from './qrCode';
import type { StyledQrOptions } from './styledQr';

// In-memory cache for generated QR codes
const qrCache = new Map<string, string>();
const maxCacheSize = 50; // Limit cache size

/**
 * Generate a cache key from QR data and options
 */
function getCacheKey(data: QRCodeData, options: StyledQrOptions): string {
  const keyData = {
    ticket: data.ticketId,
    event: data.eventId,
    timestamp: Math.floor(data.timestamp / 60000), // Round to minute
    theme: options.dotsType || 'rounded',
    size: options.size || 512,
    format: options.format || 'png',
    hasLogo: !!options.logoUrl,
  };
  return JSON.stringify(keyData);
}

/**
 * Get QR code from cache if available
 */
export function getCachedQR(data: QRCodeData, options: StyledQrOptions): string | null {
  const key = getCacheKey(data, options);
  return qrCache.get(key) || null;
}

/**
 * Cache a generated QR code
 */
export function cacheQR(data: QRCodeData, options: StyledQrOptions, dataUrl: string): void {
  const key = getCacheKey(data, options);
  
  // Implement LRU-style cache eviction
  if (qrCache.size >= maxCacheSize) {
    const firstKey = qrCache.keys().next().value;
    if (firstKey) {
      qrCache.delete(firstKey);
    }
  }
  
  qrCache.set(key, dataUrl);
}

/**
 * Clear the QR cache
 */
export function clearQRCache(): void {
  qrCache.clear();
}