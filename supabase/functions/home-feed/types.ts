export type FeedItem =
  | {
      item_type: "event";
      item_id: string;
      event_id: string;
      event_title: string;
      event_cover_image?: string | null;
      event_starts_at?: string | null;
      event_location?: string | null;
    }
  | {
      item_type: "post";
      item_id: string; // post_id
      event_id: string;
      event_title: string;
      media_urls?: string[] | null;
      like_count?: number;
      comment_count?: number;
      author_user_id?: string | null;
      author_name?: string | null;
    };