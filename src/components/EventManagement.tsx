import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Event } from '@/types/events';

import {
  ArrowLeft,
  Calendar,
  Users,
  BarChart3,
  Settings,
  Scan,
  Download,
  ExternalLink,
  RefreshCw,
  Edit,
  Trash2,
  MessageSquare,
  CheckCircle,
  Clock,
  SortAsc,
  SortDesc,
  CheckSquare,
  Square,
  UserCheck,
  DollarSign,
  TrendingUp,
  Handshake,
  Ticket,
  UserPlus,
  MapPin,
  Upload,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestManagement } from '@/components/GuestManagement';
import { OrganizerRolesPanel } from './organizer/OrganizerRolesPanel';
import { EnhancedTicketManagement } from '@/components/EnhancedTicketManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EventSponsorshipManagement } from './EventSponsorshipManagement';
import { MapboxLocationPicker } from './MapboxLocationPicker';

interface Attendee {
  id: string;
  name: string;
  email: string;
  phone: string;
  badge: string;
  ticketTier: string;
  purchaseDate: string;
  checkedIn: boolean;
  price?: number;
}

type SortKey = 'name' | 'purchaseDate' | 'ticketTier' | 'badge' | 'price';

const mockAttendees: Attendee[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    phone: '+1 555-0101',
    badge: 'VIP',
    ticketTier: 'VIP Access',
    purchaseDate: '2024-01-15',
    checkedIn: true,
  },
  {
    id: '2',
    name: 'Mike Rodriguez',
    email: 'mike@example.com',
    phone: '+1 555-0102',
    badge: 'GA',
    ticketTier: 'General Admission',
    purchaseDate: '2024-01-14',
    checkedIn: false,
  },
  {
    id: '3',
    name: 'Emma Wilson',
    email: 'emma@example.com',
    phone: '+1 555-0103',
    badge: 'VIP',
    ticketTier: 'VIP Access',
    purchaseDate: '2024-01-13',
    checkedIn: true,
  },
  {
    id: '4',
    name: 'James Park',
    email: 'james@example.com',
    phone: '+1 555-0104',
    badge: 'GA',
    ticketTier: 'General Admission',
    purchaseDate: '2024-01-12',
    checkedIn: false,
  },
];

const MANAGEMENT_TABS = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'attendees', label: 'Attendees', icon: Users },
  { value: 'guests', label: 'Guests', icon: UserCheck },
  { value: 'tickets', label: 'Tickets', icon: Ticket },
  { value: 'sponsorship', label: 'Sponsor', icon: Handshake },
  { value: 'scanner', label: 'Scanner', icon: Scan },
  { value: 'teams', label: 'Teams', icon: UserPlus },
  { value: 'settings', label: 'Settings', icon: Settings },
] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'purchaseDate', label: 'Purchase date' },
  { value: 'ticketTier', label: 'Ticket tier' },
  { value: 'badge', label: 'Badge' },
  { value: 'price', label: 'Ticket price' },
];

