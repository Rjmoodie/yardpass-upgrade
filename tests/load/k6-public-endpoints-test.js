/**
 * =====================================================
 * K6 Load Test: Public Endpoints Only
 * =====================================================
 * Purpose: Test public endpoints that work with anon key
 * 
 * Run:
 * SUPABASE_URL=https://xxx.supabase.co \
 * SUPABASE_ANON_KEY=xxx \
 * EVENT_ID=xxx \
 * k6 run tests/load/k6-public-endpoints-test.js
 * 
 * =====================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const endpointFailures = new Rate('endpoint_failures');
const endpointLatency = new Trend('endpoint_latency');
const http4xx = new Rate('http_4xx');
const http5xx = new Rate('http_5xx');

// Request tags
const eventsTags = { endpoint: 'events', op: 'list' };
const tiersTags = { endpoint: 'ticket_tiers', op: 'list' };

// Configuration
export const options = {
  scenarios: {
    events_read: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 15,
      exec: 'runEventsRead'
    },
    tiers_read: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 10,
      exec: 'runTiersRead'
    }
  },
  
  thresholds: {
    'http_req_duration{endpoint:events}': ['p(90)<1000'],
    'http_req_duration{endpoint:ticket_tiers}': ['p(90)<800'],
    'endpoint_failures': ['rate<0.1'],
    'http_5xx': ['rate<0.01'],
    'http_4xx': ['rate<0.1'],
    'http_req_failed': ['rate<0.15']
  },
  
  discardResponseBodies: true,
};

// Environment variables
const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';
const EVENT_ID = __ENV.EVENT_ID || 'your-event-id';

// Helper functions
function classifyResponse(res) {
  if (res.status >= 500) {
    http5xx.add(1);
  } else if (res.status >= 400) {
    http4xx.add(1);
  }
}

// Scenario execution functions
export function runEventsRead() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  // Test various event queries
  const queries = [
    // All events
    `select=id,title,start_at,venue,city,cover_image_url&order=start_at.desc&limit=20`,
    // Specific event
    `id=eq.${EVENT_ID}&select=id,title,start_at,venue,city,cover_image_url`,
    // Upcoming events
    `start_at=gte.${new Date().toISOString()}&select=id,title,start_at,venue,city&order=start_at.asc&limit=10`,
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/rest/v1/events?${query}`,
    { headers, tags: eventsTags }
  );
  const duration = Date.now() - start;
  
  classifyResponse(res);
  endpointLatency.add(duration);
  
  const success = check(res, {
    'events: status 200': (r) => r.status === 200,
    'events: has array response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    }
  });
  
  if (!success) {
    endpointFailures.add(1);
    console.error(`Events read failed: ${res.status}`);
  }
}

export function runTiersRead() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  // Test ticket tier queries
  const queries = [
    // Tiers for specific event
    `event_id=eq.${EVENT_ID}&select=id,name,price_cents,total_quantity,reserved_quantity`,
    // All active tiers
    `status=eq.active&select=id,name,price_cents,event_id&limit=50`,
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/rest/v1/ticket_tiers?${query}`,
    { headers, tags: tiersTags }
  );
  const duration = Date.now() - start;
  
  classifyResponse(res);
  
  const success = check(res, {
    'tiers: status 200': (r) => r.status === 200,
    'tiers: has array response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    }
  });
  
  if (!success) {
    endpointFailures.add(1);
    console.error(`Tiers read failed: ${res.status}`);
  }
}

// Default function
export default function () {
  runEventsRead();
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
  output += '          K6 PUBLIC ENDPOINTS LOAD TEST SUMMARY\n';
  output += '═══════════════════════════════════════════════\n\n';
  
  // HTTP metrics
  output += '📊 HTTP Performance:\n';
  output += `${indent}Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}4xx Errors: ${data.metrics.http_4xx?.values?.rate ? (data.metrics.http_4xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}5xx Errors: ${data.metrics.http_5xx?.values?.rate ? (data.metrics.http_5xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Duration p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p90: ${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Endpoint metrics
  output += '🎯 Endpoint Performance:\n';
  output += `${indent}Endpoint Failures: ${data.metrics.endpoint_failures?.values?.rate ? (data.metrics.endpoint_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Endpoint p50: ${data.metrics.endpoint_latency?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Endpoint p90: ${data.metrics.endpoint_latency?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Per-endpoint metrics
  output += '📋 Per-Endpoint Performance:\n';
  const endpoints = ['events', 'ticket_tiers'];
  endpoints.forEach(endpoint => {
    const duration = data.metrics.http_req_duration?.values?.[`p(90){endpoint:${endpoint}}`];
    const failed = data.metrics.http_req_failed?.values?.[`rate{endpoint:${endpoint}}`];
    if (duration !== undefined || failed !== undefined) {
      output += `${indent}${endpoint}: p90=${duration?.toFixed(2) || 'N/A'}ms, failed=${failed ? (failed * 100).toFixed(2) : 'N/A'}%\n`;
    }
  });
  output += '\n';
  
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


