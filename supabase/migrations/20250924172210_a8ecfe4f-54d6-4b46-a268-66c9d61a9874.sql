-- ---- Tighten constraints & indexes ----
ALTER TABLE public.request_logs
  ADD CONSTRAINT request_logs_status_range
  CHECK (response_status IS NULL OR (response_status BETWEEN 100 AND 599));

CREATE INDEX IF NOT EXISTS idx_dead_letter_webhooks_type        ON public.dead_letter_webhooks(webhook_type);
CREATE INDEX IF NOT EXISTS idx_dead_letter_webhooks_status_time ON public.dead_letter_webhooks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_source_time         ON public.request_logs(source_type, created_at DESC);

-- ---- RLS: DENY BY DEFAULT; only functions can touch tables ----
ALTER TABLE public.dead_letter_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_breaker_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dlq_all ON public.dead_letter_webhooks;
CREATE POLICY dlq_all ON public.dead_letter_webhooks
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS req_logs_all ON public.request_logs;
CREATE POLICY req_logs_all ON public.request_logs
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS cb_all ON public.circuit_breaker_state;
CREATE POLICY cb_all ON public.circuit_breaker_state
  FOR ALL USING (false) WITH CHECK (false);

-- ---- Safe function wrappers (SECURITY DEFINER) ----
-- Request logging
CREATE OR REPLACE FUNCTION public.log_request(
  p_correlation_id uuid,
  p_source_type text,
  p_function_name text,
  p_http_method text,
  p_url text,
  p_headers jsonb,
  p_body jsonb,
  p_response_status integer,
  p_response_body jsonb,
  p_execution_time_ms integer,
  p_error_message text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.request_logs(
    correlation_id, source_type, function_name, http_method, url,
    headers, body, response_status, response_body, execution_time_ms, error_message
  ) VALUES (
    p_correlation_id, p_source_type, p_function_name, p_http_method, p_url,
    p_headers, p_body, p_response_status, p_response_body, p_execution_time_ms, p_error_message
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- DLQ enqueue
CREATE OR REPLACE FUNCTION public.dlq_enqueue_webhook(
  p_correlation_id uuid,
  p_webhook_type text,
  p_payload jsonb,
  p_original_timestamp timestamptz,
  p_failure_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.dead_letter_webhooks(
    correlation_id, webhook_type, payload, original_timestamp, failure_reason, status
  ) VALUES (
    p_correlation_id, p_webhook_type, p_payload, p_original_timestamp, p_failure_reason, 'pending'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- DLQ mark result
CREATE OR REPLACE FUNCTION public.dlq_set_status(
  p_id uuid,
  p_status text,
  p_failure_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dead_letter_webhooks
  SET status = p_status,
      failure_reason = COALESCE(p_failure_reason, failure_reason),
      updated_at = now()
  WHERE id = p_id;
END; $$;

-- DLQ pop next (for workers)
CREATE OR REPLACE FUNCTION public.dlq_pop_next(p_webhook_type text DEFAULT NULL)
RETURNS TABLE(id uuid, correlation_id uuid, webhook_type text, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.dead_letter_webhooks
    WHERE status IN ('pending','failed')
      AND (p_webhook_type IS NULL OR webhook_type = p_webhook_type)
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dead_letter_webhooks d
  SET status = 'retrying', retry_count = d.retry_count + 1, last_retry_at = now(), updated_at = now()
  FROM cte
  WHERE d.id = cte.id
  RETURNING d.id, d.correlation_id, d.webhook_type, d.payload;
END; $$;

-- Circuit breaker: add jitter + lock on read path
CREATE OR REPLACE FUNCTION public.check_circuit_breaker(p_service_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_state circuit_breaker_state%ROWTYPE;
        v_now timestamptz := now();
BEGIN
  SELECT * INTO v_state
  FROM public.circuit_breaker_state
  WHERE id = p_service_id
  FOR UPDATE; -- prevent concurrent half_open flips

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_proceed', true, 'state', 'closed');
  END IF;

  IF v_state.state = 'open' AND v_now >= COALESCE(v_state.next_attempt_at, v_now) THEN
    UPDATE public.circuit_breaker_state
    SET state = 'half_open', updated_at = v_now
    WHERE id = p_service_id;
    RETURN jsonb_build_object('can_proceed', true, 'state', 'half_open');
  END IF;

  RETURN jsonb_build_object(
    'can_proceed', v_state.state <> 'open',
    'state', v_state.state,
    'next_attempt_at', v_state.next_attempt_at
  );
END; $$;

CREATE OR REPLACE FUNCTION public.update_circuit_breaker_state(
  p_service_id TEXT,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state circuit_breaker_state%ROWTYPE;
  v_now   timestamptz := now();
  v_jitter int := (random()*5)::int; -- small jitter
BEGIN
  SELECT * INTO v_state
  FROM public.circuit_breaker_state
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Circuit breaker not found: %', p_service_id;
  END IF;

  IF p_success THEN
    UPDATE public.circuit_breaker_state
    SET state = 'closed',
        failure_count = 0,
        last_failure_at = NULL,
        next_attempt_at = NULL,
        updated_at = v_now
    WHERE id = p_service_id;

    RETURN jsonb_build_object('state','closed','can_proceed',true);
  END IF;

  -- failure path
  v_state.failure_count := v_state.failure_count + 1;

  IF v_state.failure_count >= v_state.failure_threshold THEN
    UPDATE public.circuit_breaker_state
    SET state = 'open',
        failure_count = v_state.failure_count,
        last_failure_at = v_now,
        next_attempt_at = v_now + make_interval(secs => v_state.timeout_seconds + v_jitter),
        updated_at = v_now
    WHERE id = p_service_id;

    RETURN jsonb_build_object(
      'state','open','can_proceed',false,'next_attempt_at', (v_now + make_interval(secs => v_state.timeout_seconds + v_jitter))
    );
  ELSE
    UPDATE public.circuit_breaker_state
    SET failure_count = v_state.failure_count,
        last_failure_at = v_now,
        updated_at = v_now
    WHERE id = p_service_id;

    RETURN jsonb_build_object('state',v_state.state,'can_proceed', v_state.state <> 'open');
  END IF;
END; $$;

-- Retention jobs
CREATE OR REPLACE FUNCTION public.prune_request_logs(p_keep_days int DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.request_logs
  WHERE created_at < now() - make_interval(days => p_keep_days);
END; $$;

CREATE OR REPLACE FUNCTION public.prune_dead_letters(p_keep_days int DEFAULT 30)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.dead_letter_webhooks
  WHERE status IN ('succeeded')
    AND updated_at < now() - make_interval(days => p_keep_days);
END; $$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_dead_letter_webhooks_updated_at ON public.dead_letter_webhooks;
CREATE TRIGGER update_dead_letter_webhooks_updated_at
  BEFORE UPDATE ON public.dead_letter_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_circuit_breaker_state_updated_at ON public.circuit_breaker_state;
CREATE TRIGGER update_circuit_breaker_state_updated_at
  BEFORE UPDATE ON public.circuit_breaker_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant minimal permissions
GRANT EXECUTE ON FUNCTION public.log_request(uuid,text,text,text,text,jsonb,jsonb,int,jsonb,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_circuit_breaker(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_circuit_breaker_state(text,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dlq_enqueue_webhook(uuid,text,jsonb,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dlq_set_status(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dlq_pop_next(text) TO service_role;