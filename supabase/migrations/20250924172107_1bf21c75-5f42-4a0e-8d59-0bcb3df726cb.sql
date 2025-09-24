-- Create base tables for Phase 6 resiliency
CREATE TABLE IF NOT EXISTS public.dead_letter_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid,
  webhook_type text NOT NULL,
  payload jsonb NOT NULL,
  original_timestamp timestamptz NOT NULL,
  failure_reason text,
  retry_count int DEFAULT 0,
  last_retry_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'succeeded')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid,
  source_type text NOT NULL, -- 'web', 'edge_function', 'webhook'
  function_name text,
  http_method text,
  url text,
  headers jsonb,
  body jsonb,
  response_status int,
  response_body jsonb,
  execution_time_ms int,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.circuit_breaker_state (
  id text PRIMARY KEY, -- service identifier like 'stripe_api'
  state text DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count int DEFAULT 0,
  failure_threshold int DEFAULT 5,
  timeout_seconds int DEFAULT 60,
  last_failure_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert initial circuit breaker state for Stripe
INSERT INTO public.circuit_breaker_state (id, failure_threshold, timeout_seconds)
VALUES ('stripe_api', 3, 30)
ON CONFLICT (id) DO NOTHING;