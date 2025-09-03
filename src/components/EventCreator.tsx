import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Plus, X, Upload, Calendar, MapPin } from 'lucide-react';
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
    culturalGuide: {
      history: '',
      etiquette: [] as string[],
      themes: [] as string[],
      community: [] as string[]
    }
  });
  const [location, setLocation] = useState<Location | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { id: '1', name: 'General Admission', price: 0, badge: 'GA', quantity: 100 }
  ]);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !location) return;
    
    setLoading(true);
    try {
      // Create start and end datetime strings
      const startAt = new Date(`${formData.startDate}T${formData.startTime}`);
      const endAt = new Date(`${formData.endDate}T${formData.endTime}`);
      
      // Create event
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
          visibility: 'public'
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Create ticket tiers
      const tierInserts = ticketTiers.map(tier => ({
        event_id: event.id,
        name: tier.name,
        price_cents: Math.round(tier.price * 100),
        quantity: tier.quantity,
        badge_label: tier.badge,
        currency: 'USD',
        status: 'active'
      }));

      const { error: tiersError } = await supabase
        .from('ticket_tiers')
        .insert(tierInserts);

      if (tiersError) throw tiersError;

      // Create cultural guide if provided
      if (formData.culturalGuide.history || 
          formData.culturalGuide.etiquette.length > 0 || 
          formData.culturalGuide.themes.length > 0 || 
          formData.culturalGuide.community.length > 0) {
        
        const { error: guideError } = await supabase
          .from('cultural_guides')
          .insert({
            event_id: event.id,
            history_long: formData.culturalGuide.history,
            etiquette_tips: formData.culturalGuide.etiquette,
            themes: formData.culturalGuide.themes,
            community: formData.culturalGuide.community
          });

        if (guideError) throw guideError;
      }

      toast({
        title: "Event Created!",
        description: "Your event has been successfully created and published."
      });

      onCreate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addTicketTier = () => {
    const newTier: TicketTier = {
      id: Date.now().toString(),
      name: '',
      price: 0,
      badge: '',
      quantity: 0
    };
    setTicketTiers([...ticketTiers, newTier]);
  };

  const updateTicketTier = (id: string, field: keyof TicketTier, value: string | number) => {
    setTicketTiers(tiers =>
      tiers.map(tier =>
        tier.id === id ? { ...tier, [field]: value } : tier
      )
    );
  };

  const removeTicketTier = (id: string) => {
    setTicketTiers(tiers => tiers.filter(tier => tier.id !== id));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.title && formData.description && formData.category;
      case 2:
        return formData.startDate && formData.startTime && formData.endDate && formData.endTime && location;
      case 3:
        return ticketTiers.every(tier => tier.name && tier.badge && tier.quantity > 0);
      case 4:
        return true;
      default:
        return false;
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
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
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
                <Input
                  id="title"
                  placeholder="Enter event title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description">Description *</label>
                <Textarea
                  id="description"
                  placeholder="Tell people what your event is about..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="category">Category *</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="cover">Cover Image</label>
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Upload a cover image</p>
                  <Button variant="outline" size="sm">Choose File</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Schedule */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Event Schedule</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="start-date">Start Date *</label>
                    <Input
                      id="start-date"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="start-time">Start Time *</label>
                    <Input
                      id="start-time"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="end-date">End Date *</label>
                    <Input
                      id="end-date"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="end-time">End Time *</label>
                    <Input
                      id="end-time"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="venue">Venue Name</label>
                  <Input
                    id="venue"
                    placeholder="Enter venue name (optional)"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  />
                </div>
              </div>

              {/* Location Picker */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </h3>
                <MapboxLocationPicker
                  value={location}
                  onChange={setLocation}
                />
              </div>

              {/* Cultural Guide */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Cultural Guide (Optional)</h3>
                <p className="text-xs text-muted-foreground">
                  Help attendees understand the cultural significance or background of your event
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="cultural-history">Historical Context</label>
                    <Textarea
                      id="cultural-history"
                      placeholder="Share the history or background of this event type..."
                      value={formData.culturalGuide.history}
                      onChange={(e) => setFormData({
                        ...formData,
                        culturalGuide: { ...formData.culturalGuide, history: e.target.value }
                      })}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="cultural-etiquette">Etiquette Tips</label>
                    <Input
                      id="cultural-etiquette"
                      placeholder="Add etiquette tip and press Enter"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const value = (e.target as HTMLInputElement).value.trim();
                          if (value && !formData.culturalGuide.etiquette.includes(value)) {
                            setFormData({
                              ...formData,
                              culturalGuide: {
                                ...formData.culturalGuide,
                                etiquette: [...formData.culturalGuide.etiquette, value]
                              }
                            });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      {formData.culturalGuide.etiquette.map((tip, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tip}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                culturalGuide: {
                                  ...formData.culturalGuide,
                                  etiquette: formData.culturalGuide.etiquette.filter((_, i) => i !== index)
                                }
                              });
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
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
                <Button size="sm" onClick={addTicketTier}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Tier
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketTiers.map((tier, index) => (
                <Card key={tier.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm">Tier {index + 1}</h4>
                      {ticketTiers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTicketTier(tier.id)}
                        >
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
                          onChange={(e) => updateTicketTier(tier.id, 'name', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label>Badge *</label>
                        <Input
                          placeholder="e.g., GA"
                          value={tier.badge}
                          onChange={(e) => updateTicketTier(tier.id, 'badge', e.target.value)}
                        />
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
                          onChange={(e) => updateTicketTier(tier.id, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label>Quantity *</label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.quantity}
                          onChange={(e) => updateTicketTier(tier.id, 'quantity', parseInt(e.target.value) || 0)}
                        />
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
            <CardHeader>
              <CardTitle>Review & Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-2">Event Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Title:</strong> {formData.title}</div>
                    <div><strong>Category:</strong> {formData.category}</div>
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

              {(formData.culturalGuide.history || formData.culturalGuide.etiquette.length > 0) && (
                <div>
                  <h3 className="mb-2">Cultural Guide</h3>
                  {formData.culturalGuide.history && (
                    <p className="text-sm text-muted-foreground mb-2">{formData.culturalGuide.history}</p>
                  )}
                  {formData.culturalGuide.etiquette.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.culturalGuide.etiquette.map((tip, index) => (
                        <Badge key={index} variant="outline" className="text-xs">{tip}</Badge>
                      ))}
                    </div>
                  )}
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
                      <div className="text-sm">
                        ${tier.price} × {tier.quantity}
                      </div>
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
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={step === 1}
        >
          Previous
        </Button>
        
        {step < totalSteps ? (
          <Button 
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            disabled={!canProceed() || loading}
          >
            {loading ? 'Creating Event...' : 'Publish Event'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default EventCreator;