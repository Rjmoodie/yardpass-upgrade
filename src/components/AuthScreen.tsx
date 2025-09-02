import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';

/**
 * AuthScreen component handles user authentication with phone and name input.
 * 
 * @param onAuth - Callback function called when authentication is successful
 */
interface AuthScreenProps {
  /** Callback function called with phone and name when authentication is successful */
  onAuth: (phone: string, name: string) => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'name'>('phone');

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim()) {
      setStep('name');
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAuth(phone, name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">Y</span>
          </div>
          <CardTitle>Welcome to YardPass</CardTitle>
          <CardDescription>
            {step === 'phone' 
              ? 'Enter your phone number to get started' 
              : 'What should we call you?'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <Input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          ) : (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep('phone')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  Get Started
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}