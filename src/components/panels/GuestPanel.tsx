import React from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function GuestPanel({ flow }: { flow: any }) {
  const { seconds, reset, isRunning } = useCountdown(30);
  const { 
    isLoading, 
    guestContact, 
    setGuestContact, 
    error, 
    sendGuestOtp, 
    verifyGuestOtp, 
    showGuestOtp, 
    guestOtp, 
    setGuestOtp 
  } = flow;

  return (
    <div aria-label="Guest access" className="space-y-4">
      {error?.guest && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error.guest}
        </div>
      )}
      {!showGuestOtp ? (
        <>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Guest access</strong> lets you view your tickets without creating a full account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guestContact">Phone or Email</Label>
            <Input 
              id="guestContact"
              data-autofocus 
              value={guestContact} 
              onChange={e => setGuestContact(e.target.value)} 
              placeholder="+1 555 123 4567 or you@example.com"
              disabled={isLoading}
            />
          </div>
          <Button
            disabled={isLoading || isRunning || !guestContact}
            onClick={async () => { 
              const ok = await sendGuestOtp(); 
              if (ok) reset(30); 
            }}
            className="w-full"
          >
            {isLoading ? 'Sending…' : `Send code${isRunning ? ` (${seconds}s)` : ''}`}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="guestOtp">Verification Code</Label>
            <Input 
              id="guestOtp"
              data-autofocus
              inputMode="numeric" 
              maxLength={6} 
              value={guestOtp} 
              onChange={e => setGuestOtp(e.target.value)} 
              className="tracking-widest text-center text-lg"
              placeholder="000000"
              disabled={isLoading}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              disabled={isLoading || guestOtp.length < 6} 
              onClick={verifyGuestOtp} 
              className="flex-1"
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </Button>
            <Button 
              variant="outline"
              disabled={isRunning || isLoading} 
              onClick={async () => { 
                const ok = await sendGuestOtp(); 
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

