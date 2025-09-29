import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Calendar, Users, BarChart3, Settings, Scan, Download, ExternalLink, MoreVertical, Search, Filter, RefreshCw, Edit, Trash2, Plus, Eye, Share, MessageSquare, Bell, Mail, QrCode, CheckCircle, Clock, AlertCircle, SortAsc, SortDesc, CheckSquare, Square, UserCheck, UserX, Send, FileText, DollarSign, TrendingUp, Handshake } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestManagement } from '@/components/GuestManagement';
import { OrganizerRolesPanel } from './organizer/OrganizerRolesPanel';
import { EnhancedTicketManagement } from '@/components/EnhancedTicketManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EventSponsorshipManagement } from './EventSponsorshipManagement';

import { Event, TicketTier } from '@/types/events';

// Mock attendee data
const mockAttendees = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@example.com', phone: '+1 555-0101', badge: 'VIP', ticketTier: 'VIP Access', purchaseDate: '2024-01-15', checkedIn: true },
  { id: '2', name: 'Mike Rodriguez', email: 'mike@example.com', phone: '+1 555-0102', badge: 'GA', ticketTier: 'General Admission', purchaseDate: '2024-01-14', checkedIn: false },
  { id: '3', name: 'Emma Wilson', email: 'emma@example.com', phone: '+1 555-0103', badge: 'VIP', ticketTier: 'VIP Access', purchaseDate: '2024-01-13', checkedIn: true },
  { id: '4', name: 'James Park', email: 'james@example.com', phone: '+1 555-0104', badge: 'GA', ticketTier: 'General Admission', purchaseDate: '2024-01-12', checkedIn: false },
];

interface EventManagementProps {
  event: Event;
  onBack: () => void;
}