interface EditFormState {
  title: string;
  description: string;
  category: string;
  location: {
    address: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  venue: string;
  coverImage: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

const getInitialEditForm = (event: Event | null): EditFormState => ({
  title: event?.title ?? '',
  description: event?.description ?? '',
  category: event?.category ?? '',
  location: {
    address: '',
    city: '',
    country: '',
    lat: 0,
    lng: 0,
  },
  venue: '',
  coverImage: event?.coverImage ?? '',
  startDate: event?.startAtISO ? new Date(event.startAtISO).toISOString().split('T')[0] : '',
  startTime: event?.startAtISO ? new Date(event.startAtISO).toTimeString().slice(0, 5) : '',
  endDate: event?.endAtISO ? new Date(event.endAtISO).toISOString().split('T')[0] : '',
  endTime: event?.endAtISO ? new Date(event.endAtISO).toTimeString().slice(0, 5) : '',
});

interface EventManagementProps {
  event: Event | null;
  onBack: () => void;
}

export default function EventManagement({ event, onBack }: EventManagementProps) {
  try {
    console.log('🎯 EventManagement component loaded with event:', event);
    
    const { toast } = useToast();
  
  // Add error boundary and validation
  if (!event) {
    console.log('❌ EventManagement: No event provided');
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2">Event not found</h3>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  console.log('✅ EventManagement: Event provided, rendering component');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked-in' | 'not-checked-in'>('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [attendees, setAttendees] = useState<Attendee[]>(mockAttendees);
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

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(() => getInitialEditForm(event));
  const [uploading, setUploading] = useState(false);
  const [eventDetails, setEventDetails] = useState<Event | null>(event ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEventDetails(event ?? null);
  }, [event]);

  useEffect(() => {
    if (!showEditDialog) {
      setEditForm(getInitialEditForm(eventDetails));
    }
  }, [eventDetails, showEditDialog]);

  // Safety checks for undefined event or ticketTiers
  if (!eventDetails) {
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

  const eventId = eventDetails.id;

  const ticketTiers = useMemo(() => eventDetails?.ticketTiers ?? [], [eventDetails]);

  // Fetch functions - defined before they're used in useEffect
  const fetchRealAttendees = useCallback(async () => {
    if (!eventId) return;

    try {
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          created_at,
          owner_user_id,
          tier_id
        `)
        .eq('event_id', eventId);

      const userIds = [...new Set((ticketsData || []).map((ticket) => ticket.owner_user_id))];
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, phone')
        .in('user_id', userIds);

      const tierIds = [...new Set((ticketsData || []).map((ticket) => ticket.tier_id))];
      const { data: tiersData } = await supabase
        .from('ticket_tiers')
        .select('id, name, badge_label, price_cents')
        .in('id', tierIds);

      const profilesMap = new Map(profilesData?.map((profile) => [profile.user_id, profile]) || []);
      const tiersMap = new Map(tiersData?.map((tier) => [tier.id, tier]) || []);

      const transformedAttendees: Attendee[] = (ticketsData || []).map((ticket) => {
        const profile = profilesMap.get(ticket.owner_user_id);
        const tier = tiersMap.get(ticket.tier_id);

        return {
          id: ticket.id,
          name: profile?.display_name || 'Unknown attendee',
          email: `user${ticket.id.slice(0, 8)}@example.com`,
          phone: profile?.phone || '',
          badge: tier?.badge_label || 'GA',
          ticketTier: tier?.name || 'General',
          purchaseDate: new Date(ticket.created_at).toLocaleDateString(),
          checkedIn: false,
          price: (tier?.price_cents || 0) / 100,
        };
      });

      const { data: scanData } = await supabase
        .from('scan_logs')
        .select('ticket_id, result')
        .eq('event_id', eventId);

      const checkedInTickets = new Set(
        scanData?.filter((scan) => scan.result === 'valid').map((scan) => scan.ticket_id) || []
      );

      const attendeesWithStatus = transformedAttendees.map((attendee) => ({
        ...attendee,
        checkedIn: checkedInTickets.has(attendee.id),
      }));

      setAttendees(attendeesWithStatus.length > 0 ? attendeesWithStatus : mockAttendees);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      setAttendees(mockAttendees);
    }
  }, [eventId]);

  const fetchRealTimeStats = useCallback(async () => {
    if (!eventId) return;

    try {
      const { data: scanData } = await supabase
        .from('scan_logs')
        .select('result, created_at')
        .eq('event_id', eventId);

      const totalScans = scanData?.length || 0;
      const validScans = scanData?.filter((scan) => scan.result === 'valid').length || 0;
      const duplicateScans = scanData?.filter((scan) => scan.result === 'duplicate').length || 0;
      const lastScan = scanData?.length
        ? new Date(Math.max(...scanData.map((scan) => new Date(scan.created_at).getTime())))
        : null;

      setRealTimeStats({
        totalScans,
        validScans,
        duplicateScans,
        lastScanTime: lastScan,
      });
    } catch (error) {
      console.error('Error fetching scan stats:', error);
    }
  }, [eventId]);

  const fetchTicketStats = useCallback(async () => {
    if (!eventId) return;

    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_cents, status, created_at')
        .eq('event_id', eventId);

      const orderIds = orders?.map((order) => order.id) || [];
      const { data: refunds } = orderIds.length > 0
        ? await supabase
            .from('refunds')
            .select('amount_cents')
            .in('order_id', orderIds)
        : { data: [] };

      const paidOrders = orders?.filter((order) => order.status === 'paid') || [];
      const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total_cents, 0) / 100;
      const totalRefunds = (refunds || []).reduce((sum, refund) => sum + refund.amount_cents, 0) / 100;
      const averagePrice = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
      const refundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

      setTicketStats({
        totalRevenue: totalRevenue - totalRefunds,
        averagePrice,
        refundRate,
        conversionRate: 85,
      });
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    }
  }, [eventId]);

  // useEffect to call the fetch functions
  useEffect(() => {
    if (!eventId) return;

    fetchRealAttendees();
    fetchRealTimeStats();
    fetchTicketStats();
  }, [eventId, fetchRealAttendees, fetchRealTimeStats, fetchTicketStats]);

  const { totalTickets, soldTickets, revenue, totalAttendees, checkedInCount } = useMemo(() => {
    const totals = ticketTiers.reduce(
      (acc, tier) => {
        const sold = tier.total - tier.available;
        acc.totalTickets += tier.total;
        acc.soldTickets += sold;
        acc.revenue += tier.price * sold;
        return acc;
      },
      { totalTickets: 0, soldTickets: 0, revenue: 0 }
    );

    const checkedIn = attendees.filter((attendee) => attendee.checkedIn).length;

    return {
      ...totals,
      totalAttendees: attendees.length,
      checkedInCount: checkedIn,
    };
  }, [attendees, ticketTiers]);

  const availableTiers = useMemo(() => {
    const badges = attendees.map((attendee) => attendee.badge).filter(Boolean);
    return Array.from(new Set(badges)).sort();
  }, [attendees]);

  const filteredAndSortedAttendees = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase();

    const filtered = attendees.filter((attendee) => {
      const matchesSearch = !searchQuery
        || normalize(attendee.name).includes(normalize(searchQuery))
        || normalize(attendee.email).includes(normalize(searchQuery))
        || normalize(attendee.ticketTier).includes(normalize(searchQuery));

      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'checked-in' && attendee.checkedIn)
        || (statusFilter === 'not-checked-in' && !attendee.checkedIn);

      const matchesTier = tierFilter === 'all' || attendee.badge === tierFilter;

      return matchesSearch && matchesStatus && matchesTier;
    });

    const getSortValue = (attendee: Attendee) => {
      switch (sortBy) {
        case 'purchaseDate':
          return new Date(attendee.purchaseDate).getTime();
        case 'ticketTier':
          return normalize(attendee.ticketTier);
        case 'badge':
          return normalize(attendee.badge);
        case 'price':
          return attendee.price ?? 0;
        case 'name':
        default:
          return normalize(attendee.name);
      }
    };

    return filtered.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [attendees, searchQuery, statusFilter, tierFilter, sortBy, sortOrder]);

  const selectedCount = selectedAttendees.size;
  const isAllSelected = filteredAndSortedAttendees.length > 0 && selectedCount === filteredAndSortedAttendees.length;
  const hasFilters = useMemo(
    () =>
      Boolean(
        searchQuery
        || statusFilter !== 'all'
        || tierFilter !== 'all'
        || sortBy !== 'name'
        || sortOrder !== 'asc'
      ),
    [searchQuery, statusFilter, tierFilter, sortBy, sortOrder]
  );

  const eventTiming = useMemo(() => {
    if (!eventDetails?.startAtISO) {
      return {
        status: 'draft',
        badge: 'Draft',
        description: 'Schedule this event to go live',
        detail: 'Start date not set',
      } as const;
    }

    const now = Date.now();
    const start = new Date(eventDetails.startAtISO);
    const end = eventDetails.endAtISO ? new Date(eventDetails.endAtISO) : null;

    if (end && now > end.getTime()) {
      return {
        status: 'completed',
        badge: 'Completed',
        description: 'Event has ended',
        detail: `Ended ${end.toLocaleString()}`,
      } as const;
    }

    if (now >= start.getTime() && (!end || now <= end.getTime())) {
      return {
        status: 'live',
        badge: 'Live',
        description: 'Event in progress',
        detail: end ? `Ends ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Ongoing',
      } as const;
    }

    const diffMs = start.getTime() - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    let description = 'Starts soon';
    if (diffDays > 0) {
      description = `Starts in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    } else if (diffHours > 0) {
      description = `Starts in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    }

    return {
      status: 'upcoming',
      badge: 'Upcoming',
      description,
      detail: start.toLocaleString(),
    } as const;
  }, [eventDetails?.startAtISO, eventDetails?.endAtISO]);

  const eventStatusClass = useMemo(() => {
    switch (eventTiming.status) {
      case 'live':
        return 'border-green-500/20 bg-green-500/10 text-green-600';
      case 'completed':
        return 'border-muted bg-muted/40 text-muted-foreground';
      case 'upcoming':
        return 'border-blue-500/20 bg-blue-500/10 text-blue-600';
      default:
        return 'border-border text-muted-foreground';
    }
  }, [eventTiming.status]);

  const scheduleSummary = useMemo(() => {
    if (!eventDetails?.startAtISO) {
      return 'Pending scheduling';
    }

    const start = new Date(eventDetails.startAtISO);
    const end = eventDetails.endAtISO ? new Date(eventDetails.endAtISO) : null;
    const startDate = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const endTime = end ? end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

    return `${startDate} • ${startTime}${endTime ? ` – ${endTime}` : ''}`;
  }, [eventDetails?.startAtISO, eventDetails?.endAtISO]);

  const overviewHighlights = useMemo(
    () => [
      {
        label: 'Tickets sold',
        value: soldTickets.toLocaleString(),
        icon: Ticket,
        tone: 'text-primary',
      },
      {
        label: 'Checked in',
        value: checkedInCount.toLocaleString(),
        icon: CheckCircle,
        tone: 'text-green-600',
      },
      {
        label: 'Net revenue',
        value: `$${ticketStats.totalRevenue.toLocaleString()}`,
        icon: DollarSign,
        tone: 'text-blue-600',
      },
      {
        label: 'Avg price',
        value: `$${ticketStats.averagePrice.toFixed(0)}`,
        icon: TrendingUp,
        tone: 'text-orange-600',
      },
      {
        label: 'Total scans',
        value: realTimeStats.totalScans.toLocaleString(),
        icon: Scan,
        tone: 'text-purple-600',
      },
    ],
    [soldTickets, checkedInCount, ticketStats.totalRevenue, ticketStats.averagePrice, realTimeStats.totalScans]
  );

  useEffect(() => {
    if (!showEditDialog || !eventId) {
      return;
    }

    const loadEventDetails = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (data && !error) {
        setEditForm({
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          location: {
            address: data.address || '',
            city: data.city || '',
            country: data.country || '',
            lat: data.lat || 0,
            lng: data.lng || 0,
          },
          venue: data.venue || '',
          coverImage: data.cover_image_url || '',
          startDate: data.start_at ? new Date(data.start_at).toISOString().split('T')[0] : '',
          startTime: data.start_at ? new Date(data.start_at).toTimeString().slice(0, 5) : '',
          endDate: data.end_at ? new Date(data.end_at).toISOString().split('T')[0] : '',
          endTime: data.end_at ? new Date(data.end_at).toTimeString().slice(0, 5) : '',
        });

        const locationSummary = [data.venue, data.city, data.country].filter(Boolean).join(', ');

        setEventDetails((previous) => {
          if (!previous) return previous;

          return {
            ...previous,
            title: data.title ?? previous.title,
            description: data.description ?? previous.description,
            category: data.category ?? previous.category,
            coverImage: data.cover_image_url ?? previous.coverImage,
            startAtISO: data.start_at ?? previous.startAtISO,
            endAtISO: data.end_at ?? previous.endAtISO,
            location: data.address || locationSummary || previous.location,
          };
        });
      }
    };

    loadEventDetails();
  }, [showEditDialog, eventId]);


  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event-scans-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_logs',
          filter: `event_id=eq.${eventId}`,
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
  }, [eventId, fetchRealAttendees, fetchRealTimeStats]);

