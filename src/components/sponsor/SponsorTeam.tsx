import { useState } from "react";
import { Plus, Mail, MoreHorizontal, UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SponsorTeamProps {
  sponsorId: string | null;
}

const roleColors = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800", 
  editor: "bg-green-100 text-green-800",
  viewer: "bg-gray-100 text-gray-800",
};

export function SponsorTeam({ sponsorId }: SponsorTeamProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');

  if (!sponsorId) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No Sponsor Selected</h3>
          <p className="text-muted-foreground">Please select a sponsor account to manage team members.</p>
        </CardContent>
      </Card>
    );
  }

  // Mock data - in a real app, this would come from API
  const members = [
    {
      user_id: "1",
      sponsor_id: sponsorId,
      role: "owner" as const,
      created_at: "2024-01-01",
      display_name: "John Smith",
      email: "john@company.com"
    },
    {
      user_id: "2", 
      sponsor_id: sponsorId,
      role: "admin" as const,
      created_at: "2024-01-05",
      display_name: "Sarah Johnson",
      email: "sarah@company.com"
    },
    {
      user_id: "3",
      sponsor_id: sponsorId,
      role: "editor" as const,
      created_at: "2024-01-10",
      display_name: "Mike Chen",
      email: "mike@company.com"
    }
  ];

  const handleSendInvite = async () => {
    // TODO: Implement invite logic
    console.log('Sending invite to:', inviteEmail, 'with role:', inviteRole);
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteRole('viewer');
  };

  const handleRemoveMember = async (userId: string) => {
    // TODO: Implement remove member logic
    console.log('Removing member:', userId);
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    // TODO: Implement role change logic
    console.log('Changing role for:', userId, 'to:', newRole);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Team Management</h2>
          <p className="text-muted-foreground">
            Manage who has access to your sponsor account and their permissions.
          </p>
        </div>
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: 'editor' | 'viewer') => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer - Can view deals and analytics</SelectItem>
                    <SelectItem value="editor">Editor - Can create and manage sponsorships</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowInviteModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSendInvite} disabled={!inviteEmail} className="flex-1">
                  Send Invite
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Explanations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={roleColors.owner}>Owner</Badge>
                <span className="font-medium">Full access</span>
              </div>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• Manage all sponsorships</li>
                <li>• Invite/remove team members</li>
                <li>• Access billing and payments</li>
                <li>• Update brand assets</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={roleColors.admin}>Admin</Badge>
                <span className="font-medium">Administrative access</span>
              </div>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• Manage sponsorships</li>
                <li>• Invite team members</li>
                <li>• Update brand assets</li>
                <li>• View analytics</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={roleColors.editor}>Editor</Badge>
                <span className="font-medium">Content management</span>
              </div>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• Create sponsorship requests</li>
                <li>• Upload brand assets</li>
                <li>• View analytics</li>
                <li>• Manage active deals</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={roleColors.viewer}>Viewer</Badge>
                <span className="font-medium">Read-only access</span>
              </div>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• View sponsorship deals</li>
                <li>• View analytics</li>
                <li>• Download reports</li>
                <li>• View brand assets</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
              <p className="text-muted-foreground mb-4">
                Invite team members to collaborate on sponsorship management.
              </p>
              <Button onClick={() => setShowInviteModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Invite First Member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.display_name}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[member.role]}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {member.role !== 'owner' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleChangeRole(member.user_id, 'admin')}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRole(member.user_id, 'editor')}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Make Editor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRole(member.user_id, 'viewer')}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Make Viewer
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="text-red-600"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-sm text-muted-foreground">Owner</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}