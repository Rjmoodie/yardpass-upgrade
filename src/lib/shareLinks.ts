export type ShareTarget =
  | { type: 'event'; slug: string; title: string; date?: string; city?: string }
  | { type: 'post';  id: string;   title?: string;  eventSlug: string }
  | { type: 'org';   slug: string; name: string }
  | { type: 'user';  handle: string; name: string };

export function buildShareUrl(t: ShareTarget) {
  // Use liventix.tech as the base domain (matches app deployment)
  const base =
    t.type === 'event' ? `https://liventix.tech/e/${t.slug}` :
    t.type === 'post'  ? `https://liventix.tech/p/${t.id}`    :
    t.type === 'org'   ? `https://liventix.tech/org/${t.slug}` :
                         `https://liventix.tech/u/${t.handle}`;
  const qs = new URLSearchParams({
    utm_source: 'share', utm_medium: 'app', utm_campaign: t.type
  });
  return `${base}?${qs.toString()}`;
}

export function getShareTitle(target: ShareTarget): string {
  switch (target.type) {
    case 'event':
      return target.title;
    case 'post':
      return target.title || 'Post';
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
      return parts.length > 0 ? parts.join(' • ') : 'Check out this event on Liventix';
    case 'post':
      return `From ${target.eventSlug}`;
    case 'org':
      return 'Check out this organizer on Liventix';
    case 'user':
      return 'Check out this profile on Liventix';
  }
}