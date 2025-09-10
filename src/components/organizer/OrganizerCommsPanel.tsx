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
import { Mail, MessageSquare, Users, Send, Clock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OrganizerCommsPanelProps {
  eventId: string;
}

export function OrganizerCommsPanel({ eventId }: OrganizerCommsPanelProps) {
  const { createJob, loading } = useMessaging();
  const [channel, setChannel] = useState<MessageChannel>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [segment, setSegment] = useState<'all_attendees' | 'roles'>('all_attendees');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(['scanner']);
  const [audienceCount, setAudienceCount] = useState<number>(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  // Load audience count when segment or channel changes
  useEffect(() => {
    async function loadAudienceCount() {
      try {
        let count = 0;
        
        if (segment === 'all_attendees') {
          // Count ticket holders
          const { data } = await supabase
            .from('tickets')
            .select('owner_user_id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('status', 'issued');
          count = data?.length || 0;
        } else if (segment === 'roles') {
          // Count users with selected roles
          const { data } = await supabase
            .from('event_roles')
            .select('user_id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .in('role', selectedRoles);
          count = data?.length || 0;
        }
        
        setAudienceCount(count);
      } catch (error) {
        console.error('Error loading audience count:', error);
        setAudienceCount(0);
      }
    }

    loadAudienceCount();
  }, [eventId, segment, selectedRoles]);

  // Load recent jobs
  useEffect(() => {
    async function loadRecentJobs() {
      const { data } = await supabase
        .from('message_jobs')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentJobs(data || []);
    }

    loadRecentJobs();
  }, [eventId]);

  async function send() {
    if (channel === 'email' && !subject.trim()) {
      toast({ title: 'Subject is required for email', variant: 'destructive' });
      return;
    }

    if (!body.trim() && !smsBody.trim()) {
      toast({ title: 'Message body is required', variant: 'destructive' });
      return;
    }

    try {
      const job = await createJob({
        eventId,
        channel,
        subject,
        body,
        smsBody,
        fromName: 'YardPass',
        fromEmail: 'noreply@yardpass.app',
        segment: segment === 'all_attendees' 
          ? { type: 'all_attendees' } 
          : { type: 'roles', roles: selectedRoles },
      });
      
      toast({ 
        title: 'Message queued', 
        description: `Your ${channel} will be sent to ${audienceCount} recipients` 
      });
      
      // Clear form
      setSubject('');
      setBody('');
      setSmsBody('');
      
      // Refresh recent jobs
      const { data } = await supabase
        .from('message_jobs')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentJobs(data || []);
      
    } catch (error: any) {
      toast({ 
        title: 'Failed to send message', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  }

  const handleRoleToggle = (role: RoleType) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'queued': return <Badge variant="outline">Queued</Badge>;
      case 'sending': return <Badge variant="default">Sending</Badge>;
      case 'sent': return <Badge variant="default" className="bg-green-500">Sent</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
          {/* Channel & Audience Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="channel-select">Channel</Label>
              <Select value={channel} onValueChange={(v: MessageChannel) => setChannel(v)}>
                <SelectTrigger id="channel-select">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="audience-select">Audience</Label>
              <Select value={segment} onValueChange={(v: 'all_attendees' | 'roles') => setSegment(v)}>
                <SelectTrigger id="audience-select">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_attendees">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All Attendees
                    </div>
                  </SelectItem>
                  <SelectItem value="roles">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Specific Roles
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Role Selection */}
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
                : `Users with roles: ${selectedRoles.map(r => ROLE_MATRIX[r].label).join(', ')}`
              }
            </div>
          </div>

          {/* Message Content */}
          {channel === 'email' && (
            <div>
              <Label htmlFor="subject-input">Subject</Label>
              <Input 
                id="subject-input"
                placeholder="Event update: {{event_title}}" 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
              />
            </div>
          )}

          <div>
            <Label htmlFor="body-input">
              {channel === 'email' ? 'Email Body' : 'SMS Message'}
            </Label>
            <Textarea 
              id="body-input"
              rows={8} 
              value={channel === 'email' ? body : smsBody} 
              onChange={e => channel === 'email' ? setBody(e.target.value) : setSmsBody(e.target.value)}
              placeholder={channel === 'email' 
                ? "Hi there,\n\nYour event {{event_title}} is coming up on {{event_date}}.\n\nSee you there!" 
                : "Hi! {{event_title}} is on {{event_date}}. See you there!"
              }
            />
            <div className="text-xs text-muted-foreground mt-1">
              Available variables: <code>{"{{event_title}}"}</code>, <code>{"{{event_date}}"}</code>, <code>{"{{first_name}}"}</code>
            </div>
          </div>

          <Button onClick={send} disabled={loading} className="w-full md:w-auto">
            {loading ? 'Sending...' : `Send ${channel === 'email' ? 'Email' : 'SMS'} to ${audienceCount} recipients`}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Messages
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
                      <div className="font-medium">
                        {job.subject || 'SMS Message'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {job.channel.toUpperCase()}
                    </Badge>
                    <Separator orientation="vertical" className="h-4" />
                    {getJobStatusBadge(job.status)}
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