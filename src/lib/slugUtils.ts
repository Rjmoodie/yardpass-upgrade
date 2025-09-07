/**
 * Utility functions for generating and handling SEO-friendly slugs
 */

const MAX_LEN = 60;

/** Normalize, strip diacritics/emojis, collapse spaces, hyphenate */
export function generateSlug(title: string, maxLength: number = MAX_LEN): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')          // remove diacritics
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')// non-alphanum -> hyphen
    .replace(/^-+|-+$/g, '')                   // trim hyphens
    .replace(/-+/g, '-')                       // collapse hyphens
    .toLowerCase()
    .substring(0, maxLength)
    .replace(/-+$/g, '');
}

/** quick random suffix (base36, 5–6 chars) */
export function randomSuffix(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

export function generateUniqueSlug(baseSlug: string): string {
  return `${baseSlug}-${randomSuffix(6)}`;
}

/** Event slugs default to unique */
export function createEventSlug(title: string, makeUnique: boolean = true): string {
  const base = generateSlug(title);
  return makeUnique ? generateUniqueSlug(base) : base;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** Remove a trailing -xxxxxx random suffix if present */
export function getBaseSlug(slug: string): string {
  const parts = slug.split('-');
  const last = parts[parts.length - 1];
  if (/^[a-z0-9]{5,8}$/.test(last)) return parts.slice(0, -1).join('-');
  return slug;
}

/**
 * Given a desired slug, check DB and return an available one.
 * Pass a checker that returns true if a slug EXISTS.
 */
export async function ensureAvailableSlug(
  desired: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let candidate = generateSlug(desired) || randomSuffix(6);
  if (!(await exists(candidate))) return candidate;

  // try a few deterministic variations before fully random
  const base = candidate;
  for (let i = 2; i <= 5; i++) {
    candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  // fallback to random
  do {
    candidate = `${base}-${randomSuffix(6)}`;
  } while (await exists(candidate));

  return candidate;
}
