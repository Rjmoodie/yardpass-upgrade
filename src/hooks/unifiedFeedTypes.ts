export type FeedItem =
  | {
      item_type: 'event';
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
      event_is_flashback?: boolean;
      event_flashback_end_date?: string | null;
      event_linked_event_id?: string | null;
      event_flashback_explainer?: string | null;
      author_id: null;
      author_name: null;
      author_badge: null;
      author_social_links: null;
      media_urls: null;
      content: null;
      metrics: {
        likes: number;
        comments: number;
        viewer_has_liked?: boolean;
        [k: string]: any;
      };
      sponsor?: {
        name: string;
        logo_url?: string;
        tier: string;
        amount_cents: number;
      } | null;
      sponsors?: Array<{
        name: string;
        logo_url?: string;
        tier: string;
        amount_cents: number;
      }> | null;
      isPromoted?: boolean;
      promotion?: FeedPromotion | null;
    }
  | {
      item_type: 'post';
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
      event_is_flashback?: boolean;
      event_flashback_end_date?: string | null;
      event_linked_event_id?: string | null;
      event_flashback_explainer?: string | null;
      author_id: string | null;
      author_name: string | null;
      author_username: string | null;
      author_photo: string | null;
      author_badge: string | null;
      author_social_links: any[] | null;
      media_urls: string[] | null;
      content: string | null;
      created_at: string | null;
      metrics: {
        likes: number;
        comments: number;
        viewer_has_liked?: boolean;
        [k: string]: any;
      };
      sponsor?: null;
      sponsors?: null;
      isPromoted?: boolean;
      promotion?: FeedPromotion | null;
    };

export type FeedPromotion = {
  campaignId: string;
  creativeId?: string | null;
  impressionId?: string | null;
  placement?: 'feed' | 'search_results' | 'story' | 'event_banner';
  objective?: string | null;
  headline?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  priority?: number | null;
  pricingModel?: string | null;
  estimatedRate?: number | null;
  rateModel?: string | null;
  cpmRateCredits?: number | null;
  cpcRateCredits?: number | null;
  remainingCredits?: number | null;
  frequencyCapPerUser?: number | null;
  frequencyCapPeriod?: 'session' | 'day' | 'week' | null;
};

export type FeedCursor = {
  cursorTs: string;
  cursorId: string;
  cursorScore?: number | null;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
};
