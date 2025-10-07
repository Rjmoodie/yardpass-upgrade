// Canonical Mux URL & ID helpers
const MUX_BASE = "https://stream.mux.com";

export type MuxIds = { playbackId: string };

export function extractMuxPlaybackId(input?: string | null): string | null {
  if (!input) return null;
  // Accept mux:ABC or https://stream.mux.com/ABC(.m3u8|/...)
  const muxProto = input.match(/^mux:([a-zA-Z0-9]+)$/)?.[1];
  if (muxProto) return muxProto;

  try {
    const url = new URL(input);
    if (url.hostname.endsWith("mux.com")) {
      const seg = url.pathname.split("/").filter(Boolean)[0];
      return seg?.replace(/\.m3u8$/, "") ?? null;
    }
  } catch {
    // not a URL
  }

  // plain playback id?
  if (/^[a-zA-Z0-9]+$/.test(input)) return input;
  return null;
}

export function hlsUrl({ playbackId }: MuxIds) {
  return `${MUX_BASE}/${playbackId}.m3u8`;
}

export function posterUrl(
  { playbackId }: MuxIds,
  params?: { time?: number; width?: number; height?: number; fitMode?: "preserve" | "smartcrop" | "stretch" }
) {
  const t = params?.time ?? 1;
  const q = new URLSearchParams();
  q.set("time", String(t));
  if (params?.width) q.set("width", String(params.width));
  if (params?.height) q.set("height", String(params.height));
  if (params?.fitMode) q.set("fit_mode", params.fitMode);
  return `${MUX_BASE}/${playbackId}/thumbnail.jpg?${q.toString()}`;
}

export function storyboardVtt({ playbackId }: MuxIds) {
  return `${MUX_BASE}/${playbackId}/storyboard.vtt`;
}

/** Backwards-compat helpers (so existing calls keep working) */
export function muxToHls(input: string) {
  const id = extractMuxPlaybackId(input);
  return id ? hlsUrl({ playbackId: id }) : input;
}

export function muxToPoster(input: string, rawQuery?: string) {
  const id = extractMuxPlaybackId(input);
  if (!id) return input;
  const base = `${MUX_BASE}/${id}/thumbnail.jpg`;
  return rawQuery ? `${base}?${rawQuery}` : posterUrl({ playbackId: id });
}
