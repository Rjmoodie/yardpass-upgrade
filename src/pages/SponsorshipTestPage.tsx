// Sponsorship Test Page - Quick test to verify integration
// This page can be used to test the sponsorship system integration

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SponsorshipTestPage: React.FC = () => {
  const navigate = useNavigate();

  const testRoutes = [
    {
      path: '/sponsorship',
      label: 'Main Sponsorship Page',
      description: 'Complete sponsorship system with all features',
      role: 'sponsor'
    },
    {
      path: '/sponsorship/event/test-event',
      label: 'Event Sponsorship Management',
      description: 'Organizer view for managing event sponsorships',
      role: 'organizer'
    },
    {
      path: '/sponsorship/sponsor/test-sponsor',
      label: 'Sponsor Profile Management',
      description: 'Sponsor view for managing profile and matches',
      role: 'sponsor'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sponsorship System Integration Test</h1>
        <p className="text-muted-foreground">
          Test the complete sponsorship system integration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testRoutes.map((route, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>{route.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {route.description}
              </p>
              
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{route.role}</Badge>
                <span className="text-xs text-muted-foreground">
                  {route.path}
                </span>
              </div>

              <Button 
                onClick={() => navigate(route.path)}
                className="w-full"
              >
                Test Route
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Integration Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Routes added to App.tsx</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Navigation updated</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Auth guards configured</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Components imported and ready</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SponsorshipTestPage;
