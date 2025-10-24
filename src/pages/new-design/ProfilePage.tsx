import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Settings, Share2, Grid3x3, Calendar, Heart, MapPin, Instagram, Twitter, Globe } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { useUserConnections } from "@/hooks/useUserConnections";
import { supabase } from "@/integrations/supabase/client";
import { transformUserProfile } from "@/lib/dataTransformers";

interface UserProfile {
  name: string;
  username: string;
  avatar: string;
  coverImage: string;
  bio: string;
  location: string;
  website: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  socialLinks: {
    instagram?: string;
    twitter?: string;
  };
}

interface Post {
  id: string;
  image: string;
  likes: number;
  type: 'post' | 'event';
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const targetUserId = userId || user?.id;
  
  const [activeTab, setActiveTab] = useState<'posts' | 'events' | 'saved'>('posts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { following, followers } = useUserConnections(targetUserId);
  
  const isOwnProfile = !userId || userId === user?.id;

  // Load user profile
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

        // Transform and set profile
        const transformed = transformUserProfile(profileData);
        if (transformed) {
          // Add real stats
          transformed.stats = {
            posts: 0, // Will be updated when posts load
            followers: followers.length,
            following: following.length
          };
          setProfile(transformed);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId, followers.length, following.length]);

  // Load user posts
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
            event_reactions!event_reactions_post_id_fkey (
              kind
            )
          `)
          .eq('author_user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const transformed = (data || [])
          .map(post => {
            const likeCount = post.event_reactions?.filter((r: any) => r.kind === 'like').length || 0;
            return {
              id: post.id,
              image: post.media_urls?.[0] || '',
              likes: likeCount,
              type: post.event_id ? 'event' as const : 'post' as const
            };
          })
          .filter(post => post.image); // Only show posts with images

        setPosts(transformed);
        setProfile(prev =>
          prev
            ? {
                ...prev,
                stats: {
                  ...prev.stats,
                  posts: transformed.length
                }
              }
            : prev
        );
      } catch (error) {
        console.error('Error loading posts:', error);
      }
    };

    loadPosts();
  }, [targetUserId]);

  // Load user events
  useEffect(() => {
    const loadEvents = async () => {
      if (!targetUserId) return;

      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            id,
            title,
            cover_image_url,
            created_at
          `)
          .eq('created_by', targetUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const transformed = (data || []).map(event => ({
          id: event.id,
          image: event.cover_image_url || '',
          likes: 0,
          type: 'event' as const
        })).filter(event => event.image);

        setEvents(transformed);
      } catch (error) {
        console.error('Error loading events:', error);
      }
    };

    loadEvents();
  }, [targetUserId]);

  // Loading state
  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#FF8C00]" />
      </div>
    );
  }

  // Determine content to show based on active tab
  const displayContent = activeTab === 'posts' ? posts : activeTab === 'events' ? events : [];

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Cover Image */}
      <div className="relative h-32 overflow-hidden sm:h-48 md:h-64">
        <ImageWithFallback
          src={profile.coverImage}
          alt="Cover"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        
        {/* Header Actions */}
        <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${profile.name} on Yardpass`,
                  url: window.location.href
                });
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
          >
            <Share2 className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </button>
          {isOwnProfile && (
            <button 
              onClick={() => navigate('/profile/edit')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
            >
              <Settings className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative px-3 sm:px-4 md:px-6">
        {/* Avatar */}
        <div className="relative -mt-12 mb-4 sm:-mt-16">
          <div className="inline-block rounded-full border-4 border-black bg-black">
            <ImageWithFallback
              src={profile.avatar}
              alt={profile.name}
              className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
            />
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-4">
          <h1 className="mb-1 text-2xl font-bold text-white sm:text-3xl">{profile.name}</h1>
          <p className="mb-3 text-sm text-white/60 sm:text-base">{profile.username}</p>
          
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
                    className="hover:text-[#FF8C00] transition-colors"
                  >
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Social Links */}
          {(profile.socialLinks.instagram || profile.socialLinks.twitter) && (
            <div className="mb-4 flex gap-3">
              {profile.socialLinks.instagram && (
                <a
                  href={`https://instagram.com/${profile.socialLinks.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
                >
                  <Instagram className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </a>
              )}
              {profile.socialLinks.twitter && (
                <a
                  href={`https://twitter.com/${profile.socialLinks.twitter}`}
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
              <p className="mb-1 text-lg font-bold text-white sm:text-xl">{profile.stats.posts}</p>
              <p className="text-xs text-white/60 sm:text-sm">Posts</p>
            </div>
            <button 
              onClick={() => navigate(`/profile/${targetUserId}/followers`)}
              className="text-center transition-opacity hover:opacity-80"
            >
              <p className="mb-1 text-lg font-bold text-white sm:text-xl">{profile.stats.followers.toLocaleString()}</p>
              <p className="text-xs text-white/60 sm:text-sm">Followers</p>
            </button>
            <button 
              onClick={() => navigate(`/profile/${targetUserId}/following`)}
              className="text-center transition-opacity hover:opacity-80"
            >
              <p className="mb-1 text-lg font-bold text-white sm:text-xl">{profile.stats.following}</p>
              <p className="text-xs text-white/60 sm:text-sm">Following</p>
            </button>
          </div>

          {/* Edit Profile Button */}
          {isOwnProfile && (
            <button 
              onClick={() => navigate('/profile/edit')}
              className="w-full rounded-full bg-[#FF8C00] py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:text-base"
            >
              Edit Profile
            </button>
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
        </div>

        {/* Content Grid */}
        {displayContent.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
            {displayContent.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  if (post.type === 'event') {
                    navigate(`/e/${post.id}`);
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
            <h3 className="mb-2 text-lg font-semibold text-white">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'events' && 'No events yet'}
              {activeTab === 'saved' && 'No saved items yet'}
            </h3>
            <p className="text-sm text-white/60">
              {activeTab === 'posts' && 'Share your event experiences to see them here'}
              {activeTab === 'events' && 'Create your first event to get started'}
              {activeTab === 'saved' && 'Save posts and events you love'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
