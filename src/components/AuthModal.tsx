import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { Mail, Phone } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export default function AuthModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  title = "Sign in to continue",
  description = "You need to be signed in to perform this action"
}: AuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const { isLoading, showOtpInput, phoneForOtp, handleSignIn, handleSignUp, resetOtpState } = useAuthFlow();

  const handleClose = () => {
    resetOtpState();
    onClose();
  };

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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center mb-6">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={authMethod === 'phone' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setAuthMethod('phone');
                resetOtpState();
              }}
              className="flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Phone
            </Button>
            <Button
              variant={authMethod === 'email' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setAuthMethod('email');
                resetOtpState();
              }}
              className="flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Email
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              {authMethod === 'email' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signin-email">Email</Label>
                    <Input
                      id="modal-signin-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                    />
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
                        placeholder="Enter your phone number"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="modal-signin-otp">Verification Code</Label>
                      <Input
                        id="modal-signin-otp"
                        name="otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Code sent to {phoneForOtp}
                      </p>
                    </div>
                  )}
                </>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  authMethod === 'phone' && !showOtpInput ? "Sending code..." : 
                  authMethod === 'phone' && showOtpInput ? "Verifying..." : 
                  "Signing in..."
                ) : (
                  authMethod === 'phone' && !showOtpInput ? "Send Code" :
                  authMethod === 'phone' && showOtpInput ? "Verify Code" :
                  "Sign In"
                )}
              </Button>
              
              {authMethod === 'phone' && showOtpInput && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={resetOtpState}
                >
                  Back to phone number
                </Button>
              )}
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              {!showOtpInput && (
                <div className="space-y-2">
                  <Label htmlFor="modal-signup-name">Display Name</Label>
                  <Input
                    id="modal-signup-name"
                    name="displayName"
                    type="text"
                    placeholder="Your display name"
                    required
                  />
                </div>
              )}
              
              {authMethod === 'email' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signup-email">Email</Label>
                    <Input
                      id="modal-signup-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modal-signup-phone">Phone (Optional)</Label>
                    <Input
                      id="modal-signup-phone"
                      name="phone"
                      type="tel"
                      placeholder="Your phone number"
                    />
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
                        placeholder="Enter your phone number"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="modal-signup-otp">Verification Code</Label>
                      <Input
                        id="modal-signup-otp"
                        name="otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Code sent to {phoneForOtp}
                      </p>
                    </div>
                  )}
                </>
              )}
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  authMethod === 'phone' && !showOtpInput ? "Sending code..." : 
                  authMethod === 'phone' && showOtpInput ? "Verifying..." : 
                  "Creating account..."
                ) : (
                  authMethod === 'phone' && !showOtpInput ? "Send Code" :
                  authMethod === 'phone' && showOtpInput ? "Verify & Create Account" :
                  "Sign Up"
                )}
              </Button>
              
              {authMethod === 'phone' && showOtpInput && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={resetOtpState}
                >
                  Back to phone number
                </Button>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}