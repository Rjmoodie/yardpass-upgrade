import { ArrowLeft, Share2, Heart, Calendar, Clock, MapPin, Users, DollarSign, Info } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

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
  ticketTiers: {
    id: string;
    name: string;
    price: number;
    available: number;
    total: number;
    benefits: string[];
  }[];
  isSaved: boolean;
}

const mockEvent: EventDetails = {
  id: "1",
  title: "Summer Music Festival 2025",
  coverImage: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200",
  organizer: {
    name: "Live Nation Events",
    avatar: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200",
    verified: true
  },
  date: "August 15, 2025",
  time: "6:00 PM - 11:00 PM",
  location: "Central Park, New York, NY",
  venue: "Great Lawn",
  description: "Join us for the ultimate summer music experience featuring top artists from around the world. This year's lineup includes amazing performances, food trucks, art installations, and more. Don't miss out on the event of the summer!",
  categories: ["Music", "Festival", "Outdoor"],
  attendees: 2847,
  ticketTiers: [
    {
      id: "1",
      name: "General Admission",
      price: 45,
      available: 234,
      total: 1000,
      benefits: ["Entry to event", "Access to main stage", "Food & beverage available"]
    },
    {
      id: "2",
      name: "VIP Pass",
      price: 150,
      available: 12,
      total: 100,
      benefits: ["All GA benefits", "VIP viewing area", "Complimentary drinks", "Exclusive merch"]
    },
    {
      id: "3",
      name: "Premium Package",
      price: 300,
      available: 3,
      total: 50,
      benefits: ["All VIP benefits", "Meet & greet", "Backstage tour", "Premium gift bag"]
    }
  ],
  isSaved: false
};

export function EventDetailsPage() {
  const [event, setEvent] = useState(mockEvent);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'tickets' | 'attendees'>('about');

  const toggleSave = () => {
    setEvent(prev => ({ ...prev, isSaved: !prev.isSaved }));
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Hero Image */}
      <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
        <ImageWithFallback
          src={event.coverImage}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
        
        {/* Header Actions */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={toggleSave}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
            >
              <Heart className={`h-5 w-5 ${event.isSaved ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10">
              <Share2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="mb-2 flex flex-wrap gap-2">
            {event.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-md sm:text-sm"
              >
                {category}
              </span>
            ))}
          </div>
          <h1 className="mb-2 text-white drop-shadow-lg">{event.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pt-4 sm:px-4 sm:pt-6 md:px-6">
        {/* Organizer */}
        <div className="mb-6 flex items-center gap-3">
          <ImageWithFallback
            src={event.organizer.avatar}
            alt={event.organizer.name}
            className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm text-white sm:text-base">{event.organizer.name}</h3>
              {event.organizer.verified && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-xs text-white/60 sm:text-sm">Event Organizer</p>
          </div>
          <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white transition-all hover:bg-white/10 sm:text-sm">
            Follow
          </button>
        </div>

        {/* Quick Info Cards */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FF8C00]/20">
              <Calendar className="h-5 w-5 text-[#FF8C00]" />
            </div>
            <div>
              <p className="mb-1 text-xs text-white/60 sm:text-sm">Date & Time</p>
              <p className="text-sm text-white sm:text-base">{event.date}</p>
              <p className="text-xs text-white/70">{event.time}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20">
              <MapPin className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="mb-1 text-xs text-white/60 sm:text-sm">Location</p>
              <p className="text-sm text-white sm:text-base">{event.venue}</p>
              <p className="text-xs text-white/70">{event.location}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 pb-3 text-sm transition-all sm:text-base ${
              activeTab === 'about'
                ? 'border-b-2 border-[#FF8C00] text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 pb-3 text-sm transition-all sm:text-base ${
              activeTab === 'tickets'
                ? 'border-b-2 border-[#FF8C00] text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Tickets
          </button>
          <button
            onClick={() => setActiveTab('attendees')}
            className={`flex-1 pb-3 text-sm transition-all sm:text-base ${
              activeTab === 'attendees'
                ? 'border-b-2 border-[#FF8C00] text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Attendees
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="mb-3 text-white">About This Event</h3>
              <p className="text-sm leading-relaxed text-white/80 sm:text-base">{event.description}</p>
            </div>

            {/* Attendees Count */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-white sm:text-base">
                  <span className="font-semibold">{event.attendees.toLocaleString()}</span> people attending
                </p>
                <p className="text-xs text-white/60">Join them!</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {event.ticketTiers.map((tier) => {
              const availabilityPercent = (tier.available / tier.total) * 100;
              const isLowAvailability = availabilityPercent < 20;
              const isSelected = selectedTier === tier.id;

              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all sm:rounded-3xl sm:p-5 ${
                    isSelected
                      ? 'border-[#FF8C00] bg-[#FF8C00]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="mb-1 text-white">{tier.name}</h3>
                      <p className="text-xs text-white/60">
                        {tier.available} of {tier.total} available
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl text-[#FF8C00] sm:text-2xl">${tier.price}</p>
                      <p className="text-xs text-white/60">per ticket</p>
                    </div>
                  </div>

                  {/* Availability Bar */}
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLowAvailability ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${availabilityPercent}%` }}
                    />
                  </div>

                  {isLowAvailability && (
                    <p className="mb-3 text-xs text-red-400">⚠️ Limited availability!</p>
                  )}

                  {/* Benefits */}
                  <div className="space-y-1.5">
                    {tier.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs text-white/70 sm:text-sm">
                        <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FF8C00]" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>

                  {isSelected && tier.available > 0 && (
                    <button className="mt-4 w-full rounded-full bg-[#FF8C00] py-3 text-sm text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:text-base">
                      Select Ticket
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'attendees' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl sm:rounded-3xl sm:p-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Users className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="mb-2 text-white">{event.attendees.toLocaleString()} Attending</h3>
            <p className="text-sm text-white/60">
              See who else is going to this event
            </p>
            <button className="mt-6 rounded-full bg-[#FF8C00] px-6 py-3 text-sm text-white transition-all hover:bg-[#FF9D1A] active:scale-95">
              View Attendees
            </button>
          </div>
        )}
      </div>

      {/* Fixed Bottom CTA */}
      {activeTab !== 'tickets' && (
        <div className="fixed bottom-16 left-0 right-0 border-t border-white/10 bg-black/80 p-4 backdrop-blur-xl sm:bottom-0">
          <div className="mx-auto max-w-5xl">
            <button 
              onClick={() => setActiveTab('tickets')}
              className="w-full rounded-full bg-[#FF8C00] py-3 text-sm text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:py-4 sm:text-base"
            >
              Get Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
