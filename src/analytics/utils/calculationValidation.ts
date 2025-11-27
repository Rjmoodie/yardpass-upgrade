/**
 * Calculation Validation Utilities
 * 
 * Validates analytics calculations to prevent NaN, Infinity, and division by zero errors
 */

/**
 * Safely calculate a percentage with validation
 * Returns 0 for invalid inputs instead of NaN/Infinity
 */
export function safePercentage(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }
  
  if (denominator === 0 || denominator < 0) {
    return 0;
  }
  
  const result = (numerator / denominator) * 100;
  
  if (!Number.isFinite(result)) {
    return 0;
  }
  
  // Clamp to reasonable range (0-10000%)
  return Math.max(0, Math.min(10000, result));
}

/**
 * Safely calculate a rate with validation
 * Returns 0 for invalid inputs instead of NaN/Infinity
 */
export function safeRate(numerator: number, denominator: number, multiplier: number = 1): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }
  
  if (denominator === 0 || denominator < 0) {
    return 0;
  }
  
  const result = (numerator / denominator) * multiplier;
  
  if (!Number.isFinite(result)) {
    return 0;
  }
  
  // Clamp to reasonable range (0 to 1e10)
  return Math.max(0, Math.min(1e10, result));
}

/**
 * Safely divide two numbers with validation
 */
export function safeDivide(numerator: number, denominator: number, defaultValue: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return defaultValue;
  }
  
  if (denominator === 0) {
    return defaultValue;
  }
  
  const result = numerator / denominator;
  
  if (!Number.isFinite(result)) {
    return defaultValue;
  }
  
  return result;
}

/**
 * Validate a number and return a safe value or default
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  
  return defaultValue;
}

/**
 * Format a percentage with validation
 * Returns "N/A" for invalid values
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const safe = safePercentage(value, 100); // Normalize if already a percentage
  
  if (safe === 0 && value !== 0) {
    return 'N/A';
  }
  
  return `${safe.toFixed(decimals)}%`;
}

/**
 * Format a rate with validation
 * Returns "N/A" for invalid values
 */
export function formatRate(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value) || value === 0) {
    return 'N/A';
  }
  
  return value.toFixed(decimals);
}

