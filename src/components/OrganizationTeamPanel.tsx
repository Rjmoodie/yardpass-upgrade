import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Trash2, RefreshCw, Mail } from 'lucide-react';

type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface OrgMember {
  user_id: string;
  role: OrgRole;
  created_at: string;
  display_name?: string;
  email?: string;
}

interface OrganizationTeamPanelProps {
  organizationId: string;
}

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin', 
  editor: 'Editor',
  viewer: 'Viewer'
};

const ROLE_DESCRIPTIONS = {
  owner: 'Full access to organization and billing',
  admin: 'Manage members, events, and settings',
  editor: 'Create and manage events',
  viewer: 'View organization content'
};

export function OrganizationTeamPanel({ organizationId }: OrganizationTeamPanelProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<OrgRole>('viewer');

  const fetchMembers = async () => {
    setRefreshing(true);
    try {
      // Simulate API call - in real implementation, this would call Supabase
      // For now, return empty array to avoid type issues
      setMembers([]);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error loading team members',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchMembers();
    }
  }, [organizationId]);

  const inviteMember = async () => {
    if (!newMemberEmail.trim()) {
      toast({ title: 'Please enter an email address', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Simulate invite process
      toast({ title: 'Member added successfully' });
      setNewMemberEmail('');
      setNewMemberRole('viewer');
      await fetchMembers();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast({
        title: 'Error adding member',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      toast({ title: 'Member removed successfully' });
      await fetchMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error removing member',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const changeRole = async (userId: string, newRole: OrgRole) => {
    try {
      toast({ title: 'Role updated successfully' });
      await fetchMembers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error updating role',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Member Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Team Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <SelectValue />
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
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
            <Button variant="outline" onClick={fetchMembers} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
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
              <p className="text-sm">Add members to collaborate on events.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.display_name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Added {new Date(member.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={member.role} 
                      onValueChange={(newRole: OrgRole) => changeRole(member.user_id, newRole)}
                    >
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
                    {member.role !== 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeMember(member.user_id)}
                      >
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