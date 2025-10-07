// Temporary shim: forward old imports to the canonical helpers
export {
  extractMuxPlaybackId,
  muxToHls,
  muxToPoster,
  hlsUrl,
  posterUrl,
} from "@/lib/video/muxClient";

export const isLikelyVideo = (u?: string) =>
  !!u && (u.includes(".m3u8") || u.startsWith("mux:") || u.includes("stream.mux.com"));

export const isMux = (u?: string) => !!u && u.startsWith('mux:');
export const muxPlaybackId = (u: string) => u.replace(/^mux:/, '').trim();
export const isHttpLike = (s?: string) => !!s && /^https?:\/\//i.test(s);