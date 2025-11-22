import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Trash2, RefreshCw, Mail, Search, Clock, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profile?: {
    display_name?: string | null;
    phone?: string | null;
  };
}

interface PendingInvite {
  invite_id: string;
  org_id: string;
  organization_name: string;
  invitee_email: string;
  invited_role: string;
  invite_status: string;
  email_status: string;
  email_sent_at: string | null;
  invite_created_at: string;
  invite_expires_at: string;
  is_expired: boolean;
  inviter_name: string | null;
  inviter_email: string | null;
  email_provider_id: string | null;
  email_error_message: string | null;
  display_status: string;
}

interface OrganizationTeamPanelProps {
  organizationId: string;
}

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full access to organization and billing',
  admin: 'Manage members, events, and settings',
  editor: 'Create and manage events',
  viewer: 'View organization content',
};

export function OrganizationTeamPanel({ organizationId }: OrganizationTeamPanelProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<OrgRole>('viewer');
  const [query, setQuery] = useState('');
  const mountedRef = useRef(true);

  const fetchMembers = async () => {
    if (!organizationId) return;
    setRefreshing(true);
    try {
      // 1) members
      const { data: rawMembers, error: membersErr } = await supabase
        .from('org_memberships')
        .select('org_id, user_id, role, created_at')
        .eq('org_id', organizationId);
      if (membersErr) throw membersErr;

      // 2) profiles (join separately for reliability)
      const userIds = (rawMembers ?? []).map(m => m.user_id).filter(Boolean);
      let profiles: Record<string, { display_name?: string | null; phone?: string | null }> = {};
      if (userIds.length) {
        const { data: profileRows, error: profErr } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, phone')
          .in('user_id', userIds);
        if (!profErr && profileRows) {
          profiles = profileRows.reduce((acc, p) => {
            acc[p.user_id] = { display_name: p.display_name, phone: p.phone };
            return acc;
          }, {} as Record<string, { display_name?: string | null; phone?: string | null }>);
        }
      }

      const mapped: OrgMember[] = (rawMembers ?? []).map((m) => ({
        id: `${m.org_id}-${m.user_id}`, // synthetic id since org_memberships uses composite key
        org_id: m.org_id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        profile: profiles[m.user_id] ?? { display_name: null, phone: null },
      }));
      if (mountedRef.current) setMembers(mapped);

      // 3) Fetch pending invites
      await fetchPendingInvites();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Failed to load team',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  };

  const fetchPendingInvites = async () => {
    if (!organizationId) return;
    try {
      const { data: invites, error } = await supabase
        .from('org_invite_status_log')
        .select('*')
        .eq('org_id', organizationId)
        .in('invite_status', ['pending'])
        .order('invite_created_at', { ascending: false });
      
      if (error) throw error;
      if (mountedRef.current && invites) {
        setPendingInvites(invites);
      }
    } catch (error: any) {
      console.error('Failed to fetch pending invites:', error);
      // Don't show error toast for invites - it's supplementary info
    }
  };

  // --- Lifecycle & realtime -------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    fetchMembers();

    // Realtime on members for this org
    const membCh = supabase
      .channel(`org-members-${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_memberships', filter: `org_id=eq.${organizationId}` }, () => fetchMembers())
      .subscribe();

    // Realtime on invitations
    const inviteCh = supabase
      .channel(`org-invites-${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'organizations', table: 'org_invitations', filter: `org_id=eq.${organizationId}` }, () => fetchPendingInvites())
      .subscribe();

    return () => {
      mountedRef.current = false;
      try { 
        supabase.removeChannel(membCh);
        supabase.removeChannel(inviteCh);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // --- Actions --------------------------------------------------------------

  const inviteMember = async () => {
    if (!newMemberEmail.trim()) {
      toast({ title: 'Please enter an email address', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-org-invite', {
        body: {
          org_id: organizationId,
          email: newMemberEmail.trim(),
          role: newMemberRole,
          expires_in_hours: 168 // 7 days
        }
      });

      if (error) throw error;

      const result = data as { email_sent?: boolean; email_error?: string };
      
      toast({ 
        title: result.email_sent ? 'Invitation sent successfully' : 'Invitation created', 
        description: result.email_sent 
          ? `Invitation sent to ${newMemberEmail} with ${newMemberRole} role.`
          : `Invitation created for ${newMemberEmail}, but email ${result.email_error ? 'failed: ' + result.email_error : 'was not sent'}.`,
        variant: result.email_sent ? 'default' : 'destructive'
      });
      setNewMemberEmail('');
      setNewMemberRole('viewer');
      
      // Refresh invites list
      await fetchPendingInvites();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error sending invitation',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (rowId: string, role: OrgRole) => {
    // Guard: do not allow removing owner here (keep an owner)
    if (role === 'owner') {
      toast({ title: 'Cannot remove owner', variant: 'destructive' });
      return;
    }
    
    const member = members.find(m => m.id === rowId);
    if (!member) return;

    // optimistic
    const snapshot = members;
    setMembers(prev => prev.filter(m => m.id !== rowId));
    try {
      const { error } = await supabase
        .from('org_memberships')
        .delete()
        .eq('org_id', member.org_id)
        .eq('user_id', member.user_id);
      if (error) throw error;
      toast({ title: 'Member removed' });
    } catch (error: any) {
      setMembers(snapshot);
      toast({ title: 'Error removing member', description: error.message, variant: 'destructive' });
    }
  };

  const changeRole = async (rowId: string, newRole: OrgRole) => {
    const member = members.find(m => m.id === rowId);
    if (!member) return;

    // optimistic
    const snapshot = members;
    setMembers(prev => prev.map(m => (m.id === rowId ? { ...m, role: newRole } : m)));
    try {
      const { error } = await supabase
        .from('org_memberships')
        .update({ role: newRole })
        .eq('org_id', member.org_id)
        .eq('user_id', member.user_id);
      if (error) throw error;
      toast({ title: 'Role updated' });
    } catch (error: any) {
      setMembers(snapshot);
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    }
  };

  // --- Derived UI -----------------------------------------------------------

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => {
      const name = m.profile?.display_name?.toLowerCase() || '';
      const phone = m.profile?.phone?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || m.role.includes(q);
    });
  }, [members, query]);

  // --- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Add Member */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Organization Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
            <div>
              <Label htmlFor="email-input">Email Address</Label>
              <Input
                id="email-input"
                type="email"
                placeholder="user@example.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role-select">Role</Label>
              <Select value={newMemberRole} onValueChange={(v: OrgRole) => setNewMemberRole(v)}>
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {ROLE_DESCRIPTIONS[role as OrgRole]}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={inviteMember} disabled={loading}>
              {loading ? 'Creating…' : 'Create Invite'}
            </Button>
            <Button variant="outline" onClick={fetchMembers} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invites ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvites.map((invite) => {
                const isExpired = invite.is_expired;
                const emailSent = invite.email_status === 'sent';
                const emailFailed = invite.email_status === 'failed' || invite.email_status === 'error';
                
                return (
                  <div key={invite.invite_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{invite.invitee_email}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{invite.invited_role}</span>
                          <span>•</span>
                          <span>Invited {new Date(invite.invite_created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</span>
                          {invite.inviter_name && (
                            <>
                              <span>•</span>
                              <span>by {invite.inviter_name}</span>
                            </>
                          )}
                        </div>
                        {invite.email_error_message && (
                          <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {invite.email_error_message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired ? (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Expired
                        </Badge>
                      ) : emailFailed ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Email Failed
                        </Badge>
                      ) : emailSent ? (
                        <Badge variant="default" className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Info className="h-3 w-3" />
                          {invite.display_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({members.length})
            </span>
            <div className="relative w-[240px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, role…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {refreshing ? (
            <div className="text-center py-4 text-muted-foreground">Loading…</div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No matching members.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {m.profile?.display_name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {m.user_id.split('-')[0]}...@email.com
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Added {new Date(m.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric', 
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(nr: OrgRole) => changeRole(m.id, nr)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                          <SelectItem key={role} value={role}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {m.role !== 'owner' && (
                      <Button variant="outline" size="sm" onClick={() => removeMember(m.id, m.role)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
