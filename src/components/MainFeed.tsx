import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { FeedFilter } from './FeedFilter';
import { Heart, MessageCircle, Share, Play, Pause, MoreVertical, MapPin, Calendar, Plus, Filter, Search, Bookmark } from 'lucide-react';
import { routes } from '@/lib/routes';
import { openMaps } from '@/lib/maps';
import { capture } from '@/lib/analytics';
import { sharePayload } from '@/lib/share';
import { buildShareUrl, getShareTitle, getShareText } from '@/lib/shareLinks';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface Event {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;
  date: string;
  location: string;
  coverImage: string;
  videoUrl: string;
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
}

interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

interface MainFeedProps {
  onEventClick?: (eventId: string) => void;
  onGetTickets?: (eventId: string) => void;
  onShareEvent?: (eventId: string, eventTitle: string, eventDescription?: string) => void;
  onViewDetails?: (eventId: string) => void;
  onCreatePost?: (eventId?: string) => void;
  onUserProfile?: (userId: string) => void;
  onOrganizerProfile?: (orgId: string) => void;
  onAttendees?: (eventId: string) => void;
}

// Mock event data
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    description: 'Three days of incredible music with top artists from around the world. Food trucks, art installations, and unforgettable experiences await!',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    date: 'July 15-17, 2024',
    location: 'Central Park, NYC',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    videoUrl: '',
    ticketTiers: [
      { id: '1', name: 'General Admission', price: 89, badge: 'GA', available: 45, total: 1000 },
      { id: '2', name: 'VIP Experience', price: 199, badge: 'VIP', available: 12, total: 100 }
    ],
    attendeeCount: 1243,
    likes: 892,
    shares: 156,
    isLiked: false
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world. Over 50 food vendors, live cooking demos, and family-friendly activities.',
    organizer: 'Foodie Adventures',
    organizerId: '102',
    category: 'Food & Drink',
    date: 'August 8, 2024',
    location: 'Brooklyn Bridge Park',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    videoUrl: '',
    ticketTiers: [
      { id: '3', name: 'Entry Pass', price: 25, badge: 'ENTRY', available: 234, total: 500 },
      { id: '4', name: 'Foodie Pass', price: 75, badge: 'FOODIE', available: 18, total: 50 }
    ],
    attendeeCount: 567,
    likes: 445,
    shares: 89,
    isLiked: true
  },
  {
    id: '3',
    title: 'Contemporary Art Showcase',
    description: 'Discover emerging artists and groundbreaking installations. Interactive exhibits, artist talks, and exclusive previews.',
    organizer: 'Modern Gallery NYC',
    organizerId: '103',
    category: 'Art & Culture',
    date: 'September 2, 2024',
    location: 'SoHo Art District',
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbnxlbnwxfHx8fDE3NTY3NjI4ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    videoUrl: '',
    ticketTiers: [
      { id: '5', name: 'Standard', price: 35, badge: 'STD', available: 156, total: 200 },
      { id: '6', name: 'Premium', price: 85, badge: 'PREM', available: 23, total: 50 }
    ],
    attendeeCount: 298,
    likes: 234,
    shares: 67,
    isLiked: false
  }
];

