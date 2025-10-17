/**
 * =====================================================
 * K6 Load Test: Guest Ticket Purchase Flow
 * =====================================================
 * Purpose: Test guest checkout under load (no auth required)
 * 
 * Run:
 * SUPABASE_URL=https://xxx.supabase.co \
 * EVENT_ID=xxx \
 * TIER_ID=xxx \
 * k6 run tests/load/k6-guest-test.js
 * 
 * =====================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const guestFailures = new Rate('guest_failures');
const guestLatency = new Trend('guest_latency');

// Configuration
export const options = {
  // Shorter test for debugging
  stages: [
    { duration: '5s', target: 5 },   // Ramp to 5 users
    { duration: '15s', target: 20 }, // Spike to 20 users
    { duration: '10s', target: 0 },  // Ramp down
  ],
  
  // More lenient thresholds for debugging
  thresholds: {
    'http_req_duration': ['p(90)<1000'],  // 90% < 1s
    'guest_failures': ['rate<0.2'],  // Less than 20% failure rate
    'http_req_failed': ['rate<0.3'],  // Less than 30% HTTP errors
  },
};

// Environment variables
const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const EVENT_ID = __ENV.EVENT_ID || 'your-event-id';
const TIER_ID = __ENV.TIER_ID || 'your-tier-id';

// Generate unique session ID per iteration
function generateSessionId() {
  return `k6-guest-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function () {
  const sessionId = generateSessionId();
  
  group('Guest Checkout Flow', function () {
    // =====================================================
    // Step 1: Guest Checkout (No Authentication Required)
    // =====================================================
    
    const guestPayload = JSON.stringify({
      event_id: EVENT_ID,
      contact_email: `test-${sessionId}@example.com`,
      items: [
        {
          tier_id: TIER_ID,
          quantity: 1,
          unit_price_cents: 10000 // $100.00 in cents
        }
      ]
    });
    
    const guestStart = Date.now();
    const guestRes = http.post(
      `${BASE_URL}/functions/v1/guest-checkout`,
      guestPayload,
      { 
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `guest-${sessionId}`
        }
      }
    );
    const guestDuration = Date.now() - guestStart;
    guestLatency.add(guestDuration);
    
    const guestSuccess = check(guestRes, {
      'guest: status 200 or 409': (r) => r.status === 200 || r.status === 409,
      'guest: has response body': (r) => r.body && r.body.length > 0,
    });
    
    if (!guestSuccess) {
      guestFailures.add(1);
      console.error(`Guest checkout failed: ${guestRes.status} - ${guestRes.body}`);
      return;
    }
    
    // Parse response
    try {
      const body = JSON.parse(guestRes.body);
      
      if (guestRes.status === 409) {
        // Expected when sold out
        console.log('Guest checkout: Sold out (expected)');
        return;
      }
      
      if (guestRes.status === 200 && body.session_url) {
        console.log('Guest checkout: Success');
      }
      
    } catch (e) {
      guestFailures.add(1);
      console.error('Failed to parse guest response');
    }
  });
  
  // Small delay between iterations
  sleep(0.5);
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  
  let output = '\n';
  output += '═══════════════════════════════════════════════\n';
  output += '          K6 GUEST LOAD TEST SUMMARY\n';
  output += '═══════════════════════════════════════════════\n\n';
  
  // HTTP metrics
  output += '📊 HTTP Performance:\n';
  output += `${indent}Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Duration p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p90: ${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Guest metrics
  output += '🎫 Guest Checkout Metrics:\n';
  output += `${indent}Guest Failures: ${data.metrics.guest_failures?.values?.rate ? (data.metrics.guest_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Guest p50: ${data.metrics.guest_latency?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Guest p90: ${data.metrics.guest_latency?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  output += '═══════════════════════════════════════════════\n';
  
  return output;
}
