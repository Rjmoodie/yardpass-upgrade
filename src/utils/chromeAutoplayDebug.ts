export type AutoplayContextOptions = {
  muted?: boolean;
};

export type AutoplayContext = {
  muted: boolean;
  userActivation: {
    isActive: boolean;
    hasBeenActive: boolean;
  };
  visibilityState: DocumentVisibilityState | 'unknown';
  documentHasFocus: boolean;
  autoplayLikelyAllowed: boolean;
};

export function describeAutoplayContext(options: AutoplayContextOptions = {}): AutoplayContext {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') {
    return {
      muted: options.muted ?? true,
      userActivation: { isActive: true, hasBeenActive: true },
      visibilityState: 'unknown',
      documentHasFocus: true,
      autoplayLikelyAllowed: true,
    };
  }

  const muted = options.muted ?? true;
  const userActivation = (navigator as Navigator & { userActivation?: { isActive: boolean; hasBeenActive: boolean } }).userActivation;
  const isActive = userActivation?.isActive ?? false;
  const hasBeenActive = userActivation?.hasBeenActive ?? false;

  const visibilityState = document.visibilityState ?? 'unknown';
  const documentHasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  const autoplayLikelyAllowed = muted || hasBeenActive || isActive;

  return {
    muted,
    userActivation: {
      isActive,
      hasBeenActive,
    },
    visibilityState,
    documentHasFocus,
    autoplayLikelyAllowed,
  };
}

export function logAutoplayContext(options: AutoplayContextOptions = {}): AutoplayContext {
  const context = describeAutoplayContext(options);

  if (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, unknown> }).env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('Chrome autoplay context', context);
  }

  return context;
}
