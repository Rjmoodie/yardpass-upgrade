import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
  Share
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

interface TeamMember {
  user_id: string;
  role: string;
  created_at: string;
  user_profiles: {
    display_name: string;
    photo_url: string | null;
  } | null;
}

export function OrganizationDashboard({ user, organizationId, onBack, onCreateEvent }: OrganizationDashboardProps) {
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [analytics, setAnalytics] = useState({
    totalEvents: 0,
    totalRevenue: 0,
    totalAttendees: 0,
    completedEvents: 0
  });
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');

  useEffect(() => {
    fetchOrganizationData();
  }, [organizationId]);

  const fetchOrganizationData = async () => {
    try {
      // Fetch organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);

      // Fetch team members - simplified for now
      const { data: members, error: membersError } = await supabase
        .from('org_memberships')
        .select('user_id, role, created_at')
        .eq('org_id', organizationId);

      if (membersError) throw membersError;
      
      // Create simplified team members with mock profile data
      const teamMembersWithProfiles = (members || []).map(member => ({
        ...member,
        user_profiles: {
          display_name: 'Team Member',
          photo_url: null
        }
      }));
      setTeamMembers(teamMembersWithProfiles);

      // Fetch analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .rpc('get_org_analytics', { p_org_id: organizationId });

      if (analyticsError) throw analyticsError;
      if (analyticsData && analyticsData.length > 0) {
        const data = analyticsData[0];
        setAnalytics({
          totalEvents: data.total_events,
          totalRevenue: data.total_revenue,
          totalAttendees: data.total_attendees,
          completedEvents: data.completed_events
        });
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;

    try {
      // In a real implementation, this would send an email invitation
      // For now, we'll just show a success message
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail} as ${inviteRole}`,
      });
      setInviteEmail('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('org_memberships')
        .delete()
        .eq('user_id', userId)
        .eq('org_id', organizationId);

      if (error) throw error;

      setTeamMembers(members => members.filter(m => m.user_id !== userId));
      toast({
        title: "Member Removed",
        description: "Team member has been removed from the organization",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Organization not found</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar className="w-12 h-12">
            <AvatarFallback>
              {organization.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1>{organization.name}</h1>
              <Badge variant="outline" className="text-xs">
                @{organization.handle}
              </Badge>
              {organization.verification_status === 'verified' && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                import('@/lib/share').then(({ sharePayload }) => {
                  import('@/lib/shareLinks').then(({ buildShareUrl, getShareTitle, getShareText }) => {
                    sharePayload({
                      title: getShareTitle({ type: 'org', slug: organization.handle, name: organization.name }),
                      text: getShareText({ type: 'org', slug: organization.handle, name: organization.name }),
                      url: buildShareUrl({ type: 'org', slug: organization.handle, name: organization.name })
                    });
                  });
                });
              }}
            >
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team ({teamMembers.length})</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{analytics.totalEvents}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.completedEvents} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">${analytics.totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    All time earnings
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Attendees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{analytics.totalAttendees}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all events
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Team Members</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{teamMembers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active members
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            {/* Invite Member */}
            <Card>
              <CardHeader>
                <CardTitle>Invite Team Member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteMember} disabled={!inviteEmail.trim()}>
                    <Mail className="w-4 h-4 mr-1" />
                    Invite
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Viewer:</strong> Can view events and analytics</p>
                  <p><strong>Editor:</strong> Can create and manage events</p>
                  <p><strong>Admin:</strong> Can manage team members and settings</p>
                </div>
              </CardContent>
            </Card>

            {/* Team Members List */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamMembers.map((member, index) => (
                    <div key={`${member.user_id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>
                            {member.user_profiles?.display_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{member.user_profiles?.display_name || 'Unknown'}</span>
                            <Badge variant="outline" className="text-xs">
                              {member.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                  <div className={`w-3 h-3 rounded-full ${
                    organization.verification_status === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="text-sm">
                    Status: <Badge variant="outline">{organization.verification_status}</Badge>
                  </span>
                </div>
                
                {organization.verification_status !== 'verified' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Complete business verification to enable payment processing and unlock advanced features.
                    </p>
                    <Button>
                      Start Verification Process
                    </Button>
                  </div>
                )}

                {organization.verification_status === 'verified' && (
                  <div className="space-y-3">
                    <p className="text-sm text-green-600">
                      ✓ Your organization is verified and can process payments
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Organization Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm">Organization Name</label>
                  <input
                    type="text"
                    value={organization.name}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm">Handle</label>
                  <input
                    type="text"
                    value={`@${organization.handle}`}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled
                  />
                </div>
                <Button variant="outline">
                  Edit Organization
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OrganizationDashboard;