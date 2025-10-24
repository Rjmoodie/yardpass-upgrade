import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Building2 } from 'lucide-react';
import { YardpassSpinner } from '@/components/LoadingSpinner';

export default function OrgInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError('No invitation token provided');
      setLoading(false);
      return;
    }

    // Fetch invite details
    const fetchInviteDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('org_invitations')
          .select(`
            *,
            organizations (
              id,
              name,
              description
            )
          `)
          .eq('token', token)
          .single();

        if (error) {
          console.error('Error fetching invite:', error);
          setStatus('invalid');
          setError('Invitation not found or expired');
          return;
        }

        if (data.status !== 'pending') {
          setStatus('invalid');
          setError(`Invitation has been ${data.status}`);
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setStatus('invalid');
          setError('Invitation has expired');
          return;
        }

        setInviteData(data);
        setStatus('valid');
      } catch (err) {
        console.error('Error:', err);
        setStatus('error');
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInviteDetails();
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!token) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('accept_org_invitation', {
        p_token: token
      });

      if (error) {
        throw error;
      }

      setStatus('accepted');
      toast({
        title: 'Welcome to the team!',
        description: `You've successfully joined ${inviteData?.organizations?.name} as a ${inviteData?.role}.`,
      });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Failed to accept invitation',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-transparent to-accent/10">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <YardpassSpinner className="mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-transparent to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            {status === 'accepted' ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : status === 'invalid' ? (
              <XCircle className="h-8 w-8 text-red-600" />
            ) : (
              <Building2 className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle>
            {status === 'accepted' ? 'Welcome to the team!' : 
             status === 'invalid' ? 'Invalid Invitation' : 
             'Organization Invitation'}
          </CardTitle>
          <CardDescription>
            {status === 'accepted' ? 'You have successfully joined the organization.' :
             status === 'invalid' ? error :
             'You have been invited to join an organization on YardPass.'}
          </CardDescription>
        </CardHeader>
        
        {status === 'valid' && inviteData && (
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{inviteData.organizations?.name}</h3>
              {inviteData.organizations?.description && (
                <p className="text-muted-foreground text-sm">{inviteData.organizations.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Role:</span>
                <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {inviteData.role}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleAcceptInvitation} 
                disabled={processing}
                className="w-full"
              >
                {processing ? (
                  <>
                    <YardpassSpinner
                      size="xs"
                      showGlow={false}
                      showLogo={false}
                      className="mr-2"
                    />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="w-full"
              >
                Decline
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              By accepting this invitation, you agree to join {inviteData.organizations?.name} 
              with {inviteData.role} permissions.
            </p>
          </CardContent>
        )}

        {status === 'accepted' && (
          <CardContent className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Redirecting you to your dashboard...
            </p>
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              Go to Dashboard
            </Button>
          </CardContent>
        )}

        {status === 'invalid' && (
          <CardContent className="text-center py-6">
            <Button onClick={() => navigate('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
