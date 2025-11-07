import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, Loader2, BarChart3, Package } from 'lucide-react';
import { formatCentsAsCurrency } from '@/utils/formatters';
import { AnalyticsSelector } from '@/components/organizer/AnalyticsSelector';
import type { AnalyticsShowcase } from '@/types/analytics';

interface PackageEditorProps {
  eventId: string;
  onCreated?: () => void;
}

export function PackageEditor({ eventId, onCreated }: PackageEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceCents, setPriceCents] = useState(50000);
  const [inventory, setInventory] = useState(1);
  const [benefits, setBenefits] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [analyticsShowcase, setAnalyticsShowcase] = useState<AnalyticsShowcase>({
    enabled: false,
    metrics: [],
    source: 'current',
  });
  const [referenceEventId, setReferenceEventId] = useState<string | null>(null);
  const [pastEvents, setPastEvents] = useState<Array<{ id: string; title: string; start_at: string }>>([]);

  // Fetch organizer's past events for analytics reference
  useEffect(() => {
    const fetchPastEvents = async () => {
      try {
        // Get the current event to determine the organizer
        const { data: currentEvent } = await supabase
          .from('events')
          .select('owner_context_type, owner_context_id, created_by')
          .eq('id', eventId)
          .single();

        if (!currentEvent) return;

        // Fetch past events from the same organizer
        let query = supabase
          .from('events')
          .select('id, title, start_at')
          .lt('end_at', new Date().toISOString())
          .neq('id', eventId)
          .order('start_at', { ascending: false })
          .limit(10);

        if (currentEvent.owner_context_type === 'organization') {
          query = query
            .eq('owner_context_type', 'organization')
            .eq('owner_context_id', currentEvent.owner_context_id);
        } else {
          query = query
            .eq('owner_context_type', 'individual')
            .eq('created_by', currentEvent.created_by);
        }

        const { data } = await query;
        setPastEvents(data || []);
      } catch (error) {
        console.error('Error fetching past events:', error);
      }
    };

    fetchPastEvents();
  }, [eventId]);

  const addBenefit = () => {
    setBenefits([...benefits, '']);
  };

  const removeBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  const updateBenefit = (index: number, value: string) => {
    const newBenefits = [...benefits];
    newBenefits[index] = value;
    setBenefits(newBenefits);
  };

  const createPackage = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a package title',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const filteredBenefits = benefits.filter(b => b.trim());

      const { error } = await supabase
        .from('sponsorship_packages')
        .insert({
          event_id: eventId,
          tier: title.trim(), // Use title as tier for backward compatibility
          title: title.trim(),
          description: description.trim() || null,
          price_cents: priceCents,
          inventory,
          benefits: filteredBenefits,
          created_by: user.id,
          analytics_showcase: analyticsShowcase,
          reference_event_id: analyticsShowcase.source === 'reference' ? referenceEventId : null,
        });

      if (error) {
        console.error('Package creation error:', error);
        throw error;
      }

      toast({
        title: 'Package Created',
        description: 'Your sponsorship package has been created successfully.',
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPriceCents(50000);
      setInventory(1);
      setBenefits(['']);
      setAnalyticsShowcase({
        enabled: false,
        metrics: [],
        source: 'current',
      });
      setReferenceEventId(null);

      onCreated?.();

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create package';
      console.error('Error creating package:', error);
      toast({
        title: 'Creation Failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Sponsorship Package</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="gap-2">
              <Package className="h-4 w-4" />
              Package Details
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics Showcase
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
        <div>
          <label className="text-sm font-medium">Package Title</label>
          <Input
            placeholder="e.g., Gold Sponsor Package"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea
            placeholder="Describe what this sponsorship package includes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Price ($)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={priceCents / 100 || ''}
              onChange={(e) => {
                const value = e.target.value;
                setPriceCents(value === '' ? 0 : Math.round(Number(value) * 100));
              }}
              placeholder="5000"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formatCentsAsCurrency(priceCents)}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Available Spots</label>
            <Input
              type="number"
              min="1"
              value={inventory || ''}
              onChange={(e) => {
                const value = e.target.value;
                setInventory(value === '' ? 1 : parseInt(value, 10));
              }}
              placeholder="1"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Package Benefits</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBenefit}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Benefit
            </Button>
          </div>

          <div className="space-y-2">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="e.g., Logo on event website"
                  value={benefit}
                  onChange={(e) => updateBenefit(index, e.target.value)}
                />
                {benefits.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeBenefit(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsSelector
              value={analyticsShowcase}
              onChange={setAnalyticsShowcase}
              currentEventId={eventId}
              availablePastEvents={pastEvents}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button 
            onClick={createPackage} 
            disabled={loading || !title.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Package...
              </>
            ) : (
              'Create Sponsorship Package'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}