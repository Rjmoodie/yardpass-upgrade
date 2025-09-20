// src/components/EventCreator.tsx
import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  ArrowLeft, ArrowRight, Plus, X, Upload, Calendar,
  MapPin, Shield, Share2, Wand2, Image as ImageIcon, Lightbulb
} from 'lucide-react';
import { MapboxLocationPicker } from './MapboxLocationPicker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useToast } from '@/hooks/use-toast';

// AI modules
import { AIWritingAssistant } from '@/components/ai/AIWritingAssistant';
import { AIImageGenerator } from '@/components/ai/AIImageGenerator';
import { AIRecommendations } from '@/components/ai/AIRecommendations';

// Series functionality
import { SeriesConfiguration } from '@/components/SeriesConfiguration';
import { useSeriesCreation } from '@/hooks/useSeriesCreation';

// === Local Types ===
interface EventCreatorProps {
  onBack: () => void;
  onCreate: () => void;
  organizationId: string;
}
interface Location {
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}
interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  quantity: number;
}

const categories = [
  'Music', 'Food & Drink', 'Art & Culture', 'Sports & Fitness',
  'Business & Professional', 'Community', 'Technology', 'Other'
];

// === Small utils ===
const toISODate = (d: Date) => d.toISOString().split('T')[0];
const combineDateTime = (dateStr?: string, timeStr?: string) =>
  (!dateStr || !timeStr) ? null : new Date(`${dateStr}T${timeStr}`);
const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

