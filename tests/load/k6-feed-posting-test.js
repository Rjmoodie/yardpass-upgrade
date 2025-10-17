/**
 * =====================================================
 * K6 Load Test: Unified Feed Posting System (Production-Grade)
 * =====================================================
 * Purpose: Test feed posting under load with various content types
 * 
 * Run:
 * SUPABASE_URL=https://xxx.supabase.co \
 * SUPABASE_ANON_KEY=xxx \
 * EVENT_ID=xxx \
 * k6 run tests/load/k6-feed-posting-test.js
 * 
 * =====================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const postFailures = new Rate('post_failures');
const mediaProcessingFailures = new Rate('media_processing_failures');
const postLatency = new Trend('post_latency');
const feedRetrievalLatency = new Trend('feed_retrieval_latency');
const postsCreated = new Counter('posts_created');
const readAfterWriteMs = new Trend('read_after_write_ms');
const http4xx = new Rate('http_4xx');
const http5xx = new Rate('http_5xx');

// Request tags for per-endpoint metrics
const createTags = { endpoint: 'posts-create', op: 'create' };
const feedTags = { endpoint: 'event_posts', op: 'feed' };
const mediaTags = { endpoint: 'media-check', op: 'media' };
const likeTags = { endpoint: 'event_reactions', op: 'like' };

// Configuration
export const options = {
  // Use scenarios to mix content types with realistic traffic patterns
  scenarios: {
    text_posts: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '30s', target: 15 },
        { duration: '20s', target: 20 },
        { duration: '10s', target: 0 }
      ],
      exec: 'runText'
    },
    image_posts: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 3 },
        { duration: '30s', target: 8 },
        { duration: '20s', target: 10 },
        { duration: '10s', target: 0 }
      ],
      exec: 'runImage'
    },
    video_posts: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 2 },
        { duration: '30s', target: 5 },
        { duration: '20s', target: 7 },
        { duration: '10s', target: 0 }
      ],
      exec: 'runVideo'
    },
    feed_reads: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m10s',
      preAllocatedVUs: 10,
      exec: 'runFeedReads'
    }
  },
  
  // Per-endpoint and global thresholds
  thresholds: {
    // Per-endpoint thresholds
    'http_req_failed{endpoint:posts-create}': ['rate<0.05'],
    'http_req_duration{endpoint:posts-create}': ['p(90)<1500', 'p(99)<3500'],
    'http_req_duration{endpoint:event_posts}': ['p(90)<400'],
    'http_req_duration{endpoint:media-check}': ['p(90)<200'],
    
    // Custom metrics
    'post_failures': ['rate<0.05'],
    'post_latency': ['p(90)<1200'],
    'read_after_write_ms': ['p(90)<2000'],
    'http_5xx': ['rate<0.01'],
    'http_4xx': ['rate<0.03'],
    
    // Global fallbacks
    'http_req_duration': ['p(90)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.15']
  },
  
  // Performance optimizations
  discardResponseBodies: true, // For high-rate feed reads
};

// Environment variables
const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';
const EVENT_ID = __ENV.EVENT_ID || 'your-event-id';

// Setup and teardown
export function setup() {
  return { runId: `k6-${Date.now()}` };
}

export function teardown(data) {
  // Cleanup test posts (optional)
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  http.del(`${BASE_URL}/rest/v1/event_posts?event_id=eq.${EVENT_ID}&text=like.Load test post%`, { 
    headers,
    tags: { endpoint: 'cleanup', op: 'delete' }
  });
}

// Helper functions
function classifyResponse(res) {
  if (res.status >= 500) {
    http5xx.add(1);
  } else if (res.status >= 400) {
    http4xx.add(1);
  }
}

function waitUntilInFeed(postId, maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = http.get(`${BASE_URL}/rest/v1/event_posts?id=eq.${postId}&select=id`, { 
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      tags: mediaTags
    });
    
    classifyResponse(r);
    
    try {
      const arr = JSON.parse(r.body);
      if (Array.isArray(arr) && arr.length > 0) {
        readAfterWriteMs.add(Date.now() - start);
        return true;
      }
    } catch {}
    sleep(0.2);
  }
  return false;
}

function waitMediaProcessed(id, maxWaitMs = 15000) {
  let delay = 0.25;
  const start = Date.now();
  
  while (Date.now() - start < maxWaitMs) {
    const r = http.get(`${BASE_URL}/rest/v1/event_posts?id=eq.${id}&select=media_state,media_urls`, { 
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      tags: mediaTags
    });
    
    classifyResponse(r);
    const ok = check(r, { 'media: 200': (x) => x.status === 200 });
    if (!ok) return false;

    try {
      const [row] = JSON.parse(r.body);
      if (row && (row.media_state === 'processed' || row.media_state === 'none' || !row.media_state)) {
        return true;
      }
    } catch {}

    sleep(delay);
    delay = Math.min(delay * 2, 2); // cap backoff
  }
  
  mediaProcessingFailures.add(1);
  return false;
}

// Generate unique content per type
function generatePostContent(type) {
  const sessionId = `k6-${__VU}-${__ITER}-${Date.now()}`;
  
  const baseContent = {
    text: `Load test ${type} post ${sessionId} - Testing feed performance under load`,
    media_urls: [],
    event_id: EVENT_ID,
    source: 'k6' // For cleanup
  };
  
  switch (type) {
    case 'text':
      return baseContent;
      
    case 'image':
      return {
        ...baseContent,
        text: `📸 Image post ${sessionId} - Testing image upload performance`,
        media_urls: ['https://images.unsplash.com/photo-1501281668745-f7f57925c3b4']
      };
      
    case 'video':
      return {
        ...baseContent,
        text: `🎥 Video post ${sessionId} - Testing video processing performance`,
        media_urls: ['https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4']
      };
      
    default:
      return baseContent;
  }
}

// Scenario execution functions
export function runText() { flow('text'); }
export function runImage() { flow('image'); }
export function runVideo() { flow('video'); }
export function runFeedReads() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };
  
  http.get(
    `${BASE_URL}/rest/v1/event_posts?event_id=eq.${EVENT_ID}&select=id,created_at&order=created_at.desc&limit=20`,
    { headers, tags: feedTags }
  );
}

// Main flow function
function flow(type) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  group('Feed Posting Flow', function () {
    // =====================================================
    // Step 1: Create Post
    // =====================================================
    
    const postContent = generatePostContent(type);
    const postPayload = JSON.stringify(postContent);
    
    const postStart = Date.now();
    const postRes = http.post(
      `${BASE_URL}/functions/v1/posts-create`,
      postPayload,
      { 
        headers: {
          ...headers,
          'Idempotency-Key': `post-${type}-${__VU}-${__ITER}-${Date.now()}`
        },
        tags: createTags
      }
    );
    const postDuration = Date.now() - postStart;
    postLatency.add(postDuration);
    classifyResponse(postRes);
    
    const postSuccess = check(postRes, {
      'post: 200/201': (r) => r.status === 200 || r.status === 201,
      'post: json ok': (r) => { try { JSON.parse(r.body); return true; } catch { return false; } },
      'post: has id & created_at': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.id || b.post_id) && !!(b.created_at || b.inserted_at);
        } catch { return false; }
      }
    });
    
    if (!postSuccess) {
      postFailures.add(1);
      console.error(`Post creation failed: ${postRes.status} - ${postRes.body}`);
      return;
    }
    
    let postId;
    try {
      const body = JSON.parse(postRes.body);
      postId = body.id || body.post_id;
      
      if (postId) {
        postsCreated.add(1);
        console.log(`Post created: ${postId}`);
      }
    } catch (e) {
      postFailures.add(1);
      console.error('Failed to parse post response');
      return;
    }
    
    // =====================================================
    // Step 2: Test Read-After-Write Consistency
    // =====================================================
    
    const appeared = waitUntilInFeed(postId, 5000);
    check(null, { 'post visible in feed ≤5s': () => appeared });
    
    // =====================================================
    // Step 3: Wait for Media Processing (if applicable)
    // =====================================================
    
    if (postContent.media_urls && postContent.media_urls.length > 0) {
      const processed = waitMediaProcessed(postId, 15000);
      check(null, { 'media processed ≤15s': () => processed });
    }
    
    // =====================================================
    // Step 4: Simulate User Interaction
    // =====================================================
    
    // Simulate realistic user behavior
    sleep(Math.random() * 3 + 1);  // 1-4 seconds between posts
    
    // Occasionally like a post (simulate engagement)
    if (Math.random() < 0.3 && postId) {  // 30% chance
      const likeRes = http.post(
        `${BASE_URL}/rest/v1/event_reactions`,
        JSON.stringify({
          post_id: postId,
          kind: 'like'
        }),
        { 
          headers,
          tags: likeTags
        }
      );
      
      classifyResponse(likeRes);
      check(likeRes, {
        'like: status 201 or 409': (r) => r.status === 201 || r.status === 409, // 409 = already liked
      });
    }
  });
  
  // Small delay between iterations
  sleep(0.5);
}

// Default function for backward compatibility
export default function () {
  flow('text');
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
  output += '          K6 FEED POSTING LOAD TEST SUMMARY\n';
  output += '═══════════════════════════════════════════════\n\n';
  
  // HTTP metrics
  output += '📊 HTTP Performance:\n';
  output += `${indent}Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}4xx Errors: ${data.metrics.http_4xx?.values?.rate ? (data.metrics.http_4xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}5xx Errors: ${data.metrics.http_5xx?.values?.rate ? (data.metrics.http_5xx.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Duration p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Duration p90: ${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Post metrics
  output += '📝 Feed Posting Metrics:\n';
  output += `${indent}Posts Created: ${data.metrics.posts_created?.values?.count || 0}\n`;
  output += `${indent}Post Failures: ${data.metrics.post_failures?.values?.rate ? (data.metrics.post_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Media Processing Failures: ${data.metrics.media_processing_failures?.values?.rate ? (data.metrics.media_processing_failures.values.rate * 100).toFixed(2) : 0}%\n`;
  output += `${indent}Post p50: ${data.metrics.post_latency?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Post p90: ${data.metrics.post_latency?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Consistency metrics
  output += '🔄 Consistency Metrics:\n';
  output += `${indent}Read-After-Write p50: ${data.metrics.read_after_write_ms?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  output += `${indent}Read-After-Write p90: ${data.metrics.read_after_write_ms?.values?.['p(90)']?.toFixed(2) || 0}ms\n\n`;
  
  // Per-endpoint metrics
  output += '🎯 Per-Endpoint Performance:\n';
  const endpoints = ['posts-create', 'event_posts', 'media-check'];
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
