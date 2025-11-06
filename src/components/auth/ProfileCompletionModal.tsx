import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
  userId: string;
  displayName?: string;
}

export function ProfileCompletionModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  displayName,
}: ProfileCompletionModalProps) {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const validateUsername = (value: string): string | null => {
    if (!value) return 'Username is required to post';
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 30) return 'Username must be less than 30 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return null;
  };

  const checkUsernameAvailable = async (value: string): Promise<boolean> => {
    if (!value) return false;

    setIsChecking(true);
    setError(null);
    
    try {
      const { data, error: checkError } = await supabase
        .from('user_profiles')
        .select('username')
        .ilike('username', value)
        .neq('user_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;
      
      const available = !data;
      setIsAvailable(available);
      
      if (!available) {
        setError('Username is already taken');
      }
      
      return available;
    } catch (err: any) {
      console.error('Error checking username:', err);
      setError('Unable to check username availability');
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const handleUsernameChange = async (value: string) => {
    setUsername(value);
    setError(null);
    setIsAvailable(null);

    const validationError = validateUsername(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Debounce check
    const timeoutId = setTimeout(() => {
      checkUsernameAvailable(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleSave = async () => {
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Final availability check
    const available = await checkUsernameAvailable(username);
    if (!available) {
      setError('Username is already taken');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ username: username.trim() })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast({
        title: 'Profile complete! 🎉',
        description: `Welcome @${username}! You can now post and engage.`,
      });

      onSuccess(username);
      onClose();
    } catch (err: any) {
      console.error('Error updating username:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to set username',
        variant: 'destructive',
      });
      setError(err.message || 'Failed to set username');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Complete Your Profile
          </DialogTitle>
          <DialogDescription>
            {displayName ? `Hi ${displayName}! ` : ''}Set a unique username to start posting and engaging with the community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <Alert className="border-primary/30 bg-primary/5">
            <AlertDescription className="text-sm">
              <strong>Guest Mode:</strong> You purchased a ticket as a guest. To post content, like, or comment, please choose a username.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="username">Choose your username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                type="text"
                placeholder="yourname"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className={cn(
                  'pl-7 pr-10',
                  error && 'border-destructive',
                  isAvailable && 'border-green-500'
                )}
                autoFocus
                disabled={isSaving}
              />
              {isChecking && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {!isChecking && isAvailable === true && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
              {!isChecking && isAvailable === false && (
                <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {isAvailable && (
              <p className="text-sm text-green-600">@{username} is available!</p>
            )}
            <p className="text-xs text-muted-foreground">
              3-30 characters • Letters, numbers, underscores, and hyphens only
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              className="w-full"
              disabled={isSaving || !isAvailable || !!error}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Set Username & Continue
                </>
              )}
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            You can close this and set your username later from your profile
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

