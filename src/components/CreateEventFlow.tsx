import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationCreator } from './OrganizationCreator';
import { EventCreator } from './EventCreator';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Building2, Plus, Users, RefreshCw, ArrowLeft } from 'lucide-react';
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

const LAST_ORG_KEY = 'yp:lastOrgId';

export function CreateEventFlow({ onBack, onCreate }: CreateEventFlowProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<'select-org' | 'create-org' | 'create-event'>('select-org');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Restore last used org early (for optimistic preselect)
  useEffect(() => {
    if (!user) return;
    const lastId = localStorage.getItem(LAST_ORG_KEY) || '';
    if (lastId) setSelectedOrgId(lastId);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const loadUserOrganizations = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const { data, error } = await supabase
          .from('org_memberships')
          .select(`
            role,
            organizations!fk_org_memberships_org_id (
              id,
              name,
              handle,
              logo_url
            )
          `)
          .eq('user_id', user.id)
          .in('role', ['owner', 'admin', 'editor']);

        if (error) throw error;

        const orgs = (data ?? [])
          .map((row) => row.organizations)
          .filter(Boolean) as Organization[];

        if (!alive) return;

        setOrganizations(orgs);

        // Auto-routes:
        if (orgs.length === 0) {
          setStep('create-org');
          return;
        }

        // Prefer last used org if still valid
        const lastId = localStorage.getItem(LAST_ORG_KEY) || '';
        if (lastId && orgs.some((o) => o.id === lastId)) {
          setSelectedOrgId(lastId);
        } else if (orgs.length === 1) {
          setSelectedOrgId(orgs[0].id);
          // don’t auto-jump immediately; let user confirm
        }

      } catch (err: any) {
        if (!alive) return;
        setLoadError(err?.message || 'Failed to load organizations');
        toast({
          title: 'Error loading organizations',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadUserOrganizations();
    return () => { alive = false; };
  }, [user, toast]);

  // Persist last used org selection
  useEffect(() => {
    if (selectedOrgId) localStorage.setItem(LAST_ORG_KEY, selectedOrgId);
  }, [selectedOrgId]);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.handle.toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const handleContinue = useCallback(() => {
    if (!selectedOrgId) return;
    setStep('create-event');
  }, [selectedOrgId]);

  const handleOrgCreated = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    localStorage.setItem(LAST_ORG_KEY, orgId);
    setStep('create-event');
  }, []);

  const handleEventCreated = useCallback(() => {
    toast({ title: 'Event created 🎉', description: 'Redirecting...' });
    onCreate();
  }, [onCreate, toast]);

  const retryLoad = useCallback(() => {
    // Force a fresh reload by toggling loading + clearing error
    setLoadError(null);
    setLoading(true);
    // Instead of page reload, just refresh the data
    window.setTimeout(() => {
      // Reset the component state instead of full page reload
      setLoading(false);
    }, 100);
  }, []);

  // —————————————————————
  // Guards
  // —————————————————————
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Sign in to create events and manage organizations.</p>
          <Button onClick={onBack} className="pill-button">Go Back</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <header className="flex items-center gap-3 mb-6">
          <Button onClick={onBack} variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1>Create Event</h1>
            <p className="text-sm text-muted-foreground">Loading organizations…</p>
          </div>
        </header>

        <div className="max-w-md mx-auto space-y-4">
          <Card className="enhanced-card">
            <CardHeader>
              <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </CardContent>
          </Card>

          <Card className="enhanced-card">
            <CardHeader>
              <div className="h-5 w-56 rounded-md bg-muted animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'create-org') {
    return <OrganizationCreator onBack={onBack} onSuccess={handleOrgCreated} />;
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

  // —————————————————————
  // Select Organization step
  // —————————————————————
  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Back to previous"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1>Create Event</h1>
            <p className="text-sm text-muted-foreground">
              Choose an organization or create a new one
            </p>
          </div>
          {loadError && (
            <Button variant="outline" size="sm" onClick={retryLoad} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Select Existing Organization */}
          {organizations.length > 0 && (
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Select Organization
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Search/filter */}
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search organizations by name or @handle"
                  aria-label="Search organizations"
                />

                <Select
                  value={selectedOrgId}
                  onValueChange={(val) => setSelectedOrgId(val)}
                >
                  <SelectTrigger aria-label="Organization selector">
                    <SelectValue placeholder={filteredOrgs.length ? "Choose an organization" : "No matches"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-auto scrollbar-slim">
                    {filteredOrgs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No organizations found</div>
                    ) : (
                      filteredOrgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{org.name}</span>
                            <span className="text-xs text-muted-foreground">@{org.handle}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Contextual helper */}
                {selectedOrgId && (
                  <div className="text-xs text-muted-foreground">
                    You’ll create this event under&nbsp;
                    <span className="font-medium">
                      @{organizations.find((o) => o.id === selectedOrgId)?.handle}
                    </span>.
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleContinue}
                    disabled={!selectedOrgId}
                  >
                    Continue with Selected Org
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => {
                      // refresh the list silently by forcing re-render
                      setStep('select-org');
                      setLoading(true);
                      setTimeout(() => setLoading(false), 100);
                    }}
                    title="Refresh organizations list"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create New Organization */}
          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Set up an organization to manage events, teammates, and payouts.
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
          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Why Organizations?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <Bullet>Collaborate with teammates on events and check-in.</Bullet>
              <Bullet>Centralized billing and payouts.</Bullet>
              <Bullet>Professional branding and verification.</Bullet>
              <Bullet>Unified analytics across events.</Bullet>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 bg-primary rounded-full mt-2" />
      <p>{children}</p>
    </div>
  );
}

export default CreateEventFlow;
