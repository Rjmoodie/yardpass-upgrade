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
        'https://yardpass.com/e/summer-fest?utm_source=share&utm_medium=app&utm_campaign=event'
      );
    });

    it('builds correct URL for org', () => {
      const result = buildShareUrl({
        type: 'org',
        slug: 'awesome-events',
        name: 'Awesome Events LLC',
      });

      expect(result).toBe(
        'https://yardpass.com/org/awesome-events?utm_source=share&utm_medium=app&utm_campaign=org'
      );
    });

    it('builds correct URL for user', () => {
      const result = buildShareUrl({
        type: 'user',
        handle: 'johndoe',
        name: 'John Doe',
      });

      expect(result).toBe(
        'https://yardpass.com/u/johndoe?utm_source=share&utm_medium=app&utm_campaign=user'
      );
    });

    it('preserves ref parameter', () => {
      const result = buildShareUrl(
        {
          type: 'event',
          slug: 'summer-fest',
          title: 'Summer Festival',
        },
        { ref: 'affiliate123' }
      );

      expect(result).toContain('ref=affiliate123');
    });

    it('merges custom UTM parameters', () => {
      const result = buildShareUrl(
        {
          type: 'event',
          slug: 'summer-fest',
          title: 'Summer Festival',
        },
        {
          utm: {
            utm_content: 'button',
            utm_term: 'festival',
          },
        }
      );

      expect(result).toContain('utm_content=button');
      expect(result).toContain('utm_term=festival');
      expect(result).toContain('utm_source=share'); // Default preserved
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

      expect(result).toBe('Check out this event on YardPass');
    });

    it('returns org text', () => {
      const result = getShareText({
        type: 'org',
        slug: 'test',
        name: 'My Org',
      });

      expect(result).toBe('Check out this organizer on YardPass');
    });

    it('returns user text', () => {
      const result = getShareText({
        type: 'user',
        handle: 'test',
        name: 'John Doe',
      });

      expect(result).toBe('Check out this profile on YardPass');
    });
  });
});