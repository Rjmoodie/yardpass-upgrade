import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';

export function useAuthFlow() {
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [phoneForOtp, setPhoneForOtp] = useState('');
  const { signIn, signInWithPhone, verifyPhoneOtp, signUp, signUpWithPhone } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>, authMethod: 'email' | 'phone') => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    
    if (authMethod === 'phone' && !showOtpInput) {
      // First step: send OTP
      const phone = formData.get('phone') as string;
      const { error } = await signInWithPhone(phone);
      
      if (error) {
        toast({
          title: "Failed to send verification code",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setPhoneForOtp(phone);
        setShowOtpInput(true);
        toast({
          title: "Verification code sent",
          description: "Please check your phone for the verification code.",
        });
      }
    } else if (authMethod === 'phone' && showOtpInput) {
      // Second step: verify OTP
      const otp = formData.get('otp') as string;
      const { error } = await verifyPhoneOtp(phoneForOtp, otp);
      
      if (error) {
        toast({
          title: "Verification failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        handleSuccess();
      }
    } else {
      // Email authentication
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        handleSuccess();
      }
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>, authMethod: 'email' | 'phone') => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get('displayName') as string;

    if (authMethod === 'phone' && !showOtpInput) {
      // First step: send OTP for sign up
      const phone = formData.get('phone') as string;
      const { error } = await signUpWithPhone(phone, displayName);
      
      if (error) {
        toast({
          title: "Failed to send verification code",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setPhoneForOtp(phone);
        setShowOtpInput(true);
        toast({
          title: "Verification code sent",
          description: "Please check your phone for the verification code.",
        });
      }
    } else if (authMethod === 'phone' && showOtpInput) {
      // Second step: verify OTP for sign up
      const otp = formData.get('otp') as string;
      const { error } = await verifyPhoneOtp(phoneForOtp, otp);
      
      if (error) {
        toast({
          title: "Verification failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome to YardPass!",
          description: "Your account has been created successfully.",
        });
        handleSuccess();
      }
    } else {
      // Email authentication
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const phone = formData.get('phone') as string;
      const { error } = await signUp(email, password, displayName, phone);
      
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome to YardPass!",
          description: "Please check your email to verify your account.",
        });
        handleSuccess();
      }
    }
    
    setIsLoading(false);
  };

  const handleSuccess = () => {
    const redirectTo = location.state?.redirectTo || '/';
    navigate(redirectTo, { replace: true });
  };

  const resetOtpState = () => {
    setShowOtpInput(false);
    setPhoneForOtp('');
  };

  return {
    isLoading,
    showOtpInput,
    phoneForOtp,
    handleSignIn,
    handleSignUp,
    resetOtpState,
  };
}
