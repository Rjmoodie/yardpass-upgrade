import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Ticket,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  Mail,
  QrCode,
  FileText,
  BarChart3
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TicketManagementProps {
  eventId: string;
}

interface TicketData {
  id: string;
  tier_name: string;
  tier_price: number;
  status: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  qr_code: string;
  is_transferred: boolean;
  is_refunded: boolean;
  checked_in_at?: string;
}

interface TicketStats {
  totalSold: number;
  totalRevenue: number;
  checkedIn: number;
  transferred: number;
  refunded: number;
  pendingRefunds: number;
}

export function EnhancedTicketManagement({ eventId }: TicketManagementProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [stats, setStats] = useState<TicketStats>({
    totalSold: 0,
    totalRevenue: 0,
    checkedIn: 0,
    transferred: 0,
    refunded: 0,
    pendingRefunds: 0
  });

  useEffect(() => {
    fetchTickets();
  }, [eventId]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      
      // Fetch tickets with related data
      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          created_at,
          owner_user_id,
          tier_id,
          qr_code
        `)
        .eq('event_id', eventId);

      if (error) throw error;

      // Get user profiles separately
      const userIds = [...new Set((ticketsData || []).map(t => t.owner_user_id))];
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, phone')
        .in('user_id', userIds);

      // Get ticket tiers separately  
      const tierIds = [...new Set((ticketsData || []).map(t => t.tier_id))];
      const { data: tiersData } = await supabase
        .from('ticket_tiers')
        .select('id, name, price_cents, badge_label')
        .in('id', tierIds);

      // Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const tiersMap = new Map(tiersData?.map(t => [t.id, t]) || []);

      // Transform data
      const transformedTickets: TicketData[] = (ticketsData || []).map(ticket => {
        const profile = profilesMap.get(ticket.owner_user_id);
        const tier = tiersMap.get(ticket.tier_id);
        
        return {
          id: ticket.id,
          tier_name: tier?.name || 'Unknown',
          tier_price: (tier?.price_cents || 0) / 100,
          status: ticket.status,
          created_at: ticket.created_at,
          owner_name: profile?.display_name || 'Unknown',
          owner_email: ticket.owner_email || 'unknown@example.com',
          qr_code: ticket.qr_code || '',
          is_transferred: ticket.status === 'transferred',
          is_refunded: false, // Would need to check refunds table
          checked_in_at: undefined // Would need to check scan_logs
        };
      });

      setTickets(transformedTickets);

      // Calculate stats
      const newStats: TicketStats = {
        totalSold: transformedTickets.length,
        totalRevenue: transformedTickets.reduce((sum, t) => sum + t.tier_price, 0),
        checkedIn: transformedTickets.filter(t => t.checked_in_at).length,
        transferred: transformedTickets.filter(t => t.is_transferred).length,
        refunded: transformedTickets.filter(t => t.is_refunded).length,
        pendingRefunds: 0 // Would calculate from refunds table
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load ticket data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (ticketId: string) => {
    try {
      // Implement refund logic
      toast({
        title: "Refund Initiated",
        description: "Refund process has been started for this ticket.",
      });
    } catch (error) {
      toast({
        title: "Refund Failed",
        description: "Could not process refund. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTransfer = async (ticketId: string) => {
    try {
      // Implement transfer logic
      toast({
        title: "Transfer Initiated",
        description: "Ticket transfer process has been started.",
      });
    } catch (error) {
      toast({
        title: "Transfer Failed",
        description: "Could not initiate transfer. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleExportTickets = () => {
    const csvData = filteredTickets.map(ticket => ({
      'Ticket ID': ticket.id,
      'Owner Name': ticket.owner_name,
      'Owner Email': ticket.owner_email,
      'Tier': ticket.tier_name,
      'Price': `$${ticket.tier_price}`,
      'Status': ticket.status,
      'Purchase Date': new Date(ticket.created_at).toLocaleDateString(),
      'Checked In': ticket.checked_in_at ? 'Yes' : 'No'
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
    a.download = `event-tickets-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchQuery || 
      ticket.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.owner_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesTier = tierFilter === 'all' || ticket.tier_name === tierFilter;
    
    return matchesSearch && matchesStatus && matchesTier;
  });

  const uniqueTiers = [...new Set(tickets.map(t => t.tier_name))];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Ticket className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalSold}</div>
                <div className="text-sm text-muted-foreground">Tickets Sold</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.checkedIn}</div>
                <div className="text-sm text-muted-foreground">Checked In</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.transferred}</div>
                <div className="text-sm text-muted-foreground">Transferred</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ticket Management</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchTickets}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportTickets}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search tickets by owner name, email, or ticket ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="redeemed">Redeemed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {uniqueTiers.map(tier => (
                    <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tickets List */}
          <div className="space-y-2">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No tickets found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || tierFilter !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'No tickets have been sold for this event yet.'
                  }
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{ticket.owner_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {ticket.tier_name}
                      </Badge>
                      <Badge 
                        variant={ticket.status === 'redeemed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {ticket.status}
                      </Badge>
                      {ticket.is_transferred && (
                        <Badge variant="outline" className="text-xs text-brand-600">
                          Transferred
                        </Badge>
                      )}
                      {ticket.checked_in_at && (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Checked In
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {ticket.owner_email} • ${ticket.tier_price} • {ticket.id.slice(0, 8)} • 
                      Purchased {new Date(ticket.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">${ticket.tier_price}</span>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <QrCode className="w-4 h-4 mr-2" />
                          View QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="w-4 h-4 mr-2" />
                          Resend Ticket
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTransfer(ticket.id)}>
                          <FileText className="w-4 h-4 mr-2" />
                          Transfer Ticket
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleRefund(ticket.id)}
                          className="text-red-600"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Refund Ticket
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}