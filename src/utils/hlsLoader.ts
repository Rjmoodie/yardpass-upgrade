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
    // Faster startup
    lowLatencyMode: false, // Disable for better initial loading
    enableWorker: true,
    autoStartLoad: true,
    startFragPrefetch: true,
    
    // Aggressive buffering for smooth playback
    maxBufferLength: 5,  // Reduced for faster startup
    maxMaxBufferLength: 15,
    backBufferLength: 10,
    
    // Quality selection for faster loading
    startLevel: -1, // auto
    capLevelOnFPSDrop: true,
    capLevelToPlayerSize: true,
    
    // Network optimization
    maxLoadingDelay: 2,  // Faster timeout
    maxBufferHole: 0.3,
    nudgeMaxRetry: 3,
    
    // Fragment loading
    progressive: false,
    testBandwidth: false, // Skip bandwidth test for faster startup
  });
}