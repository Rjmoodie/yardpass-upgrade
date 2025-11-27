/**
 * Shared Queue Utilities
 * 
 * Provides queue management with dead letter queue (DLQ) support.
 * Used by: Email queue, webhook retry queue
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface EnqueueOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Enqueue an item into a retry queue with dead letter support
 * 
 * @param supabaseClient - Supabase service client
 * @param queueTable - Table name (e.g., 'email_queue', 'webhook_retry_queue')
 * @param item - Item to enqueue
 * @param options - Configuration
 * @returns Queue item ID
 */
export async function enqueueWithDLQ(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  item: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<string> {
  const {
    maxAttempts = 5,
    initialDelayMs = 0,
    metadata = {},
  } = options;

  // Calculate initial retry time
  const nextRetryAt = initialDelayMs > 0
    ? new Date(Date.now() + initialDelayMs).toISOString()
    : new Date().toISOString();

  const { data, error } = await supabaseClient
    .from(queueTable)
    .insert({
      ...item,
      max_attempts: maxAttempts,
      status: 'pending',
      next_retry_at: nextRetryAt,
      attempts: 0,
      metadata: {
        ...metadata,
        enqueued_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to enqueue item: ${error.message}`);
  }

  return data.id;
}

/**
 * Mark queue item as processed
 */
export async function markQueueItemProcessed(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  itemId: string
): Promise<void> {
  const processedField = queueTable === 'email_queue' ? 'sent_at' : 'processed_at';
  
  const { error } = await supabaseClient
    .from(queueTable)
    .update({
      status: queueTable === 'email_queue' ? 'sent' : 'processed',
      [processedField]: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw new Error(`Failed to mark item as processed: ${error.message}`);
  }
}

/**
 * Mark queue item as failed and schedule retry
 */
export async function markQueueItemFailed(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  itemId: string,
  errorMessage: string
): Promise<void> {
  // Get current attempt count
  const { data: current, error: fetchError } = await supabaseClient
    .from(queueTable)
    .select('attempts, max_attempts')
    .eq('id', itemId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch item: ${fetchError.message}`);
  }

  const newAttempts = (current.attempts || 0) + 1;
  const maxAttempts = current.max_attempts || 5;

  // Calculate retry time based on queue type
  const retryFunction = queueTable === 'email_queue'
    ? 'calculate_email_retry_time'
    : 'calculate_webhook_retry_time';

  if (newAttempts >= maxAttempts) {
    // Move to dead letter
    const { error } = await supabaseClient
      .from(queueTable)
      .update({
        status: 'dead_letter',
        last_error: errorMessage,
        error_count: newAttempts,
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      throw new Error(`Failed to mark item as dead letter: ${error.message}`);
    }
  } else {
    // Schedule retry
    const { data: retryTime, error: retryError } = await supabaseClient
      .rpc(retryFunction, { attempt_number: newAttempts - 1 });

    if (retryError) {
      throw new Error(`Failed to calculate retry time: ${retryError.message}`);
    }

    const { error } = await supabaseClient
      .from(queueTable)
      .update({
        status: 'pending',
        attempts: newAttempts,
        error_count: newAttempts,
        last_error: errorMessage,
        next_retry_at: retryTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      throw new Error(`Failed to schedule retry: ${error.message}`);
    }
  }
}

