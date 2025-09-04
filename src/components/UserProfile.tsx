import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { 
  ArrowLeft, 
  Settings, 
  Shield, 
  Ticket, 
  Calendar,
  MapPin,
  Users,
  Star,
  Edit
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

// Mock user data
const mockTickets = [
  {
    id: '1',
    eventTitle: 'Summer Music Festival 2024',
    eventDate: 'July 15, 2024',
    eventLocation: 'Central Park, NYC',
    tierName: 'VIP Experience',
    badge: 'VIP',
    price: 199,
    status: 'confirmed',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  },
  {
    id: '2',
    eventTitle: 'Street Food Fiesta',
    eventDate: 'August 8, 2024',
    eventLocation: 'Brooklyn Bridge Park',
    tierName: 'Foodie Pass',
    badge: 'FOODIE',
    price: 75,
    status: 'confirmed',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  }
];

const mockPosts = [
  {
    id: '1',
    eventTitle: 'Summer Music Festival 2024',
    content: 'Amazing lineup! Can\'t wait for the weekend 🎵',
    timestamp: '2 days ago',
    likes: 15,
    badge: 'VIP',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  }
];

const mockBadges = [
  { name: 'VIP', count: 3, description: 'VIP tier attendee' },
  { name: 'FOODIE', count: 2, description: 'Food event enthusiast' },
  { name: 'EARLY', count: 5, description: 'Early bird ticket holder' }
];

export function UserProfile({ user, onRoleToggle, onBack }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);

  const totalSpent = mockTickets.reduce((sum, ticket) => sum + ticket.price, 0);
  const eventsAttended = mockTickets.length;

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
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Done' : <Edit className="w-4 h-4" />}
          </Button>
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

          {/* Role Toggle */}
          <Card className="max-w-sm mx-auto">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left flex-1">
                  <div className="text-sm font-medium">Organizer Mode</div>
                  <div className="text-xs text-muted-foreground">
                    {user.role === 'organizer' ? 'Create and manage events' : 'Switch to organize events'}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Switch
                    checked={user.role === 'organizer'}
                    onCheckedChange={(checked) => {
                      console.log('Switch clicked, checked:', checked, 'current role:', user.role);
                      onRoleToggle();
                    }}
                    className="data-[state=checked]:bg-green-600"
                  />
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
            <div className="text-xl">${totalSpent}</div>
            <div className="text-xs text-muted-foreground">Spent</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xl">{mockPosts.length}</div>
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
              {mockTickets.map((ticket) => (
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
                        <span className="text-xs text-muted-foreground">{ticket.tierName}</span>
                        <Badge 
                          variant={ticket.status === 'confirmed' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {ticket.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>

            {mockTickets.length === 0 && (
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
                {mockBadges.reduce((sum, badge) => sum + badge.count, 0)} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {mockBadges.map((badge) => (
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
              ))}
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
              {mockPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <ImageWithFallback
                        src={post.coverImage}
                        alt={post.eventTitle}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{post.eventTitle}</span>
                          <Badge variant="outline" className="text-xs">
                            {post.badge}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{post.content}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{post.timestamp}</span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {post.likes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {mockPosts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No posts yet</p>
                <p className="text-sm">Share your event experiences!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default UserProfile;