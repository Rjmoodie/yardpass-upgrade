import { supabase } from '@/integrations/supabase/client';

export interface HomeFeedEvent {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;
  startAtISO: string;
  endAtISO?: string;
  dateLabel: string;
  location: string;
  coverImage: string;
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
  posts?: EventPost[];
  totalComments?: number;
  sponsor?: {
    name: string;
    logo_url?: string;
    tier: string;
  };
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

export interface EventPost {
  id: string;
  authorId?: string;
  authorName: string;
  authorBadge: 'ORGANIZER' | 'ATTENDEE';
  isOrganizer?: boolean;
  content: string;
  timestamp: string;
  likes: number;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  thumbnailUrl?: string;
  commentCount?: number;
  ticketBadge?: string;
}

export async function fetchHomeFeed(limit: number = 3): Promise<HomeFeedEvent[]> {
  try {
    const nowISO = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        category,
        start_at,
        end_at,
        venue,
        city,
        cover_image_url,
        organizations!inner(
          id,
          name
        ),
        event_sponsorships (
          sponsor_id,
          tier,
          status,
          sponsors (
            name,
            logo_url
          )
        )
      `)
      .eq('visibility', 'public')
      .gte('start_at', nowISO)            // ⬅️ filter out past events
      .order('start_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Home feed error:', error);
      throw error;
    }

    // Transform the data to match our interface
    const transformedData = (data || []).map((item: any): HomeFeedEvent => {
      // Get active sponsor if available
      const activeSponsor = item.event_sponsorships?.find((s: any) => s.status === 'active');
      
      return {
        id: item.id,
        title: item.title || 'Untitled Event',
        description: item.description || '',
        organizer: item.organizations?.name || 'Unknown',
        organizerId: item.organizations?.id || '',
        category: item.category || 'general',
        startAtISO: item.start_at,
        endAtISO: item.end_at,
        dateLabel: new Date(item.start_at).toLocaleDateString(),
        location: `${item.venue || ''} ${item.city || ''}`.trim(),
        coverImage: item.cover_image_url || '',
        ticketTiers: [],
        attendeeCount: 0,
        likes: 0,
        shares: 0,
        isLiked: false,
        posts: [],
        totalComments: 0,
        sponsor: activeSponsor ? {
          name: activeSponsor.sponsors?.name,
          logo_url: activeSponsor.sponsors?.logo_url,
          tier: activeSponsor.tier
        } : undefined
      };
    });

    return transformedData;
  } catch (error) {
    console.error('Failed to fetch home feed:', error);
    throw error;
  }
}

export async function toggleEventLike(eventId: string, isLiked: boolean): Promise<void> {
  try {
    // For now, just log the action - implement actual like toggle later
    console.log('Toggling like for event:', eventId, 'Currently liked:', isLiked);
  } catch (error) {
    console.error('Failed to toggle event like:', error);
    throw error;
  }
}

export async function shareEvent(eventId: string): Promise<void> {
  try {
    // For now, just log the action - implement actual share increment later
    console.log('Sharing event:', eventId);
  } catch (error) {
    console.error('Failed to share event:', error);
    throw error;
  }
}

export function convertMuxUrl(url: string): string {
  if (!url) return url;
  
  // Convert Mux playback URLs to HLS format
  if (url.includes('mux.com') && !url.includes('.m3u8')) {
    return `${url}.m3u8`;
  }
  
  return url;
}

export function getMediaType(url: string): 'image' | 'video' | 'none' {
  if (!url) return 'none';
  
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m3u8'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  const lowercaseUrl = url.toLowerCase();
  
  if (videoExtensions.some(ext => lowercaseUrl.includes(ext)) || lowercaseUrl.includes('mux')) {
    return 'video';
  }
  
  if (imageExtensions.some(ext => lowercaseUrl.includes(ext))) {
    return 'image';
  }
  
  return 'none';
}