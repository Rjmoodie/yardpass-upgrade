// src/components/OrganizationDashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import {
  ArrowLeft,
  Building2,
  Users,
  DollarSign,
  Calendar,
  Shield,
  Settings,
  Plus,
  MoreVertical,
  Mail,
  Trash2,
  Share,
  RefreshCw,
  Download,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface OrganizationDashboardProps {
  user: User;
  organizationId: string;
  onBack: () => void;
  onCreateEvent: () => void;
}

interface Organization {
  id: string;
  name: string;
  handle: string;
  logo_url: string | null;
  verification_status: string;
  created_at: string;
}

type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface TeamMember {
  user_id: string;
  role: OrgRole;
  created_at: string;
  user_profiles?: {
    user_id?: string;
    display_name: string;
    photo_url: string | null;
  } | null;
}

type OrgAnalytics = {
  total_events: number;
  total_revenue: number;
  total_attendees: number;
  completed_events: number;
};

const fmtUSD = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export function OrganizationDashboard({
  user,
  organizationId,
  onBack,
  onCreateEvent,
}: OrganizationDashboardProps) {
  const { toast } = useToast();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [analytics, setAnalytics] = useState({
    totalEvents: 0,
    totalRevenue: 0,
    totalAttendees: 0,
    completedEvents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<OrgRole, 'owner'>>('viewer');

  // Light refresh to re-pull members + analytics
  const refresh = async () => {
    await fetchOrganizationData();
  };

  useEffect(() => {
    fetchOrganizationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const orgPublicUrl = useMemo(() => {
    if (!organization) return '';
    // Prefer handle if present
    return `${window.location.origin}/org/${organization.handle || organization.id}`;
  }, [organization]);

  const fetchOrganizationData = async () => {
    setLoading(true);
    try {
      // 1) Organization
      const orgPromise = supabase.from('organizations').select('*').eq('id', organizationId).single();

      // 2) Members (basic)
      const membersPromise = supabase
        .from('org_memberships')
        .select('user_id, role, created_at')
        .eq('org_id', organizationId);

      // 3) Analytics
      const analyticsPromise = supabase.rpc('get_org_analytics', { p_org_id: organizationId });

      const [{ data: org, error: orgError }, { data: members, error: membersError }, { data: analyticsData, error: analyticsError }] =
        await Promise.all([orgPromise, membersPromise, analyticsPromise]);

      if (orgError) throw orgError;
      setOrganization(org as Organization);

      if (membersError) throw membersError;

      // 2b) Hydrate member profiles in one query to user_profiles
      const memberRows = (members || []) as TeamMember[];
      const userIds = Array.from(new Set(memberRows.map((m) => m.user_id)));
      let profilesById: Record<string, { display_name: string; photo_url: string | null }> = {};

      if (userIds.length) {
        const { data: profiles, error: profilesErr } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', userIds);

        if (!profilesErr && profiles) {
          profilesById = Object.fromEntries(
            profiles.map((p: any) => [p.user_id, { display_name: p.display_name, photo_url: p.photo_url }])
          );
        }
      }

      const membersWithProfiles: TeamMember[] = memberRows.map((m) => ({
        ...m,
        user_profiles: {
          user_id: m.user_id,
          display_name: profilesById[m.user_id]?.display_name || 'Member',
          photo_url: profilesById[m.user_id]?.photo_url || null,
        },
      }));

      // Owner first, then admin -> editor -> viewer, then by name
      membersWithProfiles.sort((a, b) => {
        const rank: Record<OrgRole, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };
        const r = rank[a.role] - rank[b.role];
        if (r !== 0) return r;
        const an = (a.user_profiles?.display_name || '').toLowerCase();
        const bn = (b.user_profiles?.display_name || '').toLowerCase();
        return an.localeCompare(bn);
      });

      setTeamMembers(membersWithProfiles);

      if (analyticsError) {
        // Non-fatal: just fallback to zeros
        console.warn('get_org_analytics error', analyticsError);
      }
      const row: OrgAnalytics | undefined = (analyticsData && analyticsData[0]) || undefined;
      setAnalytics({
        totalEvents: row?.total_events || 0,
        totalRevenue: row?.total_revenue || 0,
        totalAttendees: row?.total_attendees || 0,
        completedEvents: row?.completed_events || 0,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load organization.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      // Try a real invite table if it exists; otherwise fallback to toast-only UX
      const payload = {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        org_id: organizationId,
      };

      let inserted = false;
      try {
        const { error } = await supabase.from('org_invitations').insert(payload);
        if (error) throw error;
        inserted = true;
      } catch {
        // If org_invitations table isn't available, we just proceed with the UX toast
      }

      // Optional: native share
      const maybeUrl = orgPublicUrl || window.location.origin;
      const shareText = `You’re invited to join ${organization?.name} on YardPass as ${inviteRole}.`;
      if ((navigator as any).share) {
        try {
          await (navigator as any).share({ title: organization?.name, text: shareText, url: maybeUrl });
        } catch {
          /* ignored */
        }
      }

      toast({
        title: inserted ? 'Invitation created' : 'Invitation sent',
        description: `${inviteEmail} • role: ${inviteRole}`,
      });
      setInviteEmail('');
      await refresh();
    } catch (error: any) {
      toast({
        title: 'Invite failed',
        description: error.message || 'Could not send invitation',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, role: OrgRole) => {
    if (role === 'owner') {
      toast({
        title: 'Not allowed',
        description: 'You cannot remove the owner.',
        variant: 'destructive',
      });
      return;
    }
    const ok = confirm('Remove this team member from the organization?');
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('org_memberships')
        .delete()
        .eq('user_id', userId)
        .eq('org_id', organizationId);

      if (error) throw error;

      setTeamMembers((members) => members.filter((m) => m.user_id !== userId));
      toast({ title: 'Member removed' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleChangeRole = async (userId: string, nextRole: OrgRole) => {
    try {
      const { error } = await supabase
        .from('org_memberships')
        .update({ role: nextRole })
        .eq('user_id', userId)
        .eq('org_id', organizationId);

      if (error) throw error;

      setTeamMembers((members) =>
        members.map((m) => (m.user_id === userId ? { ...m, role: nextRole } : m))
      );
      toast({ title: 'Role updated', description: `New role: ${nextRole}` });
    } catch (error: any) {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const copyOrgLink = async () => {
    try {
      if ((navigator as any).share) {
        try {
          await (navigator as any).share({
            title: organization?.name,
            text: `Follow ${organization?.name} on YardPass`,
            url: orgPublicUrl,
          });
          return;
        } catch {
          /* ignore and fallback to clipboard */
        }
      }
      await navigator.clipboard.writeText(orgPublicUrl);
      toast({ title: 'Link copied', description: 'Organization link copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const exportTeamCsv = () => {
    const rows = [
      ['User ID', 'Name', 'Role', 'Joined', 'Photo URL'],
      ...teamMembers.map((m) => [
        m.user_id,
        m.user_profiles?.display_name || 'Member',
        m.role,
        new Date(m.created_at).toISOString(),
        m.user_profiles?.photo_url || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${organization?.handle || 'organization'}-team.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto animate-pulse" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading organization…</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-4">Organization not found.</p>
            <Button onClick={onBack}>Go back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4 sticky top-0 z-30">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar className="w-12 h-12">
            {organization.logo_url ? (
              <AvatarImage src={organization.logo_url} alt={organization.name} />
            ) : (
              <AvatarFallback>
                <Building2 className="w-5 h-5" />
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="truncate">{organization.name}</h1>
              <Badge variant="outline" className="text-xs">@{organization.handle}</Badge>
              {organization.verification_status === 'verified' && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''} • Since{' '}
              {new Date(organization.created_at).getFullYear()}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={copyOrgLink} aria-label="Share organization">
              <Share className="w-4 h-4" />
            </Button>
            <Button onClick={onCreateEvent}>
              <Plus className="w-4 h-4 mr-1" />
              Create Event
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="overview">
          <div className="sticky top-0 bg-background z-20 pb-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="team">Team ({teamMembers.length})</TabsTrigger>
              <TabsTrigger value="verification">Verification</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{analytics.totalEvents}</div>
                  <p className="text-xs text-muted-foreground">{analytics.completedEvents} completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{fmtUSD(analytics.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">All-time earnings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Attendees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{analytics.totalAttendees.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Across all events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Team Members</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{teamMembers.length}</div>
                  <p className="text-xs text-muted-foreground">Active members</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TEAM */}
          <TabsContent value="team" className="space-y-6">
            {/* Invite Member */}
            <Card>
              <CardHeader>
                <CardTitle>Invite Team Member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(value: OrgRole) => setInviteRole(value as Exclude<OrgRole, 'owner'>)}>
                    <SelectTrigger className="md:w-40">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteMember} disabled={!inviteEmail.trim() || inviting}>
                    <Mail className="w-4 h-4 mr-1" />
                    {inviting ? 'Sending…' : 'Invite'}
                  </Button>
                  <Button variant="outline" onClick={exportTeamCsv}>
                    <Download className="w-4 h-4 mr-1" />
                    Export CSV
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Viewer:</strong> Can view events and analytics
                  </p>
                  <p>
                    <strong>Editor:</strong> Can create and manage events
                  </p>
                  <p>
                    <strong>Admin:</strong> Can manage team members and settings
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Team Members List */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <div className="text-sm text-muted-foreground">{teamMembers.length} total</div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamMembers.map((member) => {
                    const name = member.user_profiles?.display_name || 'Member';
                    const isOwner = member.role === 'owner';
                    const isMe = member.user_id === user.id;
                    return (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            {member.user_profiles?.photo_url ? (
                              <AvatarImage
                                src={member.user_profiles.photo_url}
                                alt={name}
                              />
                            ) : (
                              <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{name}</span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {member.role}
                              </Badge>
                              {isMe && <Badge className="text-xs">You</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Joined {new Date(member.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Role change (owner immutable) */}
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleChangeRole(member.user_id, v as OrgRole)}
                            disabled={isOwner}
                          >
                            <SelectTrigger className="w-28 capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner" disabled>
                                owner
                              </SelectItem>
                              <SelectItem value="admin">admin</SelectItem>
                              <SelectItem value="editor">editor</SelectItem>
                              <SelectItem value="viewer">viewer</SelectItem>
                            </SelectContent>
                          </Select>

                          {!isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(member.user_id, member.role)}
                              aria-label="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {teamMembers.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-60" />
                      <p>No team members yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VERIFICATION */}
          <TabsContent value="verification" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Business Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      organization.verification_status === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    aria-hidden
                  />
                  <span className="text-sm">
                    Status:{' '}
                    <Badge variant="outline" className="capitalize">
                      {organization.verification_status}
                    </Badge>
                  </span>
                </div>

                {organization.verification_status !== 'verified' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Complete verification to enable payouts and unlock advanced features.
                    </p>
                    <Button>Start Verification</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-green-600">✓ This organization is verified and can process payments.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Organization Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm">Organization Name</label>
                    <Input value={organization.name} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm">Handle</label>
                    <Input value={`@${organization.handle}`} disabled />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyOrgLink}>
                    <Share className="w-4 h-4 mr-1" />
                    Copy Public Link
                  </Button>
                  <Button variant="outline" onClick={refresh}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Reload
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Editing org profile (name/handle/logo) can be added here when ready.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OrganizationDashboard;