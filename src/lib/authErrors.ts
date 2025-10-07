export function mapAuthError(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const msg = (typeof err === 'object' && err && 'message' in err) ? String((err as any).message) : '';
  if (/Invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email before signing in.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait and try again.';
  if (/OTP/i.test(msg)) return 'The code you entered is invalid or expired.';
  if (/phone.*invalid/i.test(msg)) return 'Please enter a valid phone number.';
  if (/email.*invalid/i.test(msg)) return 'Please enter a valid email address.';
  return fallback;
}

