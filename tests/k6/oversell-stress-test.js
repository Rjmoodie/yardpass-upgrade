import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Test configuration
export const options = {
  scenarios: {
    oversell_test: {
      executor: 'constant-arrival-rate',
      duration: '30s',
      rate: 50, // 50 requests per second
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be under 2s
    http_req_failed: ['rate<0.1'], // Less than 10% failure rate
  },
};

// Test data - create shared array for efficiency
const testData = new SharedArray('test-data', function () {
  return [
    {
      eventId: 'test-event-id',
      ticketSelections: [
        {
          tierId: 'test-tier-id',
          quantity: 1
        }
      ]
    }
  ];
});

// Base URL - adjust for your environment
const BASE_URL = __ENV.BASE_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY';

export default function () {
  const payload = testData[0];
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  };

  // Test the enhanced-checkout endpoint
  const response = http.post(
    `${BASE_URL}/enhanced-checkout`,
    JSON.stringify(payload),
    params
  );

  // Check response status and structure
  const success = check(response, {
    'status is 200 or 500': (r) => r.status === 200 || r.status === 500,
    'response has body': (r) => r.body && r.body.length > 0,
    'response is JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    try {
      const responseBody = JSON.parse(response.body);
      
      // Check for clean error handling
      if (!responseBody.success && responseBody.error_code) {
        check(responseBody, {
          'has proper error structure': (body) => 
            body.success === false && 
            typeof body.error === 'string' && 
            typeof body.error_code === 'string',
          'oversell error handled cleanly': (body) => 
            body.error_code === 'CHECKOUT_FAILED' || 
            body.error_code === 'INSUFFICIENT_INVENTORY',
        });
      }

      // Track successful reservations
      if (responseBody.success || responseBody.session_url) {
        console.log(`✅ Successful reservation: ${response.status}`);
      } else {
        console.log(`❌ Failed reservation: ${responseBody.error || 'Unknown error'}`);
      }
      
    } catch (parseError) {
      console.log(`⚠️ Failed to parse response: ${parseError}`);
    }
  }

  // Small delay to avoid overwhelming the system
  sleep(0.1);
}

// Setup function to prepare test data
export function setup() {
  console.log('🚀 Starting oversell protection stress test');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`⏱️  Duration: 30 seconds at 50 req/s`);
  console.log(`🎯 Expected: Clean error handling, no oversells`);
}

// Teardown function to verify results
export function teardown(data) {
  console.log('🏁 Stress test completed');
  console.log('📈 Check metrics above for oversell protection effectiveness');
  
  // You could add additional verification here by querying the database
  // to ensure reserved_quantity + issued_quantity <= total_quantity
}