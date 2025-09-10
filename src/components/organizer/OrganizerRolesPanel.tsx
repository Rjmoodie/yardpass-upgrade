import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRoleInvites } from '@/hooks/useRoleInvites';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ROLES, ROLE_MATRIX, RoleType, RoleInvite, EventRole } from '@/types/roles';
import { Badge } from '@/components/ui/badge';
import { Copy, Trash2, Users, UserPlus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OrganizerRolesPanelProps {
  eventId: string;
}

export function OrganizerRolesPanel({ eventId }: OrganizerRolesPanelProps) {
  const { sendInvite, revokeInvite, subscribeToUpdates, loading } = useRoleInvites();
  const [role, setRole] = useState<RoleType>('scanner');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [invites, setInvites] = useState<RoleInvite[]>([]);
  const [members, setMembers] = useState<(EventRole & { user_profile?: { display_name?: string } })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      // Get invites
      const { data: inviteData, error: inviteError } = await supabase
        .from('role_invites')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (inviteError) {
        console.error('Error fetching invites:', inviteError);
      } else {
        setInvites(inviteData || []);
      }

      // Get current members - fix relationship issue by fetching separately
      const { data: memberData, error: memberError } = await supabase
        .from('event_roles')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'active');

      if (memberData && !memberError) {
        // Get user profiles separately
        const userIds = memberData.map(m => m.user_id);
        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .in('user_id', userIds);
          
          // Combine the data
          const membersWithProfiles = memberData.map(member => ({
            ...member,
            user_profiles: profileData?.find(p => p.user_id === member.user_id)
          }));
          setMembers(membersWithProfiles);
        } else {
          setMembers(memberData);
        }
      }

      if (memberError) {
        console.error('Error fetching members:', memberError);
      } else {
        setMembers(memberData || []);
      }
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    
    // Subscribe to realtime updates
    const unsubscribe = subscribeToUpdates(eventId, refresh);
    return () => {
      unsubscribe();
    };
  }, [eventId, subscribeToUpdates]);

  async function onInvite() {
    if (!email && !phone) {
      toast({ title: 'Enter email or phone', variant: 'destructive' });
      return;
    }

    try {
      await sendInvite({ 
        eventId, 
        role, 
        email: email || undefined, 
        phone: phone || undefined 
      });
      
      toast({ title: 'Invite sent successfully' });
      setEmail('');
      setPhone('');
      refresh();
    } catch (error: any) {
      toast({ 
        title: 'Failed to send invite', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  }

  async function onRevokeInvite(inviteId: string) {
    try {
      await revokeInvite(inviteId);
      toast({ title: 'Invite revoked' });
      refresh();
    } catch (error: any) {
      toast({ 
        title: 'Failed to revoke invite', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  }

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/roles/accept?token=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: 'Invite link copied to clipboard' });
    });
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'accepted': return 'default';
      case 'expired': return 'destructive';
      case 'revoked': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="role-select">Role</Label>
              <Select value={role} onValueChange={(v: RoleType) => setRole(v)}>
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>
                      <div>
                        <div className="font-medium">{ROLE_MATRIX[r].label}</div>
                        <div className="text-xs text-muted-foreground">{ROLE_MATRIX[r].description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="email-input">Email (optional)</Label>
              <Input 
                id="email-input"
                placeholder="team@example.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                type="email"
              />
            </div>
            <div>
              <Label htmlFor="phone-input">Phone (optional)</Label>
              <Input 
                id="phone-input"
                placeholder="+1234567890" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                type="tel"
              />
            </div>
          </div>
          <Button onClick={onInvite} disabled={loading} className="w-full md:w-auto">
            {loading ? 'Sending...' : 'Send Invite'}
          </Button>
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {refreshing ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No team members yet.</p>
              <p className="text-sm">Send invites to build your team.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {(member as any).user_profiles?.display_name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Added {new Date(member.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {ROLE_MATRIX[member.role].label}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invites ({invites.filter(i => i.status === 'pending').length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No invites sent yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {invite.email || invite.phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {ROLE_MATRIX[invite.role].label}
                        </Badge>
                        <Separator orientation="vertical" className="h-3" />
                        <span>Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(invite.status)}>
                      {invite.status}
                    </Badge>
                    {invite.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invite.token)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRevokeInvite(invite.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}