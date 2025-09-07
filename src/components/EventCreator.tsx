import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { createEventSlug } from '@/lib/slugUtils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Plus, X, Upload, Calendar, MapPin, Shield } from 'lucide-react';
import { MapboxLocationPicker } from './MapboxLocationPicker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

  const handleNext = () => setStep((s) => Math.min(totalSteps, s + 1));
  const handlePrevious = () => setStep((s) => Math.max(1, s - 1));

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

  const handleSubmit = async () => {
    if (!user || !location) return;
    setLoading(true);
    try {
      const startAt = new Date(`${formData.startDate}T${formData.startTime}`);
      const endAt = new Date(`${formData.endDate}T${formData.endTime}`);

      // Optional hardened unlisted token (requires DB column "link_token")
      const linkToken = formData.visibility === 'unlisted' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : null;

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
        slug: createEventSlug(formData.title),
        // comment the next line if you haven't added link_token column yet
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

              <div className="space-y-2">
                <label htmlFor="description">Description *</label>
                <Textarea id="description" placeholder="Tell people what your event is about..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-24"/>
              </div>

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

              <div className="space-y-2">
                <label>Cover Image</label>
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  {formData.coverImageUrl ? (
                    <div className="space-y-2">
                      <img 
                        src={formData.coverImageUrl} 
                        alt="Cover preview"
                        className="w-full h-32 object-cover rounded-lg mx-auto"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFormData({ ...formData, coverImageUrl: '' })}
                      >
                        Remove Image
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">Upload a cover image</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? 'Uploading...' : 'Choose File'}
                      </Button>
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
          <Card>
            <CardHeader><CardTitle>Review & Publish</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-2">Event Details</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Title:</strong> {formData.title}</div>
                  <div><strong>Category:</strong> {formData.category}</div>
                  <div><strong>Visibility:</strong> {formData.visibility}</div>
                  <div><strong>Start:</strong> {formData.startDate} at {formData.startTime}</div>
                  <div><strong>End:</strong> {formData.endDate} at {formData.endTime}</div>
                  {formData.venue && <div><strong>Venue:</strong> {formData.venue}</div>}
                  {location && <div><strong>Location:</strong> {location.address}</div>}
                </div>
              </div>

              <div>
                <h3 className="mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{formData.description}</p>
              </div>

              {formData.culturalGuide.history && (
                <div>
                  <h3 className="mb-2">Cultural Guide</h3>
                  <p className="text-sm text-muted-foreground mb-2">{formData.culturalGuide.history}</p>
                </div>
              )}

              <div>
                <h3 className="mb-2">Ticket Tiers</h3>
                <div className="space-y-2">
                  {ticketTiers.map((tier) => (
                    <div key={tier.id} className="flex justify-between items-center p-3 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tier.badge}</Badge>
                        <span className="text-sm">{tier.name}</span>
                      </div>
                      <div className="text-sm">${tier.price} × {tier.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-card p-4 flex justify-between">
        <Button variant="outline" onClick={handlePrevious} disabled={step === 1}>Previous</Button>
        {step < totalSteps ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canProceed() || loading}>
            {loading ? 'Creating Event...' : 'Publish Event'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default EventCreator;
