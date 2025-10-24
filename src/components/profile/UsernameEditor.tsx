import React, { useState } from 'react';
import { Check, X, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UsernameEditorProps {
  currentUsername: string | null | undefined;
  userId: string;
  onUpdate: (newUsername: string) => void;
}

export function UsernameEditor({ currentUsername, userId, onUpdate }: UsernameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(currentUsername || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const validateUsername = (value: string): string | null => {
    if (!value) return null; // Username is optional
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 30) return 'Username must be less than 30 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return null;
  };

  const checkUsernameAvailable = async (value: string): Promise<boolean> => {
    if (!value || value === currentUsername) return true;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username')
        .ilike('username', value)
        .neq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return !data; // Available if no match found
    } catch (err) {
      console.error('Error checking username:', err);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = async () => {
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if username is available
    const isAvailable = await checkUsernameAvailable(username);
    if (!isAvailable) {
      setError('Username is already taken');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ username: username || null })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: username ? `Username updated to @${username}` : 'Username removed',
      });

      onUpdate(username);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Error updating username:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update username',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setUsername(currentUsername || '');
    setError(null);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/70">
          {currentUsername ? `@${currentUsername}` : 'No username set'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="h-7 gap-1 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10"
        >
          <Edit2 className="h-3 w-3" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/50">@</span>
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
              setError(null);
            }}
            placeholder="username"
            className="pl-7 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            disabled={isSaving || isChecking}
            maxLength={30}
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || isChecking || !username || username === currentUsername}
          className="h-9 w-9 p-0 bg-green-600 hover:bg-green-700"
        >
          {isSaving || isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving || isChecking}
          className="h-9 w-9 p-0 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <p className="text-xs text-white/50">
        3-30 characters, letters, numbers, underscores, and hyphens only
      </p>
    </div>
  );
}

