import { Settings, Share2, Grid3x3, Calendar, Heart, Users, MapPin, Instagram, Twitter, Globe } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

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

const mockProfile: UserProfile = {
  name: "Alex Johnson",
  username: "@alexj",
  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
  coverImage: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200",
  bio: "Event enthusiast | Music lover | NYC 🗽",
  location: "New York, NY",
  website: "alexjohnson.com",
  stats: {
    posts: 42,
    followers: 1234,
    following: 567
  },
  socialLinks: {
    instagram: "alexj",
    twitter: "alexj"
  }
};

const mockPosts: Post[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400", likes: 234, type: "post" },
  { id: "2", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400", likes: 156, type: "event" },
  { id: "3", image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400", likes: 89, type: "post" },
  { id: "4", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400", likes: 342, type: "event" },
  { id: "5", image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400", likes: 198, type: "post" },
  { id: "6", image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400", likes: 276, type: "event" }
];

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'events' | 'saved'>('posts');

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Cover Image */}
      <div className="relative h-32 overflow-hidden sm:h-48 md:h-64">
        <ImageWithFallback
          src={mockProfile.coverImage}
          alt="Cover"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        
        {/* Header Actions */}
        <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10">
            <Share2 className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10">
            <Settings className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative px-3 sm:px-4 md:px-6">
        {/* Avatar */}
        <div className="relative -mt-12 mb-4 sm:-mt-16">
          <div className="inline-block rounded-full border-4 border-black bg-black">
            <ImageWithFallback
              src={mockProfile.avatar}
              alt={mockProfile.name}
              className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
            />
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-4">
          <h1 className="mb-1 text-white">{mockProfile.name}</h1>
          <p className="mb-3 text-sm text-white/60 sm:text-base">{mockProfile.username}</p>
          
          {/* Bio */}
          <p className="mb-3 text-sm leading-relaxed text-white/80 sm:text-base">
            {mockProfile.bio}
          </p>

          {/* Location & Website */}
          <div className="mb-4 flex flex-wrap gap-3 text-sm text-white/60">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{mockProfile.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" />
              <a href={`https://${mockProfile.website}`} className="hover:text-[#FF8C00]">
                {mockProfile.website}
              </a>
            </div>
          </div>

          {/* Social Links */}
          <div className="mb-4 flex gap-3">
            {mockProfile.socialLinks.instagram && (
              <a
                href={`https://instagram.com/${mockProfile.socialLinks.instagram}`}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
              >
                <Instagram className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </a>
            )}
            {mockProfile.socialLinks.twitter && (
              <a
                href={`https://twitter.com/${mockProfile.socialLinks.twitter}`}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 sm:h-10 sm:w-10"
              >
                <Twitter className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:gap-4 sm:p-5">
            <div className="text-center">
              <p className="mb-1 text-lg text-white sm:text-xl">{mockProfile.stats.posts}</p>
              <p className="text-xs text-white/60 sm:text-sm">Posts</p>
            </div>
            <div className="text-center">
              <p className="mb-1 text-lg text-white sm:text-xl">{mockProfile.stats.followers.toLocaleString()}</p>
              <p className="text-xs text-white/60 sm:text-sm">Followers</p>
            </div>
            <div className="text-center">
              <p className="mb-1 text-lg text-white sm:text-xl">{mockProfile.stats.following}</p>
              <p className="text-xs text-white/60 sm:text-sm">Following</p>
            </div>
          </div>

          {/* Edit Profile Button */}
          <button className="w-full rounded-full bg-[#FF8C00] py-3 text-sm text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:text-base">
            Edit Profile
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex flex-1 items-center justify-center gap-2 pb-3 text-sm transition-all sm:text-base ${
              activeTab === 'posts'
                ? 'border-b-2 border-[#FF8C00] text-white'
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
                ? 'border-b-2 border-[#FF8C00] text-white'
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
                ? 'border-b-2 border-[#FF8C00] text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
            Saved
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
          {mockPosts.map((post) => (
            <div
              key={post.id}
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
                  <span className="text-xs sm:text-sm">{post.likes}</span>
                </div>
              </div>

              {/* Event Badge */}
              {post.type === 'event' && (
                <div className="absolute right-1 top-1 rounded-full bg-[#FF8C00] px-2 py-0.5 text-[10px] text-white sm:text-xs">
                  Event
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {mockPosts.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Grid3x3 className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="mb-2 text-white">No posts yet</h3>
            <p className="text-sm text-white/60">
              Share your event experiences to see them here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
