export type MuxPlaybackDiagnostics = {
  url: string;
  valid: boolean;
  reason?: string;
  playbackId?: string;
  assetType: 'hls' | 'mp4' | 'unknown';
  isSigned: boolean;
  cdnHost?: string;
};

const MUX_HOST_SUFFIXES = ['mux.com', 'muxcdn.com', 'mux.dev'];

function extractPlaybackId(pathname: string): { playbackId?: string; assetType: 'hls' | 'mp4' | 'unknown' } {
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? '';

  if (!lastSegment) {
    return { assetType: 'unknown' };
  }

  if (lastSegment.endsWith('.m3u8')) {
    return { playbackId: lastSegment.replace(/\.m3u8$/, ''), assetType: 'hls' };
  }

  if (lastSegment.endsWith('.mp4')) {
    const filename = lastSegment.replace(/\.mp4$/, '');
    const playbackId = segments.length > 1 ? segments[segments.length - 2] : filename;
    return { playbackId, assetType: 'mp4' };
  }

  if (/^[a-zA-Z0-9]+$/.test(lastSegment)) {
    return { playbackId: lastSegment, assetType: 'hls' };
  }

  return { assetType: 'unknown' };
}

export function describeMuxPlaybackUrl(url: string): MuxPlaybackDiagnostics {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch (error) {
    return {
      url,
      valid: false,
      reason: error instanceof Error ? error.message : 'Invalid URL',
      assetType: 'unknown',
      isSigned: false,
    };
  }

  const host = parsed.hostname;
  const hostIsMux = MUX_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));

  if (!hostIsMux) {
    return {
      url,
      valid: false,
      reason: 'URL is not pointing to a mux.com domain',
      assetType: 'unknown',
      isSigned: false,
      cdnHost: host,
    };
  }

  const { playbackId, assetType } = extractPlaybackId(parsed.pathname);
  const isSigned = ['token', 'signature', 'expires', 'keyId'].some((key) => parsed.searchParams.has(key));

  if (!playbackId) {
    return {
      url,
      valid: false,
      reason: 'Unable to determine playback ID from URL',
      assetType,
      isSigned,
      cdnHost: host,
    };
  }

  return {
    url,
    valid: true,
    playbackId,
    assetType,
    isSigned,
    cdnHost: host,
  };
}

export function isMuxPlaybackUrl(url: string): boolean {
  return describeMuxPlaybackUrl(url).valid;
}
