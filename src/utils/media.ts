// src/utils/media.ts
export const isMux = (u?: string) => !!u && u.startsWith('mux:');
export const muxPlaybackId = (u: string) => u.replace(/^mux:/, '').trim();

export const isLikelyVideo = (url?: string) =>
  !!url && (/mux:/.test(url) || /\.(mp4|mov|webm|m3u8)$/i.test(url));

// HLS URL for <video>
export const muxToHls = (u: string) => 
  isMux(u) ? `https://stream.mux.com/${muxPlaybackId(u)}.m3u8` : u;

// Poster/thumbnail URL for <img>
export const muxToPoster = (u: string, qp = 'width=1200&fit_mode=preserve&time=0') =>
  isMux(u) ? `https://image.mux.com/${muxPlaybackId(u)}/thumbnail.jpg?${qp}` : u;

// Check if URL is HTTP(S)
export const isHttpLike = (s?: string) => !!s && /^https?:\/\//i.test(s);