export function MainFeed({ 
  onEventClick,
  onGetTickets,
  onShareEvent,
  onViewDetails,
  onCreatePost,
  onUserProfile,
  onOrganizerProfile,
  onAttendees
}: MainFeedProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState(mockEvents);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentEvent = events[currentIndex];

  const handleLike = (eventId: string) => {
    capture('feed_click', { target: 'like', event_id: eventId });
    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? { 
            ...event, 
            isLiked: !event.isLiked, 
            likes: event.isLiked ? event.likes - 1 : event.likes + 1 
          }
        : event
    ));
  };

  const handleShare = (event: Event) => {
    capture('feed_click', { target: 'share', event_id: event.id });
    
    const shareUrl = buildShareUrl(
      { 
        type: 'event', 
        slug: event.id, 
        title: event.title,
        date: event.date,
        city: event.location
      },
      { ref: 'feed' }
    );

    sharePayload({
      title: getShareTitle({ type: 'event', slug: event.id, title: event.title }),
      text: getShareText({ type: 'event', slug: event.id, title: event.title, date: event.date, city: event.location }),
      url: shareUrl
    });
  };

  const handleOrganizerClick = (event: Event) => {
    capture('feed_click', { target: 'handle', event_id: event.id });
    onOrganizerProfile?.(event.organizerId);
  };

  const handleCategoryClick = (category: string, eventId: string) => {
    capture('feed_click', { target: 'category', event_id: eventId });
    navigate(routes.category(category));
  };

  const handleAttendeesClick = (event: Event) => {
    capture('feed_click', { target: 'attending', event_id: event.id });
    onAttendees?.(event.id);
  };

  const handleLocationClick = (event: Event, secondary = false) => {
    capture('feed_click', { target: 'location', event_id: event.id });
    if (secondary) {
      openMaps(`${event.location}`, event.title);
    } else {
      // TODO: Navigate to event location section
    }
  };

  const handleGetTickets = (event: Event) => {
    capture('feed_click', { target: 'tickets', event_id: event.id });
    onGetTickets?.(event.id);
  };

  const handleDetails = (event: Event) => {
    capture('feed_click', { target: 'details', event_id: event.id });
    onViewDetails?.(event.id);
  };

  const handleScroll = (direction: 'up' | 'down') => {
    if (direction === 'down' && currentIndex < events.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (direction === 'up' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') handleScroll('up');
      if (e.key === 'ArrowDown') handleScroll('down');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  return (
    <div className="flex-1 relative overflow-hidden bg-background">
      {/* TikTok Style Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Top Navigation Tabs */}
        <div className="flex items-center justify-center pt-12 pb-2">
          <div className="flex items-center gap-6 text-white">
            <button className="text-sm opacity-60 hover:opacity-100 transition-opacity">
              LIVE
            </button>
            <button className="text-sm opacity-60 hover:opacity-100 transition-opacity">
              Following
            </button>
            <button className="text-sm font-semibold opacity-100 border-b-2 border-white pb-1">
              For You
            </button>
            <button className="text-sm opacity-60 hover:opacity-100 transition-opacity">
              Events
            </button>
          </div>
        </div>
        
        {/* Action Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowFilter(true)}
            className="text-white hover:bg-white/10 gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <Search className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Video/Image Container */}
      <div 
        ref={scrollRef}
        className="h-full w-full relative"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
        {events.map((event, index) => (
          <div key={event.id} className="h-full w-full absolute" style={{ top: `${index * 100}%` }}>
            <ImageWithFallback
              src={event.coverImage}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
        ))}
      </div>

      {/* TikTok Style Bottom Content */}
      <div className="absolute bottom-20 left-0 right-0">
        <div className="flex items-end justify-between px-4">
          {/* Left Content - Event Info */}
          <div className="flex-1 max-w-[75%] space-y-3">
            {/* Main Text Content */}
            <div className="space-y-2">
              <button 
                onClick={() => {
                  capture('feed_click', { target: 'title', event_id: currentEvent.id });
                  onEventClick?.(currentEvent.id);
                }}
                className="text-left block"
              >
                <h2 className="text-white text-lg font-bold leading-tight mb-1">
                  {currentEvent.title}
                </h2>
              </button>
              
              <p className="text-white text-sm leading-relaxed break-words">
                {currentEvent.description}
                <br />
                <span className="text-accent font-semibold">
                  #{currentEvent.category.replace(/\s+/g, '')} #Events
                </span>
              </p>
            </div>

            {/* Organizer Info */}
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 border-2 border-white/20">
                <AvatarFallback className="text-xs bg-white/20 text-white">
                  {currentEvent.organizer.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => handleOrganizerClick(currentEvent)}
                className="text-white font-semibold text-sm hover:opacity-80 transition-opacity"
              >
                @{currentEvent.organizer.replace(/\s+/g, '').toLowerCase()}
              </button>
              <span className="text-white/70 text-sm">•</span>
              <button 
                onClick={() => handleAttendeesClick(currentEvent)}
                className="text-white/90 text-sm hover:text-white transition-colors"
              >
                {currentEvent.attendeeCount} attending
              </button>
            </div>

            {/* Event Details */}
            <div className="flex items-center gap-4 text-sm">
              <button 
                onClick={() => {
                  capture('feed_click', { target: 'date', event_id: currentEvent.id });
                  onEventClick?.(currentEvent.id);
                }}
                className="flex items-center gap-1 text-white/90 hover:text-white transition-colors"
              >
                <Calendar className="w-4 h-4" />
                {currentEvent.date}
              </button>
              <button 
                onClick={() => handleLocationClick(currentEvent)}
                className="flex items-center gap-1 text-white/90 hover:text-white transition-colors"
              >
                <MapPin className="w-4 h-4" />
                {currentEvent.location}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                size="lg" 
                variant="premium"
                onClick={() => handleGetTickets(currentEvent)}
                className="px-8 py-3 text-base font-bold"
              >
                Get Tickets
              </Button>
              <Button 
                size="lg" 
                variant="glass"
                onClick={() => handleDetails(currentEvent)}
                className="px-8 py-3 text-base font-semibold"
              >
                Details
              </Button>
            </div>
          </div>

          {/* Right Actions - Premium Posh Style */}
          <div className="flex flex-col items-center gap-4 pb-4">
            {/* Like Button */}
            <button
              onClick={() => handleLike(currentEvent.id)}
              className="action-button group"
            >
              <Heart 
                className={`w-6 h-6 transition-all duration-300 ${
                  currentEvent.isLiked 
                    ? 'fill-red-500 text-red-500 scale-110' 
                    : 'text-white group-hover:scale-110'
                }`} 
                strokeWidth={1.5}
              />
              <span className="absolute -bottom-6 text-white text-xs font-semibold">
                {currentEvent.likes > 999 ? `${(currentEvent.likes/1000).toFixed(1)}M` : `${currentEvent.likes}`}
              </span>
            </button>

            {/* Comment Button */}
            <button 
              onClick={() => {
                capture('feed_click', { target: 'comment', event_id: currentEvent.id });
                onEventClick?.(currentEvent.id);
              }}
              className="action-button group"
            >
              <MessageCircle 
                className="w-6 h-6 text-white group-hover:scale-110 transition-all duration-300" 
                strokeWidth={1.5}
              />
              <span className="absolute -bottom-6 text-white text-xs font-semibold">7.8K</span>
            </button>

            {/* Bookmark Button */}
            <button
              onClick={() => {
                capture('feed_click', { target: 'bookmark', event_id: currentEvent.id });
              }}
              className="action-button group"
            >
              <Bookmark 
                className="w-6 h-6 text-white group-hover:scale-110 transition-all duration-300" 
                strokeWidth={1.5}
              />
              <span className="absolute -bottom-6 text-white text-xs font-semibold">70K</span>
            </button>

            {/* Share Button */}
            <button
              onClick={() => handleShare(currentEvent)}
              className="action-button group"
            >
              <Share 
                className="w-6 h-6 text-white group-hover:scale-110 transition-all duration-300" 
                strokeWidth={1.5}
              />
              <span className="absolute -bottom-6 text-white text-xs font-semibold">
                {currentEvent.shares > 999 ? `${(currentEvent.shares/1000).toFixed(1)}K` : currentEvent.shares}
              </span>
            </button>

            {/* Creator Profile Pic */}
            <button 
              onClick={() => onCreatePost?.(currentEvent.id)}
              className="relative mt-4 group"
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 backdrop-blur-sm bg-white/10 group-hover:border-primary/50 transition-all duration-300">
                <Avatar className="w-full h-full">
                  <AvatarFallback className="brand-gradient text-white font-bold text-lg">
                    {currentEvent.organizer.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 brand-gradient rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                <Plus className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Scroll Indicators */}
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-1">
        {events.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-1 h-8 rounded-full transition-colors ${
              index === currentIndex ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Swipe Navigation (Mobile) */}
      <div 
        className="absolute inset-0 z-10"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          e.currentTarget.dataset.startY = touch.clientY.toString();
        }}
        onTouchEnd={(e) => {
          const startY = parseInt(e.currentTarget.dataset.startY || '0');
          const endY = e.changedTouches[0].clientY;
          const diff = startY - endY;

          if (Math.abs(diff) > 50) {
            if (diff > 0) {
              handleScroll('down');
            } else {
              handleScroll('up');
            }
          }
        }}
      />

      {/* Filter Modal */}
      <FeedFilter
        isOpen={showFilter}
        onToggle={() => setShowFilter(false)}
        onFilterChange={(filters) => {
          console.log('Filters applied:', filters);
          // TODO: Apply filters to events
        }}
      />
    </div>
  );
}