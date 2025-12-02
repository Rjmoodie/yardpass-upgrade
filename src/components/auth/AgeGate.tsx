import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AgeGateProps {
  onAgeVerified: (dateOfBirth: Date, region: string | null) => void;
  minimumAge?: number;
}

export function AgeGate({ onAgeVerified, minimumAge = 13 }: AgeGateProps) {
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const calculateAge = (date: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!birthDate) {
      setError('Please enter your date of birth');
      return;
    }

    const birthDateObj = new Date(birthDate);
    const age = calculateAge(birthDateObj);

    if (age < minimumAge) {
      setError(`You must be at least ${minimumAge} years old to use this service.`);
      return;
    }

    if (age > 120) {
      setError('Please enter a valid date of birth');
      return;
    }

    // Detect region from timezone (simplified)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const region = timezone.includes('Europe/') ? 'EU' : 
                   timezone.includes('America/') ? 'US' : null;

    onAgeVerified(birthDateObj, region);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="birthdate" className="text-sm font-normal">
          Date of Birth
        </Label>
        <Input
          id="birthdate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          required
          className="w-full h-11"
        />
        <p className="text-xs text-muted-foreground">
          Must be {minimumAge} or older
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3 w-3" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full h-11">
        Continue
      </Button>
    </form>
  );
}

