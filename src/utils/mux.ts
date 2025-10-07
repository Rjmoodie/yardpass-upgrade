// Temporary shim: forward old imports to the canonical helpers
export {
  extractMuxPlaybackId,
  muxToHls,
  muxToPoster,
  hlsUrl,
  posterUrl,
  storyboardVtt,
} from "@/lib/video/muxClient";

export const isVideoUrl = (u?: string | null) =>
  !!u && /mux:|\.m3u8$|\.mp4$|\.mov$|\.webm$/i.test(u);

export const buildMuxUrl = (u?: string | null) => {
  if (!u) return undefined;
  if (u.startsWith('mux:')) return `https://stream.mux.com/${u.slice(4)}.m3u8`;
  return u;
};