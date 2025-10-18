import { useState } from 'react';
import { Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SocialPage() {
  const [activeTab, setActiveTab] = useState<'network' | 'messages'>('network');

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Social</h1>
            <p className="text-sm text-muted-foreground">Stay connected with your network and conversations.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'network' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('network')}
              className="gap-2 rounded-full"
            >
              <Users className="h-4 w-4" />
              Network
            </Button>
            <Button
              variant={activeTab === 'messages' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('messages')}
              className="gap-2 rounded-full"
            >
              <MessageCircle className="h-4 w-4" />
              Messages
            </Button>
          </div>
        </div>
      </div>

      <div className="scroll-container p-4">
        {activeTab === 'network' ? <NetworkTab /> : <MessagesTab />}
      </div>
    </div>
  );
}

function NetworkTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Your Network</h2>
      <p className="text-sm text-muted-foreground">
        Track the people and organizations you follow. New activity will appear here soon.
      </p>
      <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Network insights coming soon.</p>
      </div>
    </div>
  );
}

function MessagesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Messages</h2>
      <p className="text-sm text-muted-foreground">
        Conversations with your connections will live here. Stay tuned for inbox upgrades.
      </p>
      <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Messaging features are being refreshed.</p>
      </div>
    </div>
  );
}

export default SocialPage;
