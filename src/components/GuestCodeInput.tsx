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
    if (!code.trim()) return;

    setValidating(true);
    try {
      const { data: guestCodeData, error } = await supabase
        .from('guest_codes')
        .select(`
          id,
          code,
          tier_id,
          max_uses,
          used_count,
          expires_at
        `)
        .eq('event_id', eventId)
        .eq('code', code.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!guestCodeData) {
        setIsValid(false);
        toast({
          title: "Invalid code",
          description: "Guest code not found",
          variant: "destructive",
        });
        return;
      }

      // Check if code is expired
      if (guestCodeData.expires_at && new Date(guestCodeData.expires_at) < new Date()) {
        setIsValid(false);
        toast({
          title: "Code expired",
          description: "This guest code has expired",
          variant: "destructive",
        });
        return;
      }

      // Check if code has remaining uses
      if (guestCodeData.used_count >= guestCodeData.max_uses) {
        setIsValid(false);
        toast({
          title: "Code limit reached",
          description: "This guest code has been used up",
          variant: "destructive",
        });
        return;
      }

      setIsValid(true);
      toast({
        title: "Valid code",
        description: "Guest code accepted",
      });

      onCodeValidated({
        id: guestCodeData.id,
        code: guestCodeData.code,
        tier_id: guestCodeData.tier_id,
        tier_name: undefined
      });

    } catch (error: any) {
      console.error('Error validating guest code:', error);
      setIsValid(false);
      toast({
        title: "Validation error",
        description: "Unable to validate guest code",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateGuestCode();
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
                  isValid === true ? 'border-green-500' : 
                  isValid === false ? 'border-red-500' : ''
                }`}
                disabled={validating}
              />
              {isValid === true && (
                <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
              {isValid === false && (
                <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!code.trim() || validating}
              className="flex-1"
            >
              {validating ? 'Validating...' : 'Validate'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}