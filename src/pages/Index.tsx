import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, MapPin, Calendar, Crown, Users, Plus } from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { toast } from '@/hooks/use-toast';
import { EventFeed } from '@/components/EventFeed';
import { PostCreatorModal } from '@/components/PostCreatorModal';

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
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
  posts?: EventPost[];
}

interface EventPost {
  id: string;
  authorName: string;
  authorBadge: string;
  isOrganizer?: boolean;
  content: string;
  timestamp: string;
  likes: number;
}

interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

interface IndexProps {
  onEventSelect: (event: Event) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

// Mock event data with posts and badges per YardPass specs
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
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    ticketTiers: [
      { id: '1', name: 'General Admission', price: 89, badge: 'GA', available: 45, total: 1000 },
      { id: '2', name: 'VIP Experience', price: 199, badge: 'VIP', available: 12, total: 100 }
    ],
    attendeeCount: 1243,
    likes: 892,
    shares: 156,
    isLiked: false,
    posts: [
      {
        id: '1',
        authorName: 'Sarah Chen',
        authorBadge: 'VIP',
        content: 'Just got my VIP tickets! Can\'t wait for the weekend 🎵',
        timestamp: '2h ago',
        likes: 15
      },
      {
        id: '2',
        authorName: 'LiveNation Events',
        authorBadge: 'ORGANIZER',
        isOrganizer: true,
        content: 'Excited to announce headliner performances this weekend! 🎤',
        timestamp: '3h ago',
        likes: 87
      }
    ]
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
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    ticketTiers: [
      { id: '3', name: 'Entry Pass', price: 25, badge: 'ENTRY', available: 234, total: 500 },
      { id: '4', name: 'Foodie Pass', price: 75, badge: 'FOODIE', available: 18, total: 50 }
    ],
    attendeeCount: 567,
    likes: 445,
    shares: 89,
    isLiked: true,
    posts: [
      {
        id: '3',
        authorName: 'Mike Rodriguez',
        authorBadge: 'FOODIE',
        content: 'The authentic tacos here are incredible! 🌮',
        timestamp: '1h ago',
        likes: 23
      }
    ]
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
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbnxlbnwxfHx8fDE3NTY3NjI4ODd8MA&ixlib=rb-4.0&q=80&w=1080',
    ticketTiers: [
      { id: '5', name: 'Standard', price: 35, badge: 'STD', available: 156, total: 200 },
      { id: '6', name: 'Premium', price: 85, badge: 'PREM', available: 23, total: 50 }
    ],
    attendeeCount: 298,
    likes: 234,
    shares: 67,
    isLiked: false,
    posts: []
  }
];

