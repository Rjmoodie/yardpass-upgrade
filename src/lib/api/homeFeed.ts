import { supabase } from "@/integrations/supabase/client";

export type HomeFeedRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  start_at: string;
  end_at: string | null;
  venue: string | null;
  city: string | null;
  created_by: string;
  total_posts: number;
  total_comments: number;
  recent_posts: Array<{
    id: string;
    authorName: string | null;
    authorUserId: string;
    isOrganizer: boolean;
    content: string | null;
    mediaUrls: string[] | null;
    likes: number;
    commentCount: number;
    createdAt: string;
  }>;
};

export async function fetchHomeFeed(userId: string, limit = 20, offset = 0) {
  return supabase.rpc<HomeFeedRow>("get_home_feed", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });
}

export async function fetchTicketTiers(eventIds: string[]) {
  if (!eventIds.length) return { data: [], error: null as any };
  return supabase
    .from("ticket_tiers")
    .select("id,event_id,name,price_cents,badge_label,quantity,status")
    .in("event_id", eventIds)
    .eq("status", "active");
}
