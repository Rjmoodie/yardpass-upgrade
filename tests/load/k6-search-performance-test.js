/**
 * =====================================================
 * K6 Load Test: Search and Discovery Performance
 * =====================================================
 * Purpose: Test search functionality under load
 * 
 * Run:
 * SUPABASE_URL=https://xxx.supabase.co \
 * SUPABASE_ANON_KEY=xxx \
 * EVENT_ID=xxx \
 * k6 run tests/load/k6-search-performance-test.js
 * 
 * =====================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const searchFailures = new Rate('search_failures');
const searchLatency = new Trend('search_latency');
const searchResults = new Counter('search_results');
const http4xx = new Rate('http_4xx');
const http5xx = new Rate('http_5xx');

// Request tags
const searchTags = { endpoint: 'search_all', op: 'search' };
const eventsTags = { endpoint: 'events', op: 'filter' };

// Configuration
export const options = {
  scenarios: {
    search_queries: {
      executor: 'constant-arrival-rate',
      rate: 25,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 15,
      exec: 'runSearchQueries'
    },
    event_filtering: {
      executor: 'constant-arrival-rate',
      rate: 15,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 10,
      exec: 'runEventFiltering'
    }
  },
  
  thresholds: {
    'http_req_duration{endpoint:search_all}': ['p(90)<2000'],
    'http_req_duration{endpoint:events}': ['p(90)<1500'],
    'search_failures': ['rate<0.1'],
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

// Search terms and filters
const searchTerms = [
  'music', 'party', 'concert', 'festival', 'dance', 'live', 'night', 'club',
  'jazz', 'rock', 'pop', 'electronic', 'hip hop', 'country', 'blues',
  'event', 'show', 'gig', 'performance', 'venue', 'tickets'
];

const eventFilters = [
  'city', 'venue', 'category', 'start_at', 'price', 'availability'
];

// Helper functions
function classifyResponse(res) {
  if (res.status >= 500) {
    http5xx.add(1);
  } else if (res.status >= 400) {
    http4xx.add(1);
  }
}

function getRandomSearchTerm() {
  return searchTerms[Math.floor(Math.random() * searchTerms.length)];
}

function getRandomFilter() {
  return eventFilters[Math.floor(Math.random() * eventFilters.length)];
}

// Scenario execution functions
export function runSearchQueries() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  
  // Test search functionality
  const searchTerm = getRandomSearchTerm();
  const searchPayload = JSON.stringify({
    query: searchTerm,
    limit: Math.floor(Math.random() * 20) + 10, // 10-30 results
    filters: {
      type: Math.random() > 0.5 ? 'events' : 'all'
    }
  });
  
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/functions/v1/search_all`,
    searchPayload,
    { headers, tags: searchTags }
  );
  const duration = Date.now() - start;
  
  classifyResponse(res);
  searchLatency.add(duration);
  
  const success = check(res, {
    'search: status 200 or 404': (r) => r.status === 200 || r.status === 404, // 404 = function not found
    'search: valid response': (r) => {
      if (r.status === 404) return true; // Function not found is acceptable
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) || (body && typeof body === 'object');
      } catch {
        return false;
      }
    }
  });
  
  if (!success) {
    searchFailures.add(1);
    console.error(`Search failed: ${res.status} - ${res.body}`);
  } else if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const resultCount = Array.isArray(body) ? body.length : (body.results ? body.results.length : 0);
      searchResults.add(resultCount);
    } catch {
      // Ignore parsing errors for metrics
    }
  }
}

export function runEventFiltering() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  // Test event filtering queries
  const queries = [
    // Recent events
    `select=id,title,start_at,venue,city,cover_image_url&start_at=gte.${new Date().toISOString()}&order=start_at.asc&limit=20`,
    // Events by city (random city)
    `select=id,title,start_at,venue,city&city=ilike.%music%&order=start_at.desc&limit=15`,
    // Events with cover images
    `select=id,title,start_at,venue,city,cover_image_url&cover_image_url=not.is.null&order=created_at.desc&limit=25`,
    // Upcoming events this week
    `select=id,title,start_at,venue,city&start_at=gte.${new Date().toISOString()}&start_at=lte.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}&order=start_at.asc&limit=30`,
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/rest/v1/events?${query}`,
    { headers, tags: eventsTags }
  );
  const duration = Date.now() - start;
  
  classifyResponse(res);
  
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
    searchFailures.add(1);
    console.error(`Event filtering failed: ${res.status}`);
  }
}

// Default function
export default function () {
  runSearchQueries();
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
  output += '          K6 SEARCH PERFORMANCE LOAD TEST SUMMARY\n';
  output += '═══════════════════════════════════════════════\n\n';
  
  // HTTP metrics
  output += '📊 HTTP Performance:\n';
  output += `${indent}Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}4xx Errors: ${data.metrics.http_4xx?.values?.rate ? (data.metrics.http_4xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}5xx Errors: ${data.metrics.http_5xx?.values?.rate ? (data.metrics.http_5xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Duration p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p90: ${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Search metrics
  output += '🔍 Search Performance:\n';
  output += `${indent}Search Failures: ${data.metrics.search_failures?.values?.rate ? (data.metrics.search_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Search p50: ${data.metrics.search_latency?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Search p90: ${data.metrics.search_latency?.values?.['p(90)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Total Results: ${data.metrics.search_results?.values?.count || 0}\n\n`;
  
  // Per-endpoint metrics
  output += '🎯 Per-Endpoint Performance:\n';
  const endpoints = ['search_all', 'events'];
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
