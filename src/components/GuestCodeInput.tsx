import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GuestCodeInputProps {
  eventId: string;
  onCodeValidated: (guestCode: {
    id: string;
    code: string;
    tier_id?: string;
    tier_name?: string;
  }) => void;
  onClose: () => void;
}

export function GuestCodeInput({ eventId, onCodeValidated, onClose }: GuestCodeInputProps) {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const { toast } = useToast();

  const validateGuestCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setValidating(true);
    try {
      // Join tier name if present
      const { data, error } = await supabase
        .from('guest_codes')
        .select(`
          id,
          code,
          tier_id,
          max_uses,
          used_count,
          expires_at,
          ticket_tiers: tier_id ( name )
        `)
        .eq('event_id', eventId)
        .eq('code', trimmed)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setIsValid(false);
        toast({ title: 'Invalid code', description: 'Guest code not found', variant: 'destructive' });
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setIsValid(false);
        toast({ title: 'Code expired', description: 'This guest code has expired', variant: 'destructive' });
        return;
      }

      if (data.used_count >= data.max_uses) {
        setIsValid(false);
        toast({ title: 'Code limit reached', description: 'This guest code has been used up', variant: 'destructive' });
        return;
      }

      setIsValid(true);
      toast({ title: 'Valid code', description: 'Guest code accepted' });

      onCodeValidated({
        id: data.id,
        code: data.code,
        tier_id: data.tier_id ?? undefined,
        tier_name: data.ticket_tiers?.name ?? undefined,
      });
    } catch (e: any) {
      console.error('Error validating guest code:', e);
      setIsValid(false);
      toast({ title: 'Validation error', description: 'Unable to validate guest code', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validating) validateGuestCode();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          Enter Guest Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guestCode">Guest Code</Label>
            <div className="relative">
              <Input
                id="guestCode"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setIsValid(null);
                }}
                placeholder="Enter your guest code"
                className={`pr-10 ${
                  isValid === true ? 'border-green-500' : isValid === false ? 'border-red-500' : ''
                }`}
                disabled={validating}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              {isValid === true && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
              {isValid === false && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!code.trim() || validating} className="flex-1">
              {validating ? 'Validating…' : 'Validate'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