const Index = ({ onEventSelect, onCreatePost, onCategorySelect, onOrganizerSelect }: IndexProps) => {
  const [events, setEvents] = useState(mockEvents);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { withRequireAuth } = useRequireAuth();
  const { requireAuth } = useAuthRedirect();

  const currentEvent = events[currentIndex];

  const handleLike = (eventId: string) => {
    console.log('handleLike called with:', eventId);
    withRequireAuth(() => {
      console.log('Like function executing inside withRequireAuth');
      setEvents(prev => prev.map(event => 
        event.id === eventId 
          ? { 
              ...event, 
              isLiked: !event.isLiked, 
              likes: event.isLiked ? event.likes - 1 : event.likes + 1 
            }
          : event
      ));
      toast({
        title: "Like Updated",
        description: "Event like status changed",
      });
    });
  };

  const handleShare = (event: Event) => {
    console.log('handleShare called');
    setShowShareModal(true);
  };

  const handleComment = () => {
    withRequireAuth(() => {
      onEventSelect(currentEvent);
      toast({
        title: "Opening Comments",
        description: "Loading event comments and discussions...",
      });
    });
  };

  const handleMoreOptions = () => {
    withRequireAuth(() => {
      toast({
        title: "More Options",
        description: "Additional options menu coming soon...",
      });
    });
  };

  const handleCategoryClick = (category: string) => {
    console.log('handleCategoryClick called with:', category);
    if (onCategorySelect) {
      onCategorySelect(category);
      toast({
        title: "Category Filter",
        description: `Browsing ${category} events...`,
      });
    } else {
      console.log('onCategorySelect not provided');
      toast({
        title: "Category Filter",
        description: `${category} category selected`,
      });
    }
  };

  const handleOrganizerClick = (organizerId: string, organizerName: string) => {
    console.log('handleOrganizerClick called with:', organizerId, organizerName);
    if (onOrganizerSelect) {
      onOrganizerSelect(organizerId, organizerName);
      toast({
        title: "Organizer Profile",
        description: `Viewing ${organizerName}'s profile...`,
      });
    } else {
      console.log('onOrganizerSelect not provided');
      toast({
        title: "Organizer Profile",
        description: `${organizerName} profile selected`,
      });
    }
  };

  const handleLocationClick = (location: string) => {
    toast({
      title: "Location Events",
      description: `Finding events near ${location}...`,
    });
  };

  const handleTicketTierClick = (tierName: string) => {
    requireAuth(() => {
      onEventSelect(currentEvent);
      toast({
        title: "Ticket Details",
        description: `Viewing ${tierName} ticket information...`,
      });
    }, "Please sign in to view ticket details");
  };

  const handleEventTitleClick = () => {
    onEventSelect(currentEvent);
    toast({
      title: "Event Details",
      description: "Loading full event information...",
    });
  };

  const handleGetTickets = () => {
    requireAuth(() => {
      setShowTicketModal(true);
      toast({
        title: "Get Tickets",
        description: "Opening ticket purchase modal...",
      });
    }, "Please sign in to purchase tickets");
  };

  const handleEventDetails = () => {
    onEventSelect(currentEvent);
    toast({
      title: "Event Details",
      description: "Loading detailed event information...",
    });
  };

  const handleAttendeeClick = () => {
    setShowAttendeeModal(true);
    toast({
      title: "Attendee List",
      description: "Loading event attendees...",
    });
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
    <div className="h-screen relative overflow-hidden bg-black">
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
            onClick={() => requireAuth(() => onCreatePost(), "Please sign in to create content")}
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            + Create Event
          </Button>
        </div>
      </div>

      {/* Video/Image Container */}
      <div 
        ref={scrollRef}
        className="h-full w-full relative transition-transform duration-300 ease-out"
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
              <Badge 
                variant="secondary" 
                className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => handleCategoryClick(currentEvent.category)}
              >
                {currentEvent.category}
              </Badge>
              <Badge 
                variant="outline" 
                className="border-white/30 text-white cursor-pointer hover:bg-white/10 transition-colors"
                onClick={handleAttendeeClick}
              >
                {currentEvent.attendeeCount} attending
              </Badge>
            </div>

            <div>
              <h2 
                className="text-2xl font-bold mb-2 max-w-xs cursor-pointer hover:text-primary-foreground/90 transition-colors"
                onClick={handleEventTitleClick}
              >
                {currentEvent.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs bg-white/20 text-white">
                    {currentEvent.organizer.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span 
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleOrganizerClick(currentEvent.organizerId, currentEvent.organizer)}
                >
                  @{currentEvent.organizer.replace(/\s+/g, '').toLowerCase()}
                </span>
                <Badge variant="secondary" className="text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  ORGANIZER
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-300 mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {currentEvent.date}
                </div>
                <div 
                  className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleLocationClick(currentEvent.location)}
                >
                  <MapPin className="w-4 h-4" />
                  {currentEvent.location}
                </div>
                <div 
                  className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                  onClick={() => setShowAttendeeModal(true)}
                >
                  <Users className="w-4 h-4" />
                  {currentEvent.attendeeCount}
                </div>
              </div>
              <p className="text-sm text-gray-300 line-clamp-2 max-w-xs">
                {currentEvent.description}
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleGetTickets}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Get Tickets
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleEventDetails}
                className="border-white/30 text-white bg-white/10 hover:bg-white/20"
              >
                Details
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-4 text-white relative z-20">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Like button clicked');
                requireAuth(() => handleLike(currentEvent.id), "Please sign in to like events");
              }}
              className="flex flex-col items-center gap-1 transition-transform active:scale-95 z-20 relative min-h-[44px] min-w-[44px] p-2"
              style={{ touchAction: 'manipulation' }}
            >
              <div className={`p-3 rounded-full transition-all duration-200 ${
                currentEvent.isLiked 
                  ? 'bg-red-500 shadow-lg shadow-red-500/30' 
                  : 'bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20'
              }`}>
                <Heart 
                  className={`w-6 h-6 transition-colors ${
                    currentEvent.isLiked ? 'fill-white text-white' : 'text-white'
                  }`} 
                />
              </div>
              <span className="text-xs font-medium">{currentEvent.likes}</span>
            </button>

            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Comment button clicked');
                handleComment();
              }}
              className="flex flex-col items-center gap-1 transition-transform active:scale-95 z-20 relative min-h-[44px] min-w-[44px] p-2"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium">
                {currentEvent.posts?.length || 0}
              </span>
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Post button clicked');
                requireAuth(() => setPostCreatorOpen(true), "Please sign in to create posts");
              }}
              className="flex flex-col items-center gap-1 transition-transform active:scale-95 z-20 relative min-h-[44px] min-w-[44px] p-2"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="p-3 rounded-full bg-primary/80 backdrop-blur-sm border border-primary/50 hover:bg-primary transition-all duration-200">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium">Post</span>
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Share button clicked');
                handleShare(currentEvent);
              }}
              className="flex flex-col items-center gap-1 transition-transform active:scale-95 z-20 relative min-h-[44px] min-w-[44px] p-2"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200">
                <Share className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium">{currentEvent.shares}</span>
            </button>

            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('More options button clicked');
                handleMoreOptions();
              }}
              className="transition-transform active:scale-95 z-20 relative min-h-[44px] min-w-[44px]"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200">
                <MoreVertical className="w-6 h-6 text-white" />
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

      {/* Modals */}
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={currentEvent.title}
        attendeeCount={currentEvent.attendeeCount}
        attendees={[]}
      />

      {/* Event Ticket Modal */}
      <EventTicketModal
        event={currentEvent ? {
          id: currentEvent.id,
          title: currentEvent.title,
          start_at: (() => {
            // Try to parse the date string, fallback to a future date if invalid
            const parsedDate = new Date(currentEvent.date);
            if (isNaN(parsedDate.getTime())) {
              // If date string can't be parsed, use a default future date
              return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now
            }
            return parsedDate.toISOString();
          })(),
          venue: currentEvent.location,
          address: currentEvent.location,
          description: currentEvent.description
        } : null}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          setShowTicketModal(false);
          toast({
            title: "Redirecting to Checkout",
            description: "Opening Stripe checkout in a new tab..."
          });
        }}
      />
      

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        eventTitle={currentEvent.title}
        eventId={currentEvent.id}
        eventDescription={currentEvent.description}
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        preselectedEventId={currentEvent?.id}
        onSuccess={() => {
          setPostCreatorOpen(false);
          toast({
            title: "Success",
            description: "Your post has been created!",
          });
        }}
      />
    </div>
  );
};

export default Index;
