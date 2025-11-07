// src/components/OrganizationDashboard.tsx
import { ChangeEvent, useRef } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
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
  Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SocialLinkManager } from './SocialLinkManager';
import { SocialLinkDisplay } from './SocialLinkDisplay';
import { LocationAutocomplete } from './LocationAutocomplete';
import { OrgContactExportPanel } from './OrgContactExportPanel';
import { OrgContactImportPanel } from './OrgContactImportPanel';

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
  description?: string | null;
  website_url?: string | null;
  location?: string | null;
  banner_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  social_links?: Array<{
    platform: string;
    url: string;
    is_primary: boolean;
  }> | null;
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
  const [editingOrg, setEditingOrg] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    website_url: '',
    location: '',
    logo_url: '',
    banner_url: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
      setOrganization({
        ...org,
        social_links: Array.isArray(org.social_links) 
          ? org.social_links as Array<{platform: string; url: string; is_primary: boolean}>
          : [],
      } as Organization);

      if (membersError) throw membersError;

      // 2b) Hydrate member profiles in one query to user_profiles
      const memberRows = (members || []) as TeamMember[];
      const userIds = Array.from(new Set(memberRows.map((m) => m.user_id)));
      let profilesById: Record<string, { display_name: string; photo_url: string | null }> = {};

      if (userIds.length) {
        type UserProfileRecord = {
          user_id: string;
          display_name: string;
          photo_url: string | null;
        };

        const { data: profiles, error: profilesErr } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', userIds);

        if (!profilesErr && profiles) {
          profilesById = Object.fromEntries(
            (profiles as UserProfileRecord[]).map(p => [p.user_id, { display_name: p.display_name, photo_url: p.photo_url }])
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load organization.';
      toast({
        title: 'Error',
        description: message,
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
      const { data, error } = await supabase.functions.invoke('send-org-invite', {
        body: {
          org_id: organizationId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          expires_in_hours: 168 // 7 days
        }
      });

      if (error) throw error;

      toast({
        title: 'Invitation sent successfully',
        description: `Invitation sent to ${inviteEmail} with ${inviteRole} role.`,
      });
      setInviteEmail('');
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send invitation';
      toast({
        title: 'Invite failed',
        description: message,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove member';
      toast({
        title: 'Error',
        description: message,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      toast({
        title: 'Failed to update role',
        description: message,
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

  const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
    try {
      const setUploading = type === 'logo' ? setUploadingLogo : setUploadingBanner;
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${organizationId}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `org-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('org-logos')
        .getPublicUrl(filePath);

      setEditForm(prev => ({
        ...prev,
        [type === 'logo' ? 'logo_url' : 'banner_url']: publicUrl
      }));

      toast({ title: `${type === 'logo' ? 'Logo' : 'Banner'} uploaded successfully` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      const setUploading = type === 'logo' ? setUploadingLogo : setUploadingBanner;
      setUploading(false);
    }
  };

  const handleEditOrg = async () => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          description: editForm.description || null,
          website_url: editForm.website_url || null,
          location: editForm.location || null,
          logo_url: editForm.logo_url || null,
          banner_url: editForm.banner_url || null,
        })
        .eq('id', organizationId);

      if (error) throw error;

      setOrganization(prev => prev ? {
        ...prev,
        name: editForm.name,
        description: editForm.description || null,
        website_url: editForm.website_url || null,
        location: editForm.location || null,
        logo_url: editForm.logo_url || null,
        banner_url: editForm.banner_url || null,
      } : prev);

      toast({
        title: 'Organization updated',
        description: 'Organization details have been saved.',
      });
      setEditingOrg(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update organization';
      toast({
        title: 'Failed to update organization',
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Initialize edit form when opening
  useEffect(() => {
    if (editingOrg && organization) {
      setEditForm({
        name: organization.name,
        description: organization.description || '',
        website_url: organization.website_url || '',
        location: organization.location || '',
        logo_url: organization.logo_url || '',
        banner_url: organization.banner_url || '',
      });
    }
  }, [editingOrg, organization]);

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
    <div className="h-full bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="border-b bg-card p-3 sm:p-4 sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
            {organization.logo_url ? (
              <AvatarImage src={organization.logo_url} alt={organization.name} />
            ) : (
              <AvatarFallback>
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg truncate">{organization.name}</h1>
              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">@{organization.handle}</Badge>
              {organization.verification_status === 'verified' && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                  <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''} • Since{' '}
              {new Date(organization.created_at).getFullYear()}
            </p>
          </div>

          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={refresh} className="h-9 w-9 sm:w-auto p-0 sm:px-3">
              <RefreshCw className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={copyOrgLink} aria-label="Share organization" className="h-9 w-9 p-0">
              <Share className="w-4 h-4" />
            </Button>
            <Button onClick={onCreateEvent} size="sm" className="h-9 w-9 sm:w-auto p-0 sm:px-3">
              <Plus className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Create Event</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 pb-24 sm:pb-28">
        <Tabs defaultValue="overview">
          <div className="sticky top-0 bg-background z-20 pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-6">
                <TabsTrigger value="overview" className="whitespace-nowrap">Overview</TabsTrigger>
                <TabsTrigger value="team" className="whitespace-nowrap">Team ({teamMembers.length})</TabsTrigger>
                <TabsTrigger value="wallet" className="whitespace-nowrap">Wallet</TabsTrigger>
                <TabsTrigger value="verification" className="whitespace-nowrap text-xs sm:text-sm">Verification</TabsTrigger>
                <TabsTrigger value="contacts" className="whitespace-nowrap text-xs sm:text-sm">Contact Lists</TabsTrigger>
                <TabsTrigger value="settings" className="whitespace-nowrap">Settings</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-primary/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">{analytics.totalEvents.toLocaleString()}</div>
                  <p className="text-xs text-foreground/70 mt-1 font-medium">{analytics.completedEvents.toLocaleString()} completed</p>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">{fmtUSD(analytics.totalRevenue)}</div>
                  <p className="text-xs text-foreground/70 mt-1 font-medium">All-time earnings</p>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Attendees</CardTitle>
                  <Users className="h-4 w-4 text-blue-500/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">{analytics.totalAttendees.toLocaleString()}</div>
                  <p className="text-xs text-foreground/70 mt-1 font-medium">Across all events</p>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team Members</CardTitle>
                  <Building2 className="h-4 w-4 text-primary/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">{teamMembers.length.toLocaleString()}</div>
                  <p className="text-xs text-foreground/70 mt-1 font-medium">Active members</p>
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

          {/* WALLET */}
          <TabsContent value="wallet" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Organization Wallet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Coming Soon</strong> - Organization-level wallets are currently being developed. 
                    Each organization will have its own shared credit balance for ad campaigns, 
                    managed by org admins.
                  </AlertDescription>
                </Alert>
                
                <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-medium mb-2">What to Expect:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                    <li>Shared credit balance for the organization</li>
                    <li>Transaction history visible to all admins</li>
                    <li>Credit purchases managed by org admins and owners</li>
                    <li>Separate from personal user wallets</li>
                  </ul>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  For now, use your personal wallet at <a href="/wallet" className="text-primary hover:underline">/wallet</a> to manage ad credits.
                </p>
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

          {/* CONTACT LISTS */}
          <TabsContent value="contacts" className="space-y-6">
            <OrgContactImportPanel organizationId={organizationId} />
            <OrgContactExportPanel organizationId={organizationId} />
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
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Organization Name</label>
                    <div className="flex gap-2">
                      <Input value={organization.name} disabled className="flex-1" />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingOrg(true)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Handle</label>
                    <Input value={`@${organization.handle}`} disabled />
                  </div>
                </div>

                {organization.description && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <div className="p-3 bg-muted rounded-md text-sm border">
                      {organization.description}
                    </div>
                  </div>
                )}

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
              </CardContent>
            </Card>

            {/* Social Media Links Management */}
            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your organization's social media presence
                </p>
              </CardHeader>
              <CardContent>
                <SocialLinkManager 
                  socialLinks={organization.social_links || []}
                  onChange={async (newLinks) => {
                    try {
                      const { error } = await supabase
                        .from('organizations')
                        .update({ social_links: newLinks as any })
                        .eq('id', organizationId);
                        
                      if (error) throw error;
                      
                      setOrganization(prev => prev ? { 
                        ...prev, 
                        social_links: newLinks 
                      } : prev);
                      
                      toast({
                        title: 'Social links updated',
                        description: 'Your social media links have been saved.',
                      });
                    } catch (error) {
                      console.error('Failed to update social links:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to update social links. Please try again.',
                        variant: 'destructive',
                      });
                    }
                  }}
                  maxLinks={3}
                />
                
                {organization.social_links && organization.social_links.length > 0 && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Preview:</h4>
                    <SocialLinkDisplay 
                      socialLinks={organization.social_links}
                      showLabels={true}
                      size="md"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Organization Modal */}
      <Dialog open={editingOrg} onOpenChange={setEditingOrg}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-160px)] pr-2 pb-6">
            {/* Images Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Visual Identity</h3>
              
              {/* Logo */}
              <div className="space-y-2">
                <Label>Organization Logo</Label>
                <div className="flex items-center gap-4">
                  {editForm.logo_url && (
                    <img
                      src={editForm.logo_url}
                      alt="Logo preview"
                      className="w-20 h-20 rounded-lg object-cover border"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'logo');
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? 'Uploading...' : editForm.logo_url ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: Square image, at least 400x400px
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <Label>Banner Image</Label>
                <div className="space-y-2">
                  {editForm.banner_url && (
                    <img
                      src={editForm.banner_url}
                      alt="Banner preview"
                      className="w-full h-32 rounded-lg object-cover border"
                    />
                  )}
                  <div>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'banner');
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploadingBanner}
                    >
                      {uploadingBanner ? 'Uploading...' : editForm.banner_url ? 'Change Banner' : 'Upload Banner'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: 1200x400px or larger
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name *</Label>
                <Input
                  id="org-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter organization name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-description">About / Description</Label>
                <Textarea
                  id="org-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell people about your organization..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This will be displayed on your organization profile and event pages
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-location">Location</Label>
                <LocationAutocomplete
                  value={editForm.location}
                  onChange={(location) => setEditForm(prev => ({ ...prev, location }))}
                />
                <p className="text-xs text-muted-foreground">
                  Start typing to search for a location
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-website">Website URL</Label>
                <Input
                  id="org-website"
                  value={editForm.website_url}
                  onChange={(e) => setEditForm(prev => ({ ...prev, website_url: e.target.value }))}
                  placeholder="https://example.com"
                  type="url"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditOrg} disabled={!editForm.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OrganizationDashboard;