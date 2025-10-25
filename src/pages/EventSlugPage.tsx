import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Heart,
  Info,
  MapPin,
  Share2,
  Users,
} from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface EventTicketTier {
  id: string;
  name: string;
  price: number;
  available: number;
  total: number;
  benefits: string[];
}

interface EventDetails {
  id: string;
  title: string;
  coverImage: string;
  organizer: {
    name: string;
    avatar: string;
    verified: boolean;
  };
  date: string;
  time: string;
  location: string;
  venue: string;
  description: string;
  categories: string[];
  attendees: number;
  ticketTiers: EventTicketTier[];
  isSaved: boolean;
}


export default function EventSlugPage() {
  const navigate = useNavigate();
  const { identifier } = useParams<{ identifier: string }>();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [selectedTier, setSelectedTier] = useState<EventTicketTier['id'] | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'tickets' | 'attendees'>('about');
  const [loading, setLoading] = useState(true);

  const attendeesLabel = useMemo(() => {
    return event ? new Intl.NumberFormat().format(event.attendees) : '0';
  }, [event]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>Loading event...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <p className="mb-4">Event not found</p>
          <button onClick={() => navigate(-1)} className="text-[#FF8C00] hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
        <ImageWithFallback src={event.coverImage} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />

        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition hover:bg-black/60 sm:h-10 sm:w-10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setEvent((prev) => ({ ...prev, isSaved: !prev.isSaved }))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition hover:bg-black/60 sm:h-10 sm:w-10"
              aria-label="Save event"
            >
              <Heart className={`h-5 w-5 ${event.isSaved ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition hover:bg-black/60 sm:h-10 sm:w-10">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="mb-2 flex flex-wrap gap-2">
            {event.categories.map((category) => (
              <span key={category} className="rounded-full bg-black/60 px-3 py-1 text-xs backdrop-blur-md sm:text-sm">
                {category}
              </span>
            ))}
          </div>
          <h1 className="mb-2 text-2xl font-semibold drop-shadow-lg sm:text-3xl">{event.title}</h1>
        </div>
      </div>

      <div className="px-3 pt-4 sm:px-4 sm:pt-6 md:px-6">
        <div className="mb-6 flex items-center gap-3">
          <ImageWithFallback
            src={event.organizer.avatar}
            alt={event.organizer.name}
            className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base">{event.organizer.name}</h3>
              {event.organizer.verified && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">✔</span>
              )}
            </div>
            <p className="text-xs text-white/60 sm:text-sm">Event Organizer</p>
          </div>
          <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10 sm:text-sm">
            Follow
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FF8C00]/20">
              <Calendar className="h-5 w-5 text-[#FF8C00]" />
            </span>
            <div>
              <p className="mb-1 text-xs text-white/60 sm:text-sm">Date & Time</p>
              <p className="text-sm sm:text-base">{event.date}</p>
              <p className="text-xs text-white/70">{event.time}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20">
              <MapPin className="h-5 w-5 text-purple-400" />
            </span>
            <div>
              <p className="mb-1 text-xs text-white/60 sm:text-sm">Location</p>
              <p className="text-sm sm:text-base">{event.venue}</p>
              <p className="text-xs text-white/70">{event.location}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2 border-b border-white/10">
          {(['about', 'tickets', 'attendees'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 text-sm transition sm:text-base ${
                activeTab === tab ? 'border-b-2 border-[#FF8C00] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {tab === 'about' && 'About'}
              {tab === 'tickets' && 'Tickets'}
              {tab === 'attendees' && 'Attendees'}
            </button>
          ))}
        </div>

        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="mb-3 text-lg font-semibold">About this event</h2>
              <p className="text-sm leading-relaxed text-white/70">{event.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard icon={<Users className="h-5 w-5" />} title="Expected attendees" description={`${attendeesLabel} going`} />
              <InfoCard icon={<Clock className="h-5 w-5" />} title="Gates open" description="5:00 PM • Early entry available" />
              <InfoCard icon={<Info className="h-5 w-5" />} title="Need help?" description="support@yardpass.com" />
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {event.ticketTiers.map((tier) => {
              const availability = Math.max(0, tier.total ? Math.round((tier.available / tier.total) * 100) : 0);
              const isSelected = selectedTier === tier.id;

              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`flex w-full flex-col gap-4 rounded-3xl border p-5 text-left transition hover:border-white/20 hover:shadow-xl sm:flex-row sm:items-center sm:justify-between ${
                    isSelected ? 'border-[#FF8C00] bg-[#FF8C00]/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{tier.name}</h3>
                      {tier.available < 15 && (
                        <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-200">Low availability</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-white/70">
                      <DollarSign className="mr-1 inline h-4 w-4 align-middle text-white/60" />
                      {tier.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-white/60">{tier.available} of {tier.total} remaining</p>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 sm:w-48">
                    <div className="h-full bg-[#FF8C00]" style={{ width: `${availability}%` }} />
                  </div>

                  <ul className="space-y-1 text-sm text-white/70 sm:text-right">
                    {tier.benefits.map((benefit) => (
                      <li key={benefit}>• {benefit}</li>
                    ))}
                  </ul>
                </button>
              );
            })}

            <button className="w-full rounded-full bg-[#FF8C00] py-3 text-sm font-semibold text-white transition hover:bg-[#FF9D1A]">
              Continue to Tickets
            </button>
          </div>
        )}

        {activeTab === 'attendees' && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
            Attendee list coming soon.
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80">
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-white/60">{description}</p>
        </div>
      </div>
    </div>
  );
}
