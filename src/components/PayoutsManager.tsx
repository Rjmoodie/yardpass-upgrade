import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Building2,
  User,
  ExternalLink
} from 'lucide-react';
import { PayoutDashboard } from './PayoutDashboard';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';

interface OrganizationPayoutsProps {
  organizationId: string;
}

export function OrganizationPayouts({ organizationId }: OrganizationPayoutsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organization Payouts</h2>
          <p className="text-muted-foreground">
            Manage payments and payouts for your organization's events
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Building2 className="w-3 h-3" />
          Organization
        </Badge>
      </div>

      <PayoutDashboard
        contextType="organization"
        contextId={organizationId}
      />
    </div>
  );
}

export function IndividualPayouts() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please log in to view your payout information.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Personal Payouts</h2>
          <p className="text-muted-foreground">
            Manage payments and payouts for your personal events
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <User className="w-3 h-3" />
          Individual
        </Badge>
      </div>

      <PayoutDashboard
        contextType="individual"
        contextId={user.id}
      />
    </div>
  );
}

export function PayoutsManager() {
  const { user } = useAuth();
  const { organizations } = useOrganizations(user?.id);
  const [selectedContext, setSelectedContext] = useState<{
    type: 'individual' | 'organization';
    id: string;
    name: string;
  } | null>(null);

  // Auto-select individual by default
  useEffect(() => {
    if (user && !selectedContext) {
      setSelectedContext({
        type: 'individual',
        id: user.id,
        name: 'Personal Account'
      });
    }
  }, [user, selectedContext]);

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please log in to access payout management.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Context Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payout Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {/* Personal Account */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedContext?.type === 'individual' && selectedContext?.id === user.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => setSelectedContext({
                type: 'individual',
                id: user.id,
                name: 'Personal Account'
              })}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Personal Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Individual events and payouts
                  </p>
                </div>
                {selectedContext?.type === 'individual' && selectedContext?.id === user.id && (
                  <CheckCircle className="w-5 h-5 text-primary" />
                )}
              </div>
            </div>

            {/* Organization Accounts */}
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedContext?.type === 'organization' && selectedContext?.id === org.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground'
                }`}
                onClick={() => setSelectedContext({
                  type: 'organization',
                  id: org.id,
                  name: org.name
                })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{org.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Organization events and payouts
                    </p>
                  </div>
                  {selectedContext?.type === 'organization' && selectedContext?.id === org.id && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Context Payouts */}
      {selectedContext && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{selectedContext.name} Payouts</h2>
              <p className="text-muted-foreground">
                Manage payments and payouts for {selectedContext.type === 'individual' ? 'your personal' : 'organization'} events
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              {selectedContext.type === 'individual' ? (
                <User className="w-3 h-3" />
              ) : (
                <Building2 className="w-3 h-3" />
              )}
              {selectedContext.type === 'individual' ? 'Individual' : 'Organization'}
            </Badge>
          </div>

          <PayoutDashboard
            contextType={selectedContext.type}
            contextId={selectedContext.id}
          />
        </div>
      )}
    </div>
  );
}