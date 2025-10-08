import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { Mail, Phone, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;

  /** Enable the “Access Tickets” guest flow (OTP without full profile). */
  allowGuestTicketAccess?: boolean;

  /** Optional event scope (guest session limited to this event). */
  guestScopeEventId?: string;

  /** Minutes the guest session should remain valid (default 30). */
  guestSessionMinutes?: number;

  /** Default tab: 'signin' | 'signup' | 'guest' */
  defaultTab?: 'signin' | 'signup' | 'guest';
}

type GuestMethod = 'email' | 'phone';

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Sign in to continue',
  description = 'You need to be signed in to perform this action',
  allowGuestTicketAccess = true,
  guestScopeEventId,
  guestSessionMinutes = 30,
  defaultTab = 'signin',
}: AuthModalProps) {
  /** Existing full-auth flow */
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const { isLoading, showOtpInput, phoneForOtp, handleSignIn, handleSignUp, resetOtpState } =
    useAuthFlow();

  /** NEW: Guest ticket flow (OTP) */
  const [guestTab, setGuestTab] = useState<'guest' | 'signin' | 'signup'>(defaultTab);
  const [guestMethod, setGuestMethod] = useState<GuestMethod>('phone');
  const [guestContact, setGuestContact] = useState('');
  const [guestOtp, setGuestOtp] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestStep, setGuestStep] = useState<'collect' | 'otp'>('collect');
  const [resendSecs, setResendSecs] = useState<number>(0);

  const maskedContact = useMemo(() => {
    if (!guestContact) return '';
    if (guestMethod === 'email') {
      const [u, d] = guestContact.split('@');
      if (!u || !d) return guestContact;
      const ux = u.length <= 2 ? u[0] + '*' : u[0] + '*'.repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
      return `${ux}@${d}`;
    } else {
      const cleaned = guestContact.replace(/\D/g, '');
      if (cleaned.length <= 4) return cleaned;
      return cleaned.slice(0, -4).replace(/\d/g, '*') + cleaned.slice(-4);
    }
  }, [guestContact, guestMethod]);

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

  const clearGuestState = useCallback(() => {
    setGuestContact('');
    setGuestOtp('');
    setGuestLoading(false);
    setGuestStep('collect');
    setResendSecs(0);
  }, []);

  const handleClose = () => {
    resetOtpState();
    clearGuestState();
    onClose();
  };

  /** ---------- Full-account Sign In / Sign Up ---------- */
  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSignIn(e, authMethod);
    handleClose();
    onSuccess?.();
  };

  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSignUp(e, authMethod);
    handleClose();
    onSuccess?.();
  };

  /** ---------- Guest Ticket Access (OTP-only) ---------- */

  // 1) Request OTP
  const handleGuestSendCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guestContact.trim()) {
      toast({ title: 'Missing info', description: 'Please enter your phone or email', variant: 'destructive' });
      return;
    }
    setGuestLoading(true);
    try {
      // Call your Edge Function that triggers OTP dispatch
      // Expected to return { request_id } or 200 OK on success
      const { error } = await supabase.functions.invoke('guest-tickets-start', {
        body: {
          method: guestMethod, // 'phone' | 'email'
          contact: guestContact,
          event_id: guestScopeEventId || null,
        },
      });
      if (error) throw error;

      toast({
        title: 'Code Sent',
        description: `We sent a code to ${maskedContact}`,
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
  };

  // 2) Verify OTP → persist guest session
  const handleGuestVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guestOtp || guestOtp.length < 4) {
      toast({ title: 'Invalid code', description: 'Please enter the code you received.', variant: 'destructive' });
      return;
    }
    setGuestLoading(true);
    try {
      // Expected return:
      // { token: string, scope?: { all?: boolean; eventIds?: string[] } }
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
        })
      );

      toast({
        title: 'Guest access granted',
        description: 'You can now view tickets for this contact.',
      });

      clearGuestState();
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      console.error('guest verify error', err);
      toast({
        title: 'Verification failed',
        description: err?.message || 'Please check your code and try again.',
        variant: 'destructive',
      });
    } finally {
      setGuestLoading(false);
    }
  };

  const resendDisabled = resendSecs > 0 || guestLoading;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Toggle method (phone/email) shared by SignIn/SignUp; guest tab has its own toggle */}
        <div className="flex justify-center mb-4 overflow-hidden">
          <div className="flex rounded-lg border p-0.5 w-fit">
            <Button
              variant={authMethod === 'phone' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setAuthMethod('phone');
                resetOtpState();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs"
            >
              <Phone className="w-3 h-3" />
              Phone
            </Button>
            <Button
              variant={authMethod === 'email' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setAuthMethod('email');
                resetOtpState();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs"
            >
              <Mail className="w-3 h-3" />
              Email
            </Button>
          </div>
        </div>

        <Tabs defaultValue={guestTab} onValueChange={(v) => setGuestTab(v as any)} className="w-full overflow-visible">
          <TabsList className={`grid ${allowGuestTicketAccess ? 'grid-cols-3' : 'grid-cols-2'} w-full gap-0.5 overflow-hidden`}>
            <TabsTrigger value="signin" className="min-w-0 overflow-hidden px-2">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="min-w-0 overflow-hidden px-2">Sign Up</TabsTrigger>
            {allowGuestTicketAccess && <TabsTrigger value="guest" className="text-xs min-w-0 overflow-hidden px-0.5 py-1">Guest</TabsTrigger>}
          </TabsList>

          {/* ---------- Sign In ---------- */}
          <TabsContent value="signin">
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              {authMethod === 'email' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signin-email">Email</Label>
                    <Input id="modal-signin-email" name="email" type="email" placeholder="Enter your email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signin-password">Password</Label>
                    <Input
                      id="modal-signin-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  {!showOtpInput ? (
                    <div className="space-y-2">
                      <Label htmlFor="modal-signin-phone">Phone Number</Label>
                      <Input
                        id="modal-signin-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="Enter your phone number"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="modal-signin-otp">Verification Code</Label>
                      <Input id="modal-signin-otp" name="otp" type="text" placeholder="Enter 6-digit code" maxLength={6} required />
                      <p className="text-sm text-muted-foreground">Code sent to {phoneForOtp}</p>
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? authMethod === 'phone' && !showOtpInput
                    ? 'Sending code...'
                    : authMethod === 'phone' && showOtpInput
                    ? 'Verifying...'
                    : 'Signing in...'
                  : authMethod === 'phone' && !showOtpInput
                  ? 'Send Code'
                  : authMethod === 'phone' && showOtpInput
                  ? 'Verify Code'
                  : 'Sign In'}
              </Button>

              {authMethod === 'phone' && showOtpInput && (
                <Button type="button" variant="ghost" className="w-full" onClick={resetOtpState}>
                  Back to phone number
                </Button>
              )}
            </form>
          </TabsContent>

          {/* ---------- Sign Up ---------- */}
          <TabsContent value="signup">
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              {!showOtpInput && (
                <div className="space-y-2">
                  <Label htmlFor="modal-signup-name">Display Name</Label>
                  <Input id="modal-signup-name" name="displayName" type="text" placeholder="Your display name" required />
                </div>
              )}

              {authMethod === 'email' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signup-email">Email</Label>
                    <Input id="modal-signup-email" name="email" type="email" placeholder="Enter your email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signup-phone">Phone (Optional)</Label>
                    <Input id="modal-signup-phone" name="phone" type="tel" inputMode="tel" placeholder="Your phone number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signup-password">Password</Label>
                    <Input
                      id="modal-signup-password"
                      name="password"
                      type="password"
                      placeholder="Create a password"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  {!showOtpInput ? (
                    <div className="space-y-2">
                      <Label htmlFor="modal-signup-phone2">Phone Number</Label>
                      <Input
                        id="modal-signup-phone2"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="Enter your phone number"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="modal-signup-otp">Verification Code</Label>
                      <Input id="modal-signup-otp" name="otp" type="text" placeholder="Enter 6-digit code" maxLength={6} required />
                      <p className="text-sm text-muted-foreground">Code sent to {phoneForOtp}</p>
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? authMethod === 'phone' && !showOtpInput
                    ? 'Sending code...'
                    : authMethod === 'phone' && showOtpInput
                    ? 'Verifying...'
                    : 'Creating account...'
                  : authMethod === 'phone' && !showOtpInput
                  ? 'Send Code'
                  : authMethod === 'phone' && showOtpInput
                  ? 'Verify & Create Account'
                  : 'Sign Up'}
              </Button>

              {authMethod === 'phone' && showOtpInput && (
                <Button type="button" variant="ghost" className="w-full" onClick={resetOtpState}>
                  Back to phone number
                </Button>
              )}
            </form>
          </TabsContent>

          {/* ---------- Access Tickets (Guest) ---------- */}
          {allowGuestTicketAccess && (
            <TabsContent value="guest">
              {guestStep === 'collect' ? (
                <form onSubmit={handleGuestSendCode} className="space-y-4">
                  <div className="flex justify-center">
                    <div className="flex rounded-lg border p-1">
                      <Button
                        type="button"
                        variant={guestMethod === 'phone' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setGuestMethod('phone')}
                        className="flex items-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        Phone
                      </Button>
                      <Button
                        type="button"
                        variant={guestMethod === 'email' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setGuestMethod('email')}
                        className="flex items-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="guest-contact">
                      {guestMethod === 'phone' ? 'Phone Number' : 'Email'}
                    </Label>
                    <Input
                      id="guest-contact"
                      type={guestMethod === 'phone' ? 'tel' : 'email'}
                      inputMode={guestMethod === 'phone' ? 'tel' : 'email'}
                      placeholder={guestMethod === 'phone' ? '+1 (555) 123-4567' : 'you@example.com'}
                      value={guestContact}
                      onChange={(e) => setGuestContact(e.target.value)}
                      required
                    />
                    {guestScopeEventId && (
                      <p className="text-xs text-muted-foreground">
                        Access will be limited to this event.
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={guestLoading}>
                    {guestLoading ? 'Sending code…' : 'Send Code'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleGuestVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="guest-otp">Verification Code</Label>
                    <Input
                      id="guest-otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={guestOtp}
                      onChange={(e) => setGuestOtp(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Code sent to {maskedContact}
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={guestLoading || guestOtp.length < 4}>
                    {guestLoading ? 'Verifying…' : 'Verify'}
                  </Button>

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setGuestStep('collect');
                        setGuestOtp('');
                      }}
                    >
                      Back
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (resendDisabled) return;
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
                          toast({ title: 'Code re-sent', description: `Another code was sent to ${maskedContact}` });
                          startResendTimer(30);
                        } catch (err: any) {
                          toast({
                            title: 'Resend failed',
                            description: err?.message || 'Please try again.',
                            variant: 'destructive',
                          });
                        } finally {
                          setGuestLoading(false);
                        }
                      }}
                      disabled={resendDisabled}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {resendSecs > 0 ? `Resend in ${resendSecs}s` : 'Resend code'}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}