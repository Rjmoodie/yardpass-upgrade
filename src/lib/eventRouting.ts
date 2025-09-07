/**
 * Event routing utilities that prefer SEO-friendly slugs over UUIDs
 */

import { routes } from './routes';

export interface EventIdentifier {
  id: string;
  slug?: string | null;
}

/**
 * Gets the best route for an event, preferring slug over UUID
 * @param event - Event with id and optional slug
 * @returns The best route for the event
 */
export function getEventRoute(event: EventIdentifier): string {
  // Use slug if available and valid, otherwise fall back to UUID
  const identifier = event.slug || event.id;
  return routes.event(identifier);
}

/**
 * Gets the tickets route for an event
 * @param event - Event with id and optional slug
 * @returns The tickets route for the event
 */
export function getEventTicketsRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.eventTickets(identifier);
}

/**
 * Gets the details route for an event
 * @param event - Event with id and optional slug
 * @returns The details route for the event
 */
export function getEventDetailsRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.eventDetails(identifier);
}

/**
 * Gets the location route for an event
 * @param event - Event with id and optional slug
 * @returns The location route for the event
 */
export function getEventLocationRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.eventLocation(identifier);
}

/**
 * Gets the attendees route for an event
 * @param event - Event with id and optional slug
 * @returns The attendees route for the event
 */
export function getEventAttendeesRoute(event: EventIdentifier): string {
  const identifier = event.slug || event.id;
  return routes.attendees(identifier);
}

/**
 * Determines if a string is likely a UUID
 * @param str - String to test
 * @returns True if string looks like a UUID
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Parses an event identifier from URL param
 * Returns both the identifier and whether it's a UUID or slug
 * @param param - URL parameter (could be UUID or slug)
 * @returns Object with identifier and type
 */
export function parseEventIdentifier(param: string): { identifier: string; isUUID: boolean } {
  return {
    identifier: param,
    isUUID: isUUID(param)
  };
}