import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  CheckCircle,
  Building2,
  Users,
  CreditCard,
  ArrowRight,
  Calendar,
  Share,
  Settings
} from 'lucide-react';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';

interface OrganizationSuccessProps {
  organizationId: string;
  organizationName: string;
  organizationHandle: string;
  onContinue: () => void;
  onCreateEvent?: () => void;
}

export function OrganizationSuccess({
  organizationId,
  organizationName,
  organizationHandle,
  onContinue,
  onCreateEvent
}: OrganizationSuccessProps) {
  const [showStripeSetup, setShowStripeSetup] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success Header */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-900">Organization Created!</h2>
              <p className="text-green-700 mt-2">
                <strong>{organizationName}</strong> (@{organizationHandle}) is ready to go
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onCreateEvent}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Create Your First Event</h3>
                <p className="text-sm text-muted-foreground">Start planning your event</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowStripeSetup(!showStripeSetup)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Enable Payouts</h3>
                <p className="text-sm text-muted-foreground">Connect Stripe to receive payments</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Connect Setup */}
      {showStripeSetup && (
        <StripeConnectOnboarding
          contextType="organization"
          contextId={organizationId}
          title="Connect Stripe for Payouts"
          description="Set up secure payment processing to receive revenue from your events"
        />
      )}

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Next Steps for Your Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-1">
                <Users className="w-3 h-3 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Invite Team Members</h4>
                <p className="text-sm text-muted-foreground">
                  Add team members with Admin, Editor, or Scanner roles to collaborate on events
                </p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Coming Soon
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-1">
                <CreditCard className="w-3 h-3 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Payment Processing</h4>
                <p className="text-sm text-muted-foreground">
                  Complete Stripe verification to automatically receive payments from ticket sales
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowStripeSetup(true)}
                >
                  Set Up Payments
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-1">
                <Settings className="w-3 h-3 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Organization Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Customize your organization profile, branding, and preferences
                </p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Available in Dashboard
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Helpful Info */}
      <Alert>
        <Share className="h-4 w-4" />
        <AlertDescription>
          <strong>Pro tip:</strong> You can always set up payments later from your organization dashboard. 
          Focus on creating great events first, then enable payouts when you're ready to start selling tickets.
        </AlertDescription>
      </Alert>

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button onClick={onContinue} size="lg" className="px-8">
          Continue to Event Creation
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}