import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  Copy,
  Search,
  Undo2,
  Send
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { AddGuestModal } from '@/components/AddGuestModal';
import { useGuestManagement } from '@/hooks/useGuestManagement';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface GuestManagementProps {
  eventId: string;
  /** Optional: gate actions (e.g., viewer role). Defaults to true. */
  canManage?: boolean;
}

type GuestType = 'ticket' | 'invite';

export function GuestManagement({ eventId, canManage = true }: GuestManagementProps) {
  const {
    guests,
    guestCodes,
    loading,
    loadGuests,
    loadGuestCodes,
    addGuest,
    removeGuest,
    removeGuestCode,
    // optional in your hook; if present we'll use them gracefully:
    resendInvite,
    revokeComplimentary,
  } = useGuestManagement(eventId) as any;

  const [showAddModal, setShowAddModal] = useState(false);
  const [confirm, setConfirm] = useState<{ type: 'guest' | 'code'; id: string; open: boolean }>({ type: 'guest', id: '', open: false });
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'guests' | 'codes'>('guests');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { toast } = useToast();

  useEffect(() => {
    loadGuests();
    loadGuestCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // --- Derivations ---
  const ticketHolders = useMemo(() => guests.filter((g: any) => g.type === 'ticket'), [guests]);
  const invitedGuests = useMemo(() => guests.filter((g: any) => g.type === 'invite'), [guests]);
  const complimentaryTickets = useMemo(
    () => ticketHolders.filter((g: any) => g.is_complimentary),
    [ticketHolders]
  );

  // search/filter guests client-side (fast)
  const filteredGuests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g: any) =>
      [g.name, g.email, g.tier_name, g.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [guests, query]);

  // pagination
  const pagedGuests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredGuests.slice(start, start + PAGE_SIZE);
  }, [filteredGuests, page]);

  useEffect(() => {
    // reset to page 1 on new search
    setPage(1);
  }, [query, activeTab]);

  // --- CSV Export (RFC 4180 safe) ---
  const csvEscape = (val: unknown) => {
    const s = val == null ? '' : String(val);
    // wrap in quotes and escape inner quotes
    return `"${s.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    const rows = guests.length
      ? guests.map((g: any) => ({
          Name: g.name || '',
          Email: g.email || '',
          Type: g.type === 'ticket' ? 'Ticket Holder' : 'Invited',
          Status: g.status || '',
          Tier: g.tier_name || '',
          Complimentary: g.is_complimentary ? 'Yes' : 'No',
          'Added At': g.created_at ? new Date(g.created_at).toISOString() : '',
        }))
      : [];

    const headers = ['Name', 'Email', 'Type', 'Status', 'Tier', 'Complimentary', 'Added At'];
    const lines = [headers.map(csvEscape).join(',')];

    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape((row as any)[h])).join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `event-${eventId}-guests.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: 'Copied to clipboard.' });
    } catch {
      // fallback (rare)
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast({ title: 'Copied', description: 'Copied to clipboard.' });
    }
  };

  const onConfirmRemove = async () => {
    try {
      if (confirm.type === 'guest') {
        await removeGuest({ id: confirm.id });
      } else {
        await removeGuestCode(confirm.id);
      }
      toast({ title: 'Removed', description: 'Removal successful.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'Failed to remove.', variant: 'destructive' });
    } finally {
      setConfirm((c) => ({ ...c, open: false }));
    }
  };

  const canResend = typeof resendInvite === 'function';
  const canRevokeComp = typeof revokeComplimentary === 'function';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Guest Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage attendees, complimentary tickets, invitations, and guest codes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadGuests();
              loadGuestCodes();
            }}
            disabled={loading}
            aria-label="Refresh lists"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {guests.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setShowAddModal(true)}>
              <UserPlus className="w-4 h-4 mr-1" />
              Add Guest
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Ticket className="w-5 h-5 text-primary" /></div><div><div className="text-2xl font-bold">{ticketHolders.length}</div><div className="text-sm text-muted-foreground">Ticket Holders</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center"><Ticket className="w-5 h-5 text-green-500" /></div><div><div className="text-2xl font-bold">{complimentaryTickets.length}</div><div className="text-sm text-muted-foreground">Complimentary</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center"><Mail className="w-5 h-5 text-blue-500" /></div><div><div className="text-2xl font-bold">{invitedGuests.length}</div><div className="text-sm text-muted-foreground">Invited Only</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center"><Key className="w-5 h-5 text-purple-500" /></div><div><div className="text-2xl font-bold">{guestCodes.length}</div><div className="text-sm text-muted-foreground">Guest Codes</div></div></div></CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search guests"
            placeholder="Search name, email, tier, status…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Lists */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guests">Guest List</TabsTrigger>
          <TabsTrigger value="codes">Guest Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="guests">
          <Card>
            <CardHeader>
              <CardTitle>
                Guests ({filteredGuests.length}{filteredGuests.length !== guests.length ? ` / ${guests.length}` : ''})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3" aria-busy>
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
              ) : filteredGuests.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No guests match your search</h3>
                  <p className="text-muted-foreground mb-4">Try clearing filters or adding a guest.</p>
                  {canManage && (
                    <Button onClick={() => setShowAddModal(true)}>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Add Guest
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {pagedGuests.map((guest: any) => {
                      const initials =
                        (guest.name || guest.email || '?')
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();
                      return (
                        <div key={guest.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className="font-medium truncate max-w-[220px]">{guest.name || guest.email}</span>
                              <Badge variant={guest.type === 'ticket' ? 'default' : 'secondary'} className="text-xs">
                                {guest.type === 'ticket' ? (<><Ticket className="w-3 h-3 mr-1" />Ticket</>) : (<><Mail className="w-3 h-3 mr-1" />Invite</>)}
                              </Badge>
                              {guest.is_complimentary && <Badge variant="outline" className="text-xs">COMP</Badge>}
                              <Badge variant={guest.status === 'redeemed' ? 'secondary' : 'outline'} className="text-xs">
                                {guest.status}
                              </Badge>
                              {guest.tier_name && <Badge variant="outline" className="text-xs">{guest.tier_name}</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {guest.email && <span className="mr-2">{guest.email}</span>}
                              Added {formatDistanceToNow(new Date(guest.created_at), { addSuffix: true })}
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" aria-label="Open guest actions">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {guest.email && (
                                <>
                                  <DropdownMenuItem onClick={() => copyToClipboard(guest.email)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy email
                                  </DropdownMenuItem>
                                  {canResend && guest.type === 'invite' && (
                                    <DropdownMenuItem onClick={() => resendInvite?.(guest)}>
                                      <Send className="w-4 h-4 mr-2" />
                                      Resend invite
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {canRevokeComp && guest.is_complimentary && (
                                <DropdownMenuItem onClick={() => revokeComplimentary?.(guest)}>
                                  <Undo2 className="w-4 h-4 mr-2" />
                                  Revoke complimentary
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {canManage && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setConfirm({ type: 'guest', id: guest.id, open: true })}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove guest
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {filteredGuests.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 text-sm">
                      <span className="text-muted-foreground">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredGuests.length)} of {filteredGuests.length}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                        <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= filteredGuests.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
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
                <div className="space-y-4" aria-busy>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : guestCodes.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Guest Codes</h3>
                  <p className="text-muted-foreground mb-4">Create guest codes for easy event access</p>
                  {canManage && (
                    <Button onClick={() => setShowAddModal(true)}>
                      <Key className="w-4 h-4 mr-1" />
                      Create First Code
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {guestCodes.map((code: any) => (
                    <div key={code.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-muted-foreground" />
                            <span className="font-mono font-bold text-lg">{code.code}</span>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code.code)} aria-label="Copy code">
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          {code.tier_name && <Badge variant="outline">{code.tier_name}</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Uses: {code.used_count}/{code.max_uses}</span>
                          {code.expires_at && <span>Expires: {new Date(code.expires_at).toLocaleString()}</span>}
                          <span>Created: {new Date(code.created_at).toLocaleString()}</span>
                        </div>
                        {code.notes && <p className="text-sm text-muted-foreground mt-1">{code.notes}</p>}
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirm({ type: 'code', id: code.id, open: true })}
                          className="text-destructive hover:text-destructive"
                          aria-label="Remove code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Guest Modal */}
      {canManage && (
        <AddGuestModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAddGuest={addGuest}
          eventId={eventId}
        />
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirm.open} onOpenChange={(open) => setConfirm((c) => ({ ...c, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm.type === 'guest' ? 'Remove guest?' : 'Delete guest code?'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            This action can’t be undone.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onConfirmRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
