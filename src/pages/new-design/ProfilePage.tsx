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
import { UsernameEditor } from "@/components/profile/UsernameEditor";
import CommentModal from "@/components/CommentModal";
import { muxToPoster } from "@/lib/video/muxClient";

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
  const { username } = useParams<{ username?: string }>();
  const navigate = useNavigate();
  const targetUserId = username || currentUser?.id;
  
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedEvents, setSavedEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state for viewing posts
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const { following, followers } = useUserConnections(targetUserId);
  const { tickets } = useTickets();
  const { state: followState, follow, unfollow, loading: followLoading } = useFollow({
    type: 'user',
    id: targetUserId || ''
  });
  
  const isOwnProfile = !username || username === currentUser?.id;

  // Fetch profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // First try to find by username (case-insensitive)
        let { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .ilike('username', targetUserId)
          .maybeSingle();

        // If no match by username, try by UUID
        if (!profileData && !profileError) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(targetUserId)) {
            ({ data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', targetUserId)
              .single());
          }
        }

        if (profileError) throw profileError;
        setProfile(profileData as unknown as UserProfile);

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
            text,
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
            type: (post.event_id ? 'event' : 'post') as 'post' | 'event',
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

  // Fetch saved events (if own profile)
  useEffect(() => {
    const loadSavedEvents = async () => {
      if (!isOwnProfile || !targetUserId) return;

      try {
        const { data, error } = await supabase
          .from('saved_events')
          .select(`
            id,
            event_id,
            events (
              id,
              title,
              cover_image_url,
              start_at
            )
          `)
          .eq('user_id', targetUserId)
          .order('saved_at', { ascending: false });

        if (error) throw error;

        // Transform the data
        const events: UserEvent[] = (data || []).map((item: any) => ({
          id: item.events.id,
          title: item.events.title,
          cover_image_url: item.events.cover_image_url,
          start_at: item.events.start_at,
        }));

        setSavedEvents(events);
      } catch (error) {
        console.error('Error loading saved events:', error);
        setSavedEvents([]);
      }
    };

    loadSavedEvents();
  }, [targetUserId, isOwnProfile]);

  // Determine content to show based on active tab
  const displayContent = useMemo(() => {
    if (activeTab === 'posts') {
      return posts.map(p => {
        // Convert Mux URLs to poster images
        const rawUrl = p.media_urls[0];
        const imageUrl = rawUrl?.startsWith('mux:') 
          ? muxToPoster(rawUrl) 
          : rawUrl;
        
        return {
          id: p.id,
          image: imageUrl,
          likes: p.likes,
          type: p.type,
          event_id: p.event_id
        };
      });
    } else {
      // Saved tab - show saved events
      return savedEvents.map(e => ({
        id: e.id,
        image: e.cover_image_url || '',
        likes: 0,
        type: 'event' as const,
        event_id: e.id
      }));
    }
  }, [activeTab, posts, savedEvents]);

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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Cover Image */}
      <div className="relative h-32 overflow-hidden sm:h-48 md:h-64">
        <ImageWithFallback
          src={profile.cover_photo_url || 'https://images.unsplash.com/photo-1656283384093-1e227e621fad?w=1200'}
          alt="Cover"
          className="h-full w-full object-cover"
        />
        {/* Enhanced gradient overlay for better icon visibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
        
        {/* Header Actions */}
        <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4 [&>*]:shadow-2xl [&>*]:shadow-black/50">
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

                  // Update local state immediately (no reload needed!)
                  setProfile(prev => prev ? { ...prev, role: newRole } : prev);

                  toast({
                    title: 'Role Updated',
                    description: `Switched to ${newRole === 'organizer' ? 'Organizer' : 'Attendee'} mode`,
                  });

                  // Navigate to appropriate home
                  if (newRole === 'organizer') {
                    navigate('/dashboard');
                  } else {
                    navigate('/');
                  }
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
                  ? 'border-primary/50 bg-primary/20 hover:bg-primary/30'
                  : 'border-border/20 bg-background/40 hover:bg-background/60'
              }`}
              title={profile?.role === 'organizer' ? 'Currently: Organizer Mode - Click to switch to Attendee' : 'Currently: Attendee Mode - Click to switch to Organizer'}
              aria-label={profile?.role === 'organizer' ? 'Switch to Attendee Mode' : 'Switch to Organizer Mode'}
            >
              <Shield className={`h-4 w-4 sm:h-5 sm:w-5 ${profile?.role === 'organizer' ? 'text-primary' : 'text-foreground'}`} />
            </button>
          )}
          
          {/* Notification Bell */}
          {isOwnProfile && (
            <NotificationSystem />
          )}
          
          {/* Theme Toggle */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border/50 bg-background/90 backdrop-blur-md shadow-lg sm:h-10 sm:w-10">
            <ThemeToggle />
          </div>
          
          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border/50 bg-background/90 backdrop-blur-md shadow-lg transition-all hover:bg-background hover:scale-105 sm:h-10 sm:w-10"
          >
            <Share2 className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
          </button>
          
          {isOwnProfile && (
            <>
              {/* Settings */}
              <button 
                onClick={() => navigate('/edit-profile')}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border/50 bg-background/90 backdrop-blur-md shadow-lg transition-all hover:bg-background hover:scale-105 sm:h-10 sm:w-10"
              >
                <Settings className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
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
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-500/90 backdrop-blur-md shadow-lg transition-all hover:bg-red-500 hover:scale-105 sm:h-10 sm:w-10"
              >
                <LogOut className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative px-3 sm:px-4 md:px-6">
        {/* Avatar */}
        <div className="relative -mt-12 mb-2 sm:-mt-16">
          <div className="inline-block rounded-full border-4 border-black bg-background">
            <ImageWithFallback
              src={profile.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&size=200`}
              alt={profile.display_name}
              className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
            />
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-2">
          {/* Name and Followers/Following */}
          <div className="flex items-center justify-between gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{profile.display_name}</h1>
            
            {/* Followers & Following */}
            <div className="flex items-center gap-3 text-sm">
              <button 
                onClick={() => navigate(`/profile/${targetUserId}/followers`)}
                className="flex items-center gap-1 transition-opacity hover:opacity-70"
              >
                <span className="font-bold text-foreground">{followers.length.toLocaleString()}</span>
                <span className="text-foreground/60">Followers</span>
              </button>
              <button 
                onClick={() => navigate(`/profile/${targetUserId}/following`)}
                className="flex items-center gap-1 transition-opacity hover:opacity-70"
              >
                <span className="font-bold text-foreground">{following.length}</span>
                <span className="text-foreground/60">Following</span>
              </button>
            </div>
          </div>
          {isOwnProfile ? (
            <div className="mb-1.5">
              <UsernameEditor
                currentUsername={profile.username}
                userId={profile.user_id}
                onUpdate={(newUsername) => {
                  setProfile({ ...profile, username: newUsername });
                  // Update URL if username changed
                  if (newUsername) {
                    navigate(`/profile/${newUsername}`, { replace: true });
                  }
                }}
              />
              
              {/* Current Mode Indicator */}
              <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-border/20 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                <Shield className={`h-3.5 w-3.5 ${profile?.role === 'organizer' ? 'text-primary' : 'text-foreground/60'}`} />
                <span className="text-xs font-medium text-foreground/80">
                  {profile?.role === 'organizer' ? 'Organizer Mode' : 'Attendee Mode'}
                </span>
              </div>
            </div>
          ) : (
            <p className="mb-1.5 text-sm text-foreground/60 sm:text-base">
              @{profile.username || profile.user_id.slice(0, 8)}
            </p>
          )}
          
          {/* Bio */}
          {profile.bio && (
            <p className="mb-2 text-sm leading-relaxed text-foreground/80 sm:text-base">
              {profile.bio}
            </p>
          )}

          {/* Location & Website */}
          {(profile.location || profile.website) && (
            <div className="mb-2 flex flex-wrap gap-3 text-sm text-foreground/60">
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
                    className="hover:text-primary transition-colors flex items-center gap-1"
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
            <div className="mb-2 flex gap-3">
              {profile.instagram_handle && (
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
                >
                  <Instagram className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
                </a>
              )}
              {profile.twitter_handle && (
                <a
                  href={`https://twitter.com/${profile.twitter_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
                >
                  <Twitter className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
                </a>
              )}
            </div>
          )}

          {/* Event Stats: Hosted vs Attended */}
          {isOwnProfile && (
            <div className="mb-3 rounded-2xl border border-border/10 bg-white/5 p-3 backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="mb-0.5 text-lg font-bold text-primary sm:text-xl">
                    {profile?.role === 'organizer' ? tickets.filter(t => t.organizer_id === currentUser?.id).length : 0}
                  </p>
                  <p className="text-xs text-foreground/60 sm:text-sm">Events Hosted</p>
                </div>
                <div className="text-center">
                  <p className="mb-0.5 text-lg font-bold text-primary sm:text-xl">
                    {tickets.length}
                  </p>
                  <p className="text-xs text-foreground/60 sm:text-sm">Events Attended</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-2 mb-3">
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
                    ? 'border border-border/20 bg-white/5 text-foreground hover:bg-white/10'
                    : 'bg-primary text-foreground hover:bg-primary/90'
                }`}
              >
                {followLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-border/20 border-t-white" />
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
                className="flex items-center justify-center gap-2 rounded-full border border-border/20 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-white/10 active:scale-95 sm:text-base"
              >
                Message
              </button>
            </div>
          )}

        </div>

        {/* Tabs */}
        <div className="mb-3 flex gap-2 border-b border-border/10">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex flex-1 items-center justify-center gap-1.5 pb-2 text-sm transition-all sm:text-base ${
              activeTab === 'posts'
                ? 'border-b-2 border-primary text-foreground font-semibold'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            <Grid3x3 className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Posts</span>
            <span className={`text-xs sm:text-sm ${
              activeTab === 'posts' ? 'text-foreground' : 'text-foreground/50'
            }`}>
              {posts.length}
            </span>
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex flex-1 items-center justify-center gap-1.5 pb-2 text-sm transition-all sm:text-base ${
                activeTab === 'saved'
                  ? 'border-b-2 border-primary text-foreground font-semibold'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Saved</span>
              <span className={`text-xs sm:text-sm ${
                activeTab === 'saved' ? 'text-foreground' : 'text-foreground/50'
              }`}>
                {savedEvents.length}
              </span>
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
                  if (post.type === 'event' && !post.event_id) {
                    // If it's an event card (not a post), navigate to event page
                    navigate(`/e/${post.id}`);
                  } else if (activeTab === 'posts' && post.event_id) {
                    // If it's a post, open modal
                    setSelectedPostId(post.id);
                    setSelectedEventId(post.event_id);
                    setShowPostModal(true);
                  } else {
                    // Fallback navigation
                    navigate(`/e/${post.event_id || post.id}`);
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
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="flex items-center gap-1 text-foreground">
                    <Heart className="h-4 w-4 fill-white sm:h-5 sm:w-5" />
                    <span className="text-xs font-semibold sm:text-sm">{post.likes}</span>
                  </div>
                </div>

                {/* Event Badge */}
                {post.type === 'event' && (
                  <div className="absolute right-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-foreground sm:text-xs">
                    Event
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="rounded-2xl border border-border/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              {activeTab === 'posts' && <Grid3x3 className="h-8 w-8 text-foreground/30" />}
              {activeTab === 'saved' && <Heart className="h-8 w-8 text-foreground/30" />}
            </div>
            <h3 className="mb-2 text-lg font-bold text-foreground">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'saved' && 'No saved items yet'}
            </h3>
            <p className="text-sm text-foreground/60">
              {activeTab === 'posts' && 'Share your event experiences to see them here'}
              {activeTab === 'saved' && 'Save posts and events you love'}
            </p>
          </div>
        )}
      </div>

      {/* Post Detail Modal */}
      {showPostModal && selectedPostId && selectedEventId && (
        <CommentModal
          isOpen={showPostModal}
          onClose={() => {
            setShowPostModal(false);
            setSelectedPostId(null);
            setSelectedEventId(null);
          }}
          eventId={selectedEventId}
          eventTitle="Event"
          postId={selectedPostId}
        />
      )}
    </div>
  );
}

export default ProfilePage;
