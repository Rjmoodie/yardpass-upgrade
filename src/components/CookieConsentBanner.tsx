import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';

export type ConsentPreferences = {
  necessary: boolean; // Always true, cannot be disabled
  analytics: boolean;
  marketing: boolean;
};

const CONSENT_STORAGE_KEY = 'liventix_consent_preferences';
const CONSENT_VERSION = '1.0'; // Increment when consent requirements change

export function CookieConsentBanner() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has already given consent
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.version === CONSENT_VERSION) {
          setPreferences(parsed.preferences);
          setShowBanner(false);
          return;
        }
      } catch {
        // Invalid stored data, show banner
      }
    }

    // Detect region and show banner if GDPR applies
    const detectAndShow = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const detectedRegion = timezone.includes('Europe/') ? 'EU' : 
                              timezone.includes('America/') ? 'US' : null;
        setRegion(detectedRegion);

        // Show banner for EU users or if no consent stored
        if (requiresGDPR(detectedRegion as any) || !stored) {
          setShowBanner(true);
        }
      } catch {
        // If detection fails, show banner to be safe
        setShowBanner(true);
      }
    };

    detectAndShow();
  }, []);

  const handleAcceptAll = () => {
    const newPreferences: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    savePreferences(newPreferences);
  };

  const handleRejectAll = () => {
    const newPreferences: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    savePreferences(newPreferences);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const savePreferences = (prefs: ConsentPreferences) => {
    // Store in localStorage
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        preferences: prefs,
        timestamp: new Date().toISOString(),
      })
    );

    // Store in database if user is logged in
    if (user) {
      // TODO: Store in user_consents table when migration is created
      // For now, just store in localStorage
    }

    // Apply preferences immediately
    applyConsentPreferences(prefs);
    setShowBanner(false);

    // Reload PostHog if analytics consent changed
    if (typeof window !== 'undefined' && (window as any).posthog) {
      if (prefs.analytics) {
        (window as any).posthog.opt_in_capturing();
      } else {
        (window as any).posthog.opt_out_capturing();
      }
    }
  };

  const applyConsentPreferences = (prefs: ConsentPreferences) => {
    // Dispatch custom event for other components to listen
    window.dispatchEvent(
      new CustomEvent('consent-updated', { detail: prefs })
    );
  };

  const [isExpanded, setIsExpanded] = useState(false);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-lg">
      <div className="max-w-4xl mx-auto">
        {!isExpanded ? (
          // Collapsed view - subtle banner
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex-1">
              We use cookies to improve your experience.{' '}
              <button
                onClick={() => setIsExpanded(true)}
                className="underline hover:text-foreground"
              >
                Manage preferences
              </button>
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleRejectAll}
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
              >
                Reject
              </Button>
              <Button
                onClick={handleAcceptAll}
                size="sm"
                className="h-8 text-xs"
              >
                Accept
              </Button>
            </div>
          </div>
        ) : (
          // Expanded view - full preferences
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">
                We use cookies and similar technologies to improve your experience, analyze site usage, and assist with marketing efforts.
              </p>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between py-1">
                <Label htmlFor="necessary" className="text-xs font-normal cursor-pointer">
                  Necessary
                </Label>
                <Switch id="necessary" checked={true} disabled className="scale-75" />
              </div>

              <div className="flex items-center justify-between py-1">
                <Label htmlFor="analytics" className="text-xs font-normal cursor-pointer">
                  Analytics
                </Label>
                <Switch
                  id="analytics"
                  checked={preferences.analytics}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, analytics: checked })
                  }
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <Label htmlFor="marketing" className="text-xs font-normal cursor-pointer">
                  Marketing
                </Label>
                <Switch
                  id="marketing"
                  checked={preferences.marketing}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, marketing: checked })
                  }
                  className="scale-75"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleRejectAll}
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
              >
                Reject All
              </Button>
              <Button
                onClick={handleAcceptAll}
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
              >
                Accept All
              </Button>
              <Button
                onClick={handleSavePreferences}
                size="sm"
                className="flex-1 h-8 text-xs"
              >
                Save
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              <a href="/privacy-policy" className="underline hover:text-foreground">
                Privacy Policy
              </a>
              {' • '}
              <a href="/terms-of-service" className="underline hover:text-foreground">
                Terms
              </a>
              {' • '}
              <a href="/community-guidelines" className="underline hover:text-foreground">
                Guidelines
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to check if user has consented to analytics
 */
export function useConsent() {
  const [hasAnalyticsConsent, setHasAnalyticsConsent] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.version === CONSENT_VERSION) {
            setHasAnalyticsConsent(parsed.preferences.analytics === true);
          }
        } catch {
          setHasAnalyticsConsent(false);
        }
      }
    };

    checkConsent();

    // Listen for consent updates
    window.addEventListener('consent-updated', checkConsent);
    return () => window.removeEventListener('consent-updated', checkConsent);
  }, []);

  return { hasAnalyticsConsent };
}

