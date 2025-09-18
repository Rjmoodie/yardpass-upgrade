// src/lib/qrTheme.ts - Premium QR Code Themes
import type { StyledQrOptions, StyledQrGradient } from './styledQr';

export type QrThemeName = 'classic' | 'brand' | 'night';

/**
 * Base configuration optimized for scanability
 */
const BASE_CONFIG: StyledQrOptions = {
  size: 512,                      // Retina quality
  margin: 16,                     // Proper quiet zone
  lightColor: '#ffffff',          // Pure white background
  darkColor: '#111111',           // High contrast dark
  dotsType: 'rounded',            // Premium rounded dots
  cornersSquareType: 'extra-rounded', // Distinctive finder eyes
  cornersDotType: 'dot',          // Clean center dots
  logoSizeRatio: 0.22,            // Safe logo size
  logoMargin: 8,                  // Logo breathing room
  logoBackerShape: 'circle',      // Clean badge shape
  logoBackerFill: '#ffffff',      // White badge background
  logoBackerStroke: '#0000001A',  // Subtle border
  logoBackerStrokeWidth: 1.5,     // Thin stroke
  logoShadow: true,               // Soft depth
};

/**
 * Get themed QR code configuration
 * 
 * Themes:
 * - classic: Clean black on white, no gradients
 * - brand: Subtle amber gradient, maintains scanability
 * - night: Inverted colors for dark mode (UI keeps white frame)
 * 
 * @param theme Theme name
 * @param brandHex Custom brand color (default YardPass amber)
 * @returns Complete QR styling configuration
 */
export function getQrTheme(
  theme: QrThemeName, 
  brandHex: string = '#ffb400'
): StyledQrOptions {
  
  switch (theme) {
    case 'brand': {
      // Subtle diagonal gradient from dark to brand color
      const brandGradient: StyledQrGradient = {
        type: 'linear',
        rotation: Math.PI / 6,        // 30-degree diagonal
        colorStops: [
          { offset: 0, color: '#111111' },    // Start with dark
          { offset: 0.7, color: '#333333' },  // Transition
          { offset: 1, color: brandHex },     // End with brand color
        ],
      };

      return {
        ...BASE_CONFIG,
        dotsGradient: brandGradient,
        cornersColor: '#111111',      // Keep finder eyes solid for scanning
      };
    }

    case 'night': {
      // Inverted colors for dark mode
      // Note: UI will still show white frame for scanner compatibility
      return {
        ...BASE_CONFIG,
        lightColor: '#0a0a0b',        // Very dark background
        darkColor: '#ffffff',         // White modules
        cornersColor: '#ffffff',      // White finder eyes
        logoBackerFill: '#ffffff',    // Keep logo badge white
        logoBackerStroke: '#ffffff33', // Light border
      };
    }

    case 'classic':
    default: {
      // Clean, professional black on white
      return {
        ...BASE_CONFIG,
        // No gradient - uses solid darkColor
        cornersColor: '#111111',      // Consistent dark finder eyes
      };
    }
  }
}

/**
 * Get theme display information for UI
 */
export function getThemeInfo(theme: QrThemeName) {
  const themes = {
    classic: {
      name: 'Classic',
      description: 'Clean black on white',
      icon: '⚫',
      preview: '#111111',
    },
    brand: {
      name: 'Brand',
      description: 'Subtle amber gradient',
      icon: '🎨',
      preview: 'linear-gradient(30deg, #111111, #ffb400)',
    },
    night: {
      name: 'Night',
      description: 'Dark mode friendly',
      icon: '🌙',
      preview: '#ffffff',
    },
  };

  return themes[theme];
}

/**
 * Validate theme configuration for scanability
 */
export function validateTheme(theme: QrThemeName, brandHex?: string): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check brand color contrast if provided
  if (theme === 'brand' && brandHex) {
    const hex = brandHex.replace('#', '');
    if (hex.length !== 6) {
      warnings.push('Brand color must be a valid hex color (#rrggbb)');
    }
    
    // Simple brightness check for contrast
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    if (brightness > 200) {
      warnings.push('Brand color may be too light for good contrast');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Get all available themes for UI selection
 */
export function getAllThemes(): Array<{
  id: QrThemeName;
  info: ReturnType<typeof getThemeInfo>;
}> {
  return (['classic', 'brand', 'night'] as const).map(theme => ({
    id: theme,
    info: getThemeInfo(theme),
  }));
}

export default getQrTheme;