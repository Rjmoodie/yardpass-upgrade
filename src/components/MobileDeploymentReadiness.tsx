import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, XCircle, Smartphone, Globe, Settings } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getDeviceInfo, type DeviceInfo } from '@/utils/deviceInfo';
import { checkAppCapabilities, deploymentChecklist, type AppCapabilities } from '@/utils/appPermissions';

export function MobileDeploymentReadiness() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [capabilities, setCapabilities] = useState<AppCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const [device, caps] = await Promise.all([
          getDeviceInfo(),
          checkAppCapabilities()
        ]);
        setDeviceInfo(device);
        setCapabilities(caps);
      } catch (error) {
        console.error('Failed to load deployment info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInfo();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Mobile Deployment Readiness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner
            size="sm"
            label="Checking mobile readiness…"
            helperText="Gathering device info and required permissions"
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

  const renderCapabilityStatus = (capability: { granted: boolean; canRequest: boolean; message?: string }) => {
    if (capability.granted) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (capability.canRequest) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Device Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Current Platform
          </CardTitle>
          <CardDescription>
            Platform detection and capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Platform</p>
              <p className="text-sm text-muted-foreground">{deviceInfo?.platform}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Version</p>
              <p className="text-sm text-muted-foreground">{deviceInfo?.version}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Environment</p>
              <Badge variant={deviceInfo?.isNative ? 'default' : 'secondary'}>
                {deviceInfo?.isNative ? 'Native App' : 'Web Browser'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">App Version</p>
              <p className="text-sm text-muted-foreground">{deviceInfo?.appVersion}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            App Capabilities
          </CardTitle>
          <CardDescription>
            Available features and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {capabilities && Object.entries(capabilities).map(([key, capability]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderCapabilityStatus(capability)}
                  <span className="text-sm font-medium capitalize">{key}</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-48 text-right">
                  {capability.message}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* iOS Deployment Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            iOS Deployment Checklist
          </CardTitle>
          <CardDescription>
            Requirements for App Store submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Required Items</h4>
            <ul className="space-y-1">
              {deploymentChecklist.ios.required.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  {item}
                </li>
              ))}
            </ul>
            <h4 className="font-medium text-sm mt-4">Recommended</h4>
            <ul className="space-y-1">
              {deploymentChecklist.ios.recommended.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Android Deployment Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Android Deployment Checklist
          </CardTitle>
          <CardDescription>
            Requirements for Google Play Store submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Required Items</h4>
            <ul className="space-y-1">
              {deploymentChecklist.android.required.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  {item}
                </li>
              ))}
            </ul>
            <h4 className="font-medium text-sm mt-4">Recommended</h4>
            <ul className="space-y-1">
              {deploymentChecklist.android.recommended.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps for Mobile Deployment</CardTitle>
          <CardDescription>
            Follow these steps to deploy your app to mobile platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">1. Export to GitHub</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Transfer your project to your own GitHub repository for version control and deployment.
              </p>
              <Button size="sm" variant="outline">
                Export to GitHub
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">2. Set up Mobile Platforms</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Add iOS and Android platforms to your project.
              </p>
              <code className="text-xs bg-muted p-2 rounded block">
                npx cap add ios{'\n'}
                npx cap add android
              </code>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">3. Build and Sync</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Build your web assets and sync to native platforms.
              </p>
              <code className="text-xs bg-muted p-2 rounded block">
                npm run build{'\n'}
                npx cap sync
              </code>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">4. Open in Native IDEs</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Open your project in Xcode (iOS) or Android Studio (Android).
              </p>
              <code className="text-xs bg-muted p-2 rounded block">
                npx cap open ios{'\n'}
                npx cap open android
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}