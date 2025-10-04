// src/components/OrganizerCommsPanel.tsx
import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMessaging } from '@/hooks/useMessaging';
import { toast } from '@/hooks/use-toast';
import { MessageChannel, RoleType, ROLES, ROLE_MATRIX } from '@/types/roles';
import { supabase } from '@/integrations/supabase/client';
import {
  Mail, MessageSquare, Users, Send, Clock, Beaker, RefreshCw, TestTube2,
  Sparkles, Wand2, Volume2, Scissors, Expand, ShieldCheck, CheckCheck, ListChecks,
  Eye, ChevronRight, ChevronLeft
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

type TemplateKey = 'reminder' | 'change' | 'thanks' | 'volunteer' | 'weather';

const TEMPLATES: Record<TemplateKey, {
  label: string;
  email: { subject: string; preheader?: string; body: string };
  sms: { body: string };
}> = {
  reminder: {
    label: 'Reminder',
    email: {
      subject: 'Reminder: {{event_title}} is on {{event_date}}',
      preheader: 'Quick heads-up with details inside.',
      body:
        `Hi {{first_name}},\n\n` +
        `Friendly reminder that {{event_title}} is on {{event_date}}.\n\n` +
        `• Location: {{event_title}} venue\n` +
        `• Time: Doors open 30 minutes before start\n\n` +
        `See you there!\n— Team`,
    },
    sms: {
      body: `Reminder: {{event_title}} is on {{event_date}}. See you there!`,
    },
  },
  change: {
    label: 'Last-minute change',
    email: {
      subject: 'Updated info for {{event_title}} ({{event_date}})',
      preheader: 'Please read—time/location update.',
      body:
        `Hi {{first_name}},\n\n` +
        `We have an update for {{event_title}} on {{event_date}}.\n\n` +
        `• New time: __\n` +
        `• New location: __\n\n` +
        `Thanks for your flexibility.\n— Team`,
    },
    sms: {
      body: `Update for {{event_title}} on {{event_date}}: new time/location. Check email for details.`,
    },
  },
  thanks: {
    label: 'Thanks / Follow-up',
    email: {
      subject: 'Thank you for joining {{event_title}}!',
      preheader: 'Quick recap and next steps.',
      body:
        `Hi {{first_name}},\n\n` +
        `Thanks for being part of {{event_title}} on {{event_date}}.\n\n` +
        `We'd love feedback (2 mins): __\n` +
        `Photos & recap: __\n\n` +
        `Until next time!\n— Team`,
    },
    sms: {
      body: `Thanks for joining {{event_title}}! Got 2 mins for feedback? __`,
    },
  },
  volunteer: {
    label: 'Volunteer call',
    email: {
      subject: 'Lend a hand at {{event_title}}?',
      preheader: 'We could use your help—quick shifts available.',
      body:
        `Hi {{first_name}},\n\n` +
        `We're looking for volunteers for {{event_title}} on {{event_date}}.\n\n` +
        `Roles: check-in, ushers, scanners.\n` +
        `Shifts: 1–2 hours. Sign-up: __\n\n` +
        `Thank you!\n— Team`,
    },
    sms: {
      body: `Can you volunteer for {{event_title}} on {{event_date}}? Quick shifts. Signup: __`,
    },
  },
  weather: {
    label: 'Weather delay',
    email: {
      subject: 'Weather update for {{event_title}} ({{event_date}})',
      preheader: 'Start time adjusted due to weather.',
      body:
        `Hi {{first_name}},\n\n` +
        `Due to weather, {{event_title}} on {{event_date}} will start later.\n\n` +
        `New start time: __\n` +
        `We'll keep you posted with any changes.\n— Team`,
    },
    sms: {
      body: `Weather update: {{event_title}} on {{event_date}} delayed. New start: __`,
    },
  },
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
  const [segment, setSegment] = useState<'all_attendees' | 'roles'>('all_attendees');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(['scanner']);

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

  const [eventDetails, setEventDetails] = useState<{ title?: string; date?: string }>({});
  const currentText = useMemo(() => (channel === 'email' ? body : smsBody), [channel, body, smsBody]);
  const { len, segments } = smsLength(smsBody);

  const canProceedFromStep1 = true; // channel always chosen
  const canProceedFromStep2 = audienceCount > 0 || segment === 'roles'; // allow picking roles before count resolves
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
      const count = await getRecipientCount(
        eventId,
        segment === 'all_attendees' ? { type: 'all_attendees' } : { type: 'roles', roles: selectedRoles }
      );
      if (!ignore) setAudienceCount(count);
    };
    const id = setTimeout(run, 250); // gentle debounce for UX
    return () => { ignore = true; clearTimeout(id); };
  }, [eventId, segment, selectedRoles, getRecipientCount]);

  // Event details
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('events').select('title,start_at').eq('id', eventId).single();
      if (data) {
        setEventDetails({
          title: data.title,
          date: data.start_at ? new Date(data.start_at).toLocaleDateString() : undefined
        });
      }
    })();
  }, [eventId]);

  // Recent jobs
  const refreshRecent = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_jobs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!error) setRecentJobs(data || []);
  }, [eventId]);
  useEffect(() => { refreshRecent(); }, [refreshRecent]);

  /* ------------------------------- actions ------------------------------ */

  const resetComposer = () => {
    setSubject('');
    setPreheader('');
    setBody('');
    setSmsBody('');
    setAiOutput(null);
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

    const jobRes = await createJob({
      eventId,
      channel,
      subject,
      body: preheader ? `<!-- preheader: ${preheader} -->\n${body}` : body,
      smsBody,
      fromName: 'YardPass',
      fromEmail: 'onboarding@resend.dev',
      segment: segment === 'all_attendees' ? { type: 'all_attendees' } : { type: 'roles', roles: selectedRoles },
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
        channel,
        subject: channel === 'email' ? (subject || 'Test Message') : undefined,
        body: preheader ? `<!-- preheader: ${preheader} -->\n${body}` : body,
        smsBody,
        fromName: 'YardPass',
        fromEmail: 'onboarding@resend.dev',
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
          <Select value={segment} onValueChange={(v: 'all_attendees' | 'roles') => setSegment(v)}>
            <SelectTrigger id="audience-select"><SelectValue placeholder="Select audience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_attendees"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> All Attendees</div></SelectItem>
              <SelectItem value="roles"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Specific Roles</div></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          {segment === 'all_attendees'
            ? <div>Includes all ticket holders for this event.</div>
            : <div>Choose one or more roles below.</div>}
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
    <div className="space-y-4">
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
              Audience: {segment === 'all_attendees' ? 'All attendees' : selectedRoles.map(r => ROLE_MATRIX[r].label).join(', ') || '—'}
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
    <div className="space-y-6">
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

      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Messages
            <Button variant="ghost" size="icon" onClick={refreshRecent} title="Refresh" className="ml-auto">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Your last 5 sends will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {job.channel === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium truncate max-w-[40ch]">{job.subject || 'SMS Message'}</div>
                      <div className="text-sm text-muted-foreground">{new Date(job.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}