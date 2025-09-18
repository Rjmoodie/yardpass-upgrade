import type { StyledQrOptions, StyledQrGradient } from '@/lib/styledQr';

export type QrThemeName = 'classic' | 'brand' | 'night';

export function getQrTheme(theme: QrThemeName, brandHex = '#ffb400'): StyledQrOptions {
  const base: StyledQrOptions = {
    size: 512,
    margin: 16,
    lightColor: '#FFFFFF',
    darkColor: '#111111',
    dotsType: 'rounded',
    cornersSquareType: 'extra-rounded',
    cornersDotType: 'dot',
  };

  if (theme === 'brand') {
    const gradient: StyledQrGradient = {
      type: 'linear',
      rotation: Math.PI / 6, // subtle diagonal
      colorStops: [
        { offset: 0,   color: '#111111' },
        { offset: 1.0, color: brandHex }, // your amber
      ],
    };
    return {
      ...base,
      dotsGradient: gradient,
      cornersColor: '#111111',
    };
  }

  if (theme === 'night') {
    return {
      ...base,
      lightColor: '#0b0b0c',
      darkColor: '#FFFFFF',
      cornersColor: '#FFFFFF',
    };
  }

  return base;
}