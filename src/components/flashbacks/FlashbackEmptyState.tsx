// Flashback Empty State Component
// Shows when no flashback posts exist yet

import { History, Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlashbackEmptyStateProps {
  eventTitle: string;
  canPost: boolean;
  onCreatePost?: () => void;
}

export function FlashbackEmptyState({
  eventTitle,
  canPost,
  onCreatePost,
}: FlashbackEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-purple-500/10 p-6 mb-6">
        <History className="h-12 w-12 text-purple-400" />
      </div>
      
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No Flashbacks Yet
      </h3>
      
      <p className="text-sm text-foreground/70 max-w-md mb-6">
        Be the first to add a Flashback from {eventTitle}. Share your favorite photos and videos from this amazing event!
      </p>

      {canPost && onCreatePost && (
        <Button
          onClick={onCreatePost}
          size="lg"
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
        >
          <Camera className="h-5 w-5 mr-2" />
          Share Your Moment
        </Button>
      )}

      {!canPost && (
        <p className="text-xs text-foreground/60">
          <Upload className="h-4 w-4 inline mr-1" />
          Sign in to share your memories
        </p>
      )}
    </div>
  );
}

