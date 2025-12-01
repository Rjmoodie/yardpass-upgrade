import { useState, useEffect, FormEvent } from 'react';
import { Mail, ArrowRight, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AuthStep =
  | 'email-entry'
  | 'password-entry'
  | 'signup'
  | 'email-otp-entry';

type AccountType = 'guest-checkout' | 'organic-passwordless' | 'password' | 'new';

interface SmartAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SmartAuthModal({ isOpen, onClose, onSuccess }: SmartAuthModalProps) {
  const [step, setStep] = useState<AuthStep>('email-entry');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setStep('email-entry');
    setEmail('');
    setPassword('');
    setDisplayName('');
    setOtp('');
    setAccountType(null);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) resetState();
  }, [isOpen]);

  if (!isOpen) return null;

  // ============================================
  // Helpers
  // ============================================
  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const handleErrorToast = (error: unknown, fallback: string) => {
    const message = (error as any)?.message ?? fallback;
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  };

  // ============================================
  // STEP 1: Detect Account Type
  // ============================================
  const checkAccountType = async (rawEmail: string): Promise<AccountType> => {
    const normalizedEmail = normalizeEmail(rawEmail);

    try {
      // @ts-ignore - Custom RPC function added via migration
      const { data, error } = await supabase.rpc('check_user_auth_method', {
        p_email: normalizedEmail,
      });

      if (error) throw error;

      if (data?.account_type) {
        return data.account_type as AccountType;
      }

      if (data?.exists && data?.has_password) return 'password';
      if (data?.exists && data?.is_guest_checkout) return 'guest-checkout';
      if (data?.exists && !data?.has_password) return 'organic-passwordless';

      return 'new';
    } catch (error) {
      console.error('checkAccountType error:', error);
      // Safer fallback: treat as new
      return 'new';
    }
  };


  // ============================================
  // Email submission
  // ============================================
  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      setEmail(normalizedEmail);

      const type = await checkAccountType(normalizedEmail);
      setAccountType(type);

      if (type === 'password') {
        setStep('password-entry');
      } else if (type === 'guest-checkout' || type === 'organic-passwordless') {
        await sendEmailOtp(normalizedEmail);
      } else {
        setStep('signup');
      }
    } catch (error) {
      handleErrorToast(error, 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Password Flow
  // ============================================
  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({ title: 'Welcome back! 🎉' });
      onSuccess?.();
      onClose();
    } catch (error) {
      handleErrorToast(error, 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Email OTP Flow (Edge Function + fallback)
  // ============================================
  // ✅ Email OTP for guest checkout (NO FALLBACK - must use custom Edge Function)
  const sendEmailOtp = async (normalizedEmail: string) => {
    const { error } = await supabase.functions.invoke('auth-send-otp', {
      body: { email: normalizedEmail },
    });

    if (error) {
      console.error('auth-send-otp error:', error);
      throw new Error(error.message || 'Failed to send OTP. Check if Edge Function is deployed.');
    }

    setStep('email-otp-entry');
    toast({
      title: 'Check your email! 📧',
      description: 'We sent you a 6-digit verification code.',
    });
  };

  const handleVerifyEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔐 Verifying OTP via custom Edge Function');
      
      const { data, error } = await supabase.functions.invoke('auth-verify-otp', {
        body: { email, otp },
      });

      if (error) {
        console.error('❌ Edge Function error:', error);
        throw new Error(error?.message || 'Edge Function not deployed. Check Supabase Dashboard.');
      }

      if (!data?.access_token) {
        console.error('❌ No access token in response:', data);
        throw new Error(data?.error || 'Invalid verification response');
      }

      console.log('✅ OTP verified, setting session');

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (setSessionError) {
        console.error('❌ Session error:', setSessionError);
        throw setSessionError;
      }

      console.log('✅ Session created successfully');
      toast({ title: 'Welcome back! 🎉' });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('❌ Verification failed:', error);
      handleErrorToast(error, 'Invalid or expired code. Request a new one.');
    } finally {
      setLoading(false);
    }
  };


  // ============================================
  // Sign Up Flow
  // ============================================
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      
      // Create account first (required for OTP verification)
      const { error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: crypto.randomUUID() + Math.random().toString(36).substring(7), // Temporary random password
        options: {
          data: {
            display_name: displayName,
            created_via: 'organic_signup',
          },
        },
      });

      if (signUpError) {
        // If user already exists, just send OTP
        if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists')) {
          console.log('[SignUp] User already exists, sending OTP instead');
          await sendEmailOtp(normalizedEmail);
          return;
        }
        throw signUpError;
      }

      // Send OTP for verification after account creation
      await sendEmailOtp(normalizedEmail);
    } catch (error) {
      handleErrorToast(error, 'Unable to start signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // UI
  // ============================================
  const renderOtpInput = ({
    id,
    label,
    value,
    onChange,
    helper,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    helper: string;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        placeholder="123456"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        autoFocus
        maxLength={6}
                  className="h-12 text-[16px] text-center tracking-widest font-mono"
      />
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      style={{
        paddingTop: 'env(safe-area-inset-top, 1rem)',
        paddingBottom: 'env(safe-area-inset-bottom, 1rem)',
        paddingLeft: 'env(safe-area-inset-left, 1rem)',
        paddingRight: 'env(safe-area-inset-right, 1rem)',
      }}
    >
      <div className="relative w-full max-w-md bg-gradient-to-b from-primary/10 to-background rounded-3xl px-5 py-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 p-2 rounded-full hover:bg-muted transition z-10"
          aria-label="Close"
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        {/* Logo & Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mb-3 sm:mb-4">
            <img 
              src="/liventix-logo-mobile.png" 
              alt="Liventix" 
              className="w-full h-full object-contain"
              loading="eager"
              decoding="sync"
            />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">Live Event Tickets</p>
        </div>

        {/* STEP: Email Entry */}
        {step === 'email-entry' && (
          <form onSubmit={handleContinue} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-12 text-[16px]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !email}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold mt-2"
            >
              {loading ? 'Please wait...' : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </>
              )}
            </Button>

          </form>
        )}

        {/* STEP: Password Entry */}
        {step === 'password-entry' && (
          <form onSubmit={handlePasswordSignIn} className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Lock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Welcome back!</p>
                <p className="text-sm text-muted-foreground">
                  Enter your password to sign in as <strong>{email}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="h-12 text-base"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="flex flex-col gap-2 text-sm text-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await sendEmailOtp(email);
                  } catch (error) {
                    handleErrorToast(error, 'Unable to send verification code.');
                  }
                }}
                className="text-primary hover:underline"
              >
                Send me a verification code instead
              </button>
              <button
                type="button"
                onClick={() => setStep('email-entry')}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Use different email
              </button>
            </div>
          </form>
        )}


        {/* STEP: Signup */}
        {step === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Create your account</p>
                <p className="text-sm text-muted-foreground">We'll send you a verification code via email.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="How should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} disabled className="h-12 text-base bg-muted" />
            </div>

            <Button
              type="submit"
              disabled={loading || !displayName}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>

            <button
              type="button"
              onClick={() => setStep('email-entry')}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          </form>
        )}


        {/* STEP: Email OTP Entry (Guest Checkout) */}
        {step === 'email-otp-entry' && (
          <form onSubmit={handleVerifyEmailOtp} className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Access your tickets</p>
                <p className="text-sm text-muted-foreground">
                  We sent a code to <strong>{email}</strong>
                </p>
              </div>
            </div>

            {renderOtpInput({
              id: 'otp',
              label: 'Verification Code',
              value: otp,
              onChange: setOtp,
              helper: 'Enter the 6-digit code from your email',
            })}

            <Button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? 'Verifying...' : 'Login'}
            </Button>

            <div className="flex flex-col gap-2 text-sm text-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await sendEmailOtp(email);
                  } catch (error) {
                    handleErrorToast(error, 'Unable to resend code.');
                  }
                }}
                className="text-primary hover:underline"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => setStep('email-entry')}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Use different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
