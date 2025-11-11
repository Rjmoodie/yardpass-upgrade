/**
 * Cryptographic Utilities
 * 
 * Provides consistent, secure token generation for:
 * - Role invites
 * - Password reset tokens
 * - Magic link tokens
 * - Session tokens
 * 
 * Uses Web Crypto API for cryptographically secure random values.
 */

/**
 * Generate a cryptographically secure random token
 * 
 * @param lengthBytes - Number of random bytes (default: 32 = 256 bits)
 * @returns Hex-encoded token string
 * 
 * Examples:
 * - 16 bytes = 128 bits = 32 hex chars
 * - 32 bytes = 256 bits = 64 hex chars (recommended)
 * - 64 bytes = 512 bits = 128 hex chars (overkill for most use cases)
 */
export function generateSecretToken(lengthBytes: number = 32): string {
  const bytes = new Uint8Array(lengthBytes);
  crypto.getRandomValues(bytes);
  
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a short verification code (for SMS, 2FA, etc.)
 * 
 * @param length - Number of digits (default: 6)
 * @returns Numeric code string
 * 
 * Example: "749382" (6 digits)
 */
export function generateVerificationCode(length: number = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  
  return Array.from(bytes)
    .map(b => (b % 10).toString())
    .join('');
}

/**
 * Generate a URL-safe random token (base64url encoding)
 * 
 * @param lengthBytes - Number of random bytes (default: 32)
 * @returns Base64url-encoded token (no padding)
 * 
 * Useful for tokens that will be in URLs or JSON without escaping.
 */
export function generateUrlSafeToken(lengthBytes: number = 32): string {
  const bytes = new Uint8Array(lengthBytes);
  crypto.getRandomValues(bytes);
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...bytes));
  
  // Make URL-safe: replace +/= with -_
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Timing-safe string comparison
 * 
 * @param a - First string
 * @param b - Second string
 * @returns true if strings match
 * 
 * Use this for comparing tokens/passwords to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Hash a value (for ETags, cache keys, etc.)
 * 
 * @param value - String to hash
 * @returns Hex-encoded hash
 * 
 * Note: This is NOT for passwords (use bcrypt/argon2).
 * This is for cache keys, ETags, and non-security-critical hashing.
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

