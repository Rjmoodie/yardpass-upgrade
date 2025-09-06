import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  UserPlus, 
  Download, 
  MoreVertical, 
  Ticket, 
  Mail, 
  Trash2,
  RefreshCw,
  Key,
  Copy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddGuestModal } from '@/components/AddGuestModal';
import { useGuestManagement } from '@/hooks/useGuestManagement';
import { formatDistanceToNow } from 'date-fns';

interface GuestManagementProps {
  eventId: string;
}

export function GuestManagement({ eventId }: GuestManagementProps) {
  const { guests, guestCodes, loading, loadGuests, loadGuestCodes, addGuest, removeGuest, removeGuestCode } = useGuestManagement(eventId);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadGuests();
    loadGuestCodes();
  }, [loadGuests, loadGuestCodes]);

  const handleExportCSV = () => {
    const csvData = guests.map(guest => ({
      Name: guest.name,
      Email: guest.email,
      Type: guest.type === 'ticket' ? 'Ticket Holder' : 'Invited',
      Status: guest.status,
      'Added Date': new Date(guest.created_at).toLocaleDateString()
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-guests-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Guest code copied successfully",
    });
  };

  const ticketHolders = guests.filter(g => g.type === 'ticket');
  const invitedGuests = guests.filter(g => g.type === 'invite');
  const complimentaryTickets = ticketHolders.filter(g => g.is_complimentary);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Guest Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage attendees, complimentary tickets, invitations, and guest codes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadGuests(); loadGuestCodes(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {guests.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Add Guest
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Ticket className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{ticketHolders.length}</div>
                <div className="text-sm text-muted-foreground">Ticket Holders</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Ticket className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{complimentaryTickets.length}</div>
                <div className="text-sm text-muted-foreground">Complimentary</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{invitedGuests.length}</div>
                <div className="text-sm text-muted-foreground">Invited Only</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{guestCodes.length}</div>
                <div className="text-sm text-muted-foreground">Guest Codes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guest List and Codes */}
      <Tabs defaultValue="guests" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guests">Guest List</TabsTrigger>
          <TabsTrigger value="codes">Guest Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="guests">
          <Card>
            <CardHeader>
              <CardTitle>All Guests ({guests.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted animate-pulse rounded w-32" />
                        <div className="h-3 bg-muted animate-pulse rounded w-48" />
                      </div>
                      <div className="w-20 h-6 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : guests.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No guests yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add guests to give them access to your event
                  </p>
                  <Button onClick={() => setShowAddModal(true)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add First Guest
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {guests.map((guest) => (
                    <div key={guest.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {guest.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{guest.name}</span>
                          <Badge 
                            variant={guest.type === 'ticket' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {guest.type === 'ticket' ? (
                              <><Ticket className="w-3 h-3 mr-1" />Ticket</>
                            ) : (
                              <><Mail className="w-3 h-3 mr-1" />Invite</>
                            )}
                          </Badge>
                          {guest.is_complimentary && (
                            <Badge variant="outline" className="text-xs">
                              COMP
                            </Badge>
                          )}
                          <Badge 
                            variant={guest.status === 'redeemed' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {guest.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {guest.email && <span>{guest.email} • </span>}
                          {guest.tier_name && <span>{guest.tier_name} • </span>}
                          Added {formatDistanceToNow(new Date(guest.created_at), { addSuffix: true })}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => removeGuest(guest)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove Guest
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes">
          <Card>
            <CardHeader>
              <CardTitle>Guest Codes ({guestCodes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : guestCodes.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Guest Codes</h3>
                  <p className="text-muted-foreground mb-4">Create guest codes for easy event access</p>
                  <Button onClick={() => setShowAddModal(true)}>
                    <Key className="w-4 h-4 mr-1" />
                    Create First Code
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {guestCodes.map((code) => (
                    <div key={code.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-muted-foreground" />
                            <span className="font-mono font-bold text-lg">{code.code}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(code.code)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          {code.tier_name && (
                            <Badge variant="outline">{code.tier_name}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Uses: {code.used_count}/{code.max_uses}</span>
                          {code.expires_at && (
                            <span>Expires: {new Date(code.expires_at).toLocaleDateString()}</span>
                          )}
                          <span>Created: {new Date(code.created_at).toLocaleDateString()}</span>
                        </div>
                        {code.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{code.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGuestCode(code.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Guest Modal */}
      <AddGuestModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddGuest={addGuest}
        eventId={eventId}
      />
    </div>
  );
}