import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Plus, X, Upload } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface EventCreatorProps {
  user: User;
  onBack: () => void;
  onCreate: () => void;
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

export function EventCreator({ user, onBack, onCreate }: EventCreatorProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    time: '',
    location: '',
    coverImage: '',
    culturalGuide: ''
  });
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

  const handleSubmit = () => {
    // Mock event creation
    onCreate();
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
        return formData.date && formData.time && formData.location;
      case 3:
        return ticketTiers.every(tier => tier.name && tier.badge && tier.quantity > 0);
      case 4:
        return true;
      default:
        return false;
    }
  };

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
              <CardTitle>Schedule & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="date">Event Date *</label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="time">Start Time *</label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="location">Location *</label>
                <Input
                  id="location"
                  placeholder="Enter event location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="cultural">Cultural Guide (Optional)</label>
                <Textarea
                  id="cultural"
                  placeholder="Add cultural or historical context for your event..."
                  value={formData.culturalGuide}
                  onChange={(e) => setFormData({ ...formData, culturalGuide: e.target.value })}
                  className="min-h-20"
                />
                <p className="text-xs text-muted-foreground">
                  Help attendees understand the cultural significance or background of your event
                </p>
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
                  <div><strong>Date:</strong> {formData.date} at {formData.time}</div>
                  <div><strong>Location:</strong> {formData.location}</div>
                </div>
              </div>

              <div>
                <h3 className="mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{formData.description}</p>
              </div>

              {formData.culturalGuide && (
                <div>
                  <h3 className="mb-2">Cultural Guide</h3>
                  <p className="text-sm text-muted-foreground">{formData.culturalGuide}</p>
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
            disabled={!canProceed()}
          >
            Publish Event
          </Button>
        )}
      </div>
    </div>
  );
}