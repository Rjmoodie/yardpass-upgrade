import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BrandedSpinner } from '../BrandedSpinner';

interface SponsorCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onCreated: (sponsorId: string) => void;
}

export function SponsorCreateDialog({ open, onOpenChange, userId, onCreated }: SponsorCreateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    website_url: "",
    contact_email: "",
    description: ""
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    try {
      // Create sponsor account
      const { data: sponsor, error: sponsorError } = await supabase
        .from('sponsorship.sponsors')
        .insert({
          name: formData.name,
          website_url: formData.website_url || null,
          contact_email: formData.contact_email || null,
          created_by: userId
        })
        .select()
        .single();

      if (sponsorError) throw sponsorError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('sponsorship.sponsor_members')
        .insert({
          sponsor_id: sponsor.id,
          user_id: userId,
          role: 'owner'
        });

      if (memberError) throw memberError;

      toast({
        title: "Sponsor account created",
        description: `${formData.name} has been successfully created.`
      });

      onCreated(sponsor.id);
      onOpenChange(false);
      setFormData({ name: "", website_url: "", contact_email: "", description: "" });
    } catch (error) {
      console.error('Error creating sponsor:', error);
      toast({
        title: "Failed to create sponsor",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Sponsor Account</DialogTitle>
          <DialogDescription>
            Set up a new brand account to start sponsoring events and tracking performance.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Brand Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your brand name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
              placeholder="contact@yourbrand.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url">Website</Label>
            <Input
              id="website_url"
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://yourbrand.com"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <BrandedSpinner size="sm" />}
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}