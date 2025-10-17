// src/components/OrganizerCommsPanel.tsx
import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useMessaging } from '@/hooks/useMessaging';
import { toast } from '@/hooks/use-toast';
import { MessageChannel, RoleType, ROLES, ROLE_MATRIX } from '@/types/roles';
import { supabase } from '@/integrations/supabase/client';
import {
  Mail, MessageSquare, Users, Send, Clock, Beaker, RefreshCw, TestTube2,
  Sparkles, Wand2, Volume2, Scissors, Expand, ShieldCheck, CheckCheck, ListChecks,
  Eye, ChevronRight, ChevronLeft, ListPlus
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* --------------------------- helpers & types --------------------------- */

interface OrganizerCommsPanelProps {
  eventId: string;
}

const smsLength = (text: string) => {
  const len = text?.length ?? 0;
  const segments = Math.ceil(len / 160) || 1;
  return { len, segments };
};

type AiResult = {
  text?: string;
  variants?: { text: string; score?: number }[];
  insights?: string;
};

type Step = 1 | 2 | 3 | 4;

/* --------------------------- templates catalog -------------------------- */

type ContactListSummary = {
  id: string;
  name: string;
  contact_count: number;
};

// 🧩 Available merge tags in YardPass:
// {{first_name}} {{event_title}} {{event_date}} {{event_time}} {{venue}} {{city}} {{country}}
// {{org_name}} {{support_email}} {{ticket_portal_url}} {{event_description}} {{cover_image_url}}
// {{order_lookup_url}} (for ticket access)

type TemplateKey = 
  | 'general'
  | 'reminder'
  | 'change'
  | 'thanks'
  | 'volunteer'
  | 'weather'
  | 'announcement'
  | 'ticket_info'
  | 'last_call_sales'
  | 'upsell_vip'
  | 'door_time_update'
  | 'parking_info'
  | 'accessibility_info'
  | 'sponsor_spotlight'
  | 'merch_promo'
  | 'health_safety'
  | 'lost_and_found'
  | 'afterparty'
  | 'livestream'
  | 'cancellation_refund'
  | 'apology_service_disruption'
  | 'code_of_conduct'
  | 'vendor_checkin'
  | 'press_media'
  | 'vip_concierge'
  | 'survey_nps';

const TEMPLATES: Record<TemplateKey, {
  label: string;
  email: { subject: string; preheader?: string; body: string };
  sms: { body: string };
}> = {
  /* --------------------------- General / Core --------------------------- */
  general: {
    label: 'General update',
    email: {
      subject: '{{event_title}} — quick update',
      preheader: 'Details inside for {{event_date}}.',
      body:
        `Hi {{first_name}},\n\n` +
        `Here's a quick update for {{event_title}} on {{event_date}}.\n\n` +
        `• Time: {{event_time}}\n` +
        `• Venue: {{venue}}, {{city}}\n` +
        `• Tickets & info: {{ticket_portal_url}}\n\n` +
        `Need help? Reply to this email or reach us at {{support_email}}.\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Update: {{event_title}} {{event_date}} @ {{event_time}} — {{venue}}, {{city}}. Info: {{ticket_portal_url}}`
    }
  },

  reminder: {
    label: 'Reminder',
    email: {
      subject: 'Reminder: {{event_title}} is on {{event_date}}',
      preheader: 'Quick heads-up with details inside.',
      body:
        `Hi {{first_name}},\n\n` +
        `Friendly reminder that {{event_title}} is on {{event_date}}.\n\n` +
        `• Location: {{venue}}, {{city}}\n` +
        `• Time: {{event_time}}\n` +
        `• Your tickets: {{order_lookup_url}}\n\n` +
        `See you there!\n— {{org_name}}`
    },
    sms: {
      body: `Reminder: {{event_title}} {{event_date}} @ {{event_time}}, {{venue}}, {{city}}. Tix: {{order_lookup_url}}`
    }
  },

  change: {
    label: 'Last-minute change',
    email: {
      subject: 'Updated info for {{event_title}} ({{event_date}})',
      preheader: 'Please read—time/location update.',
      body:
        `Hi {{first_name}},\n\n` +
        `We have an update for {{event_title}} on {{event_date}}.\n\n` +
        `• New time: {{event_time}}\n` +
        `• New location: {{venue}}, {{city}}\n` +
        `Full details: {{ticket_portal_url}}\n\n` +
        `Thanks for your flexibility.\n— {{org_name}}`
    },
    sms: {
      body: `Update: {{event_title}} {{event_date}} — new time/location. Details: {{ticket_portal_url}}`
    }
  },

  thanks: {
    label: 'Thanks / Follow-up',
    email: {
      subject: 'Thank you for joining {{event_title}}!',
      preheader: 'Quick recap and next steps.',
      body:
        `Hi {{first_name}},\n\n` +
        `Thanks for being part of {{event_title}} on {{event_date}}!\n\n` +
        `• Share feedback (2 mins): [Your survey link]\n` +
        `• Photos & recap: {{ticket_portal_url}}\n\n` +
        `Until next time,\n— {{org_name}}`
    },
    sms: {
      body: `Thanks for joining {{event_title}}! Got 2 mins for feedback? [Your survey link]`
    }
  },

  announcement: {
    label: 'New show / lineup announcement',
    email: {
      subject: 'Just announced: {{event_title}} — on sale now',
      preheader: 'Presale info and details inside.',
      body:
        `Hi {{first_name}},\n\n` +
        `We're excited to announce {{event_title}} on {{event_date}} at {{venue}}, {{city}}.\n\n` +
        `• Start time: {{event_time}}\n` +
        `• Get tickets: {{ticket_portal_url}}\n` +
        `• Venue: {{venue}}, {{city}}\n\n` +
        `See you there!\n— {{org_name}}`
    },
    sms: {
      body: `New: {{event_title}} @ {{venue}}, {{city}} on {{event_date}}. Tix: {{ticket_portal_url}}`
    }
  },

  ticket_info: {
    label: 'Ticket info / delivery',
    email: {
      subject: 'Your tickets for {{event_title}}',
      preheader: 'Access your tickets and arrival info.',
      body:
        `Hi {{first_name}},\n\n` +
        `Your tickets for {{event_title}} on {{event_date}} are ready.\n\n` +
        `• Access tickets: {{order_lookup_url}}\n` +
        `• Show time: {{event_time}}\n` +
        `• Venue: {{venue}}, {{city}}\n\n` +
        `Questions? {{support_email}}.\n— {{org_name}}`
    },
    sms: {
      body: `Tickets ready: {{event_title}}. Access: {{order_lookup_url}} • Show {{event_time}} • {{venue}}, {{city}}`
    }
  },

  last_call_sales: {
    label: 'Last call (sales push)',
    email: {
      subject: 'Last call: limited tickets for {{event_title}}',
      preheader: 'Hurry—only a few left.',
      body:
        `Hi {{first_name}},\n\n` +
        `We're almost sold out for {{event_title}} on {{event_date}}.\n\n` +
        `Grab your spot now: {{ticket_portal_url}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Last call: limited tickets for {{event_title}} — {{ticket_portal_url}}`
    }
  },

  upsell_vip: {
    label: 'Upsell VIP / add-ons',
    email: {
      subject: 'Upgrade to VIP for {{event_title}}',
      preheader: 'Early entry, lounge, and perks.',
      body:
        `Hi {{first_name}},\n\n` +
        `Enhance your {{event_title}} experience:\n\n` +
        `• VIP early entry\n` +
        `• Lounge access & merch\n` +
        `Upgrade here: {{ticket_portal_url}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Upgrade to VIP for {{event_title}}: early entry + perks → {{ticket_portal_url}}`
    }
  },

  door_time_update: {
    label: 'Door time update',
    email: {
      subject: 'Door time for {{event_title}}',
      preheader: 'New door time and arrival info.',
      body:
        `Hi {{first_name}},\n\n` +
        `Doors open at [door time] for {{event_title}}.\n` +
        `Show starts {{event_time}}. Venue: {{venue}}, {{city}}.\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Update: doors [door time] for {{event_title}} (show {{event_time}}). {{venue}}, {{city}}`
    }
  },

  parking_info: {
    label: 'Parking & transit',
    email: {
      subject: 'Parking & transit for {{event_title}}',
      preheader: 'Best routes and lots for smooth arrival.',
      body:
        `Hi {{first_name}},\n\n` +
        `Plan your arrival to {{venue}}, {{city}}:\n` +
        `• Parking: [Your parking info]\n` +
        `• Rideshare: [Drop-off zone]\n` +
        `• Public transit: [Transit options]\n\n` +
        `Travel safe,\n— {{org_name}}`
    },
    sms: {
      body: `Parking/transit for {{event_title}} at {{venue}}, {{city}}: [Your parking info]`
    }
  },

  accessibility_info: {
    label: 'Accessibility info',
    email: {
      subject: 'Accessibility for {{event_title}}',
      preheader: 'Seating, entry, and assistance.',
      body:
        `Hi {{first_name}},\n\n` +
        `Accessibility resources for {{event_title}}:\n` +
        `• Entry & seating: [Your accessibility info]\n` +
        `• Assistance contact: {{support_email}}\n\n` +
        `We're here to help,\n— {{org_name}}`
    },
    sms: {
      body: `Accessibility info for {{event_title}}: [Your accessibility info] • Help: {{support_email}}`
    }
  },

  sponsor_spotlight: {
    label: 'Sponsor spotlight',
    email: {
      subject: 'Thanks to our partners at {{event_title}}',
      preheader: 'Exclusive perks inside.',
      body:
        `Hi {{first_name}},\n\n` +
        `Shoutout to our partners making {{event_title}} possible.\n` +
        `Perks and offers: {{ticket_portal_url}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Perks from our partners at {{event_title}} → {{ticket_portal_url}}`
    }
  },

  merch_promo: {
    label: 'Merch promo',
    email: {
      subject: '{{event_title}} merch — limited run',
      preheader: 'Preorder now, pickup at show.',
      body:
        `Hi {{first_name}},\n\n` +
        `Limited-run merch for {{event_title}} is live.\n` +
        `Preorder and pickup at the venue: {{ticket_portal_url}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Limited merch for {{event_title}} — preorder: {{ticket_portal_url}}`
    }
  },

  health_safety: {
    label: 'Health & safety',
    email: {
      subject: 'Health & safety for {{event_title}}',
      preheader: 'What to know before you go.',
      body:
        `Hi {{first_name}},\n\n` +
        `Please review our health & safety guidance for {{event_title}}:\n` +
        `Details: [Your health & safety info]\n\n` +
        `Thanks for helping keep everyone safe,\n— {{org_name}}`
    },
    sms: {
      body: `Health & safety info for {{event_title}}: [Your health & safety info]`
    }
  },

  lost_and_found: {
    label: 'Lost & found',
    email: {
      subject: 'Lost something at {{event_title}}?',
      preheader: 'How to check and claim items.',
      body:
        `Hi {{first_name}},\n\n` +
        `Lost something at {{event_title}}? Report or check here: [Your lost & found info]\n` +
        `Support: {{support_email}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Lost something at {{event_title}}? Help: [Your lost & found info]`
    }
  },

  afterparty: {
    label: 'Afterparty details',
    email: {
      subject: 'Afterparty for {{event_title}}',
      preheader: 'Location and start time inside.',
      body:
        `Hi {{first_name}},\n\n` +
        `Keep the night going! Afterparty at [afterparty location] after the show.\n` +
        `Details & RSVP: {{ticket_portal_url}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Afterparty for {{event_title}} → [afterparty location]. Info: {{ticket_portal_url}}`
    }
  },

  livestream: {
    label: 'Livestream access',
    email: {
      subject: 'Your livestream for {{event_title}}',
      preheader: 'Access link and start time.',
      body:
        `Hi {{first_name}},\n\n` +
        `Watch {{event_title}} live: [Your livestream URL]\n` +
        `Goes live at {{event_time}} ({{event_date}}).\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Livestream: {{event_title}} starts {{event_time}}. Link: [Your livestream URL]`
    }
  },

  cancellation_refund: {
    label: 'Cancellation & refunds',
    email: {
      subject: '{{event_title}} — cancellation & refunds',
      preheader: 'How to request your refund.',
      body:
        `Hi {{first_name}},\n\n` +
        `We're sorry to share that {{event_title}} on {{event_date}} has been canceled.\n\n` +
        `Refund process: {{order_lookup_url}}\n` +
        `Questions: {{support_email}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `{{event_title}} canceled. Refund info: {{order_lookup_url}}`
    }
  },

  apology_service_disruption: {
    label: 'Apology / service disruption',
    email: {
      subject: 'Apologies for the issue at {{event_title}}',
      preheader: 'What happened and what we\'re doing next.',
      body:
        `Hi {{first_name}},\n\n` +
        `We apologize for the disruption at {{event_title}}.\n` +
        `What happened & make-good: [Your explanation]\n` +
        `We appreciate your support.\n— {{org_name}}`
    },
    sms: {
      body: `Apologies for the disruption at {{event_title}}. Details: [Your explanation]`
    }
  },

  code_of_conduct: {
    label: 'Code of conduct',
    email: {
      subject: 'Code of conduct for {{event_title}}',
      preheader: 'Help us create a great experience.',
      body:
        `Hi {{first_name}},\n\n` +
        `Please review our code of conduct before {{event_title}}: [Your code of conduct]\n\n` +
        `Thank you,\n— {{org_name}}`
    },
    sms: {
      body: `Code of conduct for {{event_title}}: [Your code of conduct]`
    }
  },

  weather: {
    label: 'Weather delay',
    email: {
      subject: 'Weather update for {{event_title}} ({{event_date}})',
      preheader: 'Start time adjusted due to weather.',
      body:
        `Hi {{first_name}},\n\n` +
        `Due to weather, {{event_title}} on {{event_date}} will start later.\n\n` +
        `New start time: {{event_time}}\n` +
        `We'll keep you posted. Full plan: [Your weather plan]\n— {{org_name}}`
    },
    sms: {
      body: `Weather: {{event_title}} delayed. New start {{event_time}}. Plan: [Your weather plan]`
    }
  },

  /* --------------------------- Ops / Backstage -------------------------- */
  volunteer: {
    label: 'Volunteer call',
    email: {
      subject: 'Lend a hand at {{event_title}}?',
      preheader: 'We could use your help—quick shifts available.',
      body:
        `Hi {{first_name}},\n\n` +
        `We're looking for volunteers for {{event_title}} on {{event_date}}.\n\n` +
        `Roles: check-in, ushers, scanners.\n` +
        `Shifts: 1–2 hours. Sign-up: [Your volunteer signup]\n\n` +
        `Thank you!\n— {{org_name}}`
    },
    sms: {
      body: `Can you volunteer for {{event_title}} on {{event_date}}? Quick shifts → [Your volunteer signup]`
    }
  },

  vendor_checkin: {
    label: 'Vendor check-in & ops',
    email: {
      subject: 'Vendor check-in for {{event_title}}',
      preheader: 'Load-in times and contact info.',
      body:
        `Hi {{first_name}},\n\n` +
        `Load-in for {{event_title}} is [load-in time] at {{venue}}, {{city}}.\n` +
        `Ops details & permits: [Your vendor portal]\n` +
        `On-site contact: {{support_email}}\n\n` +
        `— {{org_name}}`
    },
    sms: {
      body: `Vendor load-in [load-in time] at {{venue}}, {{city}} for {{event_title}}. Details: [Your vendor portal]`
    }
  },

  press_media: {
    label: 'Press / media RSVP',
    email: {
      subject: 'Press RSVP for {{event_title}}',
      preheader: 'Media check-in and guidelines.',
      body:
        `Hi {{first_name}},\n\n` +
        `Media details for {{event_title}}:\n` +
        `• Check-in: [Media check-in location]\n` +
        `• Time: [Check-in time]\n` +
        `• Guidelines & assets: [Your press kit]\n\n` +
        `Questions: {{support_email}}\n— {{org_name}}`
    },
    sms: {
      body: `Press check-in [check-in time] @ [check-in location] for {{event_title}}. Details: [Your press kit]`
    }
  },

  vip_concierge: {
    label: 'VIP concierge',
    email: {
      subject: 'Your VIP details for {{event_title}}',
      preheader: 'Early entry and host contact.',
      body:
        `Hi {{first_name}},\n\n` +
        `Your VIP plan for {{event_title}}:\n` +
        `• Early entry: [VIP entry time]\n` +
        `• Lounge: {{venue}}\n` +
        `• Concierge: [Your VIP contact]\n\n` +
        `We look forward to hosting you!\n— {{org_name}}`
    },
    sms: {
      body: `VIP for {{event_title}} — early entry [VIP entry time]. Concierge: [Your VIP contact]`
    }
  },

  survey_nps: {
    label: 'Post-event survey / NPS',
    email: {
      subject: '2-minute survey for {{event_title}}',
      preheader: 'Tell us how we did.',
      body:
        `Hi {{first_name}},\n\n` +
        `We'd love your feedback on {{event_title}}. This takes ~2 minutes:\n` +
        `Survey: [Your survey link]\n\n` +
        `Thanks for helping us improve!\n— {{org_name}}`
    },
    sms: {
      body: `Quick survey for {{event_title}}: [Your survey link] (2 mins)`
    }
  }
};

/* ------------------------------ component ------------------------------ */

export function OrganizerCommsPanel({ eventId }: OrganizerCommsPanelProps) {
  const { createJob, getRecipientCount, retryJob, loading } = useMessaging();

  // core state
  const [channel, setChannel] = useState<MessageChannel>('email');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [replyTo, setReplyTo] = useState('support@yardpass.tech');
  const [segment, setSegment] = useState<'all_attendees' | 'roles' | 'import_list'>('all_attendees');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(['scanner']);
  const [selectedImportList, setSelectedImportList] = useState('');
  const [contactLists, setContactLists] = useState<ContactListSummary[]>([]);
  const [contactListsLoading, setContactListsLoading] = useState(false);

  // ui/derived
  const [audienceCount, setAudienceCount] = useState<number>(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [sendingTest, setSendingTest] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<AiResult | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();

  // template state
  const [templateKey, setTemplateKey] = useState<TemplateKey | ''>('');

  // recent messages ui
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [recentLimit, setRecentLimit] = useState(10);
  const [filterChannel, setFilterChannel] = useState<'all' | 'email' | 'sms'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'queued' | 'failed' | 'draft' | 'sending'>('all');
  const [searchSubject, setSearchSubject] = useState('');

  const [eventDetails, setEventDetails] = useState<{ title?: string; date?: string; orgId?: string | null; orgName?: string; orgSupportEmail?: string }>({});
  const currentText = useMemo(() => (channel === 'email' ? body : smsBody), [channel, body, smsBody]);
  const { len, segments } = smsLength(smsBody);

  const canProceedFromStep1 = true; // channel always chosen
  const canProceedFromStep2 = segment === 'roles'
    ? selectedRoles.length > 0
    : segment === 'import_list'
      ? !!selectedImportList && audienceCount > 0
      : audienceCount > 0;
  const canSend =
    (channel === 'email' ? !!subject.trim() && !!body.trim() : !!smsBody.trim()) &&
    audienceCount > 0 &&
    !loading &&
    !aiLoading;

  /* ---------------------------- data fetching --------------------------- */

  // Audience count (debounced)
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (segment === 'import_list') {
        if (!selectedImportList) {
          if (!ignore) setAudienceCount(0);
          return;
        }
        const count = await getRecipientCount(eventId, { type: 'import_list', listId: selectedImportList });
        if (!ignore) setAudienceCount(count);
        return;
      }
      const payload = segment === 'all_attendees'
        ? { type: 'all_attendees' as const }
        : { type: 'roles' as const, roles: selectedRoles };
      const count = await getRecipientCount(eventId, payload);
      if (!ignore) setAudienceCount(count);
    };
    const id = setTimeout(run, 250); // gentle debounce for UX
    return () => { ignore = true; clearTimeout(id); };
  }, [eventId, segment, selectedRoles, selectedImportList, getRecipientCount]);

  // Event details
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('title,start_at,owner_context_type,owner_context_id')
        .eq('id', eventId)
        .single();
      if (data) {
        const orgId = data.owner_context_type === 'organization' ? data.owner_context_id : null;
        let orgName = 'YardPass Demo Events'; // Default fallback
        let orgSupportEmail = 'support@yardpass.tech';
        
        // Fetch organization data if event is owned by an organization
        if (orgId) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name, support_email')
            .eq('id', orgId)
            .single();
          
          if (orgData) {
            orgName = orgData.name;
            orgSupportEmail = orgData.support_email || 'support@yardpass.tech';
          }
        }
        
        setEventDetails({
          title: data.title,
          date: data.start_at ? new Date(data.start_at).toLocaleDateString() : undefined,
          orgId,
          orgName,
          orgSupportEmail
        });
      }
    })();
  }, [eventId]);

  useEffect(() => {
    const loadLists = async () => {
      if (!eventDetails.orgId) {
        setContactLists([]);
        setSelectedImportList('');
        return;
      }
      setContactListsLoading(true);
      const { data, error } = await supabase
        .from('org_contact_imports')
        .select('id,name,org_contact_import_entries(count)')
        .eq('org_id', eventDetails.orgId)
        .order('imported_at', { ascending: false });
      if (!error) {
        const mapped = (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          contact_count: row.org_contact_import_entries?.[0]?.count ?? 0,
        }));
        setContactLists(mapped);
        if (mapped.length && !selectedImportList) {
          setSelectedImportList(mapped[0].id);
        }
      }
      setContactListsLoading(false);
    };
    loadLists();
  }, [eventDetails.orgId, selectedImportList]);

  // Recent jobs
  const refreshRecent = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_jobs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(recentLimit);
    if (!error) setRecentJobs(data || []);
  }, [eventId, recentLimit]);
  useEffect(() => { refreshRecent(); }, [refreshRecent]);

  // Derived, filtered view
  const recentJobsFiltered = useMemo(() => {
    return (recentJobs || []).filter(j => {
      const channelOk = filterChannel === 'all' || j.channel === filterChannel;
      const statusOk = filterStatus === 'all' || j.status === filterStatus;
      const searchOk = !searchSubject.trim() || (j.subject || 'SMS Message').toLowerCase().includes(searchSubject.toLowerCase());
      return channelOk && statusOk && searchOk;
    });
  }, [recentJobs, filterChannel, filterStatus, searchSubject]);

  /* ------------------------------- actions ------------------------------ */

  const resetComposer = () => {
    setSubject('');
    setPreheader('');
    setBody('');
    setSmsBody('');
    setReplyTo('support@yardpass.tech');
    setAiOutput(null);
    setSegment('all_attendees');
    setSelectedRoles(['scanner']);
    setSelectedImportList(contactLists[0]?.id ?? '');
    setAudienceCount(0);
    setStep(1);
  };

  async function send(dryRun = false) {
    if (channel === 'email' && !subject.trim()) {
      toast({ title: 'Add a subject', description: 'Email subject is required.', variant: 'destructive' });
      setStep(3);
      return;
    }
    if (!body.trim() && !smsBody.trim()) {
      toast({ title: 'Write a message', description: 'Message body is required.', variant: 'destructive' });
      setStep(3);
      return;
    }
    if (!dryRun && audienceCount === 0) {
      toast({ title: 'No recipients found', description: 'Pick a different audience or roles.', variant: 'destructive' });
      setStep(2);
      return;
    }

    if (segment === 'import_list' && !selectedImportList) {
      toast({ title: 'Choose a list', description: 'Select an imported contact list to continue.', variant: 'destructive' });
      setStep(2);
      return;
    }

    const segmentPayload =
      segment === 'all_attendees'
        ? { type: 'all_attendees' as const }
        : segment === 'roles'
          ? { type: 'roles' as const, roles: selectedRoles }
          : { type: 'import_list' as const, listId: selectedImportList };

    const jobRes = await createJob({
      eventId,
      orgId: eventDetails.orgId ?? undefined,
      channel,
      subject,
      body: preheader ? `<!-- preheader: ${preheader} -->\n${body}` : body,
      smsBody,
      fromName: 'YardPass',
      fromEmail: 'noreply@yardpass.tech',
      replyTo,
      segment: segmentPayload,
      dryRun,
    });

    if (dryRun) {
      toast({
        title: 'Dry run ready',
        description: `${jobRes.recipientCount} recipient${jobRes.recipientCount === 1 ? '' : 's'} would be targeted.`,
      });
      setStep(4);
      return;
    }

    toast({
      title: 'Queued',
      description: `Your ${channel} will be sent to ${jobRes.recipientCount} recipient${jobRes.recipientCount === 1 ? '' : 's'}.`,
    });
    resetComposer();
    await refreshRecent();
    setMessagesOpen(true);
  }

  async function retry(jobId: string) {
    try {
      await retryJob(jobId);
      toast({ title: 'Re-queued', description: 'Processing started.' });
      await refreshRecent();
    } catch (e: any) {
      toast({ title: 'Failed to re-queue', description: e.message || 'Please try again.', variant: 'destructive' });
    }
  }

  async function sendTestToMe() {
    setSendingTest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email && channel === 'email') {
        toast({ title: 'Your account has no email', variant: 'destructive' });
        return;
      }

      // Save a draft-only job for parity
      await createJob({
        eventId,
        orgId: eventDetails.orgId ?? undefined,
        channel,
        subject: channel === 'email' ? (subject || 'Test Message') : undefined,
        body: preheader ? `<!-- preheader: ${preheader} -->\n${body}` : body,
        smsBody,
        fromName: 'YardPass',
        fromEmail: 'noreply@yardpass.tech',
        replyTo,
        segment: { type: 'roles', roles: [] },
        dryRun: true,
      });

      if (channel === 'email') {
        const html = (preheader ? `<!-- preheader: ${preheader} -->\n` : '') + (body || `Test email for {{event_title}} on {{event_date}}`);
        const { error } = await supabase.functions.invoke('send-email', {
          body: { to: user!.email, subject: subject || 'Test Message', html }
        });
        if (error) throw new Error(error.message);
      } else {
        toast({ title: 'Tip', description: 'Use a test phone via queue or Twilio console.' });
      }
      toast({ title: 'Test sent' });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  }

  /* ------------------------------ AI actions --------------------------- */

  async function callAI(action: string, opt?: { tone?: string; maxWords?: number }) {
    setAiLoading(true);
    setAiOutput(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-writing-assistant', {
        body: {
          action,
          text:
            action === 'generate_subject' || action === 'subject_variants' || action === 'generate_preheader'
              ? (body || smsBody || `Reminder for ${eventDetails.title || 'your event'}`)
              : currentText,
          eventTitle: eventDetails.title,
          eventDate: eventDetails.date,
          tone: opt?.tone,
          messageType: channel,
          audience: segment === 'all_attendees' ? 'all attendees' : selectedRoles.map(r => ROLE_MATRIX[r].label).join(', '),
          maxWords: opt?.maxWords,
        }
      });
      if (error) throw new Error(error.message);
      setAiOutput(data as AiResult);
      return data as AiResult;
    } catch (e: any) {
      toast({ title: 'AI request failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  const aiGenerateSubject = () => callAI('generate_subject');
  const aiSubjectVariants = () => callAI('subject_variants');
  const aiPreheader = () => callAI('generate_preheader');
  const aiImprove = () => callAI('improve');
  const aiTone = (tone: string) => callAI('adjust_tone', { tone });
  const aiShorten = () => callAI('shorten', { maxWords: channel === 'sms' ? 24 : 100 });
  const aiExpand = () => callAI('expand');
  const aiCTAs = () => callAI('suggest_cta');
  const aiSpam = () => callAI('optimize_for_spam');
  const aiGrammar = () => callAI('grammar_check');

  function applyToBody(t?: string) { if (!t) return; channel === 'email' ? setBody(t) : setSmsBody(t); }
  function applySubject(t?: string) { if (!t) return; setSubject(t); }
  function applyPreheader(t?: string) { if (!t) return; setPreheader(t); }

  const applyTemplate = (mode: 'replace' | 'append') => {
    if (!templateKey) return;
    const tpl = TEMPLATES[templateKey];

    if (channel === 'email') {
      if (mode === 'replace') {
        setSubject(tpl.email.subject || '');
        setPreheader(tpl.email.preheader || '');
        setBody(tpl.email.body || '');
      } else {
        setSubject(prev => prev || tpl.email.subject || '');
        setPreheader(prev => prev || tpl.email.preheader || '');
        setBody(prev => (prev ? `${prev}\n\n${tpl.email.body}` : tpl.email.body || ''));
      }
    } else {
      // SMS
      if (mode === 'replace') {
        setSmsBody(tpl.sms.body || '');
      } else {
        setSmsBody(prev => (prev ? `${prev}\n${tpl.sms.body}` : tpl.sms.body || ''));
      }
    }
    toast({ title: mode === 'replace' ? 'Template applied' : 'Template appended' });
  };

  /* ------------------------------ sub-views ----------------------------- */

  const Stepper = () => (
    <div className="flex items-center gap-2 text-sm">
      {[
        { n: 1, label: 'Channel' },
        { n: 2, label: 'Audience' },
        { n: 3, label: 'Content' },
        { n: 4, label: 'Review & Send' },
      ].map(({ n, label }) => {
        const active = step === (n as Step);
        const done = step > (n as Step);
        return (
          <div key={n} className={cn("flex items-center gap-2", n !== 1 && "opacity-90")}>
            {n !== 1 && <Separator orientation="vertical" className="h-5" />}
            <Badge variant={active ? "default" : done ? "secondary" : "outline"}>
              {n}. {label}
            </Badge>
          </div>
        );
      })}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-4 h-4" />
        {isPending ? 'Counting…' : `Recipients: ${audienceCount}`}
      </div>
    </div>
  );

  const ChannelStep = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="channel-select">Channel</Label>
        <Select value={channel} onValueChange={(v: MessageChannel) => setChannel(v)}>
          <SelectTrigger id="channel-select"><SelectValue placeholder="Select channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</div></SelectItem>
            <SelectItem value="sms"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> SMS</div></SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-3 bg-muted/50 rounded-lg text-sm">
        <div className="font-medium mb-1">Tip</div>
        <div>Email supports subject, preheader, and rich content. SMS is best for short, time-sensitive reminders.</div>
      </div>
    </div>
  );

  const AudienceStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="audience-select">Audience</Label>
          <Select
            value={segment}
            onValueChange={(v: 'all_attendees' | 'roles' | 'import_list') => {
              setSegment(v);
              if (v !== 'import_list') {
                setSelectedImportList('');
              }
            }}
          >
            <SelectTrigger id="audience-select"><SelectValue placeholder="Select audience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_attendees"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> All Attendees</div></SelectItem>
              <SelectItem value="roles"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Specific Roles</div></SelectItem>
              <SelectItem value="import_list"><div className="flex items-center gap-2"><ListPlus className="h-4 w-4" /> Imported List</div></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          {segment === 'all_attendees' && <div>Includes all ticket holders for this event.</div>}
          {segment === 'roles' && <div>Choose one or more roles below.</div>}
          {segment === 'import_list' && (
            <div>
              Use CSV lists imported from your organization settings. Perfect for VIPs, sponsors, or past attendees.
            </div>
          )}
        </div>
      </div>

      {segment === 'roles' && (
        <div>
          <Label>Select Roles</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {ROLES.map(role => (
              <Badge
                key={role}
                variant={selectedRoles.includes(role) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  setSelectedRoles(prev =>
                    prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                  )
                }
              >
                {ROLE_MATRIX[role].label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {segment === 'import_list' && (
        <div className="grid gap-2">
          <Label htmlFor="import-list-select">Imported list</Label>
          <Select
            value={selectedImportList || undefined}
            onValueChange={(value) => setSelectedImportList(value)}
            disabled={contactListsLoading || !contactLists.length}
          >
            <SelectTrigger id="import-list-select">
              <SelectValue placeholder={contactListsLoading ? 'Loading lists…' : 'Select imported list'} />
            </SelectTrigger>
            <SelectContent>
              {contactLists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name} ({list.contact_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!contactListsLoading && !contactLists.length && (
            <p className="text-xs text-muted-foreground">
              No imported lists yet. Add CSVs from your organization settings to target them here.
            </p>
          )}
        </div>
      )}
    </div>
  );

  const ContentStep = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Editor */}
      <div className="space-y-4">
        {/* Template picker */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex-1">
            <Label htmlFor="template-select">Template</Label>
            <Select value={templateKey} onValueChange={(v: TemplateKey | '') => setTemplateKey(v)}>
              <SelectTrigger id="template-select"><SelectValue placeholder="Choose a template (optional)" /></SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <SelectItem key={k} value={k as TemplateKey}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-6">
            <Button type="button" variant="outline" size="sm" disabled={!templateKey} onClick={() => applyTemplate('replace')}>
              Apply
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={!templateKey} onClick={() => applyTemplate('append')}>
              Append
            </Button>
          </div>
        </div>

        {channel === 'email' && (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="subject-input">Subject</Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={aiGenerateSubject} disabled={aiLoading} className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" /> AI Subject
                </Button>
                <Button variant="ghost" size="sm" onClick={aiSubjectVariants} disabled={aiLoading} className="text-xs">
                  <ListChecks className="w-3 h-3 mr-1" /> 3 Variants
                </Button>
              </div>
            </div>
            <Input id="subject-input" placeholder="Event update: {{event_title}}" value={subject} onChange={e => setSubject(e.target.value)} />

            <div className="flex items-center justify-between">
              <Label htmlFor="preheader-input">Preheader (optional)</Label>
              <Button variant="ghost" size="sm" onClick={aiPreheader} disabled={aiLoading} className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" /> AI Preheader
              </Button>
            </div>
            <Input id="preheader-input" placeholder="A short teaser that boosts opens…" value={preheader} onChange={e => setPreheader(e.target.value)} />

            <div>
              <Label htmlFor="reply-to-input">Reply-To Email</Label>
              <Input 
                id="reply-to-input" 
                type="email" 
                placeholder="support@yardpass.tech" 
                value={replyTo} 
                onChange={e => setReplyTo(e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">Recipients will reply to this address</div>
            </div>
          </>
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="body-input">{channel === 'email' ? 'Email Body' : 'SMS Message'}</Label>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={aiImprove} disabled={aiLoading || !currentText} className="text-xs">
                <Wand2 className="w-3 h-3 mr-1" /> Improve
              </Button>
              <Select onValueChange={(tone) => aiTone(tone)} disabled={aiLoading || !currentText}>
                <SelectTrigger className="w-auto h-8 text-xs">
                  <Volume2 className="w-3 h-3 mr-1" /> Tone
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={aiShorten} disabled={aiLoading || !currentText} className="text-xs">
                <Scissors className="w-3 h-3 mr-1" /> Shorten
              </Button>
              <Button variant="ghost" size="sm" onClick={aiExpand} disabled={aiLoading || !currentText} className="text-xs">
                <Expand className="w-3 h-3 mr-1" /> Expand
              </Button>
              <Button variant="ghost" size="sm" onClick={aiCTAs} disabled={aiLoading} className="text-xs">
                <CheckCheck className="w-3 h-3 mr-1" /> CTAs
              </Button>
              <Button variant="ghost" size="sm" onClick={aiSpam} disabled={aiLoading || !currentText} className="text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" /> Minimize spam
              </Button>
              <Button variant="ghost" size="sm" onClick={aiGrammar} disabled={aiLoading || !currentText} className="text-xs">
                <CheckCheck className="w-3 h-3 mr-1" /> Grammar
              </Button>
            </div>
          </div>

          <Textarea
            id="body-input"
            rows={channel === 'email' ? 10 : 5}
            value={channel === 'email' ? body : smsBody}
            onChange={e => channel === 'email' ? setBody(e.target.value) : setSmsBody(e.target.value)}
            placeholder={channel === 'email'
              ? "Hi {{first_name}},\n\nYour event {{event_title}} is on {{event_date}}.\n\nSee you there!"
              : "Hi {{first_name}}! {{event_title}} is on {{event_date}}. See you there!"}
          />
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
            <span>Variables: <code>{"{{event_title}}"}</code>, <code>{"{{event_date}}"}</code>, <code>{"{{first_name}}"}</code></span>
            {channel === 'sms' && <span>{len} chars · ~{segments} SMS segment{segments>1?'s':''}</span>}
          </div>
        </div>

        {aiLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 animate-pulse" />
            AI is crafting suggestions…
          </div>
        )}

        {/* Inline AI output, next to editor for immediate apply */}
        {aiOutput && (
          <div className="space-y-4">
            {aiOutput.text && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-600" />
                    AI Suggestion
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { applyToBody(aiOutput.text); toast({ title: 'Applied to body' }); }} className="text-xs">Apply to Body</Button>
                    {channel === 'email' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { applySubject(aiOutput.text); toast({ title: 'Subject applied' }); }} className="text-xs">Use as Subject</Button>
                        <Button size="sm" variant="ghost" onClick={() => { applyPreheader(aiOutput.text); toast({ title: 'Preheader applied' }); }} className="text-xs">Use as Preheader</Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50/50 to-blue-50/50 border-purple-200/50">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{aiOutput.text}</div>
                </div>
              </div>
            )}

            {aiOutput?.variants?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-blue-600" />
                  Alternatives
                </div>
                <div className="space-y-2">
                  {aiOutput.variants.map((v, i) => (
                    <div key={i} className="group border rounded-lg p-3 hover:border-purple-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 text-sm leading-relaxed break-words">{v.text}</div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { applyToBody(v.text); toast({ title: 'Applied to body' }); }}>Apply</Button>
                          {channel === 'email' && (
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { applySubject(v.text); toast({ title: 'Subject applied' }); }}>Subject</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {aiOutput?.insights && (
              <div className="space-y-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-amber-600" />
                  AI Insights
                </div>
                <div className="p-3 border rounded-lg bg-gradient-to-r from-amber-50/50 to-orange-50/50 border-amber-200/50">
                  <div className="text-sm text-amber-800 leading-relaxed">{aiOutput.insights}</div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setAiOutput(null)} className="text-xs text-muted-foreground">Clear AI results</Button>
            </div>
          </div>
        )}
      </div>

      {/* Live Preview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="w-4 h-4" /> Live Preview
        </div>

        {channel === 'email' ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted/50">
              <div className="text-sm font-medium truncate">{subject || '— subject —'}</div>
              <div className="text-xs text-muted-foreground truncate">{preheader || '— preheader (optional) —'}</div>
            </div>
            <div className="p-4 text-sm whitespace-pre-wrap min-h-[180px]">
              {(body || `Hi {{first_name}},\n\nYour event {{event_title}} is on {{event_date}}.\n\nSee you there!`)
                .replace(/\{\{event_title\}\}/g, eventDetails.title || 'your event')
                .replace(/\{\{event_date\}\}/g, eventDetails.date || 'your date')}
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-4 text-sm">
            {(smsBody || `Hi {{first_name}}! {{event_title}} is on {{event_date}}. See you there!`)
              .replace(/\{\{event_title\}\}/g, eventDetails.title || 'your event')
              .replace(/\{\{event_date\}\}/g, eventDetails.date || 'your date')}
            <div className="mt-3 text-xs text-muted-foreground">{len} chars · ~{segments} SMS segment{segments>1?'s':''}</div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Preview shows merge tags with your latest event details: {eventDetails.title || '—' } • {eventDetails.date || '—'}
        </div>
      </div>
    </div>
  );

  const ReviewStep = () => (
    <div className="space-y-6">
      {/* Summary & Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Summary</div>
          <div className="text-sm p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{channel.toUpperCase()}</Badge>
              <Separator orientation="vertical" className="h-4" />
              <div>Recipients: {audienceCount}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Audience: {
                segment === 'all_attendees'
                  ? 'All attendees'
                  : segment === 'roles'
                    ? selectedRoles.map(r => ROLE_MATRIX[r].label).join(', ') || '—'
                    : contactLists.find(list => list.id === selectedImportList)?.name || 'Imported list'
              }
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Quick Actions</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={sendTestToMe} disabled={sendingTest || loading || aiLoading}>
              <TestTube2 className="w-4 h-4 mr-1" /> Send test to me
            </Button>
            <Button variant="outline" onClick={() => send(true)} disabled={loading || aiLoading}>
              <Beaker className="w-4 h-4 mr-1" /> Dry run
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Message Preview */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Email Preview</div>
        <div className="border rounded-lg overflow-hidden">
          {channel === 'email' ? (
            <div className="bg-gray-50 p-4">
              {/* Email Preview Header */}
              <div className="mb-4 space-y-2">
                <div className="text-xs text-gray-600">
                  <strong>To:</strong> Your selected audience ({audienceCount} recipients)
                </div>
                <div className="text-xs text-gray-600">
                  <strong>From:</strong> noreply@yardpass.tech
                </div>
                <div className="text-xs text-gray-600">
                  <strong>Subject:</strong> {(subject || '(No subject)')
                    .replace(/\{\{event_title\}\}/g, eventDetails.title || 'your event')
                    .replace(/\{\{event_date\}\}/g, eventDetails.date || 'your date')}
                </div>
                {preheader && (
                  <div className="text-xs text-gray-500 italic">
                    Preview: {preheader
                      .replace(/\{\{event_title\}\}/g, eventDetails.title || 'your event')
                      .replace(/\{\{event_date\}\}/g, eventDetails.date || 'your date')}
                  </div>
                )}
              </div>

              {/* Actual Email Preview */}
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Email Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-7 text-center">
                  <img 
                    src="/yardpass-logo.png" 
                    alt="YardPass" 
                    className="h-16 mx-auto mb-3"
                  />
                  <div className="text-xs text-slate-400 uppercase tracking-wider">
                    Powered by YardPass
                  </div>
                </div>

                {/* Email Content */}
                <div className="px-8 py-8">
                  {/* Message Body */}
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {(body || '(No message body)')
                        .replace(/\{\{event_title\}\}/g, eventDetails.title || 'your event')
                        .replace(/\{\{event_date\}\}/g, eventDetails.date || 'your date')
                        .replace(/\{\{event_time\}\}/g, eventDetails.time || 'your time')
                        .replace(/\{\{venue\}\}/g, eventDetails.venue || 'your venue')
                        .replace(/\{\{city\}\}/g, eventDetails.city || 'your city')
                        .replace(/\{\{country\}\}/g, eventDetails.country || 'your country')
                        .replace(/\{\{event_description\}\}/g, eventDetails.description || 'your event description')
                        .replace(/\{\{cover_image_url\}\}/g, eventDetails.coverImageUrl || 'https://yardpass.tech/placeholder.jpg')
                        .replace(/\{\{first_name\}\}/g, 'John')
                        .replace(/\{\{org_name\}\}/g, eventDetails.orgName || 'YardPass Demo Events')
                        .replace(/\{\{support_email\}\}/g, eventDetails.orgSupportEmail || 'support@yardpass.tech')
                        .replace(/\{\{ticket_portal_url\}\}/g, 'https://yardpass.tech/tickets')
                        .replace(/\{\{order_lookup_url\}\}/g, 'https://yardpass.tech/tickets')}
                    </div>
                  </div>
                </div>

                {/* Email Footer */}
                <div className="bg-gray-50 px-8 py-6 text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Powered by YardPass
                  </p>
                  <p className="text-xs text-gray-500">
                    Questions? Contact{' '}
                    <a href={`mailto:${eventDetails.orgSupportEmail || 'support@yardpass.tech'}`} className="text-blue-600 hover:text-blue-700">
                      {eventDetails.orgSupportEmail || 'support@yardpass.tech'}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* SMS Preview */
            <div className="bg-gray-50 p-4">
              <div className="max-w-sm mx-auto">
                {/* SMS Header */}
                <div className="mb-4 space-y-2">
                  <div className="text-xs text-gray-600">
                    <strong>To:</strong> Your selected audience ({audienceCount} recipients)
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>From:</strong> YardPass SMS
                  </div>
                </div>

                {/* SMS Message Preview */}
                <div className="bg-green-600 text-white p-4 rounded-2xl rounded-bl-md max-w-xs">
                  <div className="text-sm leading-relaxed">
                    {(smsBody || '(No SMS message)')
                      .replace(/\{\{event_title\}\}/g, eventDetails.title || 'your event')
                      .replace(/\{\{event_date\}\}/g, eventDetails.date || 'your date')
                      .replace(/\{\{event_time\}\}/g, eventDetails.time || 'your time')
                      .replace(/\{\{venue\}\}/g, eventDetails.venue || 'your venue')
                      .replace(/\{\{city\}\}/g, eventDetails.city || 'your city')
                      .replace(/\{\{country\}\}/g, eventDetails.country || 'your country')
                      .replace(/\{\{event_description\}\}/g, eventDetails.description || 'your event description')
                      .replace(/\{\{cover_image_url\}\}/g, eventDetails.coverImageUrl || 'https://yardpass.tech/placeholder.jpg')
                      .replace(/\{\{first_name\}\}/g, 'John')
                      .replace(/\{\{org_name\}\}/g, eventDetails.orgName || 'YardPass Demo Events')
                      .replace(/\{\{support_email\}\}/g, eventDetails.orgSupportEmail || 'support@yardpass.tech')
                      .replace(/\{\{ticket_portal_url\}\}/g, 'https://yardpass.tech/tickets')
                      .replace(/\{\{order_lookup_url\}\}/g, 'https://yardpass.tech/tickets')}
                  </div>
                </div>
                
                {/* SMS Info */}
                <div className="mt-3 text-xs text-gray-500 text-center">
                  Length: {len} characters ({segments} segment{segments > 1 ? 's' : ''})
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Final Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send(false)} disabled={!canSend}>
          {loading ? 'Sending…' : `Send ${channel === 'email' ? 'Email' : 'SMS'} to ${audienceCount}`}
        </Button>
        <Button variant="outline" onClick={() => setStep(3)}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to content
        </Button>
      </div>
    </div>
  );

  /* --------------------------------- UI -------------------------------- */

  return (
    <div 
      className="space-y-6" 
      onKeyDown={(e) => { 
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
          e.preventDefault();
          setMessagesOpen(v => !v);
        }
      }} 
      tabIndex={0}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Stepper />

          {/* Step content */}
          {step === 1 && <ChannelStep />}
          {step === 2 && <AudienceStep />}
          {step === 3 && <ContentStep />}
          {step === 4 && <ReviewStep />}

          {/* Step controls */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => startTransition(() => setStep(prev => (prev > 1 ? ((prev - 1) as Step) : prev)))}
              disabled={step === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            <div className="flex items-center gap-2">
              {step < 4 && (
                <Button
                  size="sm"
                  onClick={() => startTransition(() => setStep(prev => {
                    if (prev === 1 && !canProceedFromStep1) return prev;
                    if (prev === 2 && !canProceedFromStep2) return prev;
                    return ((prev + 1) as Step);
                  }))}
                  disabled={(step === 2 && !canProceedFromStep2) || (step === 3 && !(channel === 'email' ? body.trim() || subject.trim() : smsBody.trim()))}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {step === 3 && (
                <Button variant="secondary" size="sm" onClick={() => setStep(4)}>
                  Review <Eye className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Messages (compact, collapsible) */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Messages
            <span className="text-xs text-muted-foreground">({recentJobs.length})</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshRecent}
              title="Refresh"
              className="ml-auto"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion type="single" collapsible value={messagesOpen ? 'rm' : ''} onValueChange={(v) => setMessagesOpen(v === 'rm')}>
            <AccordionItem value="rm" className="border-none">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                {messagesOpen ? 'Hide list' : 'Show list'}
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-2 mb-3">
                  <div className="min-w-[140px]">
                    <Label className="text-xs">Channel</Label>
                    <Select value={filterChannel} onValueChange={(v: any) => setFilterChannel(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[160px]">
                    <Label className="text-xs">Status</Label>
                    <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="queued">Queued</SelectItem>
                        <SelectItem value="sending">Sending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <Label className="text-xs" htmlFor="rm-search">Search subject</Label>
                    <Input 
                      id="rm-search" 
                      className="h-8 text-xs" 
                      placeholder="e.g. Reminder" 
                      value={searchSubject} 
                      onChange={e => setSearchSubject(e.target.value)} 
                    />
                  </div>
                  <div className="min-w-[120px]">
                    <Label className="text-xs">Show</Label>
                    <Select value={String(recentLimit)} onValueChange={(v) => setRecentLimit(Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Scrollable list */}
                {recentJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Your last sends will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {recentJobsFiltered.length === 0 ? (
                      <div className="text-sm text-muted-foreground px-1 py-6 text-center">
                        No messages match your filters.
                      </div>
                    ) : recentJobsFiltered.map(job => (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {job.channel === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[40ch]">{job.subject || 'SMS Message'}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(job.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs">{job.channel.toUpperCase()}</Badge>
                          <Separator orientation="vertical" className="h-4" />
                          {(() => {
                            const common = "text-xs";
                            const clickable = (label: string, cb: () => void, variant: any, extra = "") =>
                              <Badge variant={variant} className={cn(common, "cursor-pointer", extra)} onClick={cb}>{label}</Badge>;
                            switch (job.status) {
                              case 'draft': return <Badge variant="secondary" className={common}>Draft</Badge>;
                              case 'queued': return clickable('Queued (run)', () => retry(job.id), "outline", "animate-pulse border-yellow-400 text-yellow-600");
                              case 'sending': return <Badge variant="default" className={cn(common, "bg-blue-500 animate-pulse")}>Sending…</Badge>;
                              case 'sent': return <Badge variant="default" className={cn(common, "bg-green-500")}>Sent</Badge>;
                              case 'failed': return clickable('Failed (retry)', () => retry(job.id), "destructive");
                              default: return <Badge variant="secondary" className={common}>{job.status}</Badge>;
                            }
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}