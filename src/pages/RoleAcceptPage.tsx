import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRoleInvites } from '@/hooks/useRoleInvites';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, UserPlus } from 'lucide-react';
import { ROLE_MATRIX } from '@/types/roles';

export default function RoleAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptInvite } = useRoleInvites();
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      return;
    }

    // Load invite details
    async function loadInvite() {
      try {
        const { data, error } = await supabase
          .from('role_invites')
          .select(`
            *,
            events(title, start_at)
          `)
          .eq('token', token)
          .single();

        if (error || !data) {
          setError('Invite not found');
          return;
        }

        if (data.status !== 'pending') {
          setError('This invite has already been processed');
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError('This invite has expired');
          return;
        }

        setInvite(data);
      } catch (err) {
        console.error('Error loading invite:', err);
        setError('Failed to load invite');
      }
    }

    loadInvite();
  }, [token]);

  async function handleAccept() {
    if (!token) return;

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    setLoading(true);
    try {
      await acceptInvite(token);
      setAccepted(true);
      toast({ 
        title: 'Invite accepted!', 
        description: `You are now a ${invite.role} for this event.` 
      });
      
      // Redirect after a delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      toast({ 
        title: 'Failed to accept invite', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Invalid Invite</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Invite Accepted!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              You are now a {ROLE_MATRIX[invite.role].label} for {invite.events?.title}.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <UserPlus className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle>You're Invited!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <h3 className="font-semibold text-lg">{invite.events?.title}</h3>
            <p className="text-muted-foreground">
              {invite.events?.start_at && new Date(invite.events.start_at).toLocaleDateString()}
            </p>
          </div>
          
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-sm text-muted-foreground">You're being invited as:</div>
            <div className="font-semibold text-lg">{ROLE_MATRIX[invite.role].label}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {ROLE_MATRIX[invite.role].description}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
          </div>

          <Button 
            onClick={handleAccept} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Accepting...' : 'Accept Invitation'}
          </Button>
          
          <Button 
            onClick={() => navigate('/')} 
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}