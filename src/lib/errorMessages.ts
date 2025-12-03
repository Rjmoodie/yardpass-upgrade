/**
 * User-Friendly Error Message Handling
 * 
 * Maps technical errors to friendly messages for customers.
 * Never expose internal error details, edge function names, or stack traces.
 */

interface ErrorMapping {
  pattern: RegExp | string;
  title: string;
  message: string;
}

const ERROR_MAPPINGS: ErrorMapping[] = [
  // Timeout / Network errors
  {
    pattern: /timeout|timed out|ETIMEDOUT|network|fetch failed/i,
    title: "Connection Issue",
    message: "We're having trouble connecting. Please check your internet and try again.",
  },
  // OTP / Verification errors
  {
    pattern: /otp|verification.*expired|code.*expired|token.*expired/i,
    title: "Code Expired",
    message: "Your verification code has expired. Please request a new one.",
  },
  {
    pattern: /invalid.*otp|invalid.*code|incorrect.*code/i,
    title: "Invalid Code",
    message: "The code you entered is incorrect. Please check and try again.",
  },
  // Authentication errors
  {
    pattern: /not authenticated|unauthorized|401|auth.*error/i,
    title: "Session Expired",
    message: "Your session has expired. Please sign in again.",
  },
  {
    pattern: /account.*exists|email.*registered/i,
    title: "Account Exists",
    message: "An account with this email already exists. Please sign in instead.",
  },
  // Ticket availability errors
  {
    pattern: /sold out|no.*available|insufficient.*quantity|not.*available/i,
    title: "Tickets Unavailable",
    message: "Sorry, these tickets are no longer available. Please try a different option.",
  },
  {
    pattern: /hold.*expired|reservation.*expired|tickets.*released/i,
    title: "Reservation Expired",
    message: "Your ticket reservation has expired. Please start again.",
  },
  // Payment errors
  {
    pattern: /payment.*failed|card.*declined|insufficient.*funds/i,
    title: "Payment Failed",
    message: "Your payment couldn't be processed. Please check your card details and try again.",
  },
  {
    pattern: /stripe|payment.*intent/i,
    title: "Payment Issue",
    message: "We couldn't process your payment. Please try again.",
  },
  // Rate limiting
  {
    pattern: /too many|rate.*limit|throttle/i,
    title: "Too Many Attempts",
    message: "Please wait a moment before trying again.",
  },
  // Server errors (500, edge function errors)
  {
    pattern: /500|internal.*error|server.*error|edge.*function|supabase.*function/i,
    title: "Something Went Wrong",
    message: "We're experiencing technical difficulties. Please try again in a moment.",
  },
  // Validation errors
  {
    pattern: /invalid.*email|email.*invalid/i,
    title: "Invalid Email",
    message: "Please enter a valid email address.",
  },
  {
    pattern: /required|missing|cannot be empty/i,
    title: "Missing Information",
    message: "Please fill in all required fields.",
  },
  // Database/Connection errors
  {
    pattern: /database|connection.*refused|ECONNREFUSED|postgres/i,
    title: "Service Unavailable",
    message: "Our service is temporarily unavailable. Please try again shortly.",
  },
];

/**
 * Default error for unmatched cases
 */
const DEFAULT_ERROR = {
  title: "Something Went Wrong",
  message: "Please try again. If the problem persists, contact support.",
};

/**
 * Convert a technical error into a user-friendly message
 * 
 * @param error - The error object, string, or unknown value
 * @returns User-friendly title and message
 */
export function getUserFriendlyError(error: unknown): { title: string; message: string } {
  // Extract error message from various formats
  let errorMessage = "";
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object") {
    const e = error as any;
    errorMessage = e.message || e.error || e.msg || JSON.stringify(error);
  }

  // Don't expose raw error messages - find a matching friendly message
  for (const mapping of ERROR_MAPPINGS) {
    const matches = typeof mapping.pattern === "string"
      ? errorMessage.toLowerCase().includes(mapping.pattern.toLowerCase())
      : mapping.pattern.test(errorMessage);
    
    if (matches) {
      return { title: mapping.title, message: mapping.message };
    }
  }

  // Log the original error for debugging (only in dev)
  if (import.meta.env.DEV) {
    console.error("[Error Handler] Unmatched error:", errorMessage);
  }

  return DEFAULT_ERROR;
}

/**
 * Check if an error indicates the user should sign in
 */
export function shouldPromptSignIn(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return /account.*exists|email.*registered|please.*sign.*in/i.test(errorMessage);
}

/**
 * Check if an error is a timeout
 */
export function isTimeoutError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|ETIMEDOUT/i.test(errorMessage);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return /timeout|network|500|502|503|504|service.*unavailable|connection/i.test(errorMessage);
}

