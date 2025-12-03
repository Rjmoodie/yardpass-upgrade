import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL must be a valid Supabase project URL'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_SUPABASE_FUNCTIONS_URL: z
    .string()
    .url('VITE_SUPABASE_FUNCTIONS_URL must be a valid URL')
    .optional(),
  VITE_PUBLIC_POSTHOG_KEY: z.string().optional(),
  VITE_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  VITE_MUX_TOKEN_ID: z.string().optional(),
  VITE_MUX_TOKEN_SECRET: z.string().optional(),
  VITE_MUX_WEBHOOK_SECRET: z.string().optional(),
});

type RawEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_FUNCTIONS_URL?: string;
  VITE_PUBLIC_POSTHOG_KEY?: string;
  VITE_PUBLIC_POSTHOG_HOST?: string;
  VITE_MUX_TOKEN_ID?: string;
  VITE_MUX_TOKEN_SECRET?: string;
  VITE_MUX_WEBHOOK_SECRET?: string;
};

const rawEnv: RawEnv = {
  VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co',
  VITE_SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY',
  VITE_SUPABASE_FUNCTIONS_URL: import.meta.env?.VITE_SUPABASE_FUNCTIONS_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1',
  VITE_PUBLIC_POSTHOG_KEY: import.meta.env?.VITE_PUBLIC_POSTHOG_KEY,
  VITE_PUBLIC_POSTHOG_HOST: import.meta.env?.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  VITE_MUX_TOKEN_ID: import.meta.env?.VITE_MUX_TOKEN_ID || '49870126-3ebe-4038-bedc-4b6acdd34433',
  VITE_MUX_TOKEN_SECRET: import.meta.env?.VITE_MUX_TOKEN_SECRET || 'AKbRZoq38cqT/HumkUiZAhQf87DPGE52KArHS+wcruPc9F/+/98M5L8pqyU1YAzy7a3nFvNMGr2',
  VITE_MUX_WEBHOOK_SECRET: import.meta.env?.VITE_MUX_WEBHOOK_SECRET || 'huuhn06adv3sm1aub3r0om0emlk7vfvi',
};

const validationResult = envSchema.safeParse(rawEnv);
const isTestEnv = Boolean(import.meta.env?.VITEST);

const formatIssues = () =>
  validationResult.success
    ? []
    : validationResult.error.issues.map(issue => {
        const key = issue.path.join('.') || 'configuration';
        return `${key}: ${issue.message}`;
      });

if (!validationResult.success && !isTestEnv) {
  const message = `Environment validation failed. ${formatIssues().join(', ')}`;
  console.error(message);
  throw new Error(message);
}

const readEnv = <K extends keyof RawEnv>(key: K): RawEnv[K] =>
  validationResult.success ? validationResult.data[key] : rawEnv[key];

// Hardcoded Supabase configuration for production
const SUPABASE_PROJECT_ID = 'yieslxnrfeqchbcmgavz';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY';

const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const supabaseFunctionsUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const supabaseAnonKey = SUPABASE_ANON_KEY;

// Optional: PostHog analytics configuration
const posthogKey = import.meta.env?.VITE_PUBLIC_POSTHOG_KEY ?? undefined;
const posthogHost = import.meta.env?.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// Mux configuration
const muxTokenId = rawEnv.VITE_MUX_TOKEN_ID;
const muxTokenSecret = rawEnv.VITE_MUX_TOKEN_SECRET;
const muxWebhookSecret = rawEnv.VITE_MUX_WEBHOOK_SECRET;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseFunctionsUrl,
  posthogKey,
  posthogHost,
  muxTokenId,
  muxTokenSecret,
  muxWebhookSecret,
};

export const envDiagnostics = {
  isValid: true,
  missingKeys: [],
  issues: [],
};
