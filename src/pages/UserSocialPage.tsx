import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Search, UserPlus, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UserFollowList } from '@/components/follow/UserFollowList';
import { UserSearchModal } from '@/components/follow/UserSearchModal';
import { UserProfileSocial } from '@/components/follow/UserProfileSocial';

export function UserSocialPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'connections' | 'discover' | 'profile'>('connections');
  const [searchOpen, setSearchOpen] = useState(false);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please sign in to view your network</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Network</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Find People
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3 network-tabs">
          <TabsTrigger value="connections">My Connections</TabsTrigger>
          <TabsTrigger value="discover">Discover People</TabsTrigger>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserFollowList 
                userId={user.id}
                showSearch={true}
                maxHeight="500px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Discover New Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Expand Your Network</h3>
                <p className="text-muted-foreground mb-4">
                  Connect with other professionals, event attendees, and organizers to build your network.
                </p>
                <Button onClick={() => setSearchOpen(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  Start Searching
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <UserProfileSocial 
            userId={user.id}
            showActions={true}
            maxHeight="600px"
          />
        </TabsContent>
      </Tabs>

      <UserSearchModal 
        open={searchOpen} 
        onOpenChange={setSearchOpen}
      />
    </div>
  );
}
