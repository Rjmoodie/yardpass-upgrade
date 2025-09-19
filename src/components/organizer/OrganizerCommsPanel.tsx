// src/components/OrganizerCommsPanel.tsx
import { useState, useEffect, useMemo } from 'react';
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
  Sparkles, Wand2, Volume2, Scissors, Expand, ShieldCheck, CheckCheck, ListChecks
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

export function OrganizerCommsPanel({ eventId }: OrganizerCommsPanelProps) {
  const { createJob, getRecipientCount, retryJob, loading } = useMessaging();
  const [channel, setChannel] = useState<MessageChannel>('email');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState(''); // NEW
  const [body, setBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [segment, setSegment] = useState<'all_attendees' | 'roles'>('all_attendees');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(['scanner']);
  const [audienceCount, setAudienceCount] = useState<number>(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [sendingTest, setSendingTest] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [eventDetails, setEventDetails] = useState<{ title?: string; date?: string }>({});
  const [aiPanelOpen, setAiPanelOpen] = useState(true); // NEW
  const [aiOutput, setAiOutput] = useState<AiResult | null>(null);

  // Derived
  const currentText = useMemo(() => (channel === 'email' ? body : smsBody), [channel, body, smsBody]);
  const { len, segments } = smsLength(smsBody);

  // Audience count
  useEffect(() => {
    (async () => {
      const count = await getRecipientCount(
        eventId,
        segment === 'all_attendees' ? { type: 'all_attendees' } : { type: 'roles', roles: selectedRoles }
      );
      setAudienceCount(count);
    })();
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
  const refreshRecent = async () => {
    const { data } = await supabase
      .from('message_jobs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentJobs(data || []);
  };
  useEffect(() => { refreshRecent(); }, [eventId]);

  // --- Sending ---
  async function send(dryRun = false) {
    if (channel === 'email' && !subject.trim()) {
      toast({ title: 'Subject is required for email', variant: 'destructive' });
      return;
    }
    if (!body.trim() && !smsBody.trim()) {
      toast({ title: 'Message body is required', variant: 'destructive' });
      return;
    }
    if (!dryRun && audienceCount === 0) {
      toast({ title: 'No recipients found', description: 'Please select a valid audience', variant: 'destructive' });
      return;
    }

    const jobRes = await createJob({
      eventId,
      channel,
      subject,
      body: preheader ? `<!-- preheader: ${preheader} -->\n${body}` : body, // embed preheader marker
      smsBody,
      fromName: 'YardPass',
      fromEmail: 'onboarding@resend.dev',
      segment: segment === 'all_attendees' ? { type: 'all_attendees' } : { type: 'roles', roles: selectedRoles },
      dryRun,
    });

    if (dryRun) {
      toast({ title: 'Dry-run (no messages sent)', description: `${jobRes.recipientCount} recipients would be targeted.` });
      return;
    }

    toast({ title: 'Message queued', description: `Your ${channel} will be sent to ${jobRes.recipientCount} recipients` });
    setSubject(''); setPreheader(''); setBody(''); setSmsBody('');
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
      // Draft-only job, then direct function for email test
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
        toast({ title: 'Use a test phone via queue or Twilio console.' });
      }
      toast({ title: 'Test sent' });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  }

  // --- AI actions ---
  async function callAI(action: string, opt?: { tone?: string; maxWords?: number }) {
    setAiLoading(true);
    setAiOutput(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-writing-assistant', {
        body: {
          action,
          text: action === 'generate_subject' || action === 'subject_variants' || action === 'generate_preheader'
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
      setAiPanelOpen(true);
      setAiOutput(data as AiResult);
      return data as AiResult;
    } catch (e: any) {
      toast({ title: 'AI request failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  // Convenience wrappers
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

  // Apply helpers
  function applyText(t?: string) {
    if (!t) return;
    if (channel === 'email') setBody(t); else setSmsBody(t);
    toast({ title: 'Applied', description: 'Suggestion inserted.' });
  }

  function applyVariant(t?: string) {
    if (!t) return;
    if (channel === 'email') setBody(t); else setSmsBody(t);
    toast({ title: 'Variant applied' });
  }

  function applySubject(t?: string) {
    if (!t) return;
    setSubject(t);
    toast({ title: 'Subject applied' });
  }

  function applyPreheader(t?: string) {
    if (!t) return;
    setPreheader(t);
    toast({ title: 'Preheader applied' });
  }

  return (
    <div className="space-y-6">
      {/* Message Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Message
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAiPanelOpen((v) => !v)}>
                <Sparkles className="w-4 h-4 mr-1" />
                {aiPanelOpen ? 'Hide AI' : 'Show AI'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel & Audience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Role chips */}
          {segment === 'roles' && (
            <div>
              <Label>Select Roles</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ROLES.map(role => (
                  <Badge
                    key={role}
                    variant={selectedRoles.includes(role) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])}
                  >
                    {ROLE_MATRIX[role].label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Audience Count */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium">Recipients: {audienceCount}</div>
            <div className="text-xs text-muted-foreground">
              {segment === 'all_attendees'
                ? 'All ticket holders for this event'
                : `Users with roles: ${selectedRoles.map(r => ROLE_MATRIX[r].label).join(', ') || '—'}`}
            </div>
          </div>

          {/* Subject / Preheader */}
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
              <Input id="preheader-input" placeholder="A quick teaser to boost opens…" value={preheader} onChange={e => setPreheader(e.target.value)} />
            </>
          )}

          {/* Body */}
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

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => send(false)} disabled={loading || aiLoading}>
              {loading ? 'Sending…' : `Send ${channel === 'email' ? 'Email' : 'SMS'} to ${audienceCount}`}
            </Button>
            <Button variant="outline" onClick={() => send(true)} disabled={loading || aiLoading}>
              <Beaker className="w-4 h-4 mr-1" /> Dry-run (no send)
            </Button>
            <Button variant="secondary" onClick={sendTestToMe} disabled={sendingTest || loading || aiLoading}>
              <TestTube2 className="w-4 h-4 mr-1" /> Send test to me
            </Button>
          </div>

          {aiLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 animate-pulse" />
              AI is crafting suggestions…
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Assistant Panel */}
      {aiPanelOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Writing Assistant
              <Badge variant="outline" className="ml-auto text-xs">Powered by GPT-4</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!aiOutput && (
              <div className="text-center py-6 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Use the AI buttons above to generate subjects, improve copy, adjust tone, or get CTAs.</p>
                <p className="text-xs mt-1">AI suggestions will appear here instantly.</p>
              </div>
            )}

            {/* Main AI suggestion */}
            {aiOutput?.text && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-600" />
                    AI Suggestion
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => applyText(aiOutput.text)}
                      className="text-xs"
                    >
                      Apply to Body
                    </Button>
                    {channel === 'email' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => applySubject(aiOutput.text)}
                          className="text-xs"
                        >
                          Use as Subject
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => applyPreheader(aiOutput.text)}
                          className="text-xs"
                        >
                          Use as Preheader
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50/50 to-blue-50/50 border-purple-200/50">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{aiOutput.text}</div>
                </div>
              </div>
            )}

            {/* Multiple variants */}
            {aiOutput?.variants && aiOutput.variants.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-blue-600" />
                  Alternative Options
                </div>
                <div className="space-y-3">
                  {aiOutput.variants.map((v, i) => (
                    <div key={i} className="group border rounded-lg p-3 hover:border-purple-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm leading-relaxed break-words">{v.text}</div>
                          {typeof v.score === 'number' && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                Score: {v.score}/10
                              </Badge>
                              <div className="h-1 bg-muted rounded-full flex-1 max-w-20">
                                <div 
                                  className="h-1 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full transition-all"
                                  style={{ width: `${(v.score || 0) * 10}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => applyVariant(v.text)}
                            className="text-xs shrink-0"
                          >
                            Apply
                          </Button>
                          {channel === 'email' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => applySubject(v.text)}
                              className="text-xs shrink-0"
                            >
                              Subject
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI insights */}
            {aiOutput?.insights && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-amber-600" />
                  AI Insights
                </div>
                <div className="p-3 border rounded-lg bg-gradient-to-r from-amber-50/50 to-orange-50/50 border-amber-200/50">
                  <div className="text-sm text-amber-800 leading-relaxed">{aiOutput.insights}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            {aiOutput && (
              <div className="pt-3 border-t flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setAiOutput(null)}
                  className="text-xs text-muted-foreground"
                >
                  Clear Results
                </Button>
                <div className="text-xs text-muted-foreground">
                  Tip: Use different tones and actions for varied results
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <p>No messages sent yet.</p>
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
