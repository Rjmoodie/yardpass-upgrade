// src/components/access/AccessGate.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { useEventAccess } from '@/hooks/useEventAccess';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type Props = {
  eventId: string;
  visibility: 'public' | 'unlisted' | 'private';
  linkTokenFromUrl?: string | null;
  onTokenAccepted?: (token: string) => void;
  children: React.ReactNode;
};

export function AccessGate({ eventId, visibility, linkTokenFromUrl, onTokenAccepted, children }: Props) {
  const [token, setToken] = useState(linkTokenFromUrl ?? '');
  const access = useEventAccess({ eventId, visibility, linkTokenFromUrl });
  const navigate = useNavigate();

  // If user pasted a correct token via URL, show content immediately
  const showContent = access.status === 'allowed';

  useEffect(() => {
    if (linkTokenFromUrl && access.status === 'allowed') onTokenAccepted?.(linkTokenFromUrl);
  }, [linkTokenFromUrl, access.status, onTokenAccepted]);

  if (access.status === 'loading') {
    return (
      <div className="min-h-[40vh] grid place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (showContent) return <>{children}</>;

  if (access.status === 'needs-login') {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="p-6 space-y-3 text-center">
          <h3 className="text-lg font-semibold">Sign in to continue</h3>
          <p className="text-sm text-muted-foreground">
            This event requires a signed-in account.
          </p>
          <Button
            onClick={() => navigate('/auth')}
            className="w-full"
          >
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (access.status === 'unlisted-key-required') {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Enter access key</h3>
            <p className="text-sm text-muted-foreground">
              This unlisted event requires the private link key (<code>k</code>).
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Paste key from link…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!token) return;
                // add ?k=token (soft navigation, no reload)
                const url = new URL(window.location.href);
                url.searchParams.set('k', token);
                window.history.replaceState({}, '', url.toString());
                onTokenAccepted?.(token);
                // Force re-render by updating the URL
                window.location.reload();
              }}
            >
              Unlock
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: organizers can share a link that already includes the key.
          </p>
        </CardContent>
      </Card>
    );
  }

  // private, denied
  return (
    <Card className="max-w-md mx-auto mt-10">
      <CardContent className="p-6 space-y-3 text-center">
        <h3 className="text-lg font-semibold">Request access</h3>
        <p className="text-sm text-muted-foreground">
          This event is private. Only organizers, invitees, or ticket-holders can view.
        </p>
        <Button
          onClick={() => {
            // Copy event URL to clipboard for sharing
            navigator.clipboard.writeText(window.location.href).then(() => {
              // You can add a toast notification here if needed
            });
          }}
          className="w-full"
          variant="outline"
        >
          Copy event link
        </Button>
      </CardContent>
    </Card>
  );
}