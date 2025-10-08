import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resetEnvironment = () => {
  vi.unstubAllEnvs();
  vi.resetModules();
};

describe('environment configuration', () => {
  beforeEach(() => {
    resetEnvironment();
  });

  afterEach(() => {
    resetEnvironment();
  });

  it('derives the Supabase Functions URL when not explicitly provided', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co/');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    const { env } = await import('@/config/env');

    expect(env.supabaseUrl).toBe('https://example.supabase.co');
    expect(env.supabaseFunctionsUrl).toBe('https://example.supabase.co/functions/v1');
  });

  it('prefers an explicitly configured Supabase Functions URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_SUPABASE_FUNCTIONS_URL', 'https://api.example.com/edge/');

    const { env } = await import('@/config/env');

    expect(env.supabaseFunctionsUrl).toBe('https://api.example.com/edge');
  });

  it('surfaces missing keys in diagnostics', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { envDiagnostics } = await import('@/config/env');

    expect(envDiagnostics.isValid).toBe(false);
    expect(envDiagnostics.missingKeys).toContain('VITE_SUPABASE_URL');
    expect(envDiagnostics.missingKeys).toContain('VITE_SUPABASE_ANON_KEY');
  });
});
