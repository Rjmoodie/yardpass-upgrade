// utils/mapbox/normalize.ts
type MapboxFeature = {
  id: string;
  text?: string;
  place_name?: string;
  center: [number, number];
  properties?: { address?: string };
  context?: Array<{ id: string; text?: string; short_code?: string }>;
  place_type?: string[];
};

export type NormalizedLocation = {
  address: string;  // "535 Carlton Ave, Brooklyn, NY 11238, US"
  line1: string;    // "535 Carlton Ave"
  city: string;
  region: string;   // state or region (e.g., "NY")
  postcode: string; // "11238"
  country: string;  // "United States" or ISO2 "US" (pick one style)
  countryCode: string; // "US"
  lat: number;
  lng: number;
};

export function normalizeMapboxFeature(f: MapboxFeature): NormalizedLocation {
  const ctx = f.context ?? [];

  const get = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix));
  const place = get('place');       // city-level
  const locality = get('locality'); // sometimes Mapbox uses locality instead of place
  const region = get('region');
  const postcode = get('postcode');
  const country = get('country');

  // Street number is properties.address, street name is f.text when feature is type "address"
  const number = f.properties?.address ?? '';
  const street = f.text ?? '';

  // Prefer address line if available, else fallback to place_name
  const line1 = number && street ? `${number} ${street}` : (f.place_name?.split(',')[0] ?? street);

  const cityText = place?.text || locality?.text || '';
  const regionText = region?.text || '';
  const postcodeText = postcode?.text || '';
  const countryText = country?.text || '';
  const countryCode = (country as any)?.short_code?.toUpperCase?.() || '';

  const parts = [line1, cityText, regionText, postcodeText, countryCode].filter(Boolean);
  const address = parts.join(', ');

  return {
    address: address || f.place_name || '',
    line1,
    city: cityText,
    region: regionText,
    postcode: postcodeText,
    country: countryText,
    countryCode,
    lat: f.center[1],
    lng: f.center[0],
  };
}
