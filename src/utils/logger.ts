/**
 * Centralized logging utility for YardPass
 * 
 * Provides consistent logging with environment-aware behavior:
 * - Production: Only errors and warnings
 * - Development: Info and debug logs (opt-in verbose mode)
 * 
 * @example
 * import { logger } from '@/utils/logger';
 * 
 * logger.debug('Detailed debug info'); // Only in DEV with verbose mode
 * logger.info('General information'); // DEV only
 * logger.warn('Warning message'); // Always shown
 * logger.error('Error occurred', error); // Always shown
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * Check if verbose logging is enabled via localStorage
 */
function isVerboseEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('verbose_logs') === 'true';
}

/**
 * Check if specific feature verbose logging is enabled
 */
function isFeatureVerboseEnabled(feature: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`verbose_${feature}`) === 'true';
}

/**
 * Main logger implementation
 */
export const logger: Logger = {
  /**
   * Debug logs - only shown in development with verbose mode enabled
   * Enable with: localStorage.setItem('verbose_logs', 'true')
   */
  debug: (...args: any[]) => {
    if (import.meta.env.DEV && isVerboseEnabled()) {
      console.debug(...args);
    }
  },

  /**
   * Info logs - shown in development only
   */
  info: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },

  /**
   * Warning logs - always shown (useful for production debugging)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error logs - always shown (critical for production monitoring)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },
};

/**
 * Feature-specific logger with opt-in verbose mode
 * 
 * @example
 * const videoLogger = createFeatureLogger('video');
 * videoLogger.debug('Video loaded'); // Only if localStorage.setItem('verbose_video', 'true')
 */
export function createFeatureLogger(feature: string): Logger {
  return {
    debug: (...args: any[]) => {
      if (import.meta.env.DEV && (isVerboseEnabled() || isFeatureVerboseEnabled(feature))) {
        console.debug(`[${feature}]`, ...args);
      }
    },
    info: (...args: any[]) => {
      if (import.meta.env.DEV) {
        console.log(`[${feature}]`, ...args);
      }
    },
    warn: (...args: any[]) => {
      console.warn(`[${feature}]`, ...args);
    },
    error: (...args: any[]) => {
      console.error(`[${feature}]`, ...args);
    },
  };
}

/**
 * Performance logger for timing operations
 * 
 * @example
 * const perf = performanceLogger.start('fetchFeed');
 * // ... do work ...
 * perf.end(); // Logs: "[Performance] fetchFeed took 150ms"
 */
export const performanceLogger = {
  timers: new Map<string, number>(),

  start(label: string): { end: () => void } {
    if (import.meta.env.DEV && isVerboseEnabled()) {
      this.timers.set(label, performance.now());
    }

    return {
      end: () => {
        if (import.meta.env.DEV && isVerboseEnabled()) {
          const startTime = this.timers.get(label);
          if (startTime !== undefined) {
            const duration = performance.now() - startTime;
            logger.debug(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
            this.timers.delete(label);
          }
        }
      },
    };
  },
};
