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
  Settings,
  ExternalLink,
  Globe
} from 'lucide-react';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';

interface OrganizationSuccessProps {
  organizationId: string;
  organizationName: string;
  organizationHandle: string;
  onContinue: () => void;
  onCreateEvent?: () => void;
  onManageOrganization?: () => void;
}

export function OrganizationSuccess({
  organizationId,
  organizationName,
  organizationHandle,
  onContinue,
  onCreateEvent,
  onManageOrganization
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={onCreateEvent}
          className="group text-left bg-card hover:bg-accent/5 border border-border rounded-xl p-6 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">Create Event</h3>
              <p className="text-sm text-muted-foreground">Start planning your first event</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
          </div>
        </button>

        <button 
          onClick={onManageOrganization}
          className="group text-left bg-card hover:bg-accent/5 border border-border rounded-xl p-6 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">Manage Profile</h3>
              <p className="text-sm text-muted-foreground">Add social links & team members</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
          </div>
        </button>

        <button 
          onClick={() => setShowStripeSetup(!showStripeSetup)}
          className="group text-left bg-card hover:bg-accent/5 border border-border rounded-xl p-6 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">Enable Payouts</h3>
              <p className="text-sm text-muted-foreground">Connect Stripe for payments</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
          </div>
        </button>
      </div>

      {/* View Organization Profile CTA */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Your Organization is Live!</h3>
                <p className="text-sm text-muted-foreground">
                  View your public organization profile at @{organizationHandle}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.open(`/org/${organizationHandle}`, '_blank')}
              className="gap-2"
            >
              View Profile <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <h4 className="font-medium">Organization Profile</h4>
                <p className="text-sm text-muted-foreground">
                  Add social media links, team members, and customize your organization's public profile
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onManageOrganization}
                >
                  Manage Profile
                </Button>
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
      <div className="flex justify-center gap-4 pt-4">
        <Button onClick={onContinue} size="lg" className="px-8">
          Continue to Events
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}