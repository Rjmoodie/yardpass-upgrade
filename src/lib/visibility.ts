// src/lib/visibility.ts
export type Visibility = 'public' | 'unlisted' | 'private';

export function shouldIndexEvent(visibility: Visibility) {
  return visibility === 'public';
}

export function buildEventShareUrl(opts: {
  origin?: string;
  idOrSlug: string;
  visibility: Visibility;
  linkToken?: string | null;
}) {
  const origin = opts.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const u = new URL(`${origin}/e/${opts.idOrSlug}`);
  if (opts.visibility === 'unlisted' && opts.linkToken) u.searchParams.set('k', opts.linkToken);
  return u.toString();
}