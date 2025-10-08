import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { mapAuthError } from '@/lib/authErrors';

type Options = {
  onSuccess?: () => void;
  mapError?: (e: unknown, fallback?: string) => string;
  guestScopeEventId?: string;
  guestSessionMinutes?: number;
};

export function useAuthFlow(opts: Options = {}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithPhone, verifyPhoneOtp, signUp, signUpWithPhone } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // email/password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // phone
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [phoneForOtp, setPhoneForOtp] = useState('');

  // guest
  const [guestContact, setGuestContact] = useState('');
  const [guestOtp, setGuestOtp] = useState('');
  const [showGuestOtp, setShowGuestOtp] = useState(false);

  const [error, setError] = useState<{ email?: string; phone?: string; guest?: string } | null>(null);

  // Cleanup on unmount
  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  function startBusy() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setIsLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return true;
  }

  function endBusy() {
    busyRef.current = false;
    setIsLoading(false);
  }

  function successRedirect() {
    const redirectTo = (location.state as any)?.from ?? '/';
    navigate(redirectTo, { replace: true });
    opts.onSuccess?.();
  }

  async function emailPasswordAuth(mode: 'signin' | 'signup') {
    setError(null);
    if (!startBusy()) return;
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({ title: 'Welcome back!', description: 'Successfully signed in.' });
      } else {
        const { error } = await signUp(email, password, displayName, undefined);
        if (error) throw error;
        toast({ title: 'Account created', description: 'Please check your email to verify (optional).' });
      }
      successRedirect();
    } catch (e) {
      setError({ email: (opts.mapError ?? mapAuthError)(e, 'Unable to authenticate.') });
    } finally {
      endBusy();
    }
  }

  function resetOtpState() { 
    setShowOtpInput(false); 
    setOtp(''); 
    setPhoneForOtp(''); 
  }

  async function sendPhoneOtp(mode: 'signin' | 'signup') {
    setError(null);
    if (!phone) { 
      setError({ phone: 'Enter your phone number.' }); 
      return false; 
    }
    if (!startBusy()) return false;
    try {
      const { error } = await signInWithPhone(phone);
      if (error) throw error;
      setShowOtpInput(true);
      setPhoneForOtp(phone);
      toast({ title: 'Verification code sent', description: 'Please check your phone.' });
      return true;
    } catch (e) {
      setError({ phone: (opts.mapError ?? mapAuthError)(e, 'Could not send code.') });
      return false;
    } finally {
      endBusy();
    }
  }

  async function verifyOtp(mode: 'signin' | 'signup') {
    setError(null);
    if (otp.length < 6) { 
      setError({ phone: 'Enter the 6-digit code.' }); 
      return; 
    }
    if (!startBusy()) return;
    try {
      const { error } = await verifyPhoneOtp(phoneForOtp || phone, otp);
      if (error) throw error;
      toast({ title: mode === 'signin' ? 'Signed in' : 'Phone verified', description: 'Successfully authenticated.' });
      successRedirect();
    } catch (e) {
      setError({ phone: (opts.mapError ?? mapAuthError)(e, 'Could not verify code.') });
    } finally {
      endBusy();
    }
  }

  // Guest ticket access (localStorage, event-scoped)
  async function sendGuestOtp() {
    setError(null);
    if (!guestContact) { 
      setError({ guest: 'Enter your phone or email.' }); 
      return false; 
    }
    if (!startBusy()) return false;
    try {
      const { error } = await signInWithPhone(guestContact);
      if (error) throw error;
      setShowGuestOtp(true);
      toast({ title: 'Verification code sent' });
      return true;
    } catch (e) {
      setError({ guest: (opts.mapError ?? mapAuthError)(e, 'Could not send code.') });
      return false;
    } finally {
      endBusy();
    }
  }

  async function verifyGuestOtp() {
    setError(null);
    if (guestOtp.length < 6) { 
      setError({ guest: 'Enter the 6-digit code.' }); 
      return; 
    }
    if (!startBusy()) return;
    try {
      // Create a scoped guest session in localStorage
      const exp = Date.now() + (opts.guestSessionMinutes ?? 30) * 60 * 1000;
      const scope = opts.guestScopeEventId ? { eventIds: [opts.guestScopeEventId] } : { all: true };
      const token = `guest_${Math.random().toString(36).slice(2, 10)}`;
      const sess = { token, contact: guestContact, exp, scope };
      localStorage.setItem('ticket-guest-session', JSON.stringify(sess));
      toast({ title: 'Guest access granted', description: 'You can now view your tickets.' });
      successRedirect();
    } catch (e) {
      setError({ guest: (opts.mapError ?? mapAuthError)(e, 'Could not verify code.') });
    } finally {
      endBusy();
    }
  }

  const handleSignIn = async (e: React.FormEvent, method: 'email' | 'phone') => {
    e.preventDefault();
    if (method === 'email') {
      await emailPasswordAuth('signin');
    } else {
      if (!showOtpInput) {
        await sendPhoneOtp('signin');
      } else {
        await verifyOtp('signin');
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent, method: 'email' | 'phone') => {
    e.preventDefault();
    if (method === 'email') {
      await emailPasswordAuth('signup');
    } else {
      if (!showOtpInput) {
        await sendPhoneOtp('signup');
      } else {
        await verifyOtp('signup');
      }
    }
  };

  return {
    isLoading,
    showOtpInput, 
    phoneForOtp, 
    resetOtpState,
    email, 
    password, 
    displayName, 
    setEmail, 
    setPassword, 
    setDisplayName,
    emailPasswordAuth,
    handleSignIn,
    handleSignUp,
    phone, 
    setPhone, 
    otp, 
    setOtp, 
    sendPhoneOtp, 
    verifyOtp,
    guestContact, 
    setGuestContact, 
    guestOtp, 
    setGuestOtp, 
    showGuestOtp, 
    sendGuestOtp, 
    verifyGuestOtp,
    error,
  };
}
