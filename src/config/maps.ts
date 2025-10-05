// Maps configuration for geocoding accuracy and reliability
export const MAPS_CONFIG = {
  // Request timeout for geocoding API calls
  requestTimeoutMs: 8000,
  
  // Retry configuration for failed geocoding attempts
  retries: 2,
  retryBackoffMs: [300, 800], // Progressive backoff delays
  
  // Minimum relevance score from Mapbox (0-1 scale)
  // Higher values = more confident results only
  minRelevance: 0.6,
  
  // Preferred accuracy levels (ordered by preference)
  // Mapbox accuracy levels: point, address, street, neighborhood, locality, region, country
  preferAccuracies: ['point', 'address', 'street'] as const,
  
  // Static map fallback configuration
  staticZoom: 15,
  staticWidth: 600,
  staticHeight: 300,
  staticPinColorHex: 'E11D48', // Primary brand color
  
  // Default map styles
  styleDark: 'mapbox://styles/mapbox/dark-v11',
  styleLight: 'mapbox://styles/mapbox/light-v11',
  defaultStyle: 'mapbox://styles/mapbox/dark-v11',
  
  // Map initialization settings
  defaultZoom: 15,
  defaultPitch: 45,
  defaultBearing: 0,
  
  // Animation settings
  flyToZoom: 16,
  flyToPitch: 60,
  flyToDuration: 2000,
  
  // Error messages
  messages: {
    geocodingFailed: 'Unable to locate this address on the map',
    lowConfidence: 'Approximate location shown',
    networkError: 'Map temporarily unavailable',
    tokenRequired: 'Map setup required',
    noResults: 'Address not found',
  },
  
  // Fallback options
  fallbackToStatic: true,
  showAccuracyIndicator: true,
  allowManualCorrection: false, // Future feature
} as const;

export type MapsConfig = typeof MAPS_CONFIG;
