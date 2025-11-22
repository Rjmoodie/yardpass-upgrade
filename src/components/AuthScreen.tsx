import { useCallback, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type Mode = 'guest' | 'full';

interface AuthScreenProps {
  /** Called when auth is completed. For guest flow, after OTP + name */
  onAuth: (phoneOrEmail: string, name: string) => void;

  /** Optional async handler to send an OTP code. If omitted, we simulate success. */
  onSendCode?: (contact: { method: 'phone' | 'email'; value: string }) => Promise<void>;

  /** Optional async handler to verify an OTP code. Return true if valid. */
  onVerifyCode?: (otp: string, contact: { method: 'phone' | 'email'; value: string }) => Promise<boolean>;

  /** Guest (OTP) or Full (no OTP) flow */
  mode?: Mode;

  /** Allow email as an alternative to phone in guest flow */
  allowEmail?: boolean;

  /** Optional brand image path */
  logoSrc?: string;
}

export function AuthScreen({
  onAuth,
  onSendCode,
  onVerifyCode,
  mode = 'guest',
  allowEmail = true,
  logoSrc = '/liventix-logo-mobile.png',
}: AuthScreenProps) {
  const [method, setMethod] = useState<'phone' | 'email'>(allowEmail ? 'phone' : 'phone');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'contact' | 'otp' | 'name'>(mode === 'guest' ? 'contact' : 'name');
  const [loading, setLoading] = useState(false);
  const [resendSecs, setResendSecs] = useState(0);

  const maskedContact = useMemo(() => {
    if (!contact) return '';
    if (method === 'email') {
      const [u, d] = contact.split('@');
      if (!u || !d) return contact;
      const ux = u.length <= 2 ? u[0] + '*' : u[0] + '*'.repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
      return `${ux}@${d}`;
    }
    const cleaned = contact.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    return cleaned.slice(0, -4).replace(/\d/g, '*') + cleaned.slice(-4);
  }, [contact, method]);

  const startResendTimer = useCallback((seconds = 30) => {
    setResendSecs(seconds);
    const i = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) {
          clearInterval(i);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(async () => {
    setLoading(true);
    try {
      if (onSendCode) {
        await onSendCode({ method, value: contact });
      } else {
        // Simulate success if no handler provided
        await new Promise((r) => setTimeout(r, 600));
      }
      setStep('otp');
      startResendTimer(30);
    } finally {
      setLoading(false);
    }
  }, [contact, method, onSendCode, startResendTimer]);

  const verifyCode = useCallback(async () => {
    setLoading(true);
    try {
      let ok = true;
      if (onVerifyCode) {
        ok = await onVerifyCode(otp, { method, value: contact });
      } else {
        // Simulate success if no handler provided
        await new Promise((r) => setTimeout(r, 600));
      }
      if (ok) {
        setStep('name');
      }
    } finally {
      setLoading(false);
    }
  }, [otp, contact, method, onVerifyCode]);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'guest') {
      if (!contact.trim()) return;
      void sendCode();
    } else {
      // Full flow: skip OTP, go to name
      setStep('name');
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    void verifyCode();
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAuth(contact, name);
  };

  return (
    <div className="min-h-screen charcoal-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl opacity-20" />

      <Card className="w-full max-w-md glass-card relative z-10">
        <CardHeader className="text-center space-y-6">
          <div className="mx-auto w-28 h-24 brand-gradient rounded-2xl flex items-center justify-center shadow-xl golden-glow">
            <img src={logoSrc} alt="Brand" className="w-20 h-16" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {mode === 'guest' ? 'Access Your Tickets' : 'Welcome'}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              {step === 'contact'
                ? method === 'phone'
                  ? 'Enter your phone number to receive a sign-in code'
                  : 'Enter your email to receive a sign-in code'
                : step === 'otp'
                ? `Enter the code we sent to ${maskedContact}`
                : 'What should we call you?'}
            </CardDescription>
          </div>

          {mode === 'guest' && allowEmail && (
            <div className="mx-auto flex rounded-lg border p-1">
              <Button
                type="button"
                variant={method === 'phone' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMethod('phone')}
              >
                Phone
              </Button>
              <Button
                type="button"
                variant={method === 'email' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMethod('email')}
              >
                Email
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 'contact' && (
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <Input
                type={method === 'phone' ? 'tel' : 'email'}
                inputMode={method === 'phone' ? 'tel' : 'email'}
                placeholder={method === 'phone' ? '+1 (555) 123-4567' : 'you@example.com'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                className="h-12 rounded-xl border-2 border-primary/20 bg-input-background/50 backdrop-blur-sm text-base focus:border-primary transition-all duration-300"
              />
              <Button type="submit" variant="premium" size="lg" className="w-full" disabled={loading}>
                {mode === 'guest' ? (loading ? 'Sending…' : 'Send Code') : 'Continue'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="h-12 rounded-xl border-2 border-primary/20 bg-input-background/50 backdrop-blur-sm text-base focus:border-primary transition-all duration-300"
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    setOtp('');
                    setStep('contact');
                  }}
                >
                  Back
                </Button>
                <Button type="submit" variant="premium" size="lg" className="flex-1" disabled={loading || otp.length < 4}>
                  {loading ? 'Verifying…' : 'Verify'}
                </Button>
              </div>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={resendSecs > 0 || loading}
                  onClick={() => {
                    if (resendSecs > 0) return;
                    void sendCode();
                  }}
                >
                  {resendSecs > 0 ? `Resend in ${resendSecs}s` : 'Resend code'}
                </Button>
              </div>
            </form>
          )}

          {step === 'name' && (
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
                  onClick={() => {
                    if (mode === 'guest') setStep('otp');
                    else setStep('contact');
                  }}
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