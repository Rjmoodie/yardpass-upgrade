// src/components/OrganizerCommsPanel.tsx
import { useState, useEffect } from 'react';
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
import { Mail, MessageSquare, Users, Send, Clock, Beaker, RefreshCw, TestTube2, Sparkles, Wand2, Volume2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OrganizerCommsPanelProps {
  eventId: string;
}

const smsLength = (text: string) => {
  // GSM-7 vs unicode is complex; rough counter is fine
  const len = text?.length ?? 0;
  const segments = Math.ceil(len / 160) || 1;
  return { len, segments };
};

export function OrganizerCommsPanel({ eventId }: OrganizerCommsPanelProps) {
  const { createJob, getRecipientCount, retryJob, loading } = useMessaging();
  const [channel, setChannel] = useState<MessageChannel>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [segment, setSegment] = useState<'all_attendees' | 'roles'>('all_attendees');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(['scanner']);
  const [audienceCount, setAudienceCount] = useState<number>(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [sendingTest, setSendingTest] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [eventDetails, setEventDetails] = useState<{ title?: string; date?: string }>({});

  // Load audience count
  useEffect(() => {
    (async () => {
      const count = await getRecipientCount(
        eventId,
        segment === 'all_attendees' ? { type: 'all_attendees' } : { type: 'roles', roles: selectedRoles }
      );
      setAudienceCount(count);
    })();
  }, [eventId, segment, selectedRoles, getRecipientCount]);

  // Load event details for AI context
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('title, start_at')
        .eq('id', eventId)
        .single();
      
      if (!error && data) {
        setEventDetails({ 
          title: data.title, 
          date: data.start_at ? new Date(data.start_at).toLocaleDateString() : undefined 
        });
      }
    })();
  }, [eventId]);

  // Load recent jobs
  const refreshRecent = async () => {
    console.log('[OrganizerCommsPanel] Refreshing recent jobs for event:', eventId);
    const { data, error } = await supabase
      .from('message_jobs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('[OrganizerCommsPanel] Error loading recent jobs:', error);
    } else {
      console.log('[OrganizerCommsPanel] Loaded recent jobs:', data);
      setRecentJobs(data || []);
    }
  };
  useEffect(() => { refreshRecent(); }, [eventId]);

  // Auto-refresh disabled

  async function send(dryRun = false) {
    console.log('[OrganizerCommsPanel] Starting send with dryRun:', dryRun);
    console.log('[OrganizerCommsPanel] Current state:', { channel, subject, body, smsBody, segment, selectedRoles, audienceCount });
    
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

    try {
      console.log('[OrganizerCommsPanel] Calling createJob...');
      const jobRes = await createJob({
        eventId,
        channel,
        subject,
        body,
        smsBody,
        fromName: 'YardPass',
        fromEmail: 'onboarding@resend.dev',
        segment: segment === 'all_attendees' ? { type: 'all_attendees' } : { type: 'roles', roles: selectedRoles },
        dryRun,
      });

      console.log('[OrganizerCommsPanel] Job result:', jobRes);

      if (dryRun) {
        toast({ 
          title: 'Dry-run (no messages sent)', 
          description: `${jobRes.recipientCount} recipients would be targeted.` 
        });
        return;
      }

      toast({
        title: 'Message queued',
        description: `Your ${channel} will be sent to ${jobRes.recipientCount} recipients`,
      });
      
      // Clear form
      setSubject(''); 
      setBody(''); 
      setSmsBody('');
      
      // Refresh the recent jobs list
      console.log('[OrganizerCommsPanel] Refreshing recent jobs...');
      await refreshRecent();
      
    } catch (error: any) {
      console.error('[OrganizerCommsPanel] Send error:', error);
      toast({ 
        title: 'Failed to send message', 
        description: error.message || 'Please try again.', 
        variant: 'destructive' 
      });
    }
  }

  async function useAI(action: 'improve' | 'generate_subject' | 'adjust_tone', tone?: string) {
    setAiLoading(true);
    try {
      const currentText = channel === 'email' ? body : smsBody;
      const { data, error } = await supabase.functions.invoke('ai-writing-assistant', {
        body: {
          action,
          text: action === 'generate_subject' ? currentText : currentText,
          eventTitle: eventDetails.title,
          eventDate: eventDetails.date,
          tone,
          messageType: channel,
          audience: segment === 'all_attendees' ? 'all attendees' : selectedRoles.map(r => ROLE_MATRIX[r].label).join(', ')
        }
      });

      if (error) throw new Error(error.message);

      if (action === 'generate_subject') {
        setSubject(data.text);
        toast({ title: 'Subject generated!', description: 'AI created a subject line for you.' });
      } else {
        if (channel === 'email') {
          setBody(data.text);
        } else {
          setSmsBody(data.text);
        }
        toast({ title: 'Message improved!', description: 'AI enhanced your message.' });
      }
    } catch (error: any) {
      toast({ title: 'AI failed', description: error.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  const handleRoleToggle = (role: RoleType) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const getJobStatusBadge = (status: string, jobId: string) => {
    const isClickable = status === 'failed' || status === 'queued';
    const common = "text-xs";
    
    switch (status) {
      case 'draft':   
        return <Badge variant="secondary" className={common}>Draft</Badge>;
      case 'queued':  
        return (
          <Badge variant="outline" className={`${common} cursor-pointer animate-pulse border-yellow-400 text-yellow-600`} onClick={() => retry(jobId)}>
            Queued (click to run)
          </Badge>
        );
      case 'sending': 
        return (
          <Badge variant="default" className={`${common} bg-blue-500 animate-pulse`}>
            Sending...
          </Badge>
        );
      case 'sent':    
        return <Badge variant="default" className={`${common} bg-green-500`}>Sent</Badge>;
      case 'failed':  
        return (
          <Badge variant="destructive" className={`${common} cursor-pointer`} onClick={() => retry(jobId)}>
            Failed (retry)
          </Badge>
        );
      default:        
        return <Badge variant="secondary" className={common}>{status}</Badge>;
    }
  };

  async function retry(jobId: string) {
    console.log('[OrganizerCommsPanel] Retrying job:', jobId);
    try {
      await retryJob(jobId);
      toast({ title: 'Re-queued', description: 'Processing started.' });
      console.log('[OrganizerCommsPanel] Job retried successfully, refreshing...');
      await refreshRecent();
    } catch (e: any) {
      console.error('[OrganizerCommsPanel] Retry failed:', e);
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
      // Create a roles segment with just yourself (draft)
      await createJob({
        eventId,
        channel,
        subject: channel === 'email' ? (subject || 'Test Message') : undefined,
        body,
        smsBody,
        fromName: 'YardPass',
        fromEmail: 'onboarding@resend.dev',
        segment: { type: 'roles', roles: [] }, // we won't use recipients list here
        dryRun: true,
      });

      // Direct edge call with your email/phone (bypassing queue for a one-off test)
      if (channel === 'email') {
        const html = body || `Test email for event {{event_title}} on {{event_date}}`;
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: { 
            to: user!.email, 
            subject: subject || 'Test Message', 
            html 
          }
        });
        if (error) throw new Error(error.message);
      } else {
        toast({ title: 'Use a test phone via the queue or Twilio console.' });
      }
      toast({ title: 'Test sent' });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  }

  const { len, segments } = smsLength(smsBody);

  return (
    <div className="space-y-6">
      {/* Message Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Message
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
                    onClick={() => handleRoleToggle(role)}
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

          {/* Subject & Body */}
          {channel === 'email' && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="subject-input">Subject</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => useAI('generate_subject')}
                  disabled={aiLoading}
                  className="text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Generate
                </Button>
              </div>
              <Input id="subject-input" placeholder="Event update: {{event_title}}" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="body-input">{channel === 'email' ? 'Email Body' : 'SMS Message'}</Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => useAI('improve')}
                  disabled={aiLoading || (!body && !smsBody)}
                  className="text-xs"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  AI Improve
                </Button>
                <Select onValueChange={(tone) => useAI('adjust_tone', tone)} disabled={aiLoading || (!body && !smsBody)}>
                  <SelectTrigger className="w-auto h-8 text-xs">
                    <Volume2 className="w-3 h-3 mr-1" />
                    Tone
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
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
              AI is working on your message...
            </div>
          )}
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
                    {getJobStatusBadge(job.status, job.id)}
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
