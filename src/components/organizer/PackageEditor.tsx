import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X } from 'lucide-react';

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

      onCreated?.();

    } catch (error: any) {
      console.error('Error creating package:', error);
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create package',
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
      <CardContent className="space-y-4">
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
            <label className="text-sm font-medium">Price (cents)</label>
            <Input
              type="number"
              min="0"
              step="100"
              value={priceCents}
              onChange={(e) => setPriceCents(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ${(priceCents / 100).toLocaleString()}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Available Spots</label>
            <Input
              type="number"
              min="1"
              value={inventory}
              onChange={(e) => setInventory(parseInt(e.target.value) || 1)}
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

        <Button 
          onClick={createPackage} 
          disabled={loading || !title.trim()}
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Package'}
        </Button>
      </CardContent>
    </Card>
  );
}