import React from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PhonePanel({ mode, flow }: { mode: 'signin' | 'signup'; flow: any }) {
  const { seconds, reset, isRunning } = useCountdown(30);
  const {
    isLoading,
    showOtpInput,
    phoneForOtp,
    sendPhoneOtp,
    verifyOtp,
    setPhone,
    setOtp,
    phone,
    otp,
    error,
  } = flow;

  return (
    <div aria-label="Phone authentication" className="space-y-4">
      {error?.phone && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error.phone}
        </div>
      )}
      {!showOtpInput ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input 
              id="phone"
              data-autofocus 
              type="tel" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              placeholder="+1 555 123 4567"
              disabled={isLoading}
            />
          </div>
          <Button
            disabled={isLoading || isRunning || !phone}
            onClick={async () => {
              const ok = await sendPhoneOtp(mode);
              if (ok) reset(30);
            }}
            className="w-full"
          >
            {isLoading ? 'Sending…' : `Send code${isRunning ? ` (${seconds}s)` : ''}`}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{phoneForOtp}</strong>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input 
              id="otp"
              data-autofocus
              inputMode="numeric" 
              maxLength={6} 
              value={otp} 
              onChange={e => setOtp(e.target.value)} 
              className="tracking-widest text-center text-lg"
              placeholder="000000"
              disabled={isLoading}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              disabled={isLoading || otp.length < 6} 
              onClick={() => verifyOtp(mode)} 
              className="flex-1"
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </Button>
            <Button 
              variant="outline"
              disabled={isRunning || isLoading} 
              onClick={async () => { 
                const ok = await sendPhoneOtp(mode); 
                if (ok) reset(30); 
              }} 
              className="w-32"
            >
              {isRunning ? `${seconds}s` : 'Resend'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

