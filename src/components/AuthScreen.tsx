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
    <div className="min-h-screen charcoal-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl opacity-20" />
      
      <Card className="w-full max-w-md glass-card relative z-10">
        <CardHeader className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 brand-gradient rounded-2xl flex items-center justify-center shadow-xl golden-glow">
            <span className="text-white font-bold text-2xl">🎪</span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Welcome to YardPass
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              {step === 'phone' 
                ? 'Enter your phone number to get started' 
                : 'What should we call you?'
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <Input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="h-12 rounded-xl border-2 border-primary/20 bg-input-background/50 backdrop-blur-sm text-base focus:border-primary transition-all duration-300"
              />
              <Button type="submit" variant="premium" size="lg" className="w-full">
                Continue
              </Button>
            </form>
          ) : (
            <form onSubmit={handleNameSubmit} className="space-y-6">
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl border-2 border-primary/20 bg-input-background/50 backdrop-blur-sm text-base focus:border-primary transition-all duration-300"
              />
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="lg"
                  onClick={() => setStep('phone')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" variant="premium" size="lg" className="flex-1">
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