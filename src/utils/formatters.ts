/**
 * Formatting Utilities
 * 
 * Centralized formatters for consistent display of numbers, currency, dates, etc.
 * across the application.
 */

/**
 * Singleton instances of formatters for performance
 * Intl formatters are expensive to create, so we reuse them
 */
let currencyFormatterInstance: Intl.NumberFormat | null = null;
let numberFormatterInstance: Intl.NumberFormat | null = null;
let compactNumberFormatterInstance: Intl.NumberFormat | null = null;
let percentFormatterInstance: Intl.NumberFormat | null = null;

/**
 * Get currency formatter instance (USD, no decimals by default)
 */
export function getCurrencyFormatter(
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  if (!currencyFormatterInstance) {
    currencyFormatterInstance = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      ...options,
    });
  }
  return currencyFormatterInstance;
}

/**
 * Get number formatter instance (no decimals by default)
 */
export function getNumberFormatter(
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  if (!numberFormatterInstance) {
    numberFormatterInstance = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
      ...options,
    });
  }
  return numberFormatterInstance;
}

/**
 * Get compact number formatter (e.g., 1.2K, 3.5M)
 */
export function getCompactNumberFormatter(
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  if (!compactNumberFormatterInstance) {
    compactNumberFormatterInstance = new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
      ...options,
    });
  }
  return compactNumberFormatterInstance;
}

/**
 * Get percent formatter
 */
export function getPercentFormatter(
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  if (!percentFormatterInstance) {
    percentFormatterInstance = new Intl.NumberFormat(undefined, {
      style: 'percent',
      maximumFractionDigits: 1,
      ...options,
    });
  }
  return percentFormatterInstance;
}

/**
 * Format a value in cents as currency
 */
export function formatCentsAsCurrency(cents: number | null | undefined): string {
  if (cents == null) return getCurrencyFormatter().format(0);
  return getCurrencyFormatter().format(cents / 100);
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '0';
  return getNumberFormatter().format(value);
}

/**
 * Format a number in compact notation (e.g., 1.2K, 3.5M)
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) return '0';
  return getCompactNumberFormatter().format(value);
}

/**
 * Format a decimal as a percentage (e.g., 0.75 -> 75%)
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '0%';
  return getPercentFormatter().format(value);
}

/**
 * Format a decimal as a percentage with custom decimals (e.g., 0.7534 -> 75.3%)
 */
export function formatPercentWithDecimals(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value == null) return '0%';
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
  return formatter.format(value);
}

/**
 * Format a date relative to now (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'Unknown';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (Math.abs(diffDays) > 30) {
    return dateObj.toLocaleDateString();
  }

  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    
    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    }
    if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    }
    if (Math.abs(diffMinutes) >= 1) {
      return rtf.format(diffMinutes, 'minute');
    }
    return rtf.format(diffSeconds, 'second');
  } catch {
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format a date range (e.g., "Jan 15 - Jan 17, 2024")
 */
export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  if (!startDate) return 'TBD';
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = endDate ? (typeof endDate === 'string' ? new Date(endDate) : endDate) : null;

  if (!end || start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const startStr = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endStr = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startStr} - ${endStr}`;
}

