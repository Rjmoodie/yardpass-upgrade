export type FeedItem =
  | {
      item_type: "event";
      item_id: string;
      event_id: string;
      event_title: string;
      event_description?: string;
      event_cover_image?: string | null;
      event_starts_at?: string | null;
      event_location?: string | null;
      event_organizer?: string | null;
      event_organizer_id?: string | null;
      event_owner_context_type?: string | null;
    }
  | {
      item_type: "post";
      item_id: string; // post_id
      event_id: string;
      event_title: string;
      event_description?: string;
      event_starts_at?: string | null;
      event_cover_image?: string;
      event_organizer?: string;
      event_organizer_id?: string;
      event_owner_context_type?: string;
      event_location?: string;
      media_urls?: string[] | null;
      like_count?: number;
      comment_count?: number;
      viewer_has_liked?: boolean;
      author_user_id?: string | null;
      author_name?: string | null;
    };