import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileDeploymentReadiness } from '@/components/MobileDeploymentReadiness';
import { updateMetaTags } from '@/utils/meta';
import { useEffect } from 'react';

interface DeploymentReadinessPageProps {
  onBack?: () => void;
}

export function DeploymentReadinessPage({ onBack }: DeploymentReadinessPageProps) {
  useEffect(() => {
    updateMetaTags({
      title: 'Mobile Deployment Readiness - Liventix',
      description: 'Check your app readiness for iOS and Android deployment',
      type: 'website'
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold">Mobile Deployment Readiness</h1>
            <p className="text-sm text-muted-foreground">
              Check your app's readiness for iOS and Android deployment
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <MobileDeploymentReadiness />
        
        {/* Additional Resources */}
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">Additional Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Capacitor Documentation</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Official Capacitor docs for mobile app development
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="https://capacitorjs.com/docs" target="_blank" rel="noopener noreferrer">
                  View Docs <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">App Store Guidelines</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Apple's guidelines for app submission
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="https://developer.apple.com/app-store/review/guidelines/" target="_blank" rel="noopener noreferrer">
                  View Guidelines <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeploymentReadinessPage;