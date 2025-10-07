import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EmailPanel({ mode, flow }: { mode: 'signin' | 'signup'; flow: any }) {
  const { isLoading, email, password, displayName, setEmail, setPassword, setDisplayName, emailPasswordAuth, error } = flow;
  
  return (
    <div aria-label="Email authentication" className="space-y-4">
      {mode === 'signup' && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input 
            id="displayName"
            type="text" 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
            placeholder="Your name"
            disabled={isLoading}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email"
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input 
          id="password"
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="••••••••"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          disabled={isLoading}
        />
      </div>
      {error?.email && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error.email}
        </div>
      )}
      <Button disabled={isLoading || !email || !password} onClick={() => emailPasswordAuth(mode)} className="w-full">
        {isLoading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
      </Button>
    </div>
  );
}

