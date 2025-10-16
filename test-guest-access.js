// Test Guest Access Flow
const SUPABASE_URL = 'https://yieslxnrfeqchbcmgavz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxcWNoYmNtZ2F2eiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM1NzQzMDQyLCJleHAiOjIwNTEzMTkwNDJ9.3QpzqjJzL5VvK8wX9rY2mN7sP4tA6bC1dE8fG3hI0jK5lM2nO9pQ7rS4tU1vW6xY3zA5bC8dE0fG2hI4jK6lM9nO1pQ3rS5tU7vW9xY';

console.log('🧪 Testing Guest Access Flow');
console.log('============================');

async function testGuestAccessFlow() {
  try {
    // Step 1: Test guest-tickets-start (send OTP)
    console.log('\n1️⃣ Testing guest-tickets-start...');
    const startResponse = await fetch(`${SUPABASE_URL}/functions/v1/guest-tickets-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        method: 'email',
        contact: 'test@example.com',
        event_id: null // Test with no specific event
      })
    });

    console.log(`   Status: ${startResponse.status}`);
    const startData = await startResponse.json();
    console.log(`   Response:`, JSON.stringify(startData, null, 2));

    if (startResponse.status !== 200) {
      console.log('   ❌ guest-tickets-start failed');
      return;
    }

    console.log('   ✅ guest-tickets-start successful');

    // Step 2: Test guest-tickets-verify (verify OTP)
    console.log('\n2️⃣ Testing guest-tickets-verify...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/functions/v1/guest-tickets-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        method: 'email',
        contact: 'test@example.com',
        otp: '123456', // This will fail, but we can see the error
        event_id: null
      })
    });

    console.log(`   Status: ${verifyResponse.status}`);
    const verifyData = await verifyResponse.json();
    console.log(`   Response:`, JSON.stringify(verifyData, null, 2));

    // Step 3: Test tickets-list-guest (this will fail without valid token)
    console.log('\n3️⃣ Testing tickets-list-guest (will fail without valid token)...');
    const listResponse = await fetch(`${SUPABASE_URL}/functions/v1/tickets-list-guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        token: 'invalid-token'
      })
    });

    console.log(`   Status: ${listResponse.status}`);
    const listData = await listResponse.json();
    console.log(`   Response:`, JSON.stringify(listData, null, 2));

    console.log('\n🎯 Guest Access Analysis:');
    console.log('=========================');
    console.log('✅ guest-tickets-start: Function is accessible');
    console.log('⚠️  guest-tickets-verify: Requires valid OTP (expected to fail)');
    console.log('⚠️  tickets-list-guest: Requires valid session token (expected to fail)');
    console.log('\n💡 To test fully, you need to:');
    console.log('1. Use a real email/phone that has tickets');
    console.log('2. Complete the OTP verification flow');
    console.log('3. Use the returned token to access tickets');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test individual functions
async function testFunctionAccess() {
  console.log('\n🔧 Testing Individual Function Access');
  console.log('=====================================');

  const functions = [
    'guest-tickets-start',
    'guest-tickets-verify', 
    'tickets-list-guest',
    'guest-checkout'
  ];

  for (const funcName of functions) {
    try {
      console.log(`\n📡 Testing ${funcName}...`);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}) // Empty body to test CORS and basic access
      });

      console.log(`   Status: ${response.status}`);
      const data = await response.json();
      console.log(`   Response:`, JSON.stringify(data, null, 2));

      if (response.status === 200 || response.status === 400) {
        console.log(`   ✅ ${funcName} is accessible`);
      } else if (response.status === 404) {
        console.log(`   ❌ ${funcName} not found (not deployed)`);
      } else {
        console.log(`   ⚠️  ${funcName} returned ${response.status}`);
      }
    } catch (error) {
      console.error(`   ❌ ${funcName} error:`, error.message);
    }
  }
}

async function runTests() {
  await testFunctionAccess();
  await testGuestAccessFlow();
}

runTests();
