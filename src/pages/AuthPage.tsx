import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { Mail, Phone } from 'lucide-react';

export default function AuthPage() {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const { user } = useAuth();
  const { isLoading, showOtpInput, phoneForOtp, handleSignIn, handleSignUp, resetOtpState } = useAuthFlow();
  const navigate = useNavigate();
  const location = useLocation();

  // Only redirect if already logged in AND we're on the direct /auth route
  useEffect(() => {
    if (user && location.pathname === '/auth' && !location.state?.fromProtectedRoute) {
      const redirectTo = location.state?.redirectTo || '/';
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSignIn(e, authMethod);
  };

  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSignUp(e, authMethod);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">{/* Removed dark background here since AuthGuard handles it */}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            YardPass
          </CardTitle>
          <CardDescription>
            Your gateway to events and culture
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
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
                        <Label htmlFor="signin-phone">Phone Number</Label>
                        <Input
                          id="signin-phone"
                          name="phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="signin-otp">Verification Code</Label>
                        <Input
                          id="signin-otp"
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
                    <Label htmlFor="signup-name">Display Name</Label>
                    <Input
                      id="signup-name"
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
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Phone (Optional)</Label>
                      <Input
                        id="signup-phone"
                        name="phone"
                        type="tel"
                        placeholder="Your phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
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
                        <Label htmlFor="signup-phone">Phone Number</Label>
                        <Input
                          id="signup-phone"
                          name="phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="signup-otp">Verification Code</Label>
                        <Input
                          id="signup-otp"
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
        </CardContent>
      </Card>
    </div>
  );
}