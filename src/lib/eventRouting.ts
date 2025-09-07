/**
 * Event routing utilities that prefer SEO-friendly slugs over UUIDs
 */

import { routes } from './routes';

export interface EventIdentifier {
  id: string;          // uuid fallback
  slug?: string | null;
}

/** True if string looks like a UUID */
export function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function getEventRoute(event: EventIdentifier): string {
  const identifier = event.slug && event.slug.length ? event.slug : event.id;
  // Assuming routes.event("/e/:identifier")
  return routes.event(identifier);
}

export function getEventTicketsRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.eventTickets(identifier);
}

export function getEventDetailsRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.eventDetails(identifier);
}

export function getEventLocationRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.eventLocation(identifier);
}

export function getEventAttendeesRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.attendees(identifier);
}

/** For parsing /e/:identifier */
export function parseEventIdentifier(param: string): { identifier: string; isUUID: boolean } {
  return { identifier: param, isUUID: isUUID(param) };
}

/** Convenience for share URLs */
export function getEventShareUrl(origin: string, event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return `${origin.replace(/\/$/, '')}${routes.event(identifier)}`;
}
