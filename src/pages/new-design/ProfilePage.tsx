import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Settings, Share2, Grid3x3, Calendar, Heart, Users, MapPin, Instagram, Twitter, Globe, ExternalLink, UserPlus, UserMinus, Shield, LogOut, Palette, MoreVertical, Bell, ArrowLeft, X } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { useUserConnections } from "@/hooks/useUserConnections";
import { useFollow } from "@/hooks/useFollow";
import { useTickets } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { CommentModal } from "@/features/comments";
import { FullscreenPostViewer } from "@/components/post-viewer/FullscreenPostViewer";
import { muxToPoster } from "@/lib/video/muxClient";
import { useProfileVisitTracking } from "@/hooks/usePurchaseIntentTracking";
import { FlashbackBadge } from "@/components/flashbacks/FlashbackBadge";
import { FollowListModal } from "@/components/follow/FollowListModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FullScreenSafeArea } from "@/components/layout/FullScreenSafeArea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface SavedItem {
  id: string;
  item_type: 'event' | 'post';
  item_id: string;
  title: string;
  cover_image_url: string | null;
  start_at: string;
  is_flashback?: boolean;
  post_media_urls?: string[] | null;
  post_text?: string | null;
  event_id?: string; // For posts, this links back to the event
}

export function ProfilePage() {
  const { user: currentUser, updateProfileOptimistic, updateRole } = useAuth();
  const { username, userId } = useParams<{ username?: string; userId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackProfileVisit } = useProfileVisitTracking();
  const targetUserId = userId || username || currentUser?.id;
  
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedEvents, setSavedEvents] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state for viewing posts
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  
  const { following: userFollowing, followers } = useUserConnections(profile?.user_id);
  const [totalFollowingCount, setTotalFollowingCount] = useState(0);
  const { tickets } = useTickets();
  const { state: followState, follow, unfollow, loading: followLoading } = useFollow({
    type: 'user',
    id: profile?.user_id || '' // useFollow requires non-null string
  });
  
  const isOwnProfile = profile ? profile.user_id === currentUser?.id : (!username && !userId);

  // ✅ CRITICAL: Reset scroll immediately when profile page mounts/loads or when navigating to a different profile
  // This ensures the page always starts at the top, regardless of browser scroll restoration
  useLayoutEffect(() => {
    const main = document.getElementById('main-content');
    if (!main || !(main instanceof HTMLElement)) return;

    // Reset immediately, synchronously (before paint)
    main.scrollTop = 0;
    main.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo(0, 0);

    // ✅ AGGRESSIVE: Reset again after layout/paint to catch any delayed scroll restoration
    // This handles cases where layout shifts or browser scroll restoration happens after initial render
    const resetTimeout = setTimeout(() => {
      if (main instanceof HTMLElement && main.scrollTop > 0) {
        main.scrollTop = 0;
        main.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        window.scrollTo(0, 0);
        
        if (import.meta.env.DEV) {
          console.log('[ProfilePage] ✅ Scroll reset completed after layout');
        }
      }
    }, 0); // Run on next tick to catch any delayed scroll restoration

    return () => clearTimeout(resetTimeout);
  }, [targetUserId, location.pathname]); // Reset when navigating to a different profile or route changes

  // Handle tab change with immediate scroll reset
  const handleTabChange = (tab: 'posts' | 'saved') => {
    setActiveTab(tab);
    // Immediately reset scroll to top so user sees the header/cover
    const main = document.getElementById('main-content');
    if (main instanceof HTMLElement) {
      // Use both methods for maximum compatibility
      main.scrollTop = 0;
      main.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };


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

  // 🎯 Track profile page visit (moderate purchase intent signal)
  useEffect(() => {
    if (!profile?.user_id) return;
    
    // Don't track visits to own profile
    if (profile.user_id === currentUser?.id) return;
    
    trackProfileVisit(profile.user_id);
    console.log('[Purchase Intent] 👤 Tracked profile page visit for:', profile.user_id);
  }, [profile?.user_id, currentUser?.id, trackProfileVisit]);

  // Load total following count (includes users, events, organizers)
  useEffect(() => {
    if (!profile?.user_id) return;

    const loadTotalFollowing = async () => {
      try {
        const { count, error } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_user_id', profile.user_id)
          .eq('status', 'accepted');

        if (error) throw error;
        setTotalFollowingCount(count || 0);
      } catch (err) {
        console.error('Error loading total following count:', err);
      }
    };

    loadTotalFollowing();
  }, [profile?.user_id]);

  // Fetch user posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!profile?.user_id) return;

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
          .eq('author_user_id', profile.user_id)
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
            type: 'post' as const,  // ✅ ALWAYS 'post' (from event_posts table)
            event_id: post.event_id || undefined
          };
        }).filter(post => post.media_urls.length > 0); // Only show posts with media

        setPosts(transformed);
      } catch (error) {
        console.error('Error loading posts:', error);
      }
    };

    loadPosts();
  }, [profile?.user_id]);

  // Fetch saved items (events + posts) (if own profile)
  useEffect(() => {
    const loadSavedItems = async () => {
      if (!isOwnProfile || !profile?.user_id) return;

      try {
        // Use the unified view that includes both events and posts
        const { data, error } = await supabase
          .from('user_saved_items')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('saved_at', { ascending: false });

        if (error) throw error;

        // Transform the data
        const items: SavedItem[] = (data || []).map((item: any) => {
          // Determine cover image - prioritize post media for posts, event cover for events
          let coverImage = null;
          if (item.item_type === 'post' && item.post_media_urls?.[0]) {
            coverImage = item.post_media_urls[0];
          } else if (item.item_type === 'event' && item.event_cover_image) {
            coverImage = item.event_cover_image;
          } else if (item.event_cover_image) {
            // Fallback to event cover if available
            coverImage = item.event_cover_image;
          }
          
          return {
            id: item.id,
            item_type: item.item_type,
            item_id: item.item_id,
            title: item.event_title || 'Untitled',
            cover_image_url: coverImage,
            start_at: item.event_start_at,
            is_flashback: item.is_flashback || false,
            post_media_urls: item.post_media_urls,
            post_text: item.post_text,
            event_id: item.event_id || (item.item_type === 'event' ? item.item_id : item.event_id), // Include event_id
          };
        });

        setSavedEvents(items);
      } catch (error) {
        console.error('Error loading saved items:', error);
        setSavedEvents([]);
      }
    };

    loadSavedItems();
  }, [profile?.user_id, isOwnProfile]);

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
      // Saved tab - show saved events AND posts
      return savedEvents.map(e => {
        // Handle media URLs - convert Mux if needed
        let imageUrl = e.cover_image_url || '';
        if (e.item_type === 'post' && e.post_media_urls?.[0]) {
          const rawUrl = e.post_media_urls[0];
          imageUrl = rawUrl.startsWith('mux:') 
            ? muxToPoster(rawUrl) 
            : rawUrl;
        }
        
        // Fallback to a placeholder if no image URL
        if (!imageUrl || imageUrl === '') {
          imageUrl = 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=400&fit=crop';
        }
        
        return {
          id: e.item_id, // Use item_id (either event_id or post_id)
          image: imageUrl,
          likes: 0,
          type: e.item_type, // 'event' or 'post'
          event_id: e.event_id, // ✅ Always use event_id from saved item (works for both events and posts)
          is_flashback: e.is_flashback || false
        };
      });
    }
  }, [activeTab, posts, savedEvents]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${profile?.display_name || 'User'} on Liventix`,
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
      <FullScreenSafeArea
        className="items-center justify-center bg-background"
        scroll={false}
        includeBottomNav={false}
      >
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/20 border-t-primary" />
      </FullScreenSafeArea>
    );
  }

  return (
    <FullScreenSafeArea scroll={false} className="bg-gradient-to-b from-background via-background to-background/95">
      {/* Top Header - Simple header with back button and actions */}
      <div 
        className="sticky top-0 z-50 flex items-center justify-between border-b border-border/10 bg-background/95 backdrop-blur-md px-4 py-3 md:px-8"
        style={{
          paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))',
          paddingBottom: '0.75rem',
        }}
      >
        {/* Left Side - Back Button */}
        <div>
          {(!isOwnProfile || window.history.length > 1) && (
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-lg backdrop-blur-md transition-all hover:bg-background sm:h-10 sm:w-10"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
        
        {/* Right Side - Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Host Button - Toggles Organizer Mode (Own Profile Only) */}
          {isOwnProfile && (
            <button
              onClick={async () => {
                try {
                  const newRole = profile?.role === 'organizer' ? 'attendee' : 'organizer';
                  
                  // Optimistic update for instant UI response
                  updateProfileOptimistic({ role: newRole });
                  setProfile(prev => prev ? { ...prev, role: newRole } : prev);

                  // Update role in database (this triggers purple theme via data-role attribute)
                  const { error } = await updateRole(newRole);

                  if (error) throw error;

                  toast({
                    title: 'Role Updated',
                    description: `Switched to ${newRole === 'organizer' ? 'Organizer' : 'Attendee'} mode`,
                  });

                  // Navigate to appropriate home after role change
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
                  // Revert optimistic update on error
                  setProfile(prev => prev ? { ...prev, role: profile?.role === 'organizer' ? 'attendee' : 'organizer' } : prev);
                }
              }}
              className={`flex h-8 w-auto items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 active:scale-95 sm:h-9 sm:px-4 sm:text-sm ${
                profile?.role === 'organizer'
                  ? 'bg-purple-500 text-white'  // Purple when in organizer mode
                  : 'bg-primary text-primary-foreground'  // Blue when in attendee mode
              }`}
              aria-label={profile?.role === 'organizer' ? 'Switch to Attendee Mode' : 'Switch to Organizer Mode'}
            >
              <span>Host</span>
            </button>
          )}
          
          {/* Notifications */}
          <button 
            onClick={() => navigate('/notifications')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-lg backdrop-blur-md transition-all hover:bg-background sm:h-10 sm:w-10"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
          </button>
          
          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-lg backdrop-blur-md transition-all hover:bg-background sm:h-10 sm:w-10"
            aria-label="Share profile"
          >
            <Share2 className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
          </button>
          
          {/* Collapsed Menu for Own Profile */}
          {isOwnProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-lg backdrop-blur-md transition-all hover:bg-background sm:h-10 sm:w-10"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[100]">
                <DropdownMenuItem onClick={() => navigate('/edit-profile')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/notifications')}>
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
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
                  className="text-red-500 focus:text-red-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Profile Header - Hero Layout */}
      <div className="relative px-4 md:px-8 pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          {/* Avatar */}
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="inline-block rounded-full border-4 border-background/80 shadow-xl shadow-black/40">
                <ImageWithFallback
                  src={profile.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&size=200`}
                  alt={profile.display_name}
                  className="h-24 w-24 rounded-full object-cover md:h-32 md:w-32"
                />
              </div>
              {profile.role === "organizer" && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-background shadow-md">
                  Organizer
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                {profile.display_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isOwnProfile
                  ? profile.username
                    ? `@${profile.username}`
                    : "Add a username to make your profile easier to share"
                  : `@${profile.username || profile.user_id.slice(0, 8)}`}
              </p>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground md:text-sm">
                <button
                  onClick={() => setFollowModal("followers")}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span className="font-semibold text-foreground">{followers.length.toLocaleString()}</span>
                  <span className="opacity-80">Followers</span>
                </button>
                <button
                  onClick={() => setFollowModal("following")}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span className="font-semibold text-foreground">{totalFollowingCount.toLocaleString()}</span>
                  <span className="opacity-80">Following</span>
                </button>
                {isOwnProfile && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{tickets.length} events attended</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-1 items-center justify-start gap-2 md:justify-end pb-2">
            {!isOwnProfile && (
              <>
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
                  className={`flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                    followState === 'accepted'
                      ? 'border border-border/20 bg-card/80 text-foreground hover:bg-card'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
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
                  className="flex items-center justify-center gap-2 rounded-full border border-border/20 bg-card/80 px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-card active:scale-95"
                >
                  Message
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-sm leading-relaxed text-foreground/80 md:text-base">
            {profile.bio}
          </p>
        )}

        {/* Metadata Row - Location, Website, Social Links */}
        {(profile.location || profile.website || profile.instagram_handle || profile.twitter_handle) && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground md:text-sm">
            {profile.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile.website && (
              <a 
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Globe className="h-3.5 w-3.5" />
                {profile.website.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <Instagram className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">@{profile.instagram_handle}</span>
              </a>
            )}
            {profile.twitter_handle && (
              <a
                href={`https://twitter.com/${profile.twitter_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <Twitter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">@{profile.twitter_handle}</span>
              </a>
            )}
          </div>
        )}


      </div>

      {/* Tabs Section - Outside main header container */}
      <div className="px-4 md:px-8">

        {/* Tabs */}
        <div className="mb-4 mt-6 flex gap-2 border-b border-border/10">
          <button
            onClick={() => handleTabChange('posts')}
            className={`flex flex-1 items-center justify-center gap-1.5 pb-3 text-sm transition-all md:text-base ${
              activeTab === 'posts'
                ? 'border-b-2 border-primary text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid3x3 className="h-4 w-4 md:h-5 md:w-5" />
            <span>Posts</span>
            <span className={`text-xs md:text-sm ${
              activeTab === 'posts' ? 'text-foreground' : 'text-muted-foreground/70'
            }`}>
              {posts.length}
            </span>
          </button>
          {isOwnProfile && (
            <button
              onClick={() => handleTabChange('saved')}
              className={`flex flex-1 items-center justify-center gap-1.5 pb-3 text-sm transition-all md:text-base ${
                activeTab === 'saved'
                  ? 'border-b-2 border-primary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Heart className="h-4 w-4 md:h-5 md:w-5" />
              <span>Saved</span>
              <span className={`text-xs md:text-sm ${
                activeTab === 'saved' ? 'text-foreground' : 'text-muted-foreground/70'
              }`}>
                {savedEvents.length}
              </span>
            </button>
          )}
        </div>

        {/* Content Grid - Gallery Style */}
        {displayContent.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3 pb-nav">
            {displayContent.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  if (post.type === 'event') {
                    // Event card → Navigate to event page
                    navigate(`/e/${post.event_id || post.id}`);
                  } else if (post.type === 'post') {
                    // Post → Open modal (don't navigate!)
                    if (post.event_id) {
                      setSelectedPostId(post.id);
                      setSelectedEventId(post.event_id);
                      setShowPostModal(true);
                    } else {
                      // Edge case: post without event_id (shouldn't happen, but handle it)
                      toast({
                        title: 'Error',
                        description: 'This post is missing event information',
                        variant: 'destructive'
                      });
                    }
                  } else {
                    // Unknown type - log and show error
                    console.error('Unknown post type:', post);
                    toast({
                      title: 'Error',
                      description: 'Unable to open this item',
                      variant: 'destructive'
                    });
                  }
                }}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border/40 transition-transform duration-200 hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60" />
                <ImageWithFallback
                  src={post.image}
                  alt={post.type === 'event' ? 'Event' : 'Post'}
                  className="relative h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  fallback="https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=400&fit=crop"
                />
                
                {/* Flashback Badge for Events */}
                {post.type === 'event' && (post as any).is_flashback && (
                  <div className="absolute top-2 left-2">
                    <FlashbackBadge variant="minimal" className="text-[10px] px-2 py-0.5" />
                  </div>
                )}
                
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/50 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 p-2">
                  <div className="flex items-center gap-1 text-xs text-white">
                    <Heart className="h-3 w-3 fill-current" />
                    <span className="font-semibold">{post.likes}</span>
                  </div>
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                    {post.type === "event" ? "Event" : "Post"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Empty State - Marketing Style */
          <div className="rounded-3xl border border-dashed border-border/40 bg-muted/30 p-10 text-center backdrop-blur-md pb-nav">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background/80 ring-1 ring-border/40">
              {activeTab === "posts" ? (
                <Grid3x3 className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Heart className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {activeTab === "posts"
                ? "Share your first event moment"
                : "Save the events you love"}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {activeTab === "posts"
                ? "Post photos or videos from events you attend and build your story on Liventix."
                : "Tap the heart on events and posts to collect them here for later."}
            </p>
            {isOwnProfile && activeTab === "posts" && (
              <Button onClick={() => navigate("/create-post")} className="gap-2">
                <Grid3x3 className="h-4 w-4" />
                Create a post
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Post Detail Modal - New Instagram-style Fullscreen Post Viewer */}
      {showPostModal && selectedPostId && selectedEventId && (
        <FullscreenPostViewer
          key={`viewer-${selectedPostId}-${selectedEventId}`}
          isOpen={showPostModal}
          onClose={() => {
            setShowPostModal(false);
            setSelectedPostId(null);
            setSelectedEventId(null);
          }}
          eventId={selectedEventId}
          eventTitle="Event"
          postId={selectedPostId}
          postIdSequence={posts.map(p => p.id)}
          initialIndex={posts.findIndex(p => p.id === selectedPostId)}
          onCommentCountChange={(postId, newCount) => {
            setPosts(prev => prev.map(p => 
              p.id === postId ? { ...p, comments: newCount } : p
            ));
          }}
          onPostDelete={(postId) => {
            // Remove deleted post from local state
            setPosts(prev => prev.filter(p => p.id !== postId));
            // Close modal
            setShowPostModal(false);
            setSelectedPostId(null);
            setSelectedEventId(null);
            console.log('🗑️ [Profile] Post deleted:', postId);
          }}
          onRequestUsername={() => {
            // ✅ Open username modal (keeps comment modal in background)
            toast({
              title: 'Complete Your Profile',
              description: 'Set your username to comment on posts',
              action: (
                <ToastAction 
                  altText="Go to Settings" 
                  onClick={() => {
                    setShowPostModal(false);
                    navigate('/settings');
                  }}
                >
                  Go to Settings
                </ToastAction>
              ),
              duration: 6000
            });
          }}
        />
      )}

      {/* Followers Modal */}
      <FollowListModal
        open={followModal === 'followers'}
        onOpenChange={(open) => setFollowModal(open ? 'followers' : null)}
        targetType="user"
        targetId={targetUserId || ''}
        direction="followers"
      />

      {/* Following Modal - Shows users only (events/organizers coming soon) */}
      {followModal === 'following' && (
        <Dialog open={true} onOpenChange={(open) => setFollowModal(open ? 'following' : null)}>
          <DialogContent className="max-h-[80vh] w-full max-w-lg overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Following ({totalFollowingCount} total)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Showing {userFollowing.length} users • {totalFollowingCount - userFollowing.length} events/organizers
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh]">
              <div className="space-y-0 divide-y">
                {userFollowing.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Not following any users yet.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {userFollowing.map(connection => (
                      <li key={connection.user_id} className="flex items-center gap-3 px-6 py-4">
                        <Avatar className="h-10 w-10">
                          {connection.photo_url ? <AvatarImage src={connection.photo_url} alt={connection.display_name} /> : null}
                          <AvatarFallback>{connection.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-medium">{connection.display_name}</span>
                          {connection.bio && (
                            <span className="text-xs text-muted-foreground line-clamp-1">{connection.bio}</span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFollowModal(null);
                            navigate(`/profile/${connection.user_id}`);
                          }}
                        >
                          View
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

    </FullScreenSafeArea>
  );
}

export default ProfilePage;
