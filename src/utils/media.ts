// src/utils/media.ts
export const isLikelyVideo = (url?: string) =>
  !!url && (/mux:/.test(url) || /\.(mp4|mov|webm|m3u8)$/i.test(url));

export const muxToHls = (mediaUrl: string) =>
  mediaUrl.startsWith('mux:')
    ? `https://stream.mux.com/${mediaUrl.replace('mux:', '')}.m3u8`
    : mediaUrl;