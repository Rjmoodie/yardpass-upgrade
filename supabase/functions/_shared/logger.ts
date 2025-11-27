/**
 * Standard Logging with Context
 * 
 * Attaches request ID, user ID, feature name to all logs
 * for better observability across all Edge Functions.
 */

export interface LogContext {
  feature: string;
  requestId?: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log with structured context
 */
export function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: LogContext
): void {
  const logEntry = {
    level,
    message,
    feature: context.feature,
    requestId: context.requestId || generateRequestId(),
    userId: context.userId,
    operation: context.operation,
    timestamp: new Date().toISOString(),
    ...context.metadata,
  };

  const logString = JSON.stringify(logEntry);

  switch (level) {
    case 'error':
      console.error(logString);
      break;
    case 'warn':
      console.warn(logString);
      break;
    case 'debug':
      if (Deno.env.get('DEBUG') === 'true') {
        console.debug(logString);
      }
      break;
    default:
      console.log(logString);
  }
}

/**
 * Create a scoped logger for a specific feature
 * 
 * @example
 * const logger = createScopedLogger('stripe', { userId: user.id });
 * logger.info('Payment intent created', { orderId: order.id });
 * logger.error('Payment failed', error, { orderId: order.id });
 */
export function createScopedLogger(feature: string, baseContext?: Partial<LogContext>) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('info', message, {
        feature,
        ...baseContext,
        metadata: { ...baseContext?.metadata, ...metadata },
      });
    },
    warn: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('warn', message, {
        feature,
        ...baseContext,
        metadata: { ...baseContext?.metadata, ...metadata },
      });
    },
    error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
      logWithContext('error', message, {
        feature,
        ...baseContext,
        metadata: {
          ...baseContext?.metadata,
          ...metadata,
          error: error?.message,
          stack: error?.stack,
        },
      });
    },
    debug: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('debug', message, {
        feature,
        ...baseContext,
        metadata: { ...baseContext?.metadata, ...metadata },
      });
    },
  };
}

