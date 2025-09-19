import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { createEventSlug, ensureAvailableSlug } from '@/lib/slugUtils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Plus, X, Upload, Calendar, MapPin, Shield, Share2, Users } from 'lucide-react';
import { MapboxLocationPicker } from './MapboxLocationPicker';
import { AIWritingAssistant } from './ai/AIWritingAssistant';
import { AIImageGenerator } from './ai/AIImageGenerator';
import { AIRecommendations } from './ai/AIRecommendations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useToast } from '@/hooks/use-toast';

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

export function EventCreator({ onBack, onCreate, organizationId }: EventCreatorProps) {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsIntegration();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
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
    visibility: 'public' as 'public' | 'unlisted' | 'private',   // NEW
    culturalGuide: {
      history: '',
      themes: [] as string[],
      community: [] as string[]
    }
  });

  const [location, setLocation] = useState<Location | null>(null);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { id: '1', name: 'General Admission', price: 0, badge: 'GA', quantity: 100 }
  ]);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    const newStep = Math.min(totalSteps, step + 1);
    trackEvent('event_creation_step', {
      from_step: step,
      to_step: newStep,
      organization_id: organizationId,
      direction: 'forward'
    });
    setStep(newStep);
  };
  const handlePrevious = () => {
    const newStep = Math.max(1, step - 1);
    trackEvent('event_creation_step', {
      from_step: step,
      to_step: newStep,
      organization_id: organizationId,
      direction: 'backward'
    });
    setStep(newStep);
  };

  const addTicketTier = () => {
    setTicketTiers((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', price: 0, badge: '', quantity: 0 }
    ]);
  };
  const updateTicketTier = (id: string, field: keyof TicketTier, value: string | number) => {
    setTicketTiers((tiers) => tiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };
  const removeTicketTier = (id: string) => setTicketTiers((tiers) => tiers.filter((t) => t.id !== id));

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.title && formData.description && formData.category && formData.visibility;
      case 2:
        return formData.startDate && formData.startTime && formData.endDate && formData.endTime && location;
      case 3:
        return ticketTiers.every((t) => t.name && t.badge && t.quantity > 0);
      default:
        return true;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `event-cover-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('event-media')
        .getPublicUrl(filePath);

      setFormData({ ...formData, coverImageUrl: publicUrl });
      
      toast({
        title: "Image uploaded",
        description: "Cover image uploaded successfully!"
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Ensure slug is unique in DB
  const ensureUniqueEventSlug = async (title: string) => {
    const desired = title;
    return await ensureAvailableSlug(desired, async (slug) => {
      const { data, error } = await supabase
        .from('events')
        .select('id', { head: true, count: 'exact' })
        .eq('slug', slug);
      if (error) return true; // be safe: treat unknown as exists
      return (data === null ? false : true); // head=true returns null; rely on count below when possible
    });
  };

  const handleSubmit = async () => {
    if (!user || !location) return;
    
    trackEvent('event_creation_submit_start', {
      organization_id: organizationId,
      event_title: formData.title,
      event_category: formData.category,
      event_visibility: formData.visibility,
      ticket_tiers_count: ticketTiers.length
    });
    
    setLoading(true);
    try {
      const startAt = new Date(`${formData.startDate}T${formData.startTime}`);
      const endAt = new Date(`${formData.endDate}T${formData.endTime}`);

      // Optional hardened unlisted token (requires DB column "link_token")
      const linkToken = formData.visibility === 'unlisted' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : null;

      const slug = await ensureUniqueEventSlug(formData.title);

      const insertPayload: any = {
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
        link_token: linkToken
      };

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(insertPayload)
        .select('id')
        .single();

      if (eventError) throw eventError;

      const tierInserts = ticketTiers.map((tier) => ({
        event_id: event.id,
        name: tier.name,
        price_cents: Math.round(tier.price * 100),
        quantity: tier.quantity,
        badge_label: tier.badge,
        currency: 'USD',
        status: 'active'
      }));
      const { error: tiersError } = await supabase.from('ticket_tiers').insert(tierInserts);
      if (tiersError) throw tiersError;

      if (formData.culturalGuide.history ||
          formData.culturalGuide.themes.length ||
          formData.culturalGuide.community.length) {
        const { error: guideError } = await supabase.from('cultural_guides').insert({
          event_id: event.id,
          history_long: formData.culturalGuide.history,
          themes: formData.culturalGuide.themes,
          community: formData.culturalGuide.community
        });
        if (guideError) throw guideError;
      }

      trackEvent('event_creation_success', {
        organization_id: organizationId,
        event_id: event.id,
        event_title: formData.title,
        event_category: formData.category,
        event_visibility: formData.visibility,
        ticket_tiers_count: ticketTiers.length,
        has_cultural_guide: !!(formData.culturalGuide.history || formData.culturalGuide.themes.length || formData.culturalGuide.community.length)
      });

      toast({
        title: "Event Created!",
        description: formData.visibility === 'unlisted'
          ? "Unlisted: share the link with the secret token."
          : formData.visibility === 'private'
          ? "Private: only invited users and ticket-holders can view."
          : "Public: visible in search and feeds."
      });
      onCreate();
    } catch (err: any) {
      trackEvent('event_creation_error', {
        organization_id: organizationId,
        error_message: err.message,
        step: step,
        event_title: formData.title
      });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to create events.</p>
          <Button onClick={onBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Create Event</h1>
            <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Event Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title">Event Title *</label>
                <Input id="title" placeholder="Enter event title" value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}/>
              </div>

              <AIWritingAssistant
                currentText={formData.description}
                onTextChange={(description) => setFormData({ ...formData, description })}
                placeholder="Tell people what your event is about..."
                context={{
                  title: formData.title,
                  category: formData.category,
                  venue: formData.venue,
                  startDate: formData.startDate
                }}
              />

              <div className="space-y-2">
                <label>Category *</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* NEW: Visibility */}
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
                <p className="text-xs text-muted-foreground">
                  Unlisted can optionally use a secret token in the URL (<code>?k=…</code>).
                </p>
              </div>

              <div className="space-y-4">
                <label>Cover Image</label>
                
                {/* Current Image Display */}
                {formData.coverImageUrl && (
                  <div className="space-y-2">
                    <img 
                      src={formData.coverImageUrl} 
                      alt="Cover preview"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setFormData({ ...formData, coverImageUrl: '' })}
                    >
                      Remove Image
                    </Button>
                  </div>
                )}

                {/* Upload or Generate Options */}
                {!formData.coverImageUrl && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Traditional Upload */}
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">Upload Image</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? 'Uploading...' : 'Choose File'}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    {/* AI Generation */}
                    <div className="border-2 border-dashed border-primary/20 rounded-lg p-4">
                      <AIImageGenerator
                        onImageGenerated={(imageUrl) => setFormData({ ...formData, coverImageUrl: imageUrl })}
                        context={{
                          title: formData.title,
                          category: formData.category,
                          description: formData.description,
                          venue: formData.venue
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Schedule & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Schedule */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Event Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label>Start Date *</label>
                    <Input type="date" value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}/>
                  </div>
                  <div className="space-y-2">
                    <label>Start Time *</label>
                    <Input type="time" value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label>End Date *</label>
                    <Input type="date" value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate || new Date().toISOString().split('T')[0]}/>
                  </div>
                  <div className="space-y-2">
                    <label>End Time *</label>
                    <Input type="time" value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}/>
                  </div>
                </div>

                <div className="space-y-2">
                  <label>Venue Name</label>
                  <Input placeholder="Enter venue name (optional)"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}/>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </h3>
                <MapboxLocationPicker value={location} onChange={setLocation} />
              </div>

              {/* Cultural Guide (optional) */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Cultural Guide (Optional)</h3>
                <p className="text-xs text-muted-foreground">
                  Share the story or meaning behind your event.
                </p>
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
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Ticket Tiers
                <Button size="sm" onClick={addTicketTier}><Plus className="w-4 h-4 mr-1" />Add Tier</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketTiers.map((tier, index) => (
                <Card key={tier.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm">Tier {index + 1}</h4>
                      {ticketTiers.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeTicketTier(tier.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <label>Tier Name *</label>
                        <Input placeholder="e.g., General Admission" value={tier.name}
                          onChange={(e) => updateTicketTier(tier.id, 'name', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label>Badge *</label>
                        <Input placeholder="e.g., GA" value={tier.badge}
                          onChange={(e) => updateTicketTier(tier.id, 'badge', e.target.value)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label>Price ($) *</label>
                        <Input type="number" min="0" step="0.01" value={tier.price}
                          onChange={(e) => updateTicketTier(tier.id, 'price', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-2">
                        <label>Quantity *</label>
                        <Input type="number" min="1" value={tier.quantity}
                          onChange={(e) => updateTicketTier(tier.id, 'quantity', parseInt(e.target.value) || 0)} />
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

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Event Preview</h2>
              <p className="text-sm text-muted-foreground">This is how your event will appear to users</p>
            </div>
            
            {/* EVENT PREVIEW - matches EventSlugPage design */}
            <div className="pb-8">
              {/* COVER IMAGE */}
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

              {/* HEADER CARD */}
              <div className={`${formData.coverImageUrl ? '-mt-12' : ''} relative`}>
                <Card className="shadow-lg">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {formData.category ? (
                          <Badge variant="secondary" className="mb-2">{formData.category}</Badge>
                        ) : null}
                        <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                          {formData.title}
                        </h1>
                        <div className="mt-2 text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {formData.startDate && formData.startTime 
                                ? `${new Date(formData.startDate).toLocaleDateString()} at ${formData.startTime}`
                                : 'Date TBA'
                              }
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

                    {/* MOCK ATTENDEES */}
                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex -space-x-2 overflow-hidden">
                        {/* Mock attendee avatars */}
                        <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gradient-to-br from-blue-400 to-purple-500" />
                        <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gradient-to-br from-green-400 to-blue-500" />
                        <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gradient-to-br from-purple-400 to-pink-500" />
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        <Users className="w-4 h-4 mr-2" />
                        See who's going
                      </Button>
                    </div>

                    {/* ORGANIZER */}
                    <div className="mt-4 text-sm">
                      Hosted by{' '}
                      <span className="font-medium text-primary">
                        Your Organization
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* DESCRIPTION */}
              {formData.description && (
                <Card className="mt-4">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">About this event</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {formData.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* CULTURAL GUIDE */}
              {formData.culturalGuide.history && (
                <Card className="mt-4">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">Cultural Guide</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {formData.culturalGuide.history}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* TICKETS */}
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
