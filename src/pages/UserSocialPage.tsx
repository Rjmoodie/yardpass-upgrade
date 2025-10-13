import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Search, UserPlus, MessageCircle, Sparkles } from 'lucide-react';
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
    <div className="relative min-h-screen bg-gradient-to-b from-background via-muted/40 to-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
              <Sparkles className="h-4 w-4" />
              Yardpass network
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Network</h1>
              <p className="text-sm text-muted-foreground">
                Grow meaningful connections and stay in touch with the people you meet at events.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2 rounded-full border-border/40">
              <Search className="h-4 w-4" />
              Find people
            </Button>
            <Button onClick={() => setActiveTab('discover')} className="gap-2 rounded-full">
              <MessageCircle className="h-4 w-4" />
              Start a chat
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-border/50 bg-background/80 shadow-lg backdrop-blur">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/15">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connections you follow</p>
                <p className="text-lg font-semibold text-foreground">Stay updated with your community</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-border/60 px-3 py-1">Attendees</span>
              <span className="rounded-full border border-border/60 px-3 py-1">Organizers</span>
              <span className="rounded-full border border-border/60 px-3 py-1">Vendors</span>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-full border border-border/40 bg-background/80 p-1 shadow-sm">
            <TabsTrigger value="connections" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              My Connections
            </TabsTrigger>
            <TabsTrigger value="discover" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Discover People
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-full text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              My Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            <Card className="border-border/50 bg-background/80 shadow-sm">
              <CardHeader className="flex flex-col gap-2 border-b border-border/40 bg-muted/20 py-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  Your Network
                </CardTitle>
                <Button variant="ghost" size="sm" className="gap-2 rounded-full" onClick={() => setSearchOpen(true)}>
                  <Search className="h-4 w-4" />
                  Add connections
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <UserFollowList userId={user.id} showSearch={true} maxHeight="500px" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discover" className="space-y-4">
            <Card className="border-border/50 bg-background/80 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/20 py-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-5 w-5" />
                  Discover new connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Expand your network</h3>
                    <p className="text-sm text-muted-foreground">
                      Connect with other professionals, event attendees, and organizers to build your network.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <span className="rounded-full border border-dashed border-border/60 px-3 py-1">Smart suggestions</span>
                    <span className="rounded-full border border-dashed border-border/60 px-3 py-1">Shared events</span>
                    <span className="rounded-full border border-dashed border-border/60 px-3 py-1">Nearby members</span>
                  </div>
                  <Button onClick={() => setSearchOpen(true)} className="gap-2 rounded-full">
                    <Search className="h-4 w-4" />
                    Start searching
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card className="border-border/50 bg-background/80 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/20 py-4">
                <CardTitle className="text-base">How others see you</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <UserProfileSocial userId={user.id} showActions={true} maxHeight="600px" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <UserSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </div>
  );
}
