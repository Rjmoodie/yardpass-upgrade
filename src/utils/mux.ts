export const isVideoUrl = (u?: string | null) =>
  !!u && /mux:|\.m3u8$|\.mp4$|\.mov$|\.webm$/i.test(u);

export const buildMuxUrl = (u?: string | null) => {
  if (!u) return undefined;
  if (u.startsWith('mux:')) return `https://stream.mux.com/${u.slice(4)}.m3u8`;
  return u;
};

export const muxToPoster = (u: string, qp = 'width=1200&fit_mode=preserve&time=0') => {
  if (!u) return '';
  if (u.startsWith('mux:')) {
    const id = u.slice(4);
    return `https://image.mux.com/${id}/thumbnail.jpg?${qp}`;
  }
  return u;
};

export const extractMuxPlaybackId = (u?: string | null) => {
  if (!u) return null;
  const m = u.match(/mux:([a-zA-Z0-9]+)/);
  if (m) return m[1];
  const m2 = u.match(/stream\.mux\.com\/([a-zA-Z0-9]+)/);
  return m2 ? m2[1] : null;
};