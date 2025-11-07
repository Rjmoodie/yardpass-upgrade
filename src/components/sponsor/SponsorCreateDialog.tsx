import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Loader2 } from 'lucide-react';

interface SponsorCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sponsorId: string) => void;
}

export function SponsorCreateDialog({ open, onOpenChange, onCreated }: SponsorCreateDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
    logo_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a sponsor account',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.name || !formData.industry) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Insert sponsor record
      const { data: sponsor, error: sponsorError } = await supabase
        .from('sponsors')
        .insert({
          name: formData.name,
          industry: formData.industry,
          website: formData.website || null,
          logo_url: formData.logo_url || null,
          primary_contact_user_id: user.id,
        })
        .select()
        .single();

      if (sponsorError) throw sponsorError;

      // Create initial team member entry
      const { error: teamError } = await supabase
        .from('sponsor_team')
        .insert({
          sponsor_id: sponsor.id,
          user_id: user.id,
          role: 'owner',
          permissions: ['all'],
        });

      if (teamError) {
        console.error('Error creating team member:', teamError);
        // Non-fatal, continue
      }

      // Enable sponsor mode for the user
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ sponsor_mode_enabled: true })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error enabling sponsor mode:', profileError);
        // Non-fatal, continue
      }

      toast({
        title: 'Success!',
        description: `${formData.name} has been created`,
      });

      // Trigger analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'sponsor_account_created', {
          sponsor_id: sponsor.id,
          sponsor_name: formData.name,
          industry: formData.industry,
        });
      }

      onCreated(sponsor.id);
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        industry: '',
        website: '',
        description: '',
        logo_url: '',
      });
      
    } catch (error) {
      console.error('Error creating sponsor:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create sponsor account',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const industries = [
    'Technology',
    'Finance',
    'Healthcare',
    'Retail',
    'Manufacturing',
    'Education',
    'Entertainment',
    'Food & Beverage',
    'Sports & Fitness',
    'Travel & Hospitality',
    'Real Estate',
    'Automotive',
    'Fashion & Beauty',
    'Media & Publishing',
    'Other',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Create Sponsor Account</DialogTitle>
              <DialogDescription>
                Set up your sponsor profile to start discovering events
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">
              Industry <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
              disabled={loading}
              required
            >
              <SelectTrigger id="industry">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((industry) => (
                  <SelectItem key={industry} value={industry.toLowerCase().replace(/\s+/g, '_')}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell us about your company and sponsorship goals..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url">Logo URL (optional)</Label>
            <Input
              id="logo_url"
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
