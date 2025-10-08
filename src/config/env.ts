// Lovable does not support VITE_* environment variables
// Using hardcoded Supabase configuration instead

const SUPABASE_PROJECT_ID = 'yieslxnrfeqchbcmgavz';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY';

const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const supabaseFunctionsUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const supabaseAnonKey = SUPABASE_ANON_KEY;

// Optional: PostHog analytics configuration
const posthogKey = import.meta.env?.VITE_PUBLIC_POSTHOG_KEY ?? undefined;
const posthogHost = import.meta.env?.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseFunctionsUrl,
  posthogKey,
  posthogHost,
};

export const envDiagnostics = {
  isValid: true,
  missingKeys: [],
  issues: [],
};
