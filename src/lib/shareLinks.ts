export type ShareTarget =
  | { type: 'event'; slug: string; title: string; date?: string; city?: string }
  | { type: 'org'; slug: string; name: string }
  | { type: 'user'; handle: string; name: string };

export function buildShareUrl(target: ShareTarget, extra?: { ref?: string; utm?: Record<string, string> }) {
  const base =
    target.type === 'event' ? `https://yardpass.com/e/${target.slug}` :
    target.type === 'org'   ? `https://yardpass.com/org/${target.slug}` :
                             `https://yardpass.com/u/${target.handle}`;
  
  const params = new URLSearchParams({
    utm_source: 'share',
    utm_medium: 'app',
    utm_campaign: target.type,
    ...(extra?.ref ? { ref: extra.ref } : {}),
    ...(extra?.utm || {})
  });
  
  return `${base}?${params.toString()}`;
}

export function getShareTitle(target: ShareTarget): string {
  switch (target.type) {
    case 'event':
      return target.title;
    case 'org':
      return target.name;
    case 'user':
      return target.name;
  }
}

export function getShareText(target: ShareTarget): string {
  switch (target.type) {
    case 'event':
      const parts = [target.city, target.date].filter(Boolean);
      return parts.length > 0 ? parts.join(' • ') : 'Check out this event on YardPass';
    case 'org':
      return 'Check out this organizer on YardPass';
    case 'user':
      return 'Check out this profile on YardPass';
  }
}