function buildSlug(raw: string) {
  return (raw || 'untitled-event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}
async function ensureUniqueSlug(base: string) {
  let slug = buildSlug(base);
  let i = 1;
  // Ensure no slug collision
  // (Consider indexing events.slug and adding org scoping later if desired)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .limit(1);
    if (error) throw error;
    if (!data?.length) return slug;
    i += 1;
    slug = `${slug.replace(/-\d+$/, '')}-${i}`;
  }
}

export function EventCreator({ onBack, onCreate, organizationId }: EventCreatorProps) {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsIntegration();
  const { toast } = useToast();

  // Series hook
  const series = useSeriesCreation({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const STORAGE_KEY = `event-creator-draft-${organizationId}`;

  // Load draft
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          step: parsed.step || 1,
          formData: parsed.formData || {},
          location: parsed.location || null,
          ticketTiers: parsed.ticketTiers || [
            { id: '1', name: 'General Admission', price: 0, badge: 'GA', quantity: 100 },
          ],
        };
      }
    } catch (error) {
      console.warn('Failed to load event creator draft:', error);
    }
    return null;
  };
  const draft = loadDraft();

  // State
  const [step, setStep] = useState(draft?.step || 1);
  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(draft?.formData || {
    title: '',
    description: '',
    category: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    venue: '',
    coverImageUrl: '',
    visibility: 'public' as 'public' | 'unlisted' | 'private',
    culturalGuide: {
      history: '',
      themes: [] as string[],
      community: [] as string[],
    },
  });

  const [location, setLocation] = useState<Location | null>(draft?.location || null);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>(
    draft?.ticketTiers || [
      { id: '1', name: 'General Admission', price: 0, badge: 'GA', quantity: 100 },
    ]
  );

  // Validation/errors + dirty + submit guard
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const submittingRef = useRef(false);
  const durationRef = useRef<number>(120); // default 2h

  // Auto-save draft
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          step, formData, location, ticketTiers, lastSaved: Date.now(),
        }));
      } catch (error) {
        console.warn('Failed to save event creator draft:', error);
      }
    }, 700);
    return () => clearTimeout(timeoutId);
  }, [step, formData, location, ticketTiers, STORAGE_KEY]);

  // Mark dirty on changes
  useEffect(() => { setDirty(true); }, [formData, location, ticketTiers]);

  // Warn before unload if dirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && !loading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, loading]);

  // Keep series start synced
  useEffect(() => {
    if (formData.startDate && formData.startTime) {
      const iso = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
      series.setState(s => ({ ...s, seriesStartISO: iso }));
    }
  }, [formData.startDate, formData.startTime, series]);

  // Auto-end time default & keep duration if user sets end later
  useEffect(() => {
    const start = combineDateTime(formData.startDate, formData.startTime);
    const end   = combineDateTime(formData.endDate, formData.endTime);

    // if we have both, keep durationRef updated
    if (start && end) {
      durationRef.current = Math.max(15, minutesBetween(start, end)); // at least 15m
      return;
    }

    // if start exists and end is blank, default to +2h (or last known duration)
    if (start && (!formData.endDate || !formData.endTime)) {
      const d = new Date(start.getTime() + durationRef.current * 60000);
      setFormData(f => ({
        ...f,
        endDate: toISODate(d),
        endTime: d.toISOString().slice(11,16),
      }));
    }
  }, [formData.startDate, formData.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear draft helper
  const clearDraft = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // --- Validation functions ---
  function validateStep1(fd: typeof formData) {
    const e: Record<string,string> = {};
    if (!fd.title) e.title = 'Title is required';
    if (!fd.description) e.description = 'Description is required';
    if (!fd.category) e.category = 'Category is required';
    return e;
  }
  function validateStep2(fd: typeof formData, loc: Location | null) {
    const e: Record<string,string> = {};
    const start = combineDateTime(fd.startDate, fd.startTime);
    const end = combineDateTime(fd.endDate, fd.endTime);
    if (!start) e.start = 'Start date & time required';
    if (!end) e.end = 'End date & time required';
    if (start && end && end < start) e.end = 'End must be after start';
    if (!loc) e.location = 'Select a location';
    const sErr = series.state.enabled ? (series.validate() || '') : '';
    if (sErr) e.series = sErr;
    return e;
  }
  function validateStep3(tiers: TicketTier[]) {
    const e: Record<string,string> = {};
    if (!tiers.length) e.tiers = 'Add at least one tier';
    tiers.forEach((t, idx) => {
      if (!t.name) e[`tier-${idx}-name`] = 'Tier name required';
      if (!t.badge) e[`tier-${idx}-badge`] = 'Badge required';
      if (!t.quantity || t.quantity < 1) e[`tier-${idx}-quantity`] = 'Quantity must be ≥ 1';
      if (t.price == null || t.price < 0) e[`tier-${idx}-price`] = 'Price must be ≥ 0';
    });
    return e;
  }

  const canProceed = () => {
    if (step === 1) return Object.keys(validateStep1(formData)).length === 0;
    if (step === 2) return Object.keys(validateStep2(formData, location)).length === 0;
    if (step === 3) return Object.keys(validateStep3(ticketTiers)).length === 0;
    return true;
  };

  const handleNext = () => {
    let e: Record<string,string> = {};
    if (step === 1) e = validateStep1(formData);
    if (step === 2) e = validateStep2(formData, location);
    if (step === 3) e = validateStep3(ticketTiers);
    setErrors(e);
    if (Object.keys(e).length) {
      toast({ title: 'Fix required fields', description: 'Please review highlighted fields.', variant: 'destructive' });
      return;
    }
    const newStep = Math.min(totalSteps, step + 1);
    trackEvent('event_creation_step', { from_step: step, to_step: newStep, organization_id: organizationId, direction: 'forward' });
    setStep(newStep);
  };
  const handlePrevious = () => {
    const newStep = Math.max(1, step - 1);
    trackEvent('event_creation_step', { from_step: step, to_step: newStep, organization_id: organizationId, direction: 'backward' });
    setStep(newStep);
  };

  // Tiers CRUD
  const addTier = () =>
    setTicketTiers((prev) => [...prev, { id: String(Date.now()), name: '', price: 0, badge: '', quantity: 0 }]);
  const updateTier = (id: string, field: keyof TicketTier, value: string | number) =>
    setTicketTiers((tiers) => tiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  const removeTier = (id: string) => setTicketTiers((tiers) => tiers.filter((t) => t.id !== id));

  // Upload cover
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image smaller than 5MB', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/event-cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('event-media').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('event-media').getPublicUrl(filePath);
      setFormData((f) => ({ ...f, coverImageUrl: publicUrl }));
      toast({ title: 'Image uploaded', description: 'Cover image uploaded successfully!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  // AI hooks
  const aiContext = useMemo(() => ({
    orgId: organizationId,
    title: formData.title,
    category: formData.category,
    city: location?.city,
    date: formData.startDate,
    tone: 'friendly',
  }), [organizationId, formData.title, formData.category, formData.startDate, location?.city]);

  const onAIReplaceDescription = (text: string) => {
    setFormData((f) => ({ ...f, description: text }));
    toast({ title: 'Description updated', description: 'AI polished your event copy.' });
  };
  const onAIGenerateTitle = (text: string) => {
    setFormData((f) => ({ ...f, title: text }));
    toast({ title: 'Title added', description: 'AI generated a catchy title.' });
  };
  const onAIImageDone = (url?: string) => {
    if (!url) return;
    setFormData((f) => ({ ...f, coverImageUrl: url }));
    toast({ title: 'Cover updated', description: 'AI image set as event banner.' });
  };
  const applyTierSuggestions = (suggestions: Array<{ name: string; price: number; badge: string; quantity: number }>) => {
    if (!suggestions?.length) return;
    const mapped: TicketTier[] = suggestions.map((s, i) => ({
      id: `${Date.now()}-${i}`,
      name: s.name,
      price: s.price,
      badge: s.badge,
      quantity: s.quantity,
    }));
    setTicketTiers(mapped);
    toast({ title: 'Tiers suggested', description: 'AI proposed ticket tiers & pricing.' });
  };

  // Submit
  const handleSubmit = async () => {
    if (!user || !location) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      // Validate everything once more
      const e = {
        ...validateStep1(formData),
        ...validateStep2(formData, location),
        ...validateStep3(ticketTiers),
      };
      setErrors(e);
      if (Object.keys(e).length) {
        toast({ title: 'Fix required fields', description: 'Please review highlighted fields.', variant: 'destructive' });
        return;
      }

      // Unique slug
      const slug = await ensureUniqueSlug(formData.title);

      // Series path
      if (series.state.enabled) {
        const created = await series.createSeriesAndEvents({
          orgId: organizationId,
          template: {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            timezone: formData.timezone,
            venue: formData.venue,
            address: location.address,
            city: location.city,
            country: location.country,
            lat: location.lat?.toString(),
            lng: location.lng?.toString(),
            cover_image_url: formData.coverImageUrl,
            visibility: formData.visibility,
            slug
          },
          createdBy: user.id
        });

        // OPTIONAL: replicate tiers to each created event
        if (ticketTiers.length && created.length) {
          const payload = created.flatMap((ev) =>
            ticketTiers.map((t) => ({
              event_id: ev.event_id,
              name: t.name,
              price_cents: Math.round((t.price || 0) * 100),
              quantity: t.quantity,
              badge_label: t.badge,
              currency: 'USD',
              status: 'active',
            }))
          );
          const { error: tiersErr } = await supabase.from('ticket_tiers').insert(payload);
          if (tiersErr) throw tiersErr;
        }

        trackEvent('event_series_creation_success', {
          organization_id: organizationId,
          series_name: series.state.name,
          event_count: created.length,
          recurrence: series.state.recurrence,
        });

        clearDraft();
        setDirty(false);
        toast({ title: `Created ${created.length} events`, description: series.state.name || 'Series created successfully.' });
        onCreate();
        return;
      }

      // Single event path
      const startAt = combineDateTime(formData.startDate, formData.startTime)!;
      const endAt = combineDateTime(formData.endDate, formData.endTime)!;
      const linkToken = formData.visibility === 'unlisted' && 'randomUUID' in crypto ? crypto.randomUUID() : null;

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          timezone: formData.timezone,
          venue: formData.venue,
          address: location.address,
          city: location.city,
          country: location.country,
          lat: location.lat,
          lng: location.lng,
          cover_image_url: formData.coverImageUrl,
          owner_context_type: 'organization',
          owner_context_id: organizationId,
          created_by: user.id,
          visibility: formData.visibility,
          slug,
          link_token: linkToken,
        })
        .select('id')
        .single();

      if (eventError) throw eventError;

      if (ticketTiers.length) {
        const tiersPayload = ticketTiers.map((t) => ({
          event_id: event.id,
          name: t.name,
          price_cents: Math.round((t.price || 0) * 100),
          quantity: t.quantity,
          badge_label: t.badge,
          currency: 'USD',
          status: 'active',
        }));
        const { error: tiersErr } = await supabase.from('ticket_tiers').insert(tiersPayload);
        if (tiersErr) throw tiersErr;
      }

      if (
        formData.culturalGuide.history ||
        formData.culturalGuide.themes.length ||
        formData.culturalGuide.community.length
      ) {
        const { error: cgErr } = await supabase.from('cultural_guides').insert({
          event_id: event.id,
          history_long: formData.culturalGuide.history,
          themes: formData.culturalGuide.themes,
          community: formData.culturalGuide.community,
        });
        if (cgErr) throw cgErr;
      }

      trackEvent('event_creation_success', {
        organization_id: organizationId,
        event_title: formData.title,
        event_category: formData.category,
      });

      clearDraft();
      setDirty(false);
      toast({
        title: 'Event Created!',
        description:
          formData.visibility === 'unlisted'
            ? 'Unlisted: share the link with the secret token.'
            : formData.visibility === 'private'
            ? 'Private: only invited users and ticket-holders can view.'
            : 'Public: visible in search and feeds.',
      });
      onCreate();
    } catch (err: any) {
      trackEvent('event_creation_error', {
        organization_id: organizationId,
        error_message: err.message,
        step,
        event_title: formData.title,
      });
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to create events.</p>
        </div>
        <Button onClick={onBack} className="ml-4">Go Back</Button>
      </div>
    );
  }

  // ===================== UI =====================
  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => {
              if (!dirty) return onBack();
              if (confirm('Discard your draft? Changes not saved to the server will be lost.')) onBack();
            }}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Create Event</h1>
            <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Auto-saving
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* STEP 1: BASICS + AI */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Event Basics</span>
                <span className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormData((f) => ({
                        ...f,
                        title: f.title || 'Untitled Event',
                        description: f.description || 'Add an engaging description so people know why this event is for them.',
                      }))
                    }
                  >
                    <Lightbulb className="w-4 h-4 mr-1" />
                    Quick Fill
                  </Button>
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Title / Category */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="title">Title *</label>
                  <Input
                    id="title"
                    placeholder="Enter event title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <label>Category *</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
                </div>
              </div>

              {/* Description + AI */}
              <div className="space-y-2">
                <label htmlFor="description">Description *</label>
                <Textarea
                  id="description"
                  placeholder="Tell people what your event is about..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-28"
                />
                {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                <div className="flex gap-2">
                  <AIWritingAssistant
                    context={aiContext}
                    onImprove={onAIReplaceDescription}
                    onGenerateTitle={onAIGenerateTitle}
                    invokePath="ai-writing-assistant"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const { data, error } = await supabase.functions.invoke('ai-writing-assistant', {
                        body: { action: 'improve', text: formData.description, context: aiContext }
                      });
                      if (!error && data?.text) onAIReplaceDescription(data.text);
                    }}
                  >
                    <Wand2 className="w-4 h-4 mr-1" /> Quick Improve
                  </Button>
                </div>
              </div>

              {/* Visibility + Cover */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Visibility *
                  </label>
                  <Select value={formData.visibility} onValueChange={(v) => setFormData({ ...formData, visibility: v as any })}>
                    <SelectTrigger><SelectValue placeholder="Choose visibility" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public — discoverable in feeds & search</SelectItem>
                      <SelectItem value="unlisted">Unlisted — hidden, link-only access</SelectItem>
                      <SelectItem value="private">Private — invitees & ticket-holders only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Cover Image
                  </label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                    {formData.coverImageUrl ? (
                      <div className="space-y-2">
                        <img
                          src={formData.coverImageUrl}
                          alt="Cover preview"
                          className="w-full h-32 object-cover rounded-lg mx-auto"
                        />
                        <div className="flex gap-2 justify-center">
                          <Button variant="outline" size="sm" onClick={() => setFormData((f) => ({ ...f, coverImageUrl: '' }))}>
                            Remove
                          </Button>
                          <AIImageGenerator
                            title={formData.title}
                            category={formData.category}
                            city={location?.city}
                            onDone={onAIImageDone}
                            invokePath="ai-image-generator"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">Upload a cover image or generate one</p>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? 'Uploading...' : 'Choose File'}
                          </Button>
                          <AIImageGenerator
                            title={formData.title}
                            category={formData.category}
                            city={location?.city}
                            onDone={onAIImageDone}
                            invokePath="ai-image-generator"
                          />
                        </div>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: SCHEDULE & LOCATION (+ Series) */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Schedule & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Event Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label>Start Date *</label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {errors.start && <p className="text-xs text-destructive mt-1">{errors.start}</p>}
                  </div>
                  <div className="space-y-2">
                    <label>Start Time *</label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label>End Date *</label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                    />
                    {errors.end && <p className="text-xs text-destructive mt-1">{errors.end}</p>}
                  </div>
                  <div className="space-y-2">
                    <label>End Time *</label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label>Venue Name</label>
                  <Input
                    placeholder="Enter venue name (optional)"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </h3>
                <MapboxLocationPicker value={location} onChange={setLocation} />
                {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Cultural Guide (Optional)</h3>
                <p className="text-xs text-muted-foreground">Share the story or meaning behind your event.</p>
                <div className="space-y-2">
                  <label>Why You Do What You Do</label>
                  <Textarea
                    placeholder="What drives this experience? What’s the deeper purpose?"
                    value={formData.culturalGuide.history}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, culturalGuide: { ...f.culturalGuide, history: e.target.value } }))
                    }
                    className="min-h-20"
                  />
                </div>
              </div>

              {/* Series Configuration */}
              <SeriesConfiguration
                enabled={series.state.enabled}
                onToggle={(v) => series.setState(s => ({ ...s, enabled: v }))}
                name={series.state.name}
                onName={(v) => series.setState(s => ({ ...s, name: v }))}
                description={series.state.description}
                onDescription={(v) => series.setState(s => ({ ...s, description: v }))}
                recurrence={series.state.recurrence}
                onRecurrence={(v) => series.setState(s => ({ ...s, recurrence: v }))}
                interval={series.state.interval}
                onInterval={(v) => series.setState(s => ({ ...s, interval: v }))}
                seriesStartISO={series.state.seriesStartISO}
                onSeriesStartISO={(v) => series.setState(s => ({ ...s, seriesStartISO: v }))}
                durationMin={series.state.durationMin}
                onDurationMin={(v) => series.setState(s => ({ ...s, durationMin: v }))}
                seriesEndDate={series.state.seriesEndDate}
                onSeriesEndDate={(v) => series.setState(s => ({ ...s, seriesEndDate: v }))}
                maxEvents={series.state.maxEvents}
                onMaxEvents={(v) => series.setState(s => ({ ...s, maxEvents: v }))}
                previewISO={series.preview}
              />
              {(errors.series || series.error) && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{errors.series || series.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 3: TICKETS + AI */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Ticket Tiers
                <div className="flex items-center gap-2">
                  <AIRecommendations
                    orgId={organizationId}
                    city={location?.city}
                    category={formData.category}
                    eventDate={formData.startDate}
                    onApplyTiers={applyTierSuggestions}
                    invokePath="ai-event-recommendations"
                  />
                  <Button size="sm" onClick={addTier}><Plus className="w-4 h-4 mr-1" />Add Tier</Button>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {errors.tiers && <p className="text-xs text-destructive">{errors.tiers}</p>}
              {ticketTiers.map((tier, index) => (
                <Card key={tier.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm">Tier {index + 1}</h4>
                      {ticketTiers.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeTier(tier.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <label>Tier Name *</label>
                        <Input
                          placeholder="e.g., General Admission"
                          value={tier.name}
                          onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                        />
                        {errors[`tier-${index}-name`] && <p className="text-xs text-destructive">{errors[`tier-${index}-name`]}</p>}
                      </div>
                      <div className="space-y-2">
                        <label>Badge *</label>
                        <Input
                          placeholder="e.g., GA"
                          value={tier.badge}
                          onChange={(e) => updateTier(tier.id, 'badge', e.target.value)}
                        />
                        {errors[`tier-${index}-badge`] && <p className="text-xs text-destructive">{errors[`tier-${index}-badge`]}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label>Price ($) *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.price}
                          onChange={(e) => updateTier(tier.id, 'price', parseFloat(e.target.value) || 0)}
                        />
                        {errors[`tier-${index}-price`] && <p className="text-xs text-destructive">{errors[`tier-${index}-price`]}</p>}
                      </div>
                      <div className="space-y-2">
                        <label>Quantity *</label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.quantity}
                          onChange={(e) => updateTier(tier.id, 'quantity', parseInt(e.target.value) || 0)}
                        />
                        {errors[`tier-${index}-quantity`] && <p className="text-xs text-destructive">{errors[`tier-${index}-quantity`]}</p>}
                      </div>
                    </div>

                    {tier.badge && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1">Badge Preview:</p>
                        <Badge variant="outline">{tier.badge}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {/* STEP 4: PREVIEW */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Event Preview</h2>
              <p className="text-sm text-muted-foreground">This is how your event will appear to users</p>
            </div>

            <div className="pb-8">
              {formData.coverImageUrl ? (
                <div className="relative">
                  <img
                    src={formData.coverImageUrl}
                    alt={formData.title}
                    className="w-full h-64 object-cover rounded-t-lg"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent rounded-t-lg" />
                </div>
              ) : null}

              <div className={`${formData.coverImageUrl ? '-mt-12' : ''} relative`}>
                <Card className="shadow-lg">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {formData.category ? (
                          <Badge variant="secondary" className="mb-2">{formData.category}</Badge>
                        ) : null}
                        <h1 className="text-xl md:text-2xl font-semibold leading-tight">{formData.title}</h1>
                        <div className="mt-2 text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {formData.startDate && formData.startTime
                                ? `${new Date(formData.startDate).toLocaleDateString()} at ${formData.startTime}`
                                : 'Date TBA'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>
                              {[formData.venue, location?.address].filter(Boolean).join(' • ') || 'Location TBA'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button variant="default" size="sm" disabled>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                    </div>

                    <div className="mt-4 text-sm">
                      Hosted by <span className="font-medium text-primary">Your Organization</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {formData.description && (
                <Card className="mt-4">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">About this event</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{formData.description}</p>
                  </CardContent>
                </Card>
              )}

              {formData.culturalGuide.history && (
                <Card className="mt-4">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">Cultural Guide</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{formData.culturalGuide.history}</p>
                  </CardContent>
                </Card>
              )}

              {ticketTiers.length > 0 && (
                <Card className="mt-4">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">Tickets</h3>
                    <div className="space-y-3">
                      {ticketTiers.map((tier) => (
                        <div key={tier.id} className="flex justify-between items-center p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{tier.badge}</Badge>
                            <div>
                              <div className="text-sm font-medium">{tier.name}</div>
                              <div className="text-xs text-muted-foreground">{tier.quantity} available</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">${tier.price}</div>
                            <Button size="sm" disabled>Get Ticket</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-card p-4 flex justify-between">
        <Button variant="outline" onClick={step === 1 ? onBack : handlePrevious} disabled={loading}>
          {step === 1 ? 'Cancel' : 'Previous'}
        </Button>
        {step < totalSteps ? (
          <Button onClick={handleNext} disabled={!canProceed() || loading}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canProceed() || loading} className="min-w-32">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Event'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default EventCreator;
