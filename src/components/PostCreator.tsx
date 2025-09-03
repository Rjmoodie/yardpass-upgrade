import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ArrowLeft, Camera, Video, MapPin, Tag } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface PostCreatorProps {
  user: User | null;
  onBack: () => void;
  onPost: () => void;
}

// Mock user's events for tagging
const mockUserEvents = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    date: 'July 15-17, 2024',
    badge: 'VIP',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    date: 'August 8, 2024',
    badge: 'FOODIE',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  }
];

// Mock organizers for tagging
const mockOrganizers = [
  { id: '101', name: 'LiveNation Events', verified: true },
  { id: '102', name: 'Foodie Adventures', verified: true },
  { id: '103', name: 'Modern Gallery NYC', verified: false }
];

export function PostCreator({ user, onBack, onPost }: PostCreatorProps) {
  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to create posts.</p>
          <Button onClick={onBack}>Go Back</Button>
        </div>
      </div>
    );
  }
  const [content, setContent] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);

  const selectedEventData = mockUserEvents.find(event => event.id === selectedEvent);

  const handleSubmit = () => {
    if (content.trim() && selectedEvent) {
      // Mock post creation
      onPost();
    }
  };

  const toggleOrganizerTag = (organizerId: string) => {
    setSelectedOrganizers(prev =>
      prev.includes(organizerId)
        ? prev.filter(id => id !== organizerId)
        : [...prev, organizerId]
    );
  };

  const canPost = content.trim() && selectedEvent;

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1>Create Post</h1>
              <p className="text-sm text-muted-foreground">Share your event experience</p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canPost}
            className="px-6"
          >
            Post
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Post Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's happening?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share your thoughts about the event, tag organizers, or post updates..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-32 resize-none"
              maxLength={280}
            />
            
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{content.length}/280 characters</span>
            </div>

            {/* Media Options */}
            <div className="flex gap-2">
              <Button
                variant={mediaType === 'photo' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMediaType(mediaType === 'photo' ? null : 'photo')}
              >
                <Camera className="w-4 h-4 mr-1" />
                Photo
              </Button>
              <Button
                variant={mediaType === 'video' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMediaType(mediaType === 'video' ? null : 'video')}
              >
                <Video className="w-4 h-4 mr-1" />
                Video
              </Button>
            </div>

            {mediaType && (
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-muted rounded-full flex items-center justify-center">
                  {mediaType === 'photo' ? <Camera className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a {mediaType} to your post
                </p>
                <Button variant="outline" size="sm">
                  Choose {mediaType === 'photo' ? 'Photo' : 'Video'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tag Event */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tag Event *
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event you're attending" />
              </SelectTrigger>
              <SelectContent>
                {mockUserEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    <div className="flex items-center gap-2 py-1">
                      <ImageWithFallback
                        src={event.coverImage}
                        alt={event.title}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <div>
                        <div className="text-sm">{event.title}</div>
                        <div className="text-xs text-muted-foreground">{event.date}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedEventData && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <ImageWithFallback
                      src={selectedEventData.coverImage}
                      alt={selectedEventData.title}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{selectedEventData.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedEventData.badge}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{selectedEventData.date}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Tag Organizers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tag Organizers</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mention event organizers in your post
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockOrganizers.map((organizer) => (
              <div
                key={organizer.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedOrganizers.includes(organizer.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleOrganizerTag(organizer.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    {organizer.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{organizer.name}</span>
                      {organizer.verified && (
                        <Badge variant="secondary" className="text-xs">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOrganizers.includes(organizer.id)
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}>
                  {selectedOrganizers.includes(organizer.id) && (
                    <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                  )}
                </div>
              </div>
            ))}

            {selectedOrganizers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Tagged organizers:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedOrganizers.map((organizerId) => {
                    const organizer = mockOrganizers.find(o => o.id === organizerId);
                    return organizer ? (
                      <Badge key={organizerId} variant="secondary" className="text-xs">
                        @{organizer.name.replace(/\s+/g, '').toLowerCase()}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        {content && selectedEvent && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{user.name}</span>
                      {selectedEventData && (
                        <Badge variant="outline" className="text-xs">
                          {selectedEventData.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mb-2">{content}</p>
                    
                    {selectedEventData && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>at {selectedEventData.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default PostCreator;