import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Ticket, Users, Crown } from 'lucide-react';
import { PostCreatorModal } from './PostCreatorModal';
import { EventFeed } from './EventFeed';

interface UserTicket {
  id: string;
  event_id: string;
  tier_id: string;
  events: {
    id: string;
    title: string;
  };
  ticket_tiers: {
    badge_label: string;
    name: string;
  };
}

export function PostsDebugPage() {
  const { user, profile } = useAuth();
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [testEventId, setTestEventId] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserTickets();
      setTestUserId(user.id);
    }
  }, [user]);

  const fetchUserTickets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🎫 Fetching user tickets...');
      
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          event_id,
          tier_id,
          status,
          events!fk_tickets_event_id (
            id,
            title,
            owner_context_type,
            owner_context_id
          ),
          ticket_tiers!fk_tickets_tier_id (
            badge_label,
            name,
            price_cents
          )
        `)
        .eq('owner_user_id', user.id);

      console.log('📋 Tickets query result:', { data, error });

      if (error) throw error;
      setUserTickets(data || []);
      
      if (data && data.length > 0) {
        setTestEventId(data[0].event_id);
      }
    } catch (error) {
      console.error('❌ Error fetching tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testPostCreation = async () => {
    if (!testEventId) {
      toast({
        title: "Missing Event ID",
        description: "Please enter an event ID to test",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🧪 Testing post creation...');
      const { data, error } = await supabase.functions.invoke('posts-create', {
        body: {
          event_id: testEventId,
          text: `Test post from debug page - ${new Date().toLocaleTimeString()}`,
          media_urls: [],
        },
      });

      console.log('📝 Post creation result:', { data, error });

      if (error) {
        toast({
          title: "Test Failed",
          description: error.message || "Failed to create test post",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test Successful",
          description: "Test post created successfully",
        });
      }
    } catch (error: any) {
      console.error('❌ Test post creation error:', error);
      toast({
        title: "Test Error",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  const testPostsList = async () => {
    try {
      console.log('📋 Testing posts list...');
      const url = new URL('https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/posts-list');
      if (testEventId) url.searchParams.append('event_id', testEventId);
      url.searchParams.append('limit', '10');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY'}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('📄 Posts list result:', result);

      toast({
        title: "Posts List Test",
        description: `Found ${result.data?.length || 0} posts`,
      });
    } catch (error: any) {
      console.error('❌ Test posts list error:', error);
      toast({
        title: "Test Error",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
            <p className="text-muted-foreground">Please sign in to test the posts system.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Posts System Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar>
              <AvatarImage src={profile?.photo_url || ''} />
              <AvatarFallback>{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{profile?.display_name}</div>
              <div className="text-sm text-muted-foreground">ID: {user.id}</div>
            </div>
          </div>

          {/* User Tickets */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Your Tickets ({userTickets.length})
            </h3>
            {loading ? (
              <div>Loading tickets...</div>
            ) : userTickets.length > 0 ? (
              <div className="grid gap-2">
                {userTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div>
                      <div className="font-medium">{ticket.events.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {ticket.ticket_tiers.name}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {ticket.ticket_tiers.badge_label}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No tickets found</div>
            )}
          </div>

          {/* Test Controls */}
          <div className="space-y-3">
            <h3 className="font-semibold">Test Controls</h3>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Test Event ID</label>
              <Input
                value={testEventId}
                onChange={(e) => setTestEventId(e.target.value)}
                placeholder="Enter event ID to test with"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={testPostCreation} variant="outline" size="sm">
                Test Create Post
              </Button>
              <Button onClick={testPostsList} variant="outline" size="sm">
                Test List Posts
              </Button>
              <Button onClick={() => setPostCreatorOpen(true)} size="sm">
                Open Post Creator
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Live Posts Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EventFeed eventId={testEventId || undefined} />
        </CardContent>
      </Card>

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        preselectedEventId={testEventId || undefined}
        onSuccess={() => {
          setPostCreatorOpen(false);
          toast({
            title: "Success",
            description: "Post created successfully!",
          });
        }}
      />
    </div>
  );
}