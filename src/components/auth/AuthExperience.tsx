import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Phone, RotateCcw, X, LogOut, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGuestTicketSession } from '@/hooks/useGuestTicketSession';

export type AuthTab = 'signin' | 'signup' | 'guest';
export type AuthMethod = 'email' | 'phone';

interface AuthExperienceProps {
  /** Controls lifecycle resets when used inside modals */
  isOpen?: boolean;
  /** Layout determines container chrome */
  layout?: 'modal' | 'page';
  /** Optional brand logo */
  logoSrc?: string;
  title?: string;
  description?: string;
  allowGuestTicketAccess?: boolean;
  guestScopeEventId?: string;
  guestSessionMinutes?: number;
  defaultTab?: AuthTab;
  onDismiss?: () => void;
  onAuthSuccess?: () => void;
}

type GuestStep = 'collect' | 'otp';

const DEFAULT_LOGO = '/yardpass-logo.png';

export function AuthExperience({
  isOpen = true,
  layout = 'modal',
  logoSrc = DEFAULT_LOGO,
  title = 'Sign in to continue',
  description = 'Use your email or phone number to get started',
  allowGuestTicketAccess = false,
  guestScopeEventId,
  guestSessionMinutes = 30,
  defaultTab = 'signin',
  onDismiss,
  onAuthSuccess,
}: AuthExperienceProps) {
  const { session: guestSession, isActive: hasGuestSession, clear: clearGuestSession } = useGuestTicketSession();
  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');

  const {
    isLoading,
    showOtpInput,
    phoneForOtp,
    handleSignIn,
    handleSignUp,
    resetOtpState,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    phone,
    setPhone,
    otp,
    setOtp,
    error,
  } = useAuthFlow({
    onSuccess: onAuthSuccess,
    guestScopeEventId,
    guestSessionMinutes,
  });

  const [guestMethod, setGuestMethod] = useState<AuthMethod>('phone');
  const [guestContact, setGuestContact] = useState('');
  const [guestOtp, setGuestOtp] = useState('');
  const [guestStep, setGuestStep] = useState<GuestStep>('collect');
  const [guestLoading, setGuestLoading] = useState(false);
  const [resendSecs, setResendSecs] = useState(0);

  const resetGuestState = useCallback(() => {
    setGuestContact('');
    setGuestOtp('');
    setGuestStep('collect');
    setGuestLoading(false);
    setResendSecs(0);
  }, []);

  const resetAll = useCallback(() => {
    resetOtpState();
    setAuthMethod('phone');
    setActiveTab(defaultTab);
    setGuestMethod('phone');
    resetGuestState();
  }, [defaultTab, resetGuestState, resetOtpState]);

  const handleGuestSignOut = useCallback(() => {
    clearGuestSession();
    toast({
      title: 'Signed out',
      description: 'Your guest session has ended.',
    });
    onDismiss?.();
  }, [clearGuestSession, onDismiss]);

  useEffect(() => {
    if (!isOpen) {
      resetAll();
    }
  }, [isOpen, resetAll]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const maskedGuestContact = useMemo(() => {
    if (!guestContact) return '';
    if (guestMethod === 'email') {
      const [user, domain] = guestContact.split('@');
      if (!user || !domain) return guestContact;
      const visible =
        user.length <= 2
          ? user[0] + '*'
          : user[0] + '*'.repeat(Math.max(1, user.length - 2)) + user[user.length - 1];
      return `${visible}@${domain}`;
    }
    const cleaned = guestContact.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    return cleaned.slice(0, -4).replace(/\d/g, '*') + cleaned.slice(-4);
  }, [guestContact, guestMethod]);

  const startResendTimer = useCallback((seconds = 30) => {
    setResendSecs(seconds);
    const timer = setInterval(() => {
      setResendSecs((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, []);

  const handleGuestSendCode = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guestContact.trim()) {
      toast({
        title: 'Missing info',
        description: 'Please enter your phone or email',
        variant: 'destructive',
      });
      return;
    }

    setGuestLoading(true);
    try {
      const { error } = await supabase.functions.invoke('guest-tickets-start', {
        body: {
          method: guestMethod,
          contact: guestContact,
          event_id: guestScopeEventId || null,
        },
      });

      if (error) throw error;

      toast({
        title: 'Code sent',
        description: `We sent a code to ${maskedGuestContact}`,
      });
      setGuestStep('otp');
      startResendTimer(30);
    } catch (err: any) {
      console.error('guest send code error', err);
      toast({
        title: 'Failed to send code',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGuestLoading(false);
    }
  }, [guestContact, guestMethod, guestScopeEventId, maskedGuestContact, startResendTimer]);

  const handleGuestVerify = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guestOtp.trim()) {
      toast({
        title: 'Invalid code',
        description: 'Enter the code you received to continue.',
        variant: 'destructive',
      });
      return;
    }

    setGuestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('guest-tickets-verify', {
        body: {
          method: guestMethod,
          contact: guestContact,
          otp: guestOtp,
          event_id: guestScopeEventId || null,
        },
      });

      if (error) throw error;

      const token = data?.token;
      const scope = data?.scope ?? (guestScopeEventId ? { eventIds: [guestScopeEventId] } : { all: true });
      if (!token) throw new Error('Invalid session token response');

      const exp = Date.now() + guestSessionMinutes * 60 * 1000;
      localStorage.setItem(
        'ticket-guest-session',
        JSON.stringify({
          token,
          exp,
          scope,
          [guestMethod]: guestContact,
        }),
      );

      toast({
        title: 'Guest access granted',
        description: 'You can now view tickets for this contact.',
      });

      resetGuestState();
      onAuthSuccess?.();
    } catch (err: any) {
      console.error('guest verify error', err);
      toast({
        title: 'Verification failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGuestLoading(false);
    }
  }, [guestContact, guestMethod, guestOtp, guestScopeEventId, guestSessionMinutes, onAuthSuccess, resetGuestState]);

  const handleSignInSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSignIn(e, authMethod);
  }, [authMethod, handleSignIn]);

  const handleSignUpSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSignUp(e, authMethod);
  }, [authMethod, handleSignUp]);

  const containerClass = cn(
    'relative overflow-hidden',
    layout === 'page'
      ? 'min-h-screen charcoal-gradient flex items-center justify-center p-4 md:p-10'
      : 'charcoal-gradient rounded-3xl p-1 sm:p-4',
  );

  const cardClass = cn(
    'relative z-10 w-full max-w-md mx-auto border border-border/40 bg-background/70 backdrop-blur-xl shadow-2xl',
    'rounded-3xl',
  );

  return (
    <div className={containerClass}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10" />
      <div className="absolute -top-20 -left-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl opacity-30" />
      <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl opacity-30" />

      <Card className={cardClass}>
        <CardHeader className="relative space-y-6 text-center px-6 pt-8 pb-0">
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full bg-background/60 hover:bg-background"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          )}

          <div className="mx-auto flex h-24 w-28 items-center justify-center rounded-2xl bg-gradient-to-r from-primary/80 to-accent/70 shadow-xl">
            <img src={logoSrc} alt="YardPass" className="h-16 w-20 object-contain" />
          </div>

          {/* Show guest session status if active */}
          {hasGuestSession && allowGuestTicketAccess ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold text-center">
                  Guest Session Active
                </CardTitle>
                <CardDescription className="text-base text-center text-muted-foreground">
                  You're currently signed in as a guest
                </CardDescription>
              </div>

              <div className="space-y-3 rounded-xl bg-green-50 dark:bg-green-950/20 p-4 border border-green-200 dark:border-green-900">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      {guestSession?.email ? 'Email' : guestSession?.phone ? 'Phone' : 'Contact'}: {guestSession?.email || guestSession?.phone}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Session expires: {new Date(guestSession?.exp || 0).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGuestSignOut}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium shadow-lg"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <CardTitle className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">
                {title}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {description}
              </CardDescription>
            </div>
          )}

          {!hasGuestSession && (
            <div className="mx-auto flex rounded-full border border-border/60 bg-background/80 p-1 shadow-inner">
              <Button
                type="button"
                variant={authMethod === 'phone' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAuthMethod('phone');
                  resetOtpState();
                }}
                className="flex items-center gap-2 rounded-full"
              >
                <Phone className="h-4 w-4" />
                Phone
              </Button>
              <Button
                type="button"
                variant={authMethod === 'email' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setAuthMethod('email');
                  resetOtpState();
                }}
                className="flex items-center gap-2 rounded-full"
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
            </div>
          )}
        </CardHeader>

        {!hasGuestSession && (
          <CardContent className="space-y-8 px-6 pb-8 pt-6">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as AuthTab)}
              className="w-full"
            >
              <TabsList className={cn('grid w-full gap-2', allowGuestTicketAccess ? 'grid-cols-3' : 'grid-cols-2')}>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                {allowGuestTicketAccess && <TabsTrigger value="guest">Guest Access</TabsTrigger>}
              </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignInSubmit} className="space-y-5">
                {authMethod === 'email' ? (
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                    />
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                      />
                    </div>
                    {error?.email && (
                      <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        {error.email}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signin-phone">Phone Number</Label>
                    {!showOtpInput ? (
                      <Input
                        id="signin-phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                      />
                    ) : (
                      <div className="space-y-2">
                        <Input
                          id="signin-otp"
                          name="otp"
                          type="text"
                          maxLength={6}
                          placeholder="Enter 6-digit code"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          required
                          className="h-12 rounded-xl border-2 border-border/40 bg-background/80 tracking-[0.3em] text-center"
                        />
                        <p className="text-sm text-muted-foreground">Code sent to {phoneForOtp}</p>
                      </div>
                    )}
                    {error?.phone && (
                      <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        {error.phone}
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? authMethod === 'phone' && !showOtpInput
                      ? 'Sending code…'
                      : authMethod === 'phone' && showOtpInput
                      ? 'Verifying…'
                      : 'Signing in…'
                    : authMethod === 'phone' && !showOtpInput
                    ? 'Send Code'
                    : authMethod === 'phone' && showOtpInput
                    ? 'Verify Code'
                    : 'Sign In'}
                </Button>

                {authMethod === 'phone' && showOtpInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={resetOtpState}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Use a different number
                  </Button>
                )}
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUpSubmit} className="space-y-5 text-left">
                {!showOtpInput && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display name</Label>
                    <Input
                      id="signup-name"
                      name="displayName"
                      type="text"
                      placeholder="How should we address you?"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                    />
                  </div>
                )}

                {authMethod === 'email' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Phone (optional)</Label>
                      <Input
                        id="signup-phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Create a secure password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                      />
                    </div>
                    {error?.email && (
                      <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        {error.email}
                      </div>
                    )}
                  </>
                ) : !showOtpInput ? (
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone-required">Phone number</Label>
                    <Input
                      id="signup-phone-required"
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                    />
                    {error?.phone && (
                      <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        {error.phone}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="signup-otp">Verification code</Label>
                    <Input
                      id="signup-otp"
                      name="otp"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      className="h-12 rounded-xl border-2 border-border/40 bg-background/80 tracking-[0.3em] text-center"
                    />
                    <p className="text-sm text-muted-foreground">Code sent to {phoneForOtp}</p>
                    {error?.phone && (
                      <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        {error.phone}
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? authMethod === 'phone' && !showOtpInput
                      ? 'Sending code…'
                      : authMethod === 'phone' && showOtpInput
                      ? 'Verifying…'
                      : 'Creating account…'
                    : authMethod === 'phone' && !showOtpInput
                    ? 'Send Code'
                    : authMethod === 'phone' && showOtpInput
                    ? 'Verify & Create Account'
                    : 'Create account'}
                </Button>

                {authMethod === 'phone' && showOtpInput && (
                  <Button type="button" variant="ghost" className="w-full" onClick={resetOtpState}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Use a different number
                  </Button>
                )}
              </form>
            </TabsContent>

            {allowGuestTicketAccess && (
              <TabsContent value="guest" className="space-y-4">
                {guestStep === 'collect' ? (
                  <form onSubmit={handleGuestSendCode} className="space-y-5 text-left">
                    <div className="space-y-2">
                      <Label htmlFor="guest-contact">Phone or email</Label>
                      <Input
                        id="guest-contact"
                        type={guestMethod === 'phone' ? 'tel' : 'email'}
                        inputMode={guestMethod === 'phone' ? 'tel' : 'email'}
                        placeholder={guestMethod === 'phone' ? '+1 (555) 123-4567' : 'you@example.com'}
                        value={guestContact}
                        onChange={(event) => setGuestContact(event.target.value)}
                        required
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex rounded-full border border-border/60 bg-background/80 p-1 text-sm font-medium">
                        <Button
                          type="button"
                          size="sm"
                          variant={guestMethod === 'phone' ? 'default' : 'ghost'}
                          className="rounded-full"
                          onClick={() => setGuestMethod('phone')}
                        >
                          Phone
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={guestMethod === 'email' ? 'default' : 'ghost'}
                          className="rounded-full"
                          onClick={() => setGuestMethod('email')}
                        >
                          Email
                        </Button>
                      </div>
                      {resendSecs > 0 && (
                        <span className="text-sm text-muted-foreground">Resend in {resendSecs}s</span>
                      )}
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={guestLoading}>
                      {guestLoading ? 'Sending…' : 'Send access code'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleGuestVerify} className="space-y-5 text-left">
                    <div className="space-y-2">
                      <Label htmlFor="guest-otp">Verification code</Label>
                      <Input
                        id="guest-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={guestOtp}
                        onChange={(event) => setGuestOtp(event.target.value)}
                        required
                        className="h-12 rounded-xl border-2 border-border/40 bg-background/80 tracking-[0.3em] text-center"
                      />
                      <p className="text-sm text-muted-foreground">Code sent to {maskedGuestContact}</p>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      {resendSecs > 0 ? (
                        <span>Resend available in {resendSecs}s</span>
                      ) : (
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 text-primary"
                          onClick={(event) => {
                            event.preventDefault();
                            setGuestStep('collect');
                            setResendSecs(0);
                          }}
                        >
                          Resend code
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 text-muted-foreground"
                        onClick={() => {
                          resetGuestState();
                        }}
                      >
                        Use a different contact
                      </Button>
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={guestLoading}>
                      {guestLoading ? 'Verifying…' : 'Verify & view tickets'}
                    </Button>
                  </form>
                )}
              </TabsContent>
            )}
          </Tabs>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default AuthExperience;
