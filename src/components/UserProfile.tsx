import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useTickets, UserTicket } from '@/hooks/useTickets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';

interface UserPost {
  id: string;
  content: string;
  event_id: string;
  tier_id: string;
  created_at: string;
  events: {
    title: string;
    date: string;
  };
  ticket_tiers: {
    name: string;
  };
}

interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
}
import { 
  ArrowLeft, 
  Settings, 
  Shield, 
  Ticket, 
  Calendar,
  MapPin,
  Users,
  Star,
  Edit,
  Share,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface User {
  id: string;
  phone: string;
  name: string;
  role: 'attendee' | 'organizer';
  isVerified: boolean;
}

interface UserProfileProps {
  user: User;
  onRoleToggle: () => void;
  onBack: () => void;
}


export function UserProfile({ user, onRoleToggle, onBack }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(false);
  const { tickets, loading: ticketsLoading } = useTickets();

  const totalSpent = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
  const eventsAttended = tickets.length;

  // Fetch user's posts and badges
  useEffect(() => {
    if (user.id) {
      fetchUserData();
    }
  }, [user.id]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch user's posts with better error handling
      const { data: posts, error: postsError } = await supabase
        .from('event_posts')
        .select(`
          id,
          text,
          created_at,
          events!event_posts_event_id_fkey (
            id,
            title,
            cover_image_url
          ),
          ticket_tiers!event_posts_tier_id_fkey (
            badge_label
          )
        `)
        .eq('author_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        toast({
          title: "Warning",
          description: "Could not load your posts",
          variant: "destructive",
        });
        setUserPosts([]);
      } else {
        setUserPosts(posts || []);
      }

      // Calculate badges from ticket tiers with better error handling
      try {
        const badgeCounts = new Map();
        tickets.forEach(ticket => {
          const badge = ticket.badge || 'GA';
          badgeCounts.set(badge, (badgeCounts.get(badge) || 0) + 1);
        });

        const badges = Array.from(badgeCounts.entries()).map(([name, count]) => ({
          name,
          count,
          description: `${name} tier attendee`
        }));

        setUserBadges(badges);
      } catch (badgeError) {
        console.error('Error calculating badges:', badgeError);
        setUserBadges([]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data. Please try refreshing the page.",
        variant: "destructive",
      });
      // Set empty states to prevent UI crashes
      setUserPosts([]);
      setUserBadges([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Profile</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                import('@/lib/share').then(({ sharePayload }) => {
                  import('@/lib/shareLinks').then(({ buildShareUrl, getShareTitle, getShareText }) => {
                    sharePayload({
                      title: getShareTitle({ type: 'user', handle: user.id, name: user.name }),
                      text: getShareText({ type: 'user', handle: user.id, name: user.name }),
                      url: buildShareUrl({ type: 'user', handle: user.id, name: user.name })
                    });
                  });
                });
              }}
            >
              <Share className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Done' : <Edit className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Profile Header */}
        <div className="p-6 text-center border-b">
          <Avatar className="w-20 h-20 mx-auto mb-4">
            <AvatarFallback className="text-xl">
              {user.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="mb-1">{user.name}</h2>
          <p className="text-sm text-muted-foreground mb-2">{user.phone}</p>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            {user.isVerified && (
              <Badge variant="secondary" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {user.role === 'organizer' ? 'Organizer' : 'Attendee'}
            </Badge>
          </div>

          {/* Role Toggle - Debug Visible */}
          <Card className="max-w-sm mx-auto border-2 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left flex-1">
                  <div className="text-sm font-medium">Organizer Mode</div>
                  <div className="text-xs text-muted-foreground">
                    {user.role === 'organizer' ? 'Create and manage events' : 'Switch to organize events'}
                  </div>
                  <div className="text-xs text-red-500 mt-1">
                    Current role: {user.role}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('TOGGLE BUTTON CLICKED! Current role:', user.role);
                      onRoleToggle();
                    }}
                    variant={user.role === 'organizer' ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[80px]"
                  >
                    {user.role === 'organizer' ? 'Attendee' : 'Organizer'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 border-b">
          <div className="p-4 text-center">
            <div className="text-xl">{eventsAttended}</div>
            <div className="text-xs text-muted-foreground">Events</div>
          </div>
          <div className="p-4 text-center border-x">
            <div className="text-xl">${totalSpent.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Spent</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xl">{userPosts.length}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tickets" className="flex-1">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3>Your Tickets</h3>
              <Button variant="outline" size="sm">Filter</Button>
            </div>

            <div className="space-y-3">
              {ticketsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Loading tickets...</p>
                </div>
              ) : tickets.length > 0 ? (
                tickets.slice(0, 5).map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden">
                  <div className="flex">
                    <ImageWithFallback
                      src={ticket.coverImage}
                      alt={ticket.eventTitle}
                      className="w-20 h-20 object-cover"
                    />
                    <CardContent className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-sm mb-1">{ticket.eventTitle}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="w-3 h-3" />
                            {ticket.eventDate}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {ticket.eventLocation}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs mb-1">
                            {ticket.badge}
                          </Badge>
                          <div className="text-sm">${ticket.price}</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{ticket.ticketType}</span>
                        <Badge 
                          variant={ticket.status === 'issued' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {ticket.status === 'issued' ? 'confirmed' : ticket.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </div>
                </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tickets yet</p>
                  <p className="text-sm">Discover and attend amazing events!</p>
                </div>
              )}
          </TabsContent>

          <TabsContent value="badges" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3>Your Badges</h3>
              <span className="text-sm text-muted-foreground">
                {userBadges.reduce((sum, badge) => sum + badge.count, 0)} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {userBadges.length > 0 ? userBadges.map((badge) => (
                <Card key={badge.name}>
                  <CardContent className="p-4 text-center">
                    <div className="mb-2">
                      <Badge variant="outline" className="text-sm">
                        {badge.name}
                      </Badge>
                    </div>
                    <div className="text-2xl mb-1">{badge.count}</div>
                    <p className="text-xs text-muted-foreground">
                      {badge.description}
                    </p>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No badges yet</p>
                  <p className="text-sm">Attend events to earn badges!</p>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Badge Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span>Music Lover</span>
                    <span className="text-muted-foreground">2/5 events</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '40%' }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Attend 3 more music events to unlock this badge
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3>Your Posts</h3>
              <Button variant="outline" size="sm">Create Post</Button>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Loading posts...</p>
                </div>
              ) : userPosts.length > 0 ? (
                userPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <ImageWithFallback
                        src={post.events?.cover_image_url || DEFAULT_EVENT_COVER}
                        alt={post.events?.title || 'Event'}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{post.events?.title || 'Event'}</span>
                          <Badge variant="outline" className="text-xs">
                            {post.ticket_tiers?.badge_label || 'GA'}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{post.text}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No posts yet</p>
                  <p className="text-sm">Share your event experiences!</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default UserProfile;