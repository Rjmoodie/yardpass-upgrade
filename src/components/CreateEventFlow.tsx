import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationCreator } from './OrganizationCreator';
import { EventCreator } from './EventCreator';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Building2, Plus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  handle: string;
  logo_url?: string;
}

interface CreateEventFlowProps {
  onBack: () => void;
  onCreate: () => void;
}

export function CreateEventFlow({ onBack, onCreate }: CreateEventFlowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'select-org' | 'create-org' | 'create-event'>('select-org');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserOrganizations();
    }
  }, [user]);

  const loadUserOrganizations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('org_memberships')
        .select(`
          organizations (
            id,
            name,
            handle,
            logo_url
          )
        `)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin', 'editor']);

      if (error) throw error;

      const orgs = data
        .map(item => item.organizations)
        .filter(Boolean) as Organization[];
      
      setOrganizations(orgs);
      
      // Auto-select if only one organization
      if (orgs.length === 1) {
        setSelectedOrgId(orgs[0].id);
        setStep('create-event');
      } else if (orgs.length === 0) {
        setStep('create-org');
      }
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

  const handleOrgCreated = (orgId: string) => {
    setSelectedOrgId(orgId);
    setStep('create-event');
    loadUserOrganizations(); // Refresh the list
  };

  const handleEventCreated = () => {
    onCreate();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (step === 'create-org') {
    return (
      <OrganizationCreator
        onBack={onBack}
        onSuccess={handleOrgCreated}
      />
    );
  }

  if (step === 'create-event') {
    return (
      <EventCreator
        onBack={() => setStep('select-org')}
        onCreate={handleEventCreated}
        organizationId={selectedOrgId}
      />
    );
  }

  // Organization selection step
  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Building2 className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Create Event</h1>
            <p className="text-sm text-muted-foreground">
              Choose an organization or create a new one
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Select Existing Organization */}
          {organizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Select Organization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        <div className="flex items-center gap-2">
                          <span>{org.name}</span>
                          <span className="text-xs text-muted-foreground">@{org.handle}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  className="w-full" 
                  onClick={() => setStep('create-event')}
                  disabled={!selectedOrgId}
                >
                  Continue with Selected Organization
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Create New Organization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new organization to manage your events and team members.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setStep('create-org')}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Why Organizations?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <p>Collaborate with team members on event management</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <p>Centralized billing and payment processing</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <p>Professional branding and verification</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <p>Analytics and reporting across all events</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CreateEventFlow;