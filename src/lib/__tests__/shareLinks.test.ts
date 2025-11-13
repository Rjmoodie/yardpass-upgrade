import { describe, it, expect } from 'vitest';
import { buildShareUrl, getShareTitle, getShareText } from '../shareLinks';

describe('shareLinks', () => {
  describe('buildShareUrl', () => {
    it('builds correct URL for event with default UTM', () => {
      const result = buildShareUrl({
        type: 'event',
        slug: 'summer-fest',
        title: 'Summer Festival',
      });

      expect(result).toBe(
        'https://liventix.com/e/summer-fest?utm_source=share&utm_medium=app&utm_campaign=event'
      );
    });

    it('builds correct URL for org', () => {
      const result = buildShareUrl({
        type: 'org',
        slug: 'awesome-events',
        name: 'Awesome Events LLC',
      });

      expect(result).toBe(
        'https://liventix.com/org/awesome-events?utm_source=share&utm_medium=app&utm_campaign=org'
      );
    });

    it('builds correct URL for user', () => {
      const result = buildShareUrl({
        type: 'user',
        handle: 'johndoe',
        name: 'John Doe',
      });

      expect(result).toBe(
        'https://liventix.com/u/johndoe?utm_source=share&utm_medium=app&utm_campaign=user'
      );
    });

    it('includes UTM parameters', () => {
      const result = buildShareUrl({
        type: 'event',
        slug: 'summer-fest',
        title: 'Summer Festival',
      });

      expect(result).toContain('utm_source=share');
      expect(result).toContain('utm_medium=app');
      expect(result).toContain('utm_campaign=event');
    });

    it('handles post type URLs', () => {
      const result = buildShareUrl({
        type: 'post',
        id: 'post123',
        eventSlug: 'summer-fest',
      });

      expect(result).toBe(
        'https://liventix.com/p/post123?utm_source=share&utm_medium=app&utm_campaign=post'
      );
    });
  });

  describe('getShareTitle', () => {
    it('returns event title', () => {
      expect(
        getShareTitle({
          type: 'event',
          slug: 'test',
          title: 'My Event',
        })
      ).toBe('My Event');
    });

    it('returns org name', () => {
      expect(
        getShareTitle({
          type: 'org',
          slug: 'test',
          name: 'My Org',
        })
      ).toBe('My Org');
    });

    it('returns user name', () => {
      expect(
        getShareTitle({
          type: 'user',
          handle: 'test',
          name: 'John Doe',
        })
      ).toBe('John Doe');
    });
  });

  describe('getShareText', () => {
    it('returns event text with city and date', () => {
      const result = getShareText({
        type: 'event',
        slug: 'test',
        title: 'Event',
        city: 'New York',
        date: '2024-06-15',
      });

      expect(result).toBe('New York • 2024-06-15');
    });

    it('returns event text with only city', () => {
      const result = getShareText({
        type: 'event',
        slug: 'test',
        title: 'Event',
        city: 'New York',
      });

      expect(result).toBe('New York');
    });

    it('returns default event text when no city or date', () => {
      const result = getShareText({
        type: 'event',
        slug: 'test',
        title: 'Event',
      });

      expect(result).toBe('Check out this event on Liventix');
    });

    it('returns org text', () => {
      const result = getShareText({
        type: 'org',
        slug: 'test',
        name: 'My Org',
      });

      expect(result).toBe('Check out this organizer on Liventix');
    });

    it('returns user text', () => {
      const result = getShareText({
        type: 'user',
        handle: 'test',
        name: 'John Doe',
      });

      expect(result).toBe('Check out this profile on Liventix');
    });
  });
});