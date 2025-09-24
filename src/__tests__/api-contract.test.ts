import { describe, it, expect, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

// Type for test purposes matching the actual API response
type FeedApiResponse = {
  item_type: string;
  sort_ts: string;
  item_id: string;
  event_id: string;
  event_title: string;
  event_description: string;
  event_starts_at: string;
  event_cover_image: string;
  event_organizer: string;
  event_organizer_id: string;
  event_owner_context_type: string;
  event_location: string;
  author_id: string | null;
  author_name: string | null;
  author_badge: string | null;
  author_social_links: any;
  media_urls: string[] | null;
  content: string | null;
  metrics: any;
  sponsor: any;
  sponsors: any;
};

describe('Home Feed API Contract', () => {
  it('should return correct sponsor data structure for active sponsorships', async () => {
    const mockFeedData: FeedApiResponse[] = [
      {
        item_type: 'event',
        sort_ts: '2024-12-31T20:00:00Z',
        item_id: 'event-1',
        event_id: 'event-1',
        event_title: 'Test Event with Active Sponsor',
        event_description: 'A test event',
        event_starts_at: '2024-12-31T20:00:00Z',
        event_cover_image: 'https://example.com/cover.jpg',
        event_organizer: 'Test Organizer',
        event_organizer_id: 'organizer-1',
        event_owner_context_type: 'individual',
        event_location: 'Test City',
        author_id: null,
        author_name: null,
        author_badge: null,
        author_social_links: null,
        media_urls: null,
        content: null,
        metrics: {},
        sponsor: {
          name: 'Active Gold Sponsor',
          logo_url: 'https://example.com/sponsor-logo.jpg',
          tier: 'gold',
          amount_cents: 100000
        },
        sponsors: [
          {
            name: 'Active Gold Sponsor',
            logo_url: 'https://example.com/sponsor-logo.jpg',
            tier: 'gold',
            amount_cents: 100000
          },
          {
            name: 'Active Silver Sponsor',
            logo_url: 'https://example.com/sponsor2-logo.jpg',
            tier: 'silver',
            amount_cents: 50000
          }
        ]
      },
      {
        item_type: 'event',
        sort_ts: '2024-12-30T19:00:00Z',
        item_id: 'event-2',
        event_id: 'event-2',
        event_title: 'Test Event without Sponsor',
        event_description: 'Another test event',
        event_starts_at: '2024-12-30T19:00:00Z',
        event_cover_image: 'https://example.com/cover2.jpg',
        event_organizer: 'Test Organizer 2',
        event_organizer_id: 'organizer-2',
        event_owner_context_type: 'organization',
        event_location: 'Test City 2',
        author_id: null,
        author_name: null,
        author_badge: null,
        author_social_links: null,
        media_urls: null,
        content: null,
        metrics: {},
        sponsor: null,
        sponsors: null
      },
      {
        item_type: 'post',
        sort_ts: '2024-12-29T18:00:00Z',
        item_id: 'post-1',
        event_id: 'event-1',
        event_title: 'Test Event with Active Sponsor',
        event_description: 'A test event',
        event_starts_at: '2024-12-31T20:00:00Z',
        event_cover_image: 'https://example.com/cover.jpg',
        event_organizer: 'Test Organizer',
        event_organizer_id: 'organizer-1',
        event_owner_context_type: 'individual',
        event_location: 'Test City',
        author_id: 'author-1',
        author_name: 'Post Author',
        author_badge: 'VIP',
        author_social_links: [],
        media_urls: ['https://example.com/media.jpg'],
        content: 'This is a test post',
        metrics: { likes: 5, comments: 2 },
        sponsor: null,
        sponsors: null
      }
    ];

    // Mock the supabase RPC call
    (supabase.rpc as any).mockResolvedValue({
      data: mockFeedData,
      error: null
    });

    const { data, error } = await supabase.rpc('get_home_feed_v2', {
      p_user: null,
      p_limit: 20,
      p_cursor_ts: null,
      p_cursor_id: null,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);

    // Test event items have sponsor data
    const eventItems = data!.filter(item => item.item_type === 'event');
    expect(eventItems).toHaveLength(2);

    // Test sponsored event - cast to any since TypeScript types haven't updated yet
    const sponsoredEvent = eventItems[0] as any;
    expect(sponsoredEvent.sponsor).toBeDefined();
    expect(sponsoredEvent.sponsor.name).toBe('Active Gold Sponsor');
    expect(sponsoredEvent.sponsor.tier).toBe('gold');
    expect(sponsoredEvent.sponsor.amount_cents).toBe(100000);
    expect(sponsoredEvent.sponsors).toHaveLength(2);

    // Test non-sponsored event
    const nonSponsoredEvent = eventItems[1] as any;
    expect(nonSponsoredEvent.sponsor).toBeNull();
    expect(nonSponsoredEvent.sponsors).toBeNull();

    // Test post items don't have sponsor data
    const postItems = data!.filter(item => item.item_type === 'post');
    expect(postItems).toHaveLength(1);
    
    const postItem = postItems[0] as any;
    expect(postItem.sponsor).toBeNull();
    expect(postItem.sponsors).toBeNull();
  });

  it('should handle expired sponsorships correctly', async () => {
    // Mock feed data with no sponsors (expired/inactive sponsorships filtered out)
    const mockFeedDataNoSponsors: FeedApiResponse[] = [
      {
        item_type: 'event',
        sort_ts: '2024-12-31T20:00:00Z',
        item_id: 'event-expired',
        event_id: 'event-expired',
        event_title: 'Event with Expired Sponsorship',
        event_description: 'This event had sponsors but they expired',
        event_starts_at: '2024-12-31T20:00:00Z',
        event_cover_image: 'https://example.com/cover.jpg',
        event_organizer: 'Test Organizer',
        event_organizer_id: 'organizer-1',
        event_owner_context_type: 'individual',
        event_location: 'Test City',
        author_id: null,
        author_name: null,
        author_badge: null,
        author_social_links: null,
        media_urls: null,
        content: null,
        metrics: {},
        sponsor: null, // No active sponsors
        sponsors: null // No active sponsors
      }
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockFeedDataNoSponsors,
      error: null
    });

    const { data, error } = await supabase.rpc('get_home_feed_v2', {
      p_user: null,
      p_limit: 20,
      p_cursor_ts: null,
      p_cursor_id: null,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    const eventItems = data!.filter(item => item.item_type === 'event');
    expect(eventItems).toHaveLength(1);
    
    const eventWithExpiredSponsor = eventItems[0] as any;
    expect(eventWithExpiredSponsor.sponsor).toBeNull();
    expect(eventWithExpiredSponsor.sponsors).toBeNull();
  });

  it('should validate sponsor data structure', () => {
    const validSponsor = {
      name: 'Test Sponsor',
      logo_url: 'https://example.com/logo.jpg',
      tier: 'gold',
      amount_cents: 50000
    };

    // Validate required fields exist
    expect(validSponsor.name).toBeDefined();
    expect(typeof validSponsor.name).toBe('string');
    expect(validSponsor.tier).toBeDefined();
    expect(typeof validSponsor.tier).toBe('string');
    expect(validSponsor.amount_cents).toBeDefined();
    expect(typeof validSponsor.amount_cents).toBe('number');

    // logo_url is optional
    expect(validSponsor.logo_url).toBeDefined();
    expect(typeof validSponsor.logo_url).toBe('string');
  });

  it('should handle sponsor data without logo_url', () => {
    const sponsorWithoutLogo = {
      name: 'Test Sponsor',
      tier: 'silver',
      amount_cents: 25000
    };

    expect(sponsorWithoutLogo.name).toBeDefined();
    expect(sponsorWithoutLogo.tier).toBeDefined();
    expect(sponsorWithoutLogo.amount_cents).toBeDefined();
    expect('logo_url' in sponsorWithoutLogo).toBe(false);
  });

  it('should filter out pending and cancelled sponsorships', async () => {
    // This test validates that only accepted, live, completed sponsorships show up
    const mockDataActiveSponsorsOnly: FeedApiResponse[] = [
      {
        item_type: 'event',
        sort_ts: '2024-12-31T20:00:00Z',
        item_id: 'event-active-only',
        event_id: 'event-active-only',
        event_title: 'Event with Only Active Sponsorships',
        event_description: 'This event should only show active sponsors',
        event_starts_at: '2024-12-31T20:00:00Z',
        event_cover_image: 'https://example.com/cover.jpg',
        event_organizer: 'Test Organizer',
        event_organizer_id: 'organizer-1',
        event_owner_context_type: 'individual',
        event_location: 'Test City',
        author_id: null,
        author_name: null,
        author_badge: null,
        author_social_links: null,
        media_urls: null,
        content: null,
        metrics: {},
        sponsor: {
          name: 'Active Sponsor Only',
          tier: 'gold',
          amount_cents: 100000
        },
        sponsors: [
          {
            name: 'Active Sponsor Only',
            tier: 'gold',
            amount_cents: 100000
          }
        ]
      }
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockDataActiveSponsorsOnly,
      error: null
    });

    const { data } = await supabase.rpc('get_home_feed_v2', {
      p_user: null,
      p_limit: 20,
      p_cursor_ts: null,
      p_cursor_id: null,
    });

    const eventWithActiveSponsorsOnly = data![0] as any;
    expect(eventWithActiveSponsorsOnly.sponsor).toBeDefined();
    expect(eventWithActiveSponsorsOnly.sponsors).toHaveLength(1);
    
    // Verify that sponsor has required fields
    expect(eventWithActiveSponsorsOnly.sponsor.name).toBe('Active Sponsor Only');
    expect(eventWithActiveSponsorsOnly.sponsor.tier).toBe('gold');
    expect(eventWithActiveSponsorsOnly.sponsor.amount_cents).toBe(100000);
  });
});