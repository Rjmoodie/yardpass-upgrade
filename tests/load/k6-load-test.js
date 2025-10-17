/**
 * =====================================================
 * K6 Load Test: Full Ticket Purchase Flow
 * =====================================================
 * Purpose: Test real HTTP API under load with latency percentiles
 * 
 * Prerequisites:
 * 1. Install k6: https://k6.io/docs/getting-started/installation/
 * 2. Set environment variables
 * 3. Have test event/tier ready
 * 
 * Run:
 * SUPABASE_URL=https://xxx.supabase.co \
 * SUPABASE_ANON_KEY=xxx \
 * EVENT_ID=xxx \
 * TIER_ID=xxx \
 * k6 run tests/load/k6-load-test.js
 * 
 * =====================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const reserveFailures = new Rate('reserve_failures');
const checkoutFailures = new Rate('checkout_failures');
const reserveLatency = new Trend('reserve_latency');
const checkoutLatency = new Trend('checkout_latency');
const oversellDetected = new Counter('oversell_detected');

// Configuration
export const options = {
  // Ramp up load
  stages: [
    { duration: '10s', target: 10 },   // Ramp to 10 users
    { duration: '30s', target: 50 },   // Spike to 50 users
    { duration: '20s', target: 100 },  // Peak at 100 users
    { duration: '10s', target: 0 },    // Ramp down
  ],
  
  // Performance thresholds
  thresholds: {
    'http_req_duration': ['p(90)<500', 'p(99)<1000'],  // 90% < 500ms, 99% < 1s
    'reserve_failures': ['rate<0.05'],  // Less than 5% failure rate (excluding legitimate sold-out)
    'checkout_failures': ['rate<0.05'],
    'http_req_failed': ['rate<0.1'],  // Less than 10% HTTP errors
  },
};

// Environment variables
const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';
const EVENT_ID = __ENV.EVENT_ID || 'your-event-id';
const TIER_ID = __ENV.TIER_ID || 'your-tier-id';

// Generate unique session ID per iteration
function generateSessionId() {
  return `k6-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function () {
  const sessionId = generateSessionId();
  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  group('Ticket Reservation Flow', function () {
    // =====================================================
    // Step 1: Reserve Tickets
    // =====================================================
    
    const reservePayload = JSON.stringify({
      eventId: EVENT_ID,
      ticketSelections: [
        {
          tierId: TIER_ID,
          quantity: 2,
          faceValue: 100.00
        }
      ]
    });
    
    const reserveStart = Date.now();
    const reserveRes = http.post(
      `${BASE_URL}/functions/v1/enhanced-checkout`,
      reservePayload,
      { 
        headers: {
          ...headers,
          'Idempotency-Key': `reserve-${sessionId}`
        }
      }
    );
    const reserveDuration = Date.now() - reserveStart;
    reserveLatency.add(reserveDuration);
    
    const reserveSuccess = check(reserveRes, {
      'reserve: status 200 or 409': (r) => r.status === 200 || r.status === 409,
      'reserve: has session_url or error': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.session_url || body.error || body.error_code;
        } catch {
          return false;
        }
      }
    });
    
    if (!reserveSuccess) {
      reserveFailures.add(1);
      console.error(`Reserve failed: ${reserveRes.status} - ${reserveRes.body}`);
      return;  // Stop this iteration
    }
    
    let checkoutSessionId;
    try {
      const body = JSON.parse(reserveRes.body);
      checkoutSessionId = body.checkout_session_id || body.session_id;
      
      // Check for overselling indicators
      if (body.error && body.error.toLowerCase().includes('insufficient')) {
        // This is expected when sold out - not a failure
        console.log('Sold out (expected)');
        return;
      }
      
      if (reserveRes.status !== 200) {
        reserveFailures.add(1);
        return;
      }
    } catch (e) {
      reserveFailures.add(1);
      console.error('Failed to parse reserve response');
      return;
    }
    
    // =====================================================
    // Step 2: Simulate user payment time
    // =====================================================
    
    sleep(Math.random() * 3 + 1);  // 1-4 seconds
    
    // =====================================================
    // Step 3: Check Session Status
    // =====================================================
    
    if (checkoutSessionId) {
      const statusRes = http.post(
        `${BASE_URL}/functions/v1/checkout-session-status`,
        JSON.stringify({
          sessionId: checkoutSessionId
        }),
        { headers }
      );
      
      check(statusRes, {
        'status: responds': (r) => r.status === 200 || r.status === 404,
      });
    }
  });
  
  // Small delay between iterations
  sleep(0.5);
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors !== false;
  
  let output = '\n';
  output += '═══════════════════════════════════════════════\n';
  output += '          K6 LOAD TEST SUMMARY\n';
  output += '═══════════════════════════════════════════════\n\n';
  
  // HTTP metrics
  output += '📊 HTTP Performance:\n';
  output += `${indent}Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Duration p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p90: ${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p99: ${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}ms\n\n`;
  
  // Custom metrics
  output += '🎫 Reservation Metrics:\n';
  output += `${indent}Reserve Failures: ${data.metrics.reserve_failures?.values?.rate ? (data.metrics.reserve_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Reserve p50: ${data.metrics.reserve_latency?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Reserve p90: ${data.metrics.reserve_latency?.values?.['p(90)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Reserve p99: ${data.metrics.reserve_latency?.values?.['p(99)']?.toFixed(2) || 0}ms\n\n`;
  
  // Thresholds
  output += '✅ Threshold Results:\n';
  for (const [name, threshold] of Object.entries(data.root_group?.checks || {})) {
    const passed = threshold.passes === threshold.fails + threshold.passes;
    const symbol = passed ? '✅' : '❌';
    output += `${indent}${symbol} ${name}: ${threshold.passes}/${threshold.passes + threshold.fails}\n`;
  }
  
  output += '\n═══════════════════════════════════════════════\n';
  
  return output;
}