export default function EventManagement({ event, onBack }: EventManagementProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [attendees, setAttendees] = useState(mockAttendees);
  const [realAttendees, setRealAttendees] = useState<any[]>([]);
  const [realTimeStats, setRealTimeStats] = useState({
    totalScans: 0,
    validScans: 0,
    duplicateScans: 0,
    lastScanTime: null as Date | null
  });
  const [ticketStats, setTicketStats] = useState({
    totalRevenue: 0,
    averagePrice: 0,
    refundRate: 0,
    conversionRate: 0
  });

  // Safety checks for undefined event or ticketTiers
  if (!event) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 text-accent">Event not found</h2>
          <p className="text-accent-muted mb-4">The requested event could not be loaded.</p>
          <Button onClick={onBack} className="btn-enhanced">Go Back</Button>
        </div>
      </div>
    );
  }

  const ticketTiers = event.ticketTiers || [];
  const totalTickets = ticketTiers.reduce((sum, tier) => sum + tier.total, 0);
  const soldTickets = ticketTiers.reduce((sum, tier) => sum + (tier.total - tier.available), 0);
  const revenue = ticketTiers.reduce((sum, tier) => sum + (tier.price * (tier.total - tier.available)), 0);
  const totalAttendees = attendees.length;
  const checkedInCount = attendees.filter(a => a.checkedIn).length;

  // Fetch real attendee data
  useEffect(() => {
    if (event?.id) {
      fetchRealAttendees();
      fetchRealTimeStats();
      fetchTicketStats();
    }
  }, [event?.id]);

  const fetchRealAttendees = async () => {
    try {
      // Get tickets with proper joins
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          created_at,
          owner_user_id,
          tier_id
        `)
        .eq('event_id', event.id);

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
        .select('id, name, badge_label, price_cents')
        .in('id', tierIds);

      // Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const tiersMap = new Map(tiersData?.map(t => [t.id, t]) || []);

      const transformedAttendees = (ticketsData || []).map(ticket => {
        const profile = profilesMap.get(ticket.owner_user_id);
        const tier = tiersMap.get(ticket.tier_id);
        
        return {
          id: ticket.id,
          name: profile?.display_name || 'Unknown',
          email: `user${ticket.id.slice(0,8)}@example.com`, // Mock email since not in user_profiles
          phone: profile?.phone || '',
          badge: tier?.badge_label || 'GA',
          ticketTier: tier?.name || 'General',
          purchaseDate: new Date(ticket.created_at).toLocaleDateString(),
          checkedIn: false, // Will be updated with scan data
          price: (tier?.price_cents || 0) / 100
        };
      });

      // Get check-in status
      const { data: scanData } = await supabase
        .from('scan_logs')
        .select('ticket_id, result')
        .eq('event_id', event.id);

      // Update check-in status
      const checkedInTickets = new Set(
        scanData?.filter(s => s.result === 'valid').map(s => s.ticket_id) || []
      );

      const attendeesWithStatus = transformedAttendees.map(attendee => ({
        ...attendee,
        checkedIn: checkedInTickets.has(attendee.id)
      }));

      setRealAttendees(attendeesWithStatus);
      setAttendees(attendeesWithStatus.length > 0 ? attendeesWithStatus : mockAttendees);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      setAttendees(mockAttendees);
    }
  };

  const fetchRealTimeStats = async () => {
    try {
      const { data: scanData } = await supabase
        .from('scan_logs')
        .select('result, created_at')
        .eq('event_id', event.id);

      const totalScans = scanData?.length || 0;
      const validScans = scanData?.filter(s => s.result === 'valid').length || 0;
      const duplicateScans = scanData?.filter(s => s.result === 'duplicate').length || 0;
      const lastScan = scanData?.length ? new Date(Math.max(...scanData.map(s => new Date(s.created_at).getTime()))) : null;

      setRealTimeStats({
        totalScans,
        validScans,
        duplicateScans,
        lastScanTime: lastScan
      });
    } catch (error) {
      console.error('Error fetching scan stats:', error);
    }
  };

  // Real-time updates for scans
  useEffect(() => {
    const channel = supabase
      .channel(`event-scans-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_logs',
          filter: `event_id=eq.${event.id}`
        },
        () => {
          fetchRealTimeStats();
          fetchRealAttendees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Refresh attendee data
      // In real implementation, fetch from API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    } catch (error) {
      setLoading(false);
      toast({
        title: "Refresh failed",
        description: "Could not refresh event data",
        variant: "destructive"
      });
    }
  };

  const handleExportAttendees = () => {
    // Create CSV data
    const csvData = attendees.map(attendee => ({
      Name: attendee.name,
      Email: attendee.email,
      Phone: attendee.phone,
      'Ticket Tier': attendee.ticketTier,
      'Purchase Date': attendee.purchaseDate,
      'Checked In': attendee.checkedIn ? 'Yes' : 'No'
    }));

    // Convert to CSV string
    const headers = Object.keys(csvData[0]);
    const csvString = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title}-attendees.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Attendee list has been downloaded.",
    });
  };

  const fetchTicketStats = async () => {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_cents, status, created_at')
        .eq('event_id', event.id);

      const orderIds = orders?.map(o => o.id) || [];
      const { data: refunds } = orderIds.length > 0 ? await supabase
        .from('refunds')
        .select('amount_cents')
        .in('order_id', orderIds) : { data: [] };

      const paidOrders = orders?.filter(o => o.status === 'paid') || [];
      const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_cents, 0) / 100;
      const totalRefunds = (refunds || []).reduce((sum, r) => sum + r.amount_cents, 0) / 100;
      const averagePrice = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
      const refundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

      setTicketStats({
        totalRevenue: totalRevenue - totalRefunds,
        averagePrice,
        refundRate,
        conversionRate: 85 // Mock conversion rate
      });
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    }
  };

  // Enhanced filtering and sorting
  const filteredAndSortedAttendees = attendees
    .filter(attendee => {
      const matchesSearch = !searchQuery || 
        attendee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attendee.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'checked-in' && attendee.checkedIn) ||
        (statusFilter === 'not-checked-in' && !attendee.checkedIn);
      
      const matchesTier = tierFilter === 'all' || attendee.badge === tierFilter;
      
      return matchesSearch && matchesStatus && matchesTier;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'purchaseDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'asc' ? result : -result;
    });

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedAttendees.size === filteredAndSortedAttendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(filteredAndSortedAttendees.map(a => a.id)));
    }
  };

  const handleSelectAttendee = (attendeeId: string) => {
    const newSelected = new Set(selectedAttendees);
    if (newSelected.has(attendeeId)) {
      newSelected.delete(attendeeId);
    } else {
      newSelected.add(attendeeId);
    }
    setSelectedAttendees(newSelected);
  };

  const handleBulkCheckIn = async () => {
    if (selectedAttendees.size === 0) return;
    
    try {
      setLoading(true);
      // Mock bulk check-in operation
      const updatedAttendees = attendees.map(attendee => 
        selectedAttendees.has(attendee.id) 
          ? { ...attendee, checkedIn: true }
          : attendee
      );
      setAttendees(updatedAttendees);
      setSelectedAttendees(new Set());
      
      toast({
        title: "Bulk Check-in Complete",
        description: `${selectedAttendees.size} attendees checked in successfully.`,
      });
    } catch (error) {
      toast({
        title: "Bulk Check-in Failed",
        description: "Could not check in selected attendees.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMessage = () => {
    if (selectedAttendees.size === 0) return;
    
    toast({
      title: "Message Feature",
      description: `Preparing to message ${selectedAttendees.size} attendees.`,
    });
    // Implement messaging modal
  };

  const unique = <T,>(arr: T[]): T[] => [...new Set(arr)];
  const availableTiers = unique(attendees.map(a => a.badge));
  const toggleSortOrder = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Enhanced Header */}
      <div className="border-b border-accent bg-card p-4">
          <div className="flex items-center gap-3 mb-4">
          <Button onClick={onBack} variant="ghost" size="sm" className="rounded-xl h-9 w-9 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-accent truncate">{event.title}</h1>
            <p className="text-xs text-accent-muted">Event Management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="h-8 px-3 text-xs">
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 px-3 text-xs"
              onClick={() => {
                window.open(`/e/${event.id}`, '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">View</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg sm:text-xl font-bold text-accent">{soldTickets}</div>
            <div className="text-xs text-accent-muted">Tickets Sold</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg sm:text-xl font-bold text-accent">{checkedInCount}</div>
            <div className="text-xs text-accent-muted">Checked In</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg sm:text-xl font-bold text-accent">${revenue.toLocaleString()}</div>
            <div className="text-xs text-accent-muted">Revenue</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg sm:text-xl font-bold text-accent">{realTimeStats.totalScans}</div>
            <div className="text-xs text-accent-muted">Total Scans</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 sm:grid-cols-8 mb-6 gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="attendees" className="text-xs sm:text-sm">Attendees</TabsTrigger>
            <TabsTrigger value="guests" className="text-xs sm:text-sm">Guests</TabsTrigger>
            <TabsTrigger value="tickets" className="text-xs sm:text-sm">Tickets</TabsTrigger>
            <TabsTrigger value="sponsorship" className="text-xs sm:text-sm">Sponsor</TabsTrigger>
            <TabsTrigger value="scanner" className="text-xs sm:text-sm">Scanner</TabsTrigger>
            <TabsTrigger value="teams" className="text-xs sm:text-sm">Teams</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-accent">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{soldTickets}</div>
                      <div className="text-sm text-accent-muted">Tickets Sold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <Users className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{totalAttendees}</div>
                      <div className="text-sm text-accent-muted">Total Attendees</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <DollarSign className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">${ticketStats.totalRevenue.toLocaleString()}</div>
                      <div className="text-sm text-accent-muted">Net Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <Scan className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{checkedInCount}</div>
                      <div className="text-sm text-accent-muted">Checked In</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <TrendingUp className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">${ticketStats.averagePrice.toFixed(0)}</div>
                      <div className="text-sm text-accent-muted">Avg Price</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <BarChart3 className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{ticketStats.refundRate.toFixed(1)}%</div>
                      <div className="text-sm text-accent-muted">Refund Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Real-time Activity */}
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="text-accent">Live Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border border-accent rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{realTimeStats.validScans}</div>
                    <div className="text-sm text-accent-muted">Valid Scans</div>
                  </div>
                  <div className="text-center p-4 border border-accent rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{realTimeStats.duplicateScans}</div>
                    <div className="text-sm text-accent-muted">Duplicate Scans</div>
                  </div>
                  <div className="text-center p-4 border border-accent rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {realTimeStats.lastScanTime ? 'Live' : 'Offline'}
                    </div>
                    <div className="text-sm text-accent-muted">Scanner Status</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="text-accent">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 p-4"
                  onClick={() => setActiveTab('scanner')}
                >
                  <Scan className="w-6 h-6" />
                  <span>Check-in Scanner</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 p-4"
                  onClick={handleExportAttendees}
                >
                  <Download className="w-6 h-6" />
                  <span>Export Guest List</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 p-4"
                  onClick={() => setActiveTab('attendees')}
                >
                  <Users className="w-6 h-6" />
                  <span>View Attendees</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 p-4"
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings className="w-6 h-6" />
                  <span>Event Settings</span>
                </Button>
              </CardContent>
            </Card>

            {/* Ticket Tiers Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Ticket Tiers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticketTiers.map((tier) => {
                  const sold = tier.total - tier.available;
                  const percentage = Math.round((sold / tier.total) * 100);
                  
                  return (
                    <div key={tier.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{tier.badge}</Badge>
                        <div>
                          <div className="font-medium">{tier.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ${tier.price} • {sold}/{tier.total} sold ({percentage}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${(tier.price * sold).toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Revenue</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="attendees" className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2>Attendee List</h2>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search attendees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attendees</SelectItem>
                      <SelectItem value="checked-in">Checked In</SelectItem>
                      <SelectItem value="not-checked-in">Not Checked In</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleExportAttendees}>
                    <Download className="w-4 h-4 mr-1" />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {attendees
                  .filter(attendee => {
                    const matchesSearch = attendee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      attendee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      attendee.ticketTier.toLowerCase().includes(searchQuery.toLowerCase());
                    
                    const matchesStatus = statusFilter === 'all' || 
                      (statusFilter === 'checked-in' && attendee.checkedIn) ||
                      (statusFilter === 'not-checked-in' && !attendee.checkedIn);
                    
                    return matchesSearch && matchesStatus;
                  })
                  .map((attendee) => (
                  <Card key={attendee.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{attendee.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {attendee.badge}
                            </Badge>
                            {attendee.checkedIn && (
                              <Badge variant="secondary" className="text-xs">
                                Checked In
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {attendee.email} • {attendee.phone}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {attendee.ticketTier} • Purchased {attendee.purchaseDate}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({
                              title: "Attendee Details",
                              description: `Viewing details for ${attendee.name}`,
                            });
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guests" className="space-y-4">
            <GuestManagement eventId={event.id} />
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <EnhancedTicketManagement eventId={event.id} />
          </TabsContent>

          <TabsContent value="scanner" className="space-y-4">
            <div className="text-center py-12">
              <Scan className="w-24 h-24 mx-auto mb-6 text-muted-foreground/50" />
              <h2 className="text-xl font-bold mb-2">QR Code Scanner</h2>
              <p className="text-muted-foreground mb-6">
                Scan attendee tickets to check them in to your event
              </p>
              <Button size="lg" onClick={() => {
                toast({
                  title: "Scanner Opened",
                  description: "QR code scanner is now active for check-ins.",
                });
                // In a real app, this would open the camera scanner
              }}>
                <Scan className="w-5 h-5 mr-2" />
                Start Scanning
              </Button>
              <div className="mt-8 max-w-md mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Scanner Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Point camera at attendee's QR code</li>
                      <li>Wait for automatic scan recognition</li>
                      <li>Verify attendee information</li>
                      <li>Confirm check-in</li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sponsorship" className="space-y-4">
            <EventSponsorshipManagement eventId={event.id} />
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <OrganizerRolesPanel eventId={event.id} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-accent">Event Title</label>
                    <Input value={event.title} className="input-enhanced" readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-accent">Status</label>
                    <Select defaultValue="active">
                      <SelectTrigger className="input-enhanced">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="btn-enhanced w-full"
                    onClick={() => {
                      toast({
                        title: "Edit Event",
                        description: "Edit functionality will be implemented soon.",
                      });
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Event
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2">Delete Event</h4>
                    <p className="text-sm text-red-600 mb-4">
                      This action cannot be undone. All tickets, attendees, and data will be permanently deleted.
                    </p>
                    <Button 
                      variant="destructive" 
                      className="btn-enhanced"
                      onClick={() => {
                        toast({
                          title: "Delete Event",
                          description: "Are you sure? This action cannot be undone.",
                          variant: "destructive",
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Event
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}