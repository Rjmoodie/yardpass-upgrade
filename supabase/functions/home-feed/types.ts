export type FeedSponsor = {
  name: string;
  logo_url?: string;
  tier?: string;
  amount_cents: number;
};

export type FeedMetrics = {
  likes: number;
  comments: number;
  viewer_has_liked: boolean;
  score?: number | null;
  [key: string]: unknown;
};

export type FeedItem =
  | {
      item_type: "event";
      sort_ts: string;
      item_id: string;
      event_id: string;
      event_title: string;
      event_description: string;
      event_starts_at: string | null;
      event_cover_image: string;
      event_organizer: string;
      event_organizer_id: string | null;
      event_created_by: string | null;
      event_owner_context_type: string;
      event_location: string;
      author_id: null;
      author_name: null;
      author_badge: null;
      author_social_links: null;
      media_urls: null;
      content: null;
      metrics: FeedMetrics;
      sponsor: FeedSponsor | null;
      sponsors: FeedSponsor[] | null;
      promotion?: Record<string, unknown> | null;
    }
  | {
      item_type: "post";
      sort_ts: string;
      item_id: string;
      event_id: string;
      event_title: string;
      event_description: string;
      event_starts_at: string | null;
      event_cover_image: string;
      event_organizer: string;
      event_organizer_id: string | null;
      event_created_by: string | null;
      event_owner_context_type: string;
      event_location: string;
      author_id: string | null;
      author_name: string | null;
      author_badge: string | null;
      author_social_links: any[] | null;
      media_urls: string[] | null;
      content: string | null;
      metrics: FeedMetrics;
      sponsor: null;
      sponsors: null;
      promotion?: Record<string, unknown> | null;
    };

export type FeedCursor = {
  cursorTs: string;
  cursorId: string;
  cursorScore?: number | null;
};

export type FeedResponse = {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
};
