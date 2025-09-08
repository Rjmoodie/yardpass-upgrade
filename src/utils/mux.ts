// Utility for extracting Mux playback IDs from various formats
export function extractMuxPlaybackId(input?: string | null): string | null {
  if (!input) return null;
  if (input.startsWith('mux:')) return input.slice(4);
  const m = input.match(/stream\.mux\.com\/([^/?\.]+)/i);
  return m?.[1] ?? null;
}