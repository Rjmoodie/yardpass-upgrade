/**
 * Deep Link Handler for Capacitor
 * Handles URLs from shared links and universal links
 */

import { Capacitor } from '@capacitor/core';

export interface ParsedDeepLink {
  path: string;
  params: Record<string, string>;
  hash?: string;
}

/**
 * Parse a deep link URL and extract the path and parameters
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  try {
    // Handle both app scheme (liventix://) and HTTP/HTTPS URLs
    // Also handle both liventix.com and liventix.tech domains
    let urlObj: URL;
    
    if (url.startsWith('liventix://') || url.startsWith('Liventix://')) {
      // App scheme URL - convert to http for parsing
      urlObj = new URL(url.replace(/^liventix:\/\//i, 'http://'));
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      urlObj = new URL(url);
      // Normalize domains - accept both liventix.com and liventix.tech
      if (urlObj.hostname === 'liventix.com' || urlObj.hostname === 'liventix.tech') {
        // Keep the pathname as-is, we just care about the path
      }
    } else {
      console.warn('[DeepLink] Invalid URL format:', url);
      return null;
    }

    // Extract pathname (e.g., /e/event-slug, /p/post-id, /u/username)
    const pathname = urlObj.pathname;
    
    // Extract query parameters
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Extract hash fragment
    const hash = urlObj.hash ? urlObj.hash.substring(1) : undefined;

    return {
      path: pathname,
      params,
      hash
    };
  } catch (error) {
    console.error('[DeepLink] Error parsing URL:', url, error);
    return null;
  }
}

/**
 * Convert a deep link path to a React Router path
 */
export function deepLinkToRoute(parsed: ParsedDeepLink): string | null {
  if (!parsed) return null;

  const { path, hash } = parsed;

  // Handle different route patterns
  // Events: /e/:identifier
  if (path.match(/^\/e\//)) {
    const identifier = path.replace('/e/', '');
    if (identifier) {
      return hash ? `/e/${identifier}${hash ? `#${hash}` : ''}` : `/e/${identifier}`;
    }
  }

  // Posts: /p/:id or /post/:id (both map to /post/:id route)
  if (path.match(/^\/(p|post)\//)) {
    const id = path.replace(/^\/(p|post)\//, '');
    if (id) {
      // The app route is /post/:id (not /p/:id)
      return `/post/${id}`;
    }
  }

  // Users: /u/:username or /profile/:username
  if (path.match(/^\/(u|profile)\//)) {
    const username = path.replace(/^\/(u|profile)\//, '');
    if (username) {
      return `/profile/${username}`;
    }
  }

  // Organizations: /org/:slug
  if (path.match(/^\/org\//)) {
    const slug = path.replace('/org/', '');
    if (slug) {
      return `/org/${slug}`;
    }
  }

  // Root or unknown paths
  if (path === '/' || !path) {
    return '/';
  }

  console.warn('[DeepLink] Unknown route pattern:', path);
  return null;
}

/**
 * Main handler for deep links
 * Returns the route path to navigate to, or null if invalid
 */
export function handleDeepLink(url: string): string | null {
  const parsed = parseDeepLink(url);
  if (!parsed) {
    return null;
  }

  const route = deepLinkToRoute(parsed);
  
  if (route) {
    console.log('[DeepLink] Parsed URL:', url, '→ Route:', route);
  } else {
    console.warn('[DeepLink] Could not convert to route:', url);
  }

  return route;
}

