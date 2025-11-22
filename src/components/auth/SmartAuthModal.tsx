import { useState, useEffect, FormEvent } from 'react';
import { Mail, Phone, ArrowRight, Sparkles, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AuthMethod = 'email' | 'phone';
type AuthStep =
  | 'email-entry'
  | 'password-entry'
  | 'magic-link-sent'
  | 'signup'
  | 'phone-otp-entry'
  | 'email-otp-entry';

type AccountType = 'guest-checkout' | 'organic-passwordless' | 'password' | 'new';
type MagicLinkMode = 'guest-login' | 'passwordless-login' | 'signup';

interface SmartAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SmartAuthModal({ isOpen, onClose, onSuccess }: SmartAuthModalProps) {
  const [method, setMethod] = useState<AuthMethod>('email');
  const [step, setStep] = useState<AuthStep>('email-entry');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setMethod('email');
    setStep('email-entry');
    setEmail('');
    setPhone('');
    setPassword('');
    setDisplayName('');
    setOtp('');
    setPhoneOtp('');
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
  // Magic Link Flow
  // ============================================
  const sendMagicLink = async (
    rawEmail: string,
    mode: MagicLinkMode,
    extraData?: Record<string, any>,
  ) => {
    const normalizedEmail = normalizeEmail(rawEmail);
    const isLogin = mode === 'guest-login' || mode === 'passwordless-login';

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: !isLogin,
        emailRedirectTo: `${window.location.origin}/auth/callback?mode=${mode}`,
        data: extraData,
      },
    });

    if (error) throw error;

    setStep('magic-link-sent');

    toast({
      title: 'Check your email! 📧',
      description:
        mode === 'guest-login'
          ? 'We sent you a link to access your tickets.'
          : 'We sent you a magic link to sign in instantly.',
    });
  };

  const handleResendMagicLink = async () => {
    if (!email) return;
    const mode: MagicLinkMode =
      accountType === 'guest-checkout'
        ? 'guest-login'
        : accountType === 'new'
        ? 'signup'
        : 'passwordless-login';

    try {
      await sendMagicLink(email, mode);
    } catch (error) {
      handleErrorToast(error, 'Unable to resend link. Please try again.');
    }
  };

  // ============================================
  // Email / Phone submission
  // ============================================
  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (method === 'email') {
        const normalizedEmail = normalizeEmail(email);
        setEmail(normalizedEmail);

        const type = await checkAccountType(normalizedEmail);
        setAccountType(type);

        if (type === 'password') {
          setStep('password-entry');
        } else if (type === 'guest-checkout') {
          await sendEmailOtp(normalizedEmail);
        } else if (type === 'organic-passwordless') {
          await sendMagicLink(normalizedEmail, 'passwordless-login');
        } else {
          setStep('signup');
        }
      } else {
        await sendPhoneOtp(phone);
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
  // Phone OTP Flow
  // ============================================
  const sendPhoneOtp = async (phoneNumber: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) throw error;

    setStep('phone-otp-entry');
    toast({
      title: 'Code sent! 📱',
      description: 'Enter the verification code we sent to your phone.',
    });
  };

  const handleVerifyPhoneOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: phoneOtp,
        type: 'sms',
      });

      if (error) throw error;

      toast({ title: 'Welcome! 🎉' });
      onSuccess?.();
      onClose();
    } catch (error) {
      handleErrorToast(error, 'Invalid code. Please try again.');
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
      await sendMagicLink(email, 'signup', {
        display_name: displayName,
      });
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

        {/* STEP: Email / Phone Entry */}
        {step === 'email-entry' && (
          <form onSubmit={handleContinue} className="space-y-4 sm:space-y-6">
            <div className="flex gap-2 p-1 bg-muted rounded-full mb-5">
              <button
                type="button"
                onClick={() => setMethod('phone')}
                className={cn(
                  'flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-full font-semibold transition flex items-center justify-center gap-2 text-sm sm:text-base',
                  method === 'phone'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                Phone
              </button>
              <button
                type="button"
                onClick={() => setMethod('email')}
                className={cn(
                  'flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-full font-semibold transition flex items-center justify-center gap-2 text-sm sm:text-base',
                  method === 'email'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                Email
              </button>
            </div>

            {method === 'email' ? (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                  className="h-12 text-[16px]"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (method === 'email' ? !email : !phone)}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold mt-2"
            >
              {loading ? 'Please wait...' : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </>
              )}
            </Button>

            <p className="text-xs sm:text-sm text-center text-muted-foreground pt-2">
              {method === 'email'
                ? "We'll detect your account type and send you the right sign-in method"
                : "We'll send you a verification code via SMS"}
            </p>
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
                onClick={() => sendMagicLink(email, 'passwordless-login').catch((e) =>
                  handleErrorToast(e, 'Unable to send magic link'),
                )}
                className="text-primary hover:underline"
              >
                Send me a magic link instead
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

        {/* STEP: Magic Link Sent */}
        {step === 'magic-link-sent' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">Check your email</h2>
              <p className="text-muted-foreground">
                {accountType === 'guest-checkout' ? (
                  <>
                    We sent a link so you can access your tickets as <strong>{email}</strong>
                  </>
                ) : (
                  <>
                    We sent a sign-in link to <strong>{email}</strong>
                  </>
                )}
              </p>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg text-left space-y-2">
              <p className="text-sm font-semibold">What's next?</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open the email from Liventix</li>
                <li>Click the "Sign In" button</li>
                <li>You'll be instantly signed in!</li>
              </ol>
            </div>

            <Button variant="outline" onClick={() => setStep('email-entry')} className="w-full">
              Use different email
            </Button>

            <p className="text-xs text-muted-foreground">
              Didn't receive it? Check your spam folder or{' '}
              <button onClick={handleResendMagicLink} className="text-primary hover:underline">
                resend
              </button>
            </p>
          </div>
        )}

        {/* STEP: Signup */}
        {step === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Create your account</p>
                <p className="text-sm text-muted-foreground">Join Liventix - no password needed!</p>
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

        {/* STEP: Phone OTP Entry */}
        {step === 'phone-otp-entry' && (
          <form onSubmit={handleVerifyPhoneOtp} className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
              <Phone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Enter verification code</p>
                <p className="text-sm text-muted-foreground">
                  We sent a code to <strong>{phone}</strong>
                </p>
              </div>
            </div>

            {renderOtpInput({
              id: 'phoneOtp',
              label: 'Verification Code',
              value: phoneOtp,
              onChange: setPhoneOtp,
              helper: 'Enter the 6-digit code from your SMS',
            })}

            <Button
              type="submit"
              disabled={loading || phoneOtp.length !== 6}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>

            <div className="flex flex-col gap-2 text-sm text-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await sendPhoneOtp(phone);
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
                ← Use different method
              </button>
            </div>
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
              {loading ? 'Verifying...' : 'Access Tickets'}
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
