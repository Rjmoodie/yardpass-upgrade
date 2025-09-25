let _loader: Promise<typeof import('hls.js')> | null = null;

export function getHlsModule() {
  if (!_loader) {
    _loader = import('hls.js');
  }
  return _loader;
}

export function createHlsInstance(HlsMod: typeof import('hls.js')) {
  const { default: Hls } = HlsMod;
  return new Hls({
    // Stability & startup
    lowLatencyMode: true,
    enableWorker: true,
    backBufferLength: 30,
    // Startup faster on average devices
    maxBufferLength: 10,
    maxMaxBufferLength: 30,
    // Avoid CPU meltdowns
    capLevelOnFPSDrop: true,
    // ABR tuning
    startLevel: -1, // auto
  });
}