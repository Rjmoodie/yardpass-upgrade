import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Link as LinkIcon, ListChecks, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';

interface OrgContactExportPanelProps {
  organizationId: string;
}

type ExportMode = 'attendees' | 'orders' | 'subscribers' | 'combined';

type EventSummary = {
  id: string;
  title: string;
  start_at: string | null;
};

type TicketRow = {
  id: string;
  event_id: string;
  owner_user_id: string;
  order_id: string | null;
  created_at: string;
};

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  email?: string | null;
  phone?: string | null;
};

type ContactRow = {
  name: string;
  email: string;
  phone?: string;
  tickets: number;
  events: string[];
  firstSeen: string;
  lastActivity: string;
  consentStatus: 'unknown' | 'granted' | 'missing';
};

const EXPORT_MODE_LABELS: Record<ExportMode, string> = {
  attendees: 'Attendee / Check-in list',
  orders: 'Orders & purchasers',
  subscribers: 'Marketing subscribers',
  combined: 'Combined master list',
};

const CONSENT_HELPERS: Record<ExportMode, string> = {
  attendees: 'Pulls everyone who has a ticket and can be used for on-site coordination.',
  orders: 'One row per order so you can reconcile purchases or refunds quickly.',
  subscribers: 'Only people who opted into marketing updates during checkout.',
  combined: 'Builds a deduped master list across every selected event.',
};

const HOW_TO_STEPS: Array<{ title: string; points: string[] }> = [
  {
    title: 'Export attendee or order reports',
    points: [
      'Open the event in Eventbrite, then go to Manage attendees → Attendees or Orders.',
      'Use the Export button to download CSV or XLSX and choose the columns you need.',
      'The file includes attendee name, email, ticket type, purchase date, and more.',
    ],
  },
  {
    title: 'Combine multiple events',
    points: [
      'In Eventbrite Reporting you can select multiple events and export a single combined report.',
      'After downloading, use this tool to dedupe on email or attendee ID so one person only appears once.',
    ],
  },
  {
    title: 'Subscribers & purchasers lists',
    points: [
      'Inside Eventbrite’s Email Campaigns you can export “Subscribers” or “Purchasers” as CSV.',
      'Only send marketing to contacts who explicitly opted in or have an existing customer relationship.',
    ],
  },
  {
    title: 'Automate with integrations',
    points: [
      'Connect Eventbrite to CRMs, Google Sheets, or marketing tools with Zapier or native integrations.',
      'Use automation for real-time syncing and then manage compliance with unsubscribe preferences.',
    ],
  },
];

