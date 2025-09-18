// src/lib/qrTheme.ts
import type { StyledQrOptions } from '@/lib/styledQr';

/** High-contrast themes (scanner-safe). Extend as needed. */
export type QrThemeName = 'classic' | 'brand' | 'night';

export function getQrTheme(
  theme: QrThemeName,
  brandHex = '#ff5a3c',   // your accent (orange from screenshot vibe)
): StyledQrOptions {
  switch (theme) {
    case 'brand':
      return {
        size: 512,
        margin: 16,
        lightColor: '#FFFFFF',
        darkColor: '#000000',
        dotsType: 'rounded',
        cornersSquareType: 'extra-rounded',
        cornersDotType: 'dot',
        // nice brand gradient for modules
        // (supported by qr-code-styling)
        // If your lib version doesn't support gradients,
        // comment this gradient block out.
        // @ts-ignore
        dotsOptionsGradient: {
          type: 'linear',
          rotation: 0, // 0 = left->right; use Math.PI/4 for diagonal
          colorStops: [
            { offset: 0, color: '#111111' },
            { offset: 1, color: brandHex },
          ],
        },
      };

    case 'night':
      return {
        size: 512,
        margin: 18,
        lightColor: '#0B0B0C', // near-black card
        darkColor: '#FFFFFF',  // inverted modules
        dotsType: 'rounded',
        cornersSquareType: 'extra-rounded',
        cornersDotType: 'dot',
      };

    default: // classic
      return {
        size: 512,
        margin: 16,
        lightColor: '#FFFFFF',
        darkColor: '#000000',
        dotsType: 'rounded',
        cornersSquareType: 'extra-rounded',
        cornersDotType: 'dot',
      };
  }
}