  const handleRefresh = useCallback(async () => {
    if (!eventId) return;

    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchRealAttendees(),
        fetchRealTimeStats(),
        fetchTicketStats(),
      ]);

      toast({
        title: 'Event data refreshed',
        description: 'Live metrics and attendee lists are up to date.',
      });
    } catch (error) {
      console.error('Error refreshing event data:', error);
      toast({
        title: 'Refresh failed',
        description: 'Could not refresh event data',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [eventId, fetchRealAttendees, fetchRealTimeStats, fetchTicketStats, toast]);

  const handleExportAttendees = useCallback(() => {
    if (attendees.length === 0) {
      toast({
        title: 'No attendees to export',
        description: 'Add attendees before exporting the guest list.',
      });
      return;
    }

    const csvData = attendees.map((attendee) => ({
      Name: attendee.name,
      Email: attendee.email,
      Phone: attendee.phone,
      'Ticket Tier': attendee.ticketTier,
      'Purchase Date': attendee.purchaseDate,
      'Checked In': attendee.checkedIn ? 'Yes' : 'No',
    }));

    const headers = Object.keys(csvData[0] ?? {});
    const csvString = [
      headers.join(','),
      ...csvData.map((row) => headers.map((header) => `"${row[header]}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventDetails.title}-attendees.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export complete',
      description: 'Attendee list has been downloaded.',
    });
  }, [attendees, eventDetails.title, toast]);


  // Bulk operations
  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedAttendees(new Set());
      return;
    }

    setSelectedAttendees(new Set(filteredAndSortedAttendees.map((attendee) => attendee.id)));
  }, [filteredAndSortedAttendees, isAllSelected]);

  const handleSelectAttendee = useCallback((attendeeId: string) => {
    setSelectedAttendees((previous) => {
      const updated = new Set(previous);
      if (updated.has(attendeeId)) {
        updated.delete(attendeeId);
      } else {
        updated.add(attendeeId);
      }
      return updated;
    });
  }, []);

  const handleBulkCheckIn = useCallback(async () => {
    if (selectedCount === 0) return;

    const selectedIds = Array.from(selectedAttendees);
    setIsBulkActionLoading(true);

    try {
      setAttendees((current) =>
        current.map((attendee) =>
          selectedIds.includes(attendee.id)
            ? { ...attendee, checkedIn: true }
            : attendee
        )
      );

      setSelectedAttendees(new Set());

      toast({
        title: 'Bulk check-in complete',
        description: `${selectedIds.length} attendees checked in successfully.`,
      });
    } catch (error) {
      console.error('Bulk check-in error:', error);
      toast({
        title: 'Bulk check-in failed',
        description: 'Could not check in selected attendees.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkActionLoading(false);
    }
  }, [selectedAttendees, selectedCount, toast]);

  const handleBulkMessage = useCallback(() => {
    if (selectedCount === 0) return;

    toast({
      title: 'Message queue prepared',
      description: `Preparing to message ${selectedCount} attendees.`,
    });
  }, [selectedCount, toast]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setTierFilter('all');
    setSortBy('name');
    setSortOrder('asc');
  }, []);

  const handleSortChange = useCallback((value: SortKey) => {
    setSortBy(value);
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((previous) => (previous === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!eventId) return;

      try {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${eventId}-${Date.now()}.${fileExt}`;
        const filePath = `event-covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('event-assets').getPublicUrl(filePath);

        setEditForm((previous) => ({ ...previous, coverImage: publicUrl }));
        setEventDetails((previous) => (previous ? { ...previous, coverImage: publicUrl } : previous));

        toast({
          title: 'Success',
          description: 'Cover image uploaded successfully',
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: 'Upload failed',
          description: 'Could not upload cover image',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
    },
    [eventId, toast]
  );

  const handleEditEvent = useCallback(async () => {
    if (!eventId) return;

    try {
      setIsSaving(true);

      const startAt =
        editForm.startDate && editForm.startTime
          ? new Date(`${editForm.startDate}T${editForm.startTime}`)
          : null;

      const endAt =
        editForm.endDate && editForm.endTime
          ? new Date(`${editForm.endDate}T${editForm.endTime}`)
          : null;

      const { error } = await supabase
        .from('events')
        .update({
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          venue: editForm.venue,
          address: editForm.location.address,
          city: editForm.location.city,
          country: editForm.location.country,
          lat: editForm.location.lat,
          lng: editForm.location.lng,
          cover_image_url: editForm.coverImage,
          start_at: startAt?.toISOString(),
          end_at: endAt?.toISOString(),
        })
        .eq('id', eventId);

      if (error) throw error;

      setEventDetails((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          coverImage: editForm.coverImage,
          startAtISO: startAt?.toISOString() ?? previous.startAtISO,
          endAtISO: endAt?.toISOString() ?? previous.endAtISO,
          location: editForm.location.address || previous.location,
        };
      });

      toast({
        title: 'Event updated',
        description: 'Your changes have been saved successfully.',
      });

      setShowEditDialog(false);
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Update failed',
        description: 'Could not update event details',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [editForm, eventId, toast]);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Enhanced Header */}
      <div className="border-b border-accent bg-card p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex items-start gap-3">
              <Button onClick={onBack} variant="ghost" size="sm" className="rounded-xl h-9 w-9 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-accent truncate">{eventDetails.title}</h1>
                  <Badge className={`border ${eventStatusClass}`}>{eventTiming.badge}</Badge>
                </div>
                <p className="text-xs text-accent-muted">{eventTiming.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {scheduleSummary}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {eventDetails.location || 'Location TBD'}
                  </span>
                  {eventTiming.detail && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {eventTiming.detail}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 px-3 text-xs"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  window.open(`/e/${eventId}`, '_blank');
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">View</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {overviewHighlights.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-background ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-accent">{value}</div>
                  <div className="text-xs text-accent-muted capitalize">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 sm:grid-cols-8 mb-6 gap-1">
            {MANAGEMENT_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center justify-center gap-1 text-xs sm:text-sm"
              >
                <Icon className="hidden sm:block h-4 w-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{soldTickets}</div>
                      <div className="text-sm text-muted-foreground">Tickets Sold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalAttendees}</div>
                      <div className="text-sm text-muted-foreground">Total Attendees</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${ticketStats.totalRevenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Net Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                      <Scan className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{checkedInCount}</div>
                      <div className="text-sm text-muted-foreground">Checked In</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${ticketStats.averagePrice.toFixed(0)}</div>
                      <div className="text-sm text-muted-foreground">Avg Price</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{ticketStats.refundRate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Refund Rate</div>
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
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="px-0">
                <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 px-0">
                <Button 
                  variant="ghost" 
                  className="h-auto flex-col gap-3 p-6 bg-card hover:bg-accent/5 border border-border rounded-xl transition-all hover:shadow-md group"
                  onClick={() => setActiveTab('scanner')}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Scan className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Check-in Scanner</span>
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-auto flex-col gap-3 p-6 bg-card hover:bg-accent/5 border border-border rounded-xl transition-all hover:shadow-md group"
                  onClick={handleExportAttendees}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Export Guest List</span>
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-auto flex-col gap-3 p-6 bg-card hover:bg-accent/5 border border-border rounded-xl transition-all hover:shadow-md group"
                  onClick={() => setActiveTab('attendees')}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">View Attendees</span>
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-auto flex-col gap-3 p-6 bg-card hover:bg-accent/5 border border-border rounded-xl transition-all hover:shadow-md group"
                  onClick={() => setActiveTab('settings')}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Settings className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Event Settings</span>
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
              <div className="flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Attendee management</h2>
                    <p className="text-sm text-muted-foreground">
                      Search, filter, and take action on your guest list.
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                    <Input
                      placeholder="Search attendees"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportAttendees}
                      className="whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="checked-in">Checked in</SelectItem>
                      <SelectItem value="not-checked-in">Not checked in</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Ticket tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tiers</SelectItem>
                      {availableTiers.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortKey)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSortOrder}
                    className="h-9 w-9"
                    aria-label="Toggle sort order"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      Reset filters
                    </Button>
                  )}
                </div>
              </div>

              {selectedCount > 0 && (
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>
                        {selectedCount} attendee{selectedCount === 1 ? '' : 's'} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                        {isAllSelected ? 'Clear selection' : 'Select all'} ({filteredAndSortedAttendees.length})
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleBulkCheckIn}
                        disabled={isBulkActionLoading}
                      >
                        <UserCheck className="mr-1 h-4 w-4" />
                        {isBulkActionLoading ? 'Checking in...' : 'Bulk check-in'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkMessage}>
                        <MessageSquare className="mr-1 h-4 w-4" />
                        Message
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {filteredAndSortedAttendees.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col gap-2 p-6 text-sm text-muted-foreground">
                      <span>No attendees match the current filters.</span>
                      <Button variant="outline" size="sm" onClick={handleClearFilters} className="w-auto">
                        Reset filters
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredAndSortedAttendees.map((attendee) => {
                    const isSelected = selectedAttendees.has(attendee.id);

                    return (
                      <Card
                        key={attendee.id}
                        className={isSelected ? 'border-primary/60 shadow-sm' : ''}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{attendee.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {attendee.badge}
                                </Badge>
                                {attendee.checkedIn && (
                                  <Badge variant="secondary" className="text-xs">
                                    Checked in
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {attendee.email} • {attendee.phone || 'No phone'}
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                <span>{attendee.ticketTier}</span>
                                <span>Purchased {attendee.purchaseDate}</span>
                                {typeof attendee.price === 'number' && attendee.price > 0 && (
                                  <span>Ticket ${attendee.price.toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSelectAttendee(attendee.id)}
                                aria-pressed={isSelected}
                                className="h-8 w-8"
                              >
                                {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({
                                    title: 'Attendee details',
                                    description: `Viewing details for ${attendee.name}`,
                                  });
                                }}
                              >
                                View details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guests" className="space-y-4">
            <GuestManagement eventId={eventId} />
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <EnhancedTicketManagement eventId={eventId} />
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
            <EventSponsorshipManagement eventId={eventId} />
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <OrganizerRolesPanel eventId={eventId} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Event Title</label>
                    <Input value={eventDetails.title} readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <div className="mt-1">
                      <Badge className={`border ${eventStatusClass}`}>{eventTiming.badge}</Badge>
                    </div>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Event
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border border-destructive/50 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
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

      {/* Edit Event Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Basic Information</h3>
              
              <div>
                <label className="text-sm font-medium">Event Title *</label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter event title"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your event"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Food & Drink">Food & Drink</SelectItem>
                    <SelectItem value="Art & Culture">Art & Culture</SelectItem>
                    <SelectItem value="Sports & Fitness">Sports & Fitness</SelectItem>
                    <SelectItem value="Business & Professional">Business & Professional</SelectItem>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cover Image */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Cover Image</h3>
              
              {editForm.coverImage && (
                <div className="relative w-full h-48 rounded-lg overflow-hidden">
                  <img
                    src={editForm.coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="cover-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {uploading ? 'Uploading...' : 'Click to upload cover image'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                  <input
                    id="cover-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Date & Time</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Location</h3>
              
              <div>
                <label className="text-sm font-medium">Venue Name</label>
                <Input
                  value={editForm.venue}
                  onChange={(e) => setEditForm(prev => ({ ...prev, venue: e.target.value }))}
                  placeholder="e.g., Madison Square Garden"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Search Location</label>
                <MapboxLocationPicker
                  value={editForm.location}
                  onChange={(location) => setEditForm(prev => ({ ...prev, location }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="h-11 flex-1 whitespace-nowrap"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditEvent}
                disabled={isSaving || !editForm.title}
                className="h-11 flex-1 whitespace-nowrap"
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
  } catch (error) {
    console.error('❌ EventManagement component error:', error);
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Event Management</h3>
          <p className="text-muted-foreground mb-4">
            There was an error loading the event management page. Please try again.
          </p>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground">Error Details</summary>
            <pre className="mt-2 text-xs bg-red-50 p-2 rounded overflow-auto">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}