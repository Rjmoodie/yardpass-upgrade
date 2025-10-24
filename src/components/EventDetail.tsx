import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ArrowLeft, MapPin, Calendar, Heart, Share, MoreVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

import { Event, TicketTier } from '@/types/events';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface EventDetailProps {
  event: Event;
  user: User | null;
  onBack: () => void;
}

// Mock posts data
const mockPosts = [
  {
    id: '1',
    author: 'Sarah Chen',
    badge: 'VIP',
    content: "Can't wait for this! The lineup is absolutely incredible 🎵",
    timestamp: '2h ago',
    likes: 12,
    avatar: 'SC',
  },
  {
    id: '2',
    author: 'Mike Johnson',
    badge: 'GA',
    content: 'First time at this venue - any tips for parking?',
    timestamp: '4h ago',
    likes: 8,
    avatar: 'MJ',
  },
  {
    id: '3',
    author: 'LiveNation Events',
    badge: 'ORG',
    content: "Weather forecast looking great! Don't forget to bring sunscreen ☀️",
    timestamp: '6h ago',
    likes: 24,
    isOrganizer: true,
    avatar: 'LN',
  },
];

export function EventDetail({ event, user, onBack }: EventDetailProps) {
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const isPast = (() => {
    const iso = event.startAtISO;
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t < Date.now() : false;
  })();

  const handlePurchase = () => {
    if (selectedTier && !isPast) {
      setShowPurchaseModal(true);
    }
  };

  const completePurchase = () => {
    setShowPurchaseModal(false);
    setSelectedTier(null);
    alert(`Successfully purchased ${quantity}x ${selectedTier?.name} ticket(s)!`);
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="relative">
        <ImageWithFallback
          src={event.coverImage}
          alt={event.title}
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full ${isLiked ? 'bg-red-500' : 'bg-black/50'} text-white hover:opacity-80 transition-all`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
          </button>

          <button
            onClick={() => {
              import('@/lib/share').then(({ sharePayload }) => {
                import('@/lib/shareLinks').then(
                  ({ buildShareUrl, getShareTitle, getShareText }) => {
                    const ident = (event as any).slug ?? event.id;
                    sharePayload({
                      title: getShareTitle({
                        type: 'event',
                        slug: ident,
                        title: event.title,
                      }),
                      text: getShareText({
                        type: 'event',
                        slug: ident,
                        title: event.title,
                        city: event.location,
                        date: event.dateLabel,
                      }),
                      url: buildShareUrl({
                        type: 'event',
                        slug: ident,
                        title: event.title,
                      }),
                    });
                  }
                );
              });
            }}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <Share className="w-5 h-5" />
          </button>

          <button className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-primary text-primary-foreground">
              {event.category}
            </Badge>
            <Badge variant="outline" className="border-white/30 text-white bg-black/30">
              {event.attendeeCount}
            </Badge>
          </div>
          <h1 className="mb-2">{event.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-xs bg-white/20 text-white">
                {event.organizer.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span>by {event.organizer}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="details" className="h-full">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="posts">Posts ({mockPosts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <div>
                  <div className="text-foreground">{event.dateLabel}</div>
                  <div>8:00 PM - 2:00 AM</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <div>
                  <div className="text-foreground">{event.location}</div>
                  <div>Get directions</div>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{event.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organizer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{event.organizer.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm">{event.organizer}</div>
                      <div className="text-xs text-muted-foreground">Verified Organizer</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Follow
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="p-4 space-y-4">
            {/* Past event banner */}
            {isPast && (
              <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
                Sales ended — this event has already started or ended.
              </div>
            )}

            <div className="space-y-3">
              {event.ticketTiers && event.ticketTiers.length > 0 ? (
                event.ticketTiers.map((tier) => (
                  <Card
                    key={tier.id}
                    className={`transition-all ${
                      isPast
                        ? 'opacity-60 cursor-not-allowed'
                        : selectedTier?.id === tier.id
                        ? 'ring-2 ring-primary border-primary cursor-pointer'
                        : 'hover:shadow-md cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isPast) setSelectedTier(tier);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm">{tier.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {tier.badge}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {tier.available} of {tier.total} available
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg">${tier.price}</div>
                          <div className="text-xs text-muted-foreground">per ticket</div>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${tier.total ? (tier.available / tier.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tickets available for this event.</p>
                </div>
              )}
            </div>

            {selectedTier && !isPast && (
              <Card className="border-primary">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm">Selected: {selectedTier.name}</h4>
                    <span className="text-lg">${selectedTier.price}</span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm">Quantity</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center text-sm">{quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setQuantity(Math.min(selectedTier.available, quantity + 1))
                        }
                        disabled={quantity >= selectedTier.available}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Subtotal</span>
                      <span>${(selectedTier.price * quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Service Fee</span>
                      <span>${(selectedTier.price * quantity * 0.05).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span>${(selectedTier.price * quantity * 1.05).toFixed(2)}</span>
                    </div>
                  </div>

                  <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
                    <DialogTrigger asChild>
                      <Button className="w-full" onClick={handlePurchase} disabled={!user}>
                        {user ? 'Purchase Tickets' : 'Sign in to Purchase'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Complete Purchase</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          You're purchasing {quantity}x {selectedTier.name} ticket(s) for $
                          {(selectedTier.price * quantity * 1.05).toFixed(2)}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={completePurchase} className="flex-1">
                            Pay with Stripe
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowPurchaseModal(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            {/* If past, hide the purchase block entirely */}
            {isPast && (
              <div className="text-sm text-muted-foreground">
                Tickets are no longer available. You can still view posts in the "Posts" tab.
              </div>
            )}
          </TabsContent>

          <TabsContent value="posts" className="p-4 space-y-4">
            {mockPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">{post.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{post.author}</span>
                        <Badge
                          variant={post.isOrganizer ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {post.badge}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{post.timestamp}</span>
                      </div>
                      <p className="text-sm mb-2">{post.content}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-foreground">
                          <Heart className="w-3 h-3" />
                          {post.likes}
                        </button>
                        <button className="hover:text-foreground">Reply</button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default EventDetail;