export function OrgContactExportPanel({ organizationId }: OrgContactExportPanelProps) {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>('combined');
  const [respectConsent, setRespectConsent] = useState(true);
  const [dedupeKey, setDedupeKey] = useState<'email' | 'user'>('email');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastPrepared, setLastPrepared] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events.events')
        .select('id,title,start_at')
        .eq('owner_context_id', organizationId)
        .order('start_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Failed to load organization events', error);
        toast({
          title: 'Could not load events',
          description: 'We were unable to load events for this organization.',
          variant: 'destructive',
        });
        return;
      }

      setEvents(data ?? []);
    };

    fetchEvents();
  }, [organizationId, toast]);

  const eventMap = useMemo(() => new Map(events.map((evt) => [evt.id, evt])), [events]);

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const selectAllEvents = () => {
    if (selectedEvents.length === events.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(events.map((evt) => evt.id));
    }
  };

  const prepareExport = async () => {
    if (!selectedEvents.length) {
      toast({
        title: 'Select at least one event',
        description: 'Choose the events you want to include in the export before continuing.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: ticketRows, error: ticketError } = await supabase
        .from('ticketing.tickets')
        .select('id,event_id,owner_user_id,order_id,created_at')
        .in('event_id', selectedEvents);

      if (ticketError) {
        throw ticketError;
      }

      const tickets = (ticketRows ?? []) as TicketRow[];
      if (!tickets.length) {
        setContacts([]);
        toast({
          title: 'No attendees found',
          description: 'We did not find any tickets for the selected events yet.',
        });
        return;
      }

      const userIds = Array.from(new Set(tickets.map((row) => row.owner_user_id).filter(Boolean)));

      const { data: profileRows, error: profileError } = await supabase
        .from('users.user_profiles')
        .select('user_id,display_name,email,phone')
        .in('user_id', userIds);

      if (profileError) {
        throw profileError;
      }

      const profileMap = new Map(
        (profileRows as UserProfileRow[] | null)?.map((profile) => [profile.user_id, profile]) ?? []
      );

      const contactMap = new Map<string, ContactRow>();

      for (const ticket of tickets) {
        const profile = profileMap.get(ticket.owner_user_id);
        const dedupeValue = dedupeKey === 'email'
          ? (profile?.email?.toLowerCase().trim() || `user:${ticket.owner_user_id}`)
          : ticket.owner_user_id;

        const existing = contactMap.get(dedupeValue);
        const eventName = eventMap.get(ticket.event_id)?.title ?? 'Event';
        const createdAt = ticket.created_at;
        const consentStatus: ContactRow['consentStatus'] = respectConsent
          ? exportMode === 'subscribers'
            ? 'unknown'
            : 'granted'
          : 'missing';

        if (existing) {
          const eventsSet = new Set(existing.events);
          eventsSet.add(eventName);
          contactMap.set(dedupeValue, {
            ...existing,
            tickets: existing.tickets + 1,
            events: Array.from(eventsSet),
            lastActivity: existing.lastActivity > createdAt ? existing.lastActivity : createdAt,
            consentStatus:
              existing.consentStatus === 'unknown' || consentStatus === 'unknown'
                ? 'unknown'
                : consentStatus,
          });
        } else {
          contactMap.set(dedupeValue, {
            name: profile?.display_name || 'Attendee',
            email: profile?.email || 'Not provided',
            phone: profile?.phone ?? undefined,
            tickets: 1,
            events: [eventName],
            firstSeen: createdAt,
            lastActivity: createdAt,
            consentStatus,
          });
        }
      }

      const rows = Array.from(contactMap.values()).map((row) => ({
        ...row,
        events: Array.from(new Set(row.events)),
      }));

      setContacts(rows);
      setLastPrepared(new Date().toISOString());
      toast({
        title: 'Export ready',
        description: `Prepared ${rows.length} contacts across ${selectedEvents.length} event(s).`,
      });
    } catch (error: any) {
      console.error('Failed to prepare contact export', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Unable to build contact export right now.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!contacts.length) {
      toast({
        title: 'Prepare the export first',
        description: 'Run “Prepare export” before attempting to download the file.',
      });
      return;
    }

    const header = [
      'Name',
      'Email',
      'Phone',
      'Total Tickets',
      'Events',
      'First Seen',
      'Last Activity',
      'Consent Status',
    ];

    const lines = contacts.map((row) => [
      row.name,
      row.email,
      row.phone ?? '',
      String(row.tickets),
      row.events.join(' | '),
      row.firstSeen,
      row.lastActivity,
      row.consentStatus,
    ]);

    const csv = [header, ...lines]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const modeLabel = EXPORT_MODE_LABELS[exportMode].replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.download = `${modeLabel}-contacts.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact exports
            </CardTitle>
            <CardDescription>
              Build deduped attendee, purchaser, or subscriber lists directly from your YardPass data
              and follow Eventbrite’s export best practices.
            </CardDescription>
          </div>
          <Badge variant="outline" className="whitespace-nowrap">
            {contacts.length ? `${contacts.length} contacts ready` : 'No export prepared yet'}
          </Badge>
        </div>
        {lastPrepared && (
          <p className="text-xs text-muted-foreground">
            Last prepared {new Date(lastPrepared).toLocaleString()} • Mode: {EXPORT_MODE_LABELS[exportMode]}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Events to include</Label>
              <Button variant="ghost" size="sm" onClick={selectAllEvents}>
                {selectedEvents.length === events.length ? 'Clear all' : 'Select all'}
              </Button>
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-3 space-y-3">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events found for this organization yet.</p>
                ) : (
                  events.map((evt) => {
                    const checked = selectedEvents.includes(evt.id);
                    return (
                      <label key={evt.id} className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition">
                        <Checkbox checked={checked} onCheckedChange={() => toggleEventSelection(evt.id)} />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{evt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {evt.start_at ? new Date(evt.start_at).toLocaleString() : 'Date TBD'}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-mode">Export type</Label>
              <Select value={exportMode} onValueChange={(value) => setExportMode(value as ExportMode)}>
                <SelectTrigger id="export-mode">
                  <SelectValue placeholder="Choose export type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined">Combined master list</SelectItem>
                  <SelectItem value="attendees">Attendees</SelectItem>
                  <SelectItem value="orders">Orders / purchasers</SelectItem>
                  <SelectItem value="subscribers">Subscribers</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{CONSENT_HELPERS[exportMode]}</p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Dedupe by email</Label>
                <p className="text-xs text-muted-foreground">Ensures repeat attendees only appear once.</p>
              </div>
              <Switch
                checked={dedupeKey === 'email'}
                onCheckedChange={(checked) => setDedupeKey(Boolean(checked) ? 'email' : 'user')}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Respect marketing consent</Label>
                <p className="text-xs text-muted-foreground">
                  Disable this if you only need operational messages like arrival instructions.
                </p>
              </div>
              <Switch checked={respectConsent} onCheckedChange={(checked) => setRespectConsent(Boolean(checked))} />
            </div>

            <div className="flex gap-2">
              <Button onClick={prepareExport} className="flex-1" disabled={isLoading}>
                <ListChecks className="mr-2 h-4 w-4" />
                {isLoading ? 'Preparing…' : 'Prepare export'}
              </Button>
              <Button onClick={downloadCsv} variant="secondary" className="flex-1" disabled={isLoading}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          {HOW_TO_STEPS.map((step) => (
            <div key={step.title} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">{step.title}</p>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                {step.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
