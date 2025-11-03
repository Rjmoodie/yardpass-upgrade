// Flashback Banner Component
// Shows explanatory banner on flashback event pages

import { History, Clock, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface FlashbackBannerProps {
  eventId: string;
  eventTitle: string;
  flashbackExplainer?: string;
  flashbackEndDate?: string; // Deprecated - kept for compatibility
  organizationCreatedAt?: string; // Organization onboarding date
  linkedEventId?: string;
  linkedEventTitle?: string;
}

export function FlashbackBanner({
  eventTitle,
  flashbackExplainer,
  organizationCreatedAt,
  linkedEventId,
  linkedEventTitle,
}: FlashbackBannerProps) {
  const navigate = useNavigate();
  
  // Posting window is based on org onboarding + 90 days, NOT event end date
  const postingWindowEnd = organizationCreatedAt 
    ? new Date(new Date(organizationCreatedAt).getTime() + 90 * 24 * 60 * 60 * 1000)
    : null;
  
  const isExpired = postingWindowEnd && postingWindowEnd < new Date();
  const daysRemaining = postingWindowEnd 
    ? Math.max(0, Math.ceil((postingWindowEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <Alert className="mb-6 border-purple-500/30 bg-purple-500/10 backdrop-blur-sm">
      <History className="h-5 w-5 text-purple-400" />
      <AlertTitle className="text-lg font-semibold text-foreground mb-2">
        Flashback Event
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm text-foreground/80 leading-relaxed">
          {flashbackExplainer || 'Share your favorite moments from this past event'}
        </p>

        {/* Linked event CTA */}
        {linkedEventId && linkedEventTitle && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/e/${linkedEventId}`)}
            className="border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View {linkedEventTitle}
          </Button>
        )}

        {/* Posting status */}
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          {isExpired ? (
            <>
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300">
                Posting window has closed. This Flashback was available for 90 days after the organization onboarded.
                {postingWindowEnd && (
                  <span className="block mt-1 text-foreground/50">
                    Window ended: {postingWindowEnd.toLocaleDateString()}
                  </span>
                )}
              </span>
            </>
          ) : daysRemaining !== null ? (
            <>
              <Clock className="h-4 w-4 text-purple-400" />
              <span>
                <span className="font-semibold text-purple-300">{daysRemaining} days</span> left to share memories
                {postingWindowEnd && (
                  <span className="block mt-1 text-foreground/50">
                    Until: {postingWindowEnd.toLocaleDateString()}
                  </span>
                )}
              </span>
            </>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}

