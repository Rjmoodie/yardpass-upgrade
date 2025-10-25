import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Camera,
  Edit,
  Heart,
  MapPin,
  Share2,
  Users,
} from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
}

interface ProfileTab {
  id: 'posts' | 'events' | 'saved';
  label: string;
}

interface ProfilePost {
  id: string;
  image: string;
  likes: number;
  category: string;
}

const PROFILE_TABS: ProfileTab[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'events', label: 'Events' },
  { id: 'saved', label: 'Saved' },
];

export default function UserProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const [activeTab, setActiveTab] = useState<ProfileTab['id']>('posts');
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <p className="mb-4">Profile not found</p>
          <button onClick={() => navigate(-1)} className="text-[#FF8C00] hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-16 text-white">
      <div className="relative h-48 sm:h-64">
        <ImageWithFallback
          src={profile.coverImage}
          alt={`${profile.name} cover`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md hover:bg-black/60"
            aria-label="Go back"
          >
            <ArrowLeftIcon />
          </button>
          <div className="flex gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md hover:bg-black/60">
              <Share2 className="h-5 w-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md hover:bg-black/60">
              <Edit className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <section className="-mt-20 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="relative mb-6 flex flex-col items-center rounded-3xl border border-white/10 bg-black/70 p-6 backdrop-blur-xl sm:flex-row sm:items-end">
            <div className="-mt-14 flex flex-col items-center gap-4 sm:-mt-24 sm:flex-row sm:items-end">
              <div className="relative">
                <ImageWithFallback
                  src={profile.avatar}
                  alt={profile.name}
                  className="h-28 w-28 rounded-full border-4 border-black/60 object-cover sm:h-32 sm:w-32"
                />
                <button className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 backdrop-blur-md hover:bg-black/80">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl font-semibold sm:text-3xl">{profile.name}</h1>
                <p className="text-sm text-white/60 sm:text-base">{profile.username}</p>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-white/70 sm:justify-start">
                  <MapPin className="h-4 w-4 text-white/40" />
                  <span>{profile.location}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-0 sm:ml-auto sm:justify-end">
              <button className="rounded-full bg-[#FF8C00] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#FF9D1A]">
                Follow
              </button>
              <button className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white transition hover:bg-white/10">
                Message
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={<Users className="h-5 w-5" />} label="Followers" value={profile.stats.followers} />
            <StatCard icon={<Heart className="h-5 w-5" />} label="Posts" value={profile.stats.posts} />
            <StatCard icon={<Calendar className="h-5 w-5" />} label="Events" value={32} />
          </div>

          <p className="mt-6 text-sm text-white/70 sm:text-base">{profile.bio}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/70">
            {profile.socials.map((social) => (
              <span key={social.platform} className="rounded-full border border-white/10 bg-white/5 px-4 py-1">
                {social.platform}: {social.handle}
              </span>
            ))}
          </div>

          <div className="mt-8 flex gap-3 border-b border-white/10">
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-5 py-2 text-sm transition ${
                  activeTab === tab.id ? 'bg-[#FF8C00] text-white shadow-lg' : 'text-white/70 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl transition hover:border-white/20 hover:shadow-xl"
              >
                <ImageWithFallback src={post.image} alt={post.category} className="h-64 w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-white">{post.category}</p>
                    <p className="text-xs text-white/70">{post.likes.toLocaleString()} likes</p>
                  </div>
                  <button className="rounded-full border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10">
                    <Heart className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/80">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          {icon}
        </span>
        <div>
          <p className="text-xs text-white/60">{label}</p>
          <p className="text-lg font-semibold text-white">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M15.75 19.5 8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
