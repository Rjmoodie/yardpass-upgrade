/**
 * Data Transformers
 * 
 * Utilities to transform database records into UI-friendly formats
 * for the New Design screens.
 */

import { DEFAULT_EVENT_COVER } from './constants';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400';

// =======================
// USER PROFILE TRANSFORMERS
// =======================

export function transformUserProfile(dbProfile: any) {
  if (!dbProfile) return null;
  
  return {
    name: dbProfile.display_name || 'User',
    username: `@${dbProfile.username || dbProfile.user_id?.slice(0, 8) || 'user'}`,
    avatar: dbProfile.photo_url || DEFAULT_AVATAR,
    coverImage: dbProfile.cover_photo_url || DEFAULT_EVENT_COVER,
    bio: dbProfile.bio || '',
    location: dbProfile.location || '',
    website: dbProfile.website || '',
    stats: {
      posts: dbProfile.posts_count || 0,
      followers: dbProfile.followers_count || 0,
      following: dbProfile.following_count || 0
    },
    socialLinks: {
      instagram: dbProfile.instagram_handle || undefined,
      twitter: dbProfile.twitter_handle || undefined
    }
  };
}

// =======================
// TICKET TRANSFORMERS
// =======================

export function transformTicket(dbTicket: any) {
  if (!dbTicket) return null;
  
  const event = dbTicket.events || {};
  const tier = dbTicket.ticket_tiers || {};
  
  return {
    id: dbTicket.id,
    eventName: event.title || 'Event',
    date: event.start_at ? new Date(event.start_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : 'TBA',
    time: event.start_at ? new Date(event.start_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }) : 'TBA',
    location: event.venue || 'Location TBA',
    address: event.address || '',
    image: event.cover_image_url || DEFAULT_EVENT_COVER,
    qrCode: dbTicket.qr_code || '',
    status: dbTicket.status || 'active',
    tierName: tier.name || 'General Admission',
    price: tier.price_cents ? `$${(tier.price_cents / 100).toFixed(2)}` : 'Free'
  };
}

export function transformTickets(dbTickets: any[]) {
  return (dbTickets || []).map(transformTicket).filter(Boolean);
}

// =======================
// EVENT TRANSFORMERS
// =======================

export function transformEvent(dbEvent: any) {
  if (!dbEvent) return null;
  
  const firstTier = dbEvent.ticket_tiers?.[0];
  
  return {
    id: dbEvent.id,
    title: dbEvent.title || 'Untitled Event',
    date: dbEvent.start_at ? new Date(dbEvent.start_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) : 'TBA',
    time: dbEvent.start_at && dbEvent.end_at 
      ? `${new Date(dbEvent.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${new Date(dbEvent.end_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : 'Time TBA',
    location: dbEvent.venue || 'Location TBA',
    address: dbEvent.address || '',
    city: dbEvent.city || '',
    image: dbEvent.cover_image_url || DEFAULT_EVENT_COVER,
    category: dbEvent.category || 'Other',
    description: dbEvent.description || '',
    price: firstTier?.price_cents 
      ? `$${(firstTier.price_cents / 100).toFixed(2)}`
      : 'Free',
    organizer: {
      name: dbEvent.user_profiles?.display_name || 'Organizer',
      avatar: dbEvent.user_profiles?.photo_url || DEFAULT_AVATAR,
      verified: dbEvent.user_profiles?.verified || false
    },
    stats: {
      interested: dbEvent.interested_count || 0,
      attending: dbEvent.attendee_count || 0
    },
    visibility: dbEvent.visibility || 'public'
  };
}

export function transformEvents(dbEvents: any[]) {
  return (dbEvents || []).map(transformEvent).filter(Boolean);
}

// =======================
// POST TRANSFORMERS
// =======================

export function transformPost(dbPost: any) {
  if (!dbPost) return null;
  
  return {
    id: dbPost.id,
    image: dbPost.media_urls?.[0] || '',
    video: dbPost.media_urls?.find((url: string) => url.includes('mux')) || null,
    likes: dbPost.metrics?.likes || 0,
    comments: dbPost.metrics?.comments || 0,
    type: dbPost.event_id ? 'event' : 'post',
    content: dbPost.content_text || '',
    createdAt: dbPost.created_at,
    author: {
      id: dbPost.author_user_id,
      name: dbPost.author_name || 'User',
      avatar: dbPost.author_photo || DEFAULT_AVATAR
    }
  };
}

export function transformPosts(dbPosts: any[]) {
  return (dbPosts || []).map(transformPost).filter(Boolean);
}

// =======================
// NOTIFICATION TRANSFORMERS
// =======================

export function transformNotification(dbNotification: any, type: 'like' | 'comment' | 'follow') {
  if (!dbNotification) return null;
  
  const user = dbNotification.user_profiles || {};
  const timeAgo = getTimeAgo(dbNotification.created_at);
  
  return {
    id: dbNotification.id,
    type,
    user: {
      name: user.display_name || 'User',
      avatar: user.photo_url || DEFAULT_AVATAR
    },
    message: getNotificationMessage(type),
    time: timeAgo,
    isRead: dbNotification.is_read || false,
    createdAt: dbNotification.created_at
  };
}

function getNotificationMessage(type: string): string {
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'comment':
      return 'commented on your post';
    case 'follow':
      return 'started following you';
    default:
      return 'interacted with you';
  }
}

// =======================
// MESSAGE/CONVERSATION TRANSFORMERS
// =======================

export function transformConversation(dbConversation: any) {
  if (!dbConversation) return null;
  
  const otherParticipant = dbConversation.participants?.[0];
  const lastMessage = dbConversation.last_message;
  
  return {
    id: dbConversation.id,
    user: {
      name: otherParticipant?.display_name || 'User',
      avatar: otherParticipant?.photo_url || DEFAULT_AVATAR,
      status: otherParticipant?.is_online ? 'online' : 'offline'
    },
    lastMessage: lastMessage?.text || '',
    time: getTimeAgo(lastMessage?.created_at),
    unread: dbConversation.unread_count || 0
  };
}

export function transformConversations(dbConversations: any[]) {
  return (dbConversations || []).map(transformConversation).filter(Boolean);
}

export function transformMessage(dbMessage: any) {
  if (!dbMessage) return null;
  
  return {
    id: dbMessage.id,
    text: dbMessage.text || '',
    sender: {
      id: dbMessage.sender_id,
      name: dbMessage.sender_name || 'User',
      avatar: dbMessage.sender_photo || DEFAULT_AVATAR
    },
    timestamp: dbMessage.created_at,
    isOwn: false // Set by calling component based on current user
  };
}

export function transformMessages(dbMessages: any[]) {
  return (dbMessages || []).map(transformMessage).filter(Boolean);
}

// =======================
// UTILITY FUNCTIONS
// =======================

function getTimeAgo(dateString: string): string {
  if (!dateString) return 'Just now';
  
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export { getTimeAgo };

