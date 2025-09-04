import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Heart, MessageCircle, Share, Play, Pause, MoreVertical, MapPin, Calendar, Plus } from 'lucide-react';
import { routes } from '@/lib/routes';
import { openMaps } from '@/lib/maps';
import { capture } from '@/lib/analytics';
import { useShare } from '@/hooks/useShare';

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
  const { shareEvent } = useShare();
  const [events, setEvents] = useState(mockEvents);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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
    onShareEvent?.(event.id, event.title, event.description);
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
    <div className="flex-1 relative overflow-hidden bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎪</span>
            <span>YardPass</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onCreatePost?.()}
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            + Post
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          </div>
        ))}
      </div>

      {/* Event Info Overlay */}
      <div className="absolute bottom-20 left-0 right-0 p-4 text-white">
        <div className="flex justify-between items-end">
          {/* Event Details */}
          <div className="flex-1 mr-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleCategoryClick(currentEvent.category, currentEvent.id)}>
                <Badge variant="secondary" className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90">
                  {currentEvent.category}
                </Badge>
              </button>
              <button onClick={() => handleAttendeesClick(currentEvent)}>
                <Badge variant="outline" className="border-white/30 text-white cursor-pointer hover:bg-white/10">
                  {currentEvent.attendeeCount} attending
                </Badge>
              </button>
            </div>

            <div>
              <button 
                onClick={() => {
                  capture('feed_click', { target: 'title', event_id: currentEvent.id });
                  onEventClick?.(currentEvent.id);
                }}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <h2 className="mb-2 max-w-xs">{currentEvent.title}</h2>
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs bg-white/20 text-white">
                    {currentEvent.organizer.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <button 
                  onClick={() => handleOrganizerClick(currentEvent)}
                  className="hover:text-white transition-colors"
                >
                  @{currentEvent.organizer.replace(/\s+/g, '').toLowerCase()}
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-300 mb-3">
                <button 
                  onClick={() => {
                    capture('feed_click', { target: 'date', event_id: currentEvent.id });
                    onEventClick?.(currentEvent.id);
                  }}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  {currentEvent.date}
                </button>
                <button 
                  onClick={() => handleLocationClick(currentEvent)}
                  onAuxClick={() => handleLocationClick(currentEvent, true)}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                  aria-label="View event location"
                >
                  <MapPin className="w-4 h-4" />
                  {currentEvent.location}
                </button>
              </div>
              <p className="text-sm text-gray-300 line-clamp-2 max-w-xs">
                {currentEvent.description}
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => handleGetTickets(currentEvent)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Get Tickets
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleDetails(currentEvent)}
                className="border-white/30 text-white bg-white/10 hover:bg-white/20"
              >
                Details
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-6 text-white">
            <button
              onClick={() => handleLike(currentEvent.id)}
              className="flex flex-col items-center gap-1 group"
              aria-label={currentEvent.isLiked ? 'Unlike event' : 'Like event'}
            >
              <div className={`p-3 rounded-full ${currentEvent.isLiked ? 'bg-red-500' : 'bg-white/20'} transition-colors group-hover:scale-110`}>
                <Heart 
                  className={`w-6 h-6 ${currentEvent.isLiked ? 'fill-white' : ''}`} 
                />
              </div>
              <span className="text-xs">{currentEvent.likes}</span>
            </button>

            <button 
              onClick={() => {
                capture('feed_click', { target: 'comment', event_id: currentEvent.id });
                onEventClick?.(currentEvent.id);
              }}
              className="flex flex-col items-center gap-1 group"
              aria-label="View comments"
            >
              <div className="p-3 rounded-full bg-white/20 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6" />
              </div>
              <span className="text-xs">42</span>
            </button>

            <button
              onClick={() => handleShare(currentEvent)}
              className="flex flex-col items-center gap-1 group"
              aria-label="Share event"
            >
              <div className="p-3 rounded-full bg-white/20 group-hover:scale-110 transition-transform">
                <Share className="w-6 h-6" />
              </div>
              <span className="text-xs">{currentEvent.shares}</span>
            </button>

            <button 
              onClick={() => onCreatePost?.(currentEvent.id)}
              className="flex flex-col items-center gap-1 group"
              aria-label="Create post"
            >
              <div className="p-3 rounded-full bg-primary/80 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-xs">Post</span>
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
    </div>
  );
}