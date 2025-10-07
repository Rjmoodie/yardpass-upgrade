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
});

type RawEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_FUNCTIONS_URL?: string;
  VITE_PUBLIC_POSTHOG_KEY?: string;
  VITE_PUBLIC_POSTHOG_HOST?: string;
};

const rawEnv: RawEnv = {
  VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_FUNCTIONS_URL: import.meta.env?.VITE_SUPABASE_FUNCTIONS_URL,
  VITE_PUBLIC_POSTHOG_KEY: import.meta.env?.VITE_PUBLIC_POSTHOG_KEY,
  VITE_PUBLIC_POSTHOG_HOST: import.meta.env?.VITE_PUBLIC_POSTHOG_HOST,
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

const normalizeUrl = (url: string | undefined): string => {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const supabaseUrl = (() => {
  const value = normalizeUrl(readEnv('VITE_SUPABASE_URL'));
  if (value) return value;
  return isTestEnv ? 'http://localhost' : '';
})();
const supabaseFunctionsUrl = (() => {
  const configured = readEnv('VITE_SUPABASE_FUNCTIONS_URL');
  if (configured) {
    return normalizeUrl(configured);
  }
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`;
  }
  return isTestEnv ? 'http://localhost/functions/v1' : '';
})();

const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY') ?? '';
const posthogKey = readEnv('VITE_PUBLIC_POSTHOG_KEY') ?? undefined;
const posthogHost = normalizeUrl(
  readEnv('VITE_PUBLIC_POSTHOG_HOST') ?? 'https://us.i.posthog.com',
);

const requiredKeys: Array<keyof RawEnv> = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const missingKeys = requiredKeys.filter(key => !rawEnv[key]);

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseFunctionsUrl,
  posthogKey,
  posthogHost,
};

export const envDiagnostics = {
  isValid: validationResult.success,
  missingKeys,
  issues: formatIssues(),
};
