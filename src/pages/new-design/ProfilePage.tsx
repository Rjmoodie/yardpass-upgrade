import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Settings, Share2, Grid3x3, Calendar, Heart, Users, MapPin, Instagram, Twitter, Globe, ExternalLink, UserPlus, UserMinus, Shield, LogOut, Palette } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { useUserConnections } from "@/hooks/useUserConnections";
import { useFollow } from "@/hooks/useFollow";
import { useTickets } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationSystem } from "@/components/NotificationSystem";

interface UserProfile {
  user_id: string;
  display_name: string;
  username: string | null;
  photo_url: string | null;
  cover_photo_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  role?: 'attendee' | 'organizer';
}

interface Post {
  id: string;
  media_urls: string[];
  likes: number;
  comments: number;
  type: 'post' | 'event';
  event_id?: string;
}

interface UserEvent {
  id: string;
  title: string;
  cover_image_url: string | null;
  start_at: string;
}

export function ProfilePage() {
  const { user: currentUser } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const targetUserId = userId || currentUser?.id;
  
  const [activeTab, setActiveTab] = useState<'posts' | 'events' | 'saved'>('posts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [savedEvents, setSavedEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { following, followers } = useUserConnections(targetUserId);
  const { tickets } = useTickets();
  const { state: followState, follow, unfollow, loading: followLoading } = useFollow({
    type: 'user',
    id: targetUserId || ''
  });
  
  const isOwnProfile = !userId || userId === currentUser?.id;

  // Fetch profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', targetUserId)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId]);

  // Fetch user posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!targetUserId) return;

      try {
        const { data, error } = await supabase
          .from('event_posts')
          .select(`
            id,
            content_text,
            media_urls,
            created_at,
            event_id,
            event_reactions!event_reactions_post_id_fkey (kind)
          `)
          .eq('author_user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const transformed: Post[] = (data || []).map(post => {
          const reactions = post.event_reactions || [];
          const likeCount = reactions.filter((r: any) => r.kind === 'like').length;
          const commentCount = reactions.filter((r: any) => r.kind === 'comment').length;
          
          return {
            id: post.id,
            media_urls: post.media_urls || [],
            likes: likeCount,
            comments: commentCount,
            type: post.event_id ? 'event' : 'post',
            event_id: post.event_id || undefined
          };
        }).filter(post => post.media_urls.length > 0); // Only show posts with media

        setPosts(transformed);
      } catch (error) {
        console.error('Error loading posts:', error);
      }
    };

    loadPosts();
  }, [targetUserId]);

  // Fetch user events
  useEffect(() => {
    const loadEvents = async () => {
      if (!targetUserId) return;

      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, cover_image_url, start_at')
          .eq('created_by', targetUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error loading events:', error);
      }
    };

    loadEvents();
  }, [targetUserId]);

  // Fetch saved events (if own profile)
  useEffect(() => {
    const loadSavedEvents = async () => {
      if (!isOwnProfile || !targetUserId) return;

      try {
        const { data, error } = await supabase
          .from('saved_events')
          .select(`
            event_id,
            events (
              id,
              title,
              cover_image_url,
              start_at
            )
          `)
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });

        if (error) {
          // Table might not exist yet
          console.log('Saved events table not available');
          return;
        }

        const transformed = (data || [])
          .filter(item => item.events)
          .map(item => item.events as UserEvent);
        
        setSavedEvents(transformed);
      } catch (error) {
        console.error('Error loading saved events:', error);
      }
    };

    loadSavedEvents();
  }, [targetUserId, isOwnProfile]);

  // Determine content to show based on active tab
  const displayContent = useMemo(() => {
    if (activeTab === 'posts') {
      return posts.map(p => ({
        id: p.id,
        image: p.media_urls[0],
        likes: p.likes,
        type: p.type,
        event_id: p.event_id
      }));
    } else if (activeTab === 'events') {
      return events.map(e => ({
        id: e.id,
        image: e.cover_image_url || '',
        likes: 0,
        type: 'event' as const,
        event_id: e.id
      }));
    } else {
      return savedEvents.map(e => ({
        id: e.id,
        image: e.cover_image_url || '',
        likes: 0,
        type: 'event' as const,
        event_id: e.id
      }));
    }
  }, [activeTab, posts, events, savedEvents]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${profile?.display_name || 'User'} on Yardpass`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied!', description: 'Profile link copied to clipboard' });
    }
  };

  // Loading state
  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#FF8C00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Cover Image */}
      <div className="relative h-32 overflow-hidden sm:h-48 md:h-64">
        <ImageWithFallback
          src={profile.cover_photo_url || 'https://images.unsplash.com/photo-1656283384093-1e227e621fad?w=1200'}
          alt="Cover"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        
        {/* Header Actions */}
        <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
          {/* Organizer Mode Toggle (Own Profile Only) */}
          {isOwnProfile && (
            <button
              onClick={async () => {
                try {
                  const newRole = profile?.role === 'organizer' ? 'attendee' : 'organizer';
                  const { error } = await supabase
                    .from('user_profiles')
                    .update({ role: newRole })
                    .eq('user_id', currentUser?.id);

                  if (error) throw error;

                  toast({
                    title: 'Role Updated',
                    description: `Switched to ${newRole === 'organizer' ? 'Organizer' : 'Attendee'} mode`,
                  });

                  // Refresh profile
                  window.location.reload();
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: 'Failed to update role',
                    variant: 'destructive',
                  });
                }
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-all sm:h-10 sm:w-10 ${
                profile?.role === 'organizer'
                  ? 'border-[#FF8C00]/50 bg-[#FF8C00]/20 hover:bg-[#FF8C00]/30'
                  : 'border-white/20 bg-black/40 hover:bg-black/60'
              }`}
              title={profile?.role === 'organizer' ? 'Switch to Attendee' : 'Become Organizer'}
            >
              <Shield className={`h-4 w-4 sm:h-5 sm:w-5 ${profile?.role === 'organizer' ? 'text-[#FF8C00]' : 'text-white'}`} />
            </button>
          )}
          
          {/* Notification Bell */}
          {isOwnProfile && (
            <NotificationSystem />
          )}
          
          {/* Theme Toggle */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md sm:h-10 sm:w-10">
            <ThemeToggle />
          </div>
          
          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
          >
            <Share2 className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </button>
          
          {isOwnProfile && (
            <>
              {/* Settings */}
              <button 
                onClick={() => navigate('/edit-profile')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
              >
                <Settings className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </button>
              
              {/* Sign Out */}
              <button 
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                    toast({ title: 'Signed out', description: 'You have been signed out successfully.' });
                    navigate('/auth');
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to sign out. Please try again.',
                      variant: 'destructive',
                    });
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 backdrop-blur-md transition-all hover:bg-red-500/20 sm:h-10 sm:w-10"
              >
                <LogOut className="h-4 w-4 text-red-400 sm:h-5 sm:w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative px-3 sm:px-4 md:px-6">
        {/* Avatar */}
        <div className="relative -mt-12 mb-4 sm:-mt-16">
          <div className="inline-block rounded-full border-4 border-black bg-black">
            <ImageWithFallback
              src={profile.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&size=200`}
              alt={profile.display_name}
              className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
            />
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-4">
          <h1 className="mb-1 text-2xl font-bold text-white sm:text-3xl">{profile.display_name}</h1>
          <p className="mb-3 text-sm text-white/60 sm:text-base">
            @{profile.username || profile.user_id.slice(0, 8)}
          </p>
          
          {/* Bio */}
          {profile.bio && (
            <p className="mb-3 text-sm leading-relaxed text-white/80 sm:text-base">
              {profile.bio}
            </p>
          )}

          {/* Location & Website */}
          {(profile.location || profile.website) && (
            <div className="mb-4 flex flex-wrap gap-3 text-sm text-white/60">
              {profile.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  <a 
                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#FF8C00] transition-colors flex items-center gap-1"
                  >
                    {profile.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Social Links */}
          {(profile.instagram_handle || profile.twitter_handle) && (
            <div className="mb-4 flex gap-3">
              {profile.instagram_handle && (
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
                >
                  <Instagram className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </a>
              )}
              {profile.twitter_handle && (
                <a
                  href={`https://twitter.com/${profile.twitter_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
                >
                  <Twitter className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </a>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:gap-4 sm:p-5">
            <div className="text-center">
              <p className="mb-1 text-lg font-bold text-white sm:text-xl">
                {isOwnProfile ? tickets.length : posts.length}
              </p>
              <p className="text-xs text-white/60 sm:text-sm">
                {isOwnProfile ? 'Events' : 'Posts'}
              </p>
            </div>
            <button 
              onClick={() => navigate(`/u/${targetUserId}/followers`)}
              className="text-center transition-opacity hover:opacity-80"
            >
              <p className="mb-1 text-lg font-bold text-white sm:text-xl">{followers.length.toLocaleString()}</p>
              <p className="text-xs text-white/60 sm:text-sm">Followers</p>
            </button>
            <button 
              onClick={() => navigate(`/u/${targetUserId}/following`)}
              className="text-center transition-opacity hover:opacity-80"
            >
              <p className="mb-1 text-lg font-bold text-white sm:text-xl">{following.length}</p>
              <p className="text-xs text-white/60 sm:text-sm">Following</p>
            </button>
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-2 mb-6">
              <button 
                onClick={async () => {
                  if (!currentUser) {
                    navigate('/auth');
                    return;
                  }
                  try {
                    if (followState === 'accepted') {
                      await unfollow();
                      toast({ title: 'Unfollowed', description: `You unfollowed ${profile?.display_name}` });
                    } else {
                      await follow();
                      toast({ title: 'Following', description: `You are now following ${profile?.display_name}` });
                    }
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to update follow status',
                      variant: 'destructive'
                    });
                  }
                }}
                disabled={followLoading}
                className={`flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all active:scale-95 sm:text-base ${
                  followState === 'accepted'
                    ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
                    : 'bg-[#FF8C00] text-white hover:bg-[#FF9D1A]'
                }`}
              >
                {followLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : followState === 'accepted' ? (
                  <>
                    <UserMinus className="h-4 w-4" />
                    Following
                  </>
                ) : followState === 'pending' ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Pending
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Follow
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  if (!currentUser) {
                    navigate('/auth');
                    return;
                  }
                  navigate(`/messages?to=${targetUserId}`);
                }}
                className="flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-95 sm:text-base"
              >
                Message
              </button>
            </div>
          )}

        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex flex-1 items-center justify-center gap-2 pb-3 text-sm transition-all sm:text-base ${
              activeTab === 'posts'
                ? 'border-b-2 border-[#FF8C00] text-white font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Grid3x3 className="h-4 w-4 sm:h-5 sm:w-5" />
            Posts
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex flex-1 items-center justify-center gap-2 pb-3 text-sm transition-all sm:text-base ${
              activeTab === 'events'
                ? 'border-b-2 border-[#FF8C00] text-white font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Events
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex flex-1 items-center justify-center gap-2 pb-3 text-sm transition-all sm:text-base ${
                activeTab === 'saved'
                  ? 'border-b-2 border-[#FF8C00] text-white font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              Saved
            </button>
          )}
        </div>

        {/* Content Grid */}
        {displayContent.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
            {displayContent.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  if (post.type === 'event' || post.event_id) {
                    navigate(`/e/${post.event_id || post.id}`);
                  } else {
                    navigate(`/post/${post.id}`);
                  }
                }}
                className="group relative aspect-square overflow-hidden rounded-lg bg-white/5 sm:rounded-xl"
              >
                <ImageWithFallback
                  src={post.image}
                  alt="Post"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="flex items-center gap-1 text-white">
                    <Heart className="h-4 w-4 fill-white sm:h-5 sm:w-5" />
                    <span className="text-xs font-semibold sm:text-sm">{post.likes}</span>
                  </div>
                </div>

                {/* Event Badge */}
                {post.type === 'event' && (
                  <div className="absolute right-1 top-1 rounded-full bg-[#FF8C00] px-2 py-0.5 text-[10px] font-semibold text-white sm:text-xs">
                    Event
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              {activeTab === 'posts' && <Grid3x3 className="h-8 w-8 text-white/30" />}
              {activeTab === 'events' && <Calendar className="h-8 w-8 text-white/30" />}
              {activeTab === 'saved' && <Heart className="h-8 w-8 text-white/30" />}
            </div>
            <h3 className="mb-2 text-lg font-bold text-white">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'events' && 'No events yet'}
              {activeTab === 'saved' && 'No saved items yet'}
            </h3>
            <p className="text-sm text-white/60">
              {activeTab === 'posts' && 'Share your event experiences to see them here'}
              {activeTab === 'events' && isOwnProfile && 'Create your first event to get started'}
              {activeTab === 'events' && !isOwnProfile && 'No events created yet'}
              {activeTab === 'saved' && 'Save posts and events you love'}
            </p>
            {isOwnProfile && activeTab === 'events' && (
              <button 
                onClick={() => navigate('/create-event')}
                className="mt-6 rounded-full bg-[#FF8C00] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF9D1A] active:scale-95"
              >
                Create Event
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
