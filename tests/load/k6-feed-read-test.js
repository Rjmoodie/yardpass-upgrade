/**
 * =====================================================
 * K6 Load Test: Feed Retrieval (Anon Key Compatible)
 * =====================================================
 * Purpose: Test feed retrieval performance under load
 * 
 * Run:
 * SUPABASE_URL=https://xxx.supabase.co \
 * SUPABASE_ANON_KEY=xxx \
 * EVENT_ID=xxx \
 * k6 run tests/load/k6-feed-read-test.js
 * 
 * =====================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const feedFailures = new Rate('feed_failures');
const feedLatency = new Trend('feed_latency');
const http4xx = new Rate('http_4xx');
const http5xx = new Rate('http_5xx');

// Request tags for per-endpoint metrics
const feedTags = { endpoint: 'event_posts', op: 'feed' };
const searchTags = { endpoint: 'search', op: 'search' };

// Configuration
export const options = {
  scenarios: {
    feed_reads: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 20,
      exec: 'runFeedReads'
    },
    search_reads: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 10,
      exec: 'runSearchReads'
    }
  },
  
  // Per-endpoint thresholds
  thresholds: {
    'http_req_duration{endpoint:event_posts}': ['p(90)<500'],
    'http_req_duration{endpoint:search}': ['p(90)<800'],
    'feed_failures': ['rate<0.05'],
    'http_5xx': ['rate<0.01'],
    'http_4xx': ['rate<0.05'],
    'http_req_failed': ['rate<0.1']
  },
  
  // Performance optimizations
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
export function runFeedReads() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  // Test various feed queries
  const queries = [
    // Recent posts for specific event
    `event_id=eq.${EVENT_ID}&select=id,created_at,text,media_urls&order=created_at.desc&limit=20`,
    // All recent posts
    `select=id,created_at,text,media_urls,event_id&order=created_at.desc&limit=50`,
    // Posts with media
    `media_urls=not.is.null&select=id,created_at,text,media_urls&order=created_at.desc&limit=20`,
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/rest/v1/event_posts?${query}`,
    { headers, tags: feedTags }
  );
  const duration = Date.now() - start;
  
  classifyResponse(res);
  feedLatency.add(duration);
  
  const success = check(res, {
    'feed: status 200': (r) => r.status === 200,
    'feed: has array response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    }
  });
  
  if (!success) {
    feedFailures.add(1);
    console.error(`Feed read failed: ${res.status}`);
  }
}

export function runSearchReads() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  // Test search functionality (if available)
  const searchTerms = ['test', 'event', 'music', 'party', 'fun'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/functions/v1/search_all`,
    JSON.stringify({
      query: term,
      limit: 20
    }),
    { 
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      tags: searchTags
    }
  );
  const duration = Date.now() - start;
  
  classifyResponse(res);
  
  check(res, {
    'search: status 200 or 404': (r) => r.status === 200 || r.status === 404, // 404 = function not found
  });
}

// Default function
export default function () {
  runFeedReads();
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
  output += '          K6 FEED READ LOAD TEST SUMMARY\n';
  output += '═══════════════════════════════════════════════\n\n';
  
  // HTTP metrics
  output += '📊 HTTP Performance:\n';
  output += `${indent}Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}4xx Errors: ${data.metrics.http_4xx?.values?.rate ? (data.metrics.http_4xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}5xx Errors: ${data.metrics.http_5xx?.values?.rate ? (data.metrics.http_5xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Duration p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p90: ${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Feed metrics
  output += '📱 Feed Read Metrics:\n';
  output += `${indent}Feed Failures: ${data.metrics.feed_failures?.values?.rate ? (data.metrics.feed_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Feed p50: ${data.metrics.feed_latency?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Feed p90: ${data.metrics.feed_latency?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Per-endpoint metrics
  output += '🎯 Per-Endpoint Performance:\n';
  const endpoints = ['event_posts', 'search'];
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


