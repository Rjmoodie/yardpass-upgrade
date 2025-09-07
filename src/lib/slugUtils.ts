/**
 * Utility functions for generating and handling SEO-friendly slugs
 */

/**
 * Generates a URL-friendly slug from a title
 * @param title - The title to convert to a slug
 * @param maxLength - Maximum length of the slug (default: 50)
 * @returns A URL-friendly slug
 */
export function generateSlug(title: string, maxLength: number = 50): string {
  return title
    .toLowerCase()
    .trim()
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Truncate to max length
    .substring(0, maxLength)
    // Remove trailing hyphen if truncation created one
    .replace(/-+$/, '');
}

/**
 * Generates a unique slug by appending a random suffix
 * @param baseSlug - The base slug to make unique
 * @returns A unique slug with random suffix
 */
export function generateUniqueSlug(baseSlug: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${randomSuffix}`;
}

/**
 * Creates an event slug from title with optional uniqueness
 * @param title - Event title
 * @param makeUnique - Whether to add random suffix for uniqueness
 * @returns SEO-friendly event slug
 */
export function createEventSlug(title: string, makeUnique: boolean = true): string {
  const baseSlug = generateSlug(title);
  return makeUnique ? generateUniqueSlug(baseSlug) : baseSlug;
}

/**
 * Validates if a slug is properly formatted
 * @param slug - The slug to validate
 * @returns True if slug is valid
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Extracts the base slug without the unique suffix
 * @param slug - The full slug
 * @returns Base slug without random suffix
 */
export function getBaseSlug(slug: string): string {
  // Remove the last part if it looks like a random suffix (6 characters)
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  
  if (lastPart.length === 6 && /^[a-z0-9]{6}$/.test(lastPart)) {
    return parts.slice(0, -1).join('-');
  }
  
  return slug;
}