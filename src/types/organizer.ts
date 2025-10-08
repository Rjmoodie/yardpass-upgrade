export type OwnerContextType = 'individual' | 'organization';

export interface OrganizerEventSummary {
  id: string;
  title: string;
  status: string;
  date: string;
  attendees: number;
  revenue: number;
  views: number;
  likes: number;
  shares: number;
  tickets_sold: number;
  capacity: number;
  conversion_rate: number;
  engagement_rate: number;
  created_at: string;
  start_at: string;
  end_at: string;
  venue?: string;
  category?: string;
  cover_image_url?: string;
  description?: string;
  city?: string;
  visibility?: string;
  owner_context_type?: OwnerContextType;
  owner_context_id?: string | null;
  sponsor_count?: number;
  sponsor_revenue?: number;
}
