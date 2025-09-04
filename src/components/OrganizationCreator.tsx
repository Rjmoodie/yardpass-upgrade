import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { ArrowLeft, Upload, Users, Building2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface OrganizationCreatorProps {
  onBack: () => void;
  onSuccess: (orgId: string) => void;
}

export function OrganizationCreator({ onBack, onSuccess }: OrganizationCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    description: '',
    logoUrl: ''
  });

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Use the new RPC function to create organization and membership atomically
      const { data: orgId, error } = await supabase.rpc('create_organization_with_membership', {
        p_name: formData.name,
        p_handle: formData.handle,
        p_logo_url: formData.logoUrl || null,
        p_creator_id: user.id
      });

      if (error) throw error;

      toast({
        title: "Organization Created",
        description: "Your organization has been created successfully!"
      });

      onSuccess(orgId);
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

  const canProceed = () => {
    if (step === 1) {
      return formData.name && formData.handle;
    }
    return true;
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Create Organization</h1>
            <p className="text-sm text-muted-foreground">
              Set up your organization to manage events and team members
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {step === 1 && (
          <div className="space-y-6">
            {/* Organization Basics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Organization Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name">Organization Name *</label>
                  <Input
                    id="name"
                    placeholder="Enter organization name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="handle">Handle *</label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">@</span>
                    <Input
                      id="handle"
                      placeholder="your-organization"
                      value={formData.handle}
                      onChange={(e) => setFormData({ ...formData, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be your unique identifier (letters, numbers, hyphens only)
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description">Description</label>
                  <Textarea
                    id="description"
                    placeholder="Tell people about your organization..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logo Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Organization Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="text-lg">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : <Building2 className="w-8 h-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">Upload your organization logo</p>
                      <Button variant="outline" size="sm">
                        Choose Logo
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            {formData.name && (
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>
                        {formData.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm">{formData.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          @{formData.handle}
                        </Badge>
                      </div>
                      {formData.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formData.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next Steps Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  What's Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm">Invite team members with different roles</p>
                    <p className="text-xs text-muted-foreground">Admin, Editor, Scanner permissions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm">Complete business verification for payouts</p>
                    <p className="text-xs text-muted-foreground">Required for processing payments</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm">Create and manage events as a team</p>
                    <p className="text-xs text-muted-foreground">Collaborative event management</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-card p-4 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        
        <Button 
          onClick={handleSubmit}
          disabled={!canProceed() || loading}
          className="px-8"
        >
          {loading ? 'Creating...' : 'Create Organization'}
        </Button>
      </div>
    </div>
  );
}

export default OrganizationCreator;