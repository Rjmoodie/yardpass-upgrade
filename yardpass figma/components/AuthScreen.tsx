import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface AuthScreenProps {
  onAuth: (phone: string, name: string) => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'name'>('phone');

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length >= 10) {
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
    <div className="h-screen bg-gradient-to-b from-primary/5 to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-2xl text-primary-foreground">🎪</span>
          </div>
          <CardTitle className="text-2xl">Welcome to YardPass</CardTitle>
          <CardDescription>
            Discover and create amazing events in your area
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="phone">Phone Number</label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-center"
                />
              </div>
              <Button type="submit" className="w-full" disabled={phone.length < 10}>
                Continue with Phone
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                We'll send you a verification code
              </p>
            </form>
          ) : (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name">What's your name?</label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!name.trim()}>
                Get Started
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => setStep('phone')}
              >
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}