// Test Guest Access with Real Data
const SUPABASE_URL = 'https://yieslxnrfeqchbcmgavz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxcWNoYmNtZ2F2eiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM1NzQzMDQyLCJleHAiOjIwNTEzMTkwNDJ9.3QpzqjJzL5VvK8wX9rY2mN7sP4tA6bC1dE8fG3hI0jK5lM2nO9pQ7rS4tU1vW6xY3zA5bC8dE0fG2hI4jK6lM9nO1pQ3rS5tU7vW9xY';

console.log('🧪 Testing Guest Access with Real Data');
console.log('=====================================');
console.log('Using email: roderickmoodie@yahoo.com (has 2 tickets)');

async function testRealGuestAccess() {
  try {
    // Step 1: Test guest-tickets-start with real email
    console.log('\n1️⃣ Sending OTP to roderickmoodie@yahoo.com...');
    const startResponse = await fetch(`${SUPABASE_URL}/functions/v1/guest-tickets-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        method: 'email',
        contact: 'roderickmoodie@yahoo.com',
        event_id: null // Test with no specific event
      })
    });

    console.log(`   Status: ${startResponse.status}`);
    const startData = await startResponse.json();
    console.log(`   Response:`, JSON.stringify(startData, null, 2));

    if (startResponse.status === 200) {
      console.log('   ✅ OTP sent successfully!');
      console.log('   📧 Check roderickmoodie@yahoo.com for the 6-digit code');
      console.log('\n   To complete the test:');
      console.log('   1. Check the email for the OTP code');
      console.log('   2. Use the code in guest-tickets-verify');
      console.log('   3. Use the returned token to access tickets');
    } else {
      console.log('   ❌ Failed to send OTP');
      console.log('   Error:', startData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test with a different approach - check if functions are accessible
async function testFunctionConnectivity() {
  console.log('\n🔧 Testing Function Connectivity');
  console.log('================================');

  const functions = [
    'guest-tickets-start',
    'guest-tickets-verify', 
    'tickets-list-guest'
  ];

  for (const funcName of functions) {
    try {
      console.log(`\n📡 Testing ${funcName}...`);
      
      // Test with minimal payload to check CORS and basic connectivity
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({})
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`   ✅ ${funcName} is working`);
      } else if (response.status === 400) {
        console.log(`   ✅ ${funcName} is accessible (400 = missing params, expected)`);
      } else if (response.status === 404) {
        console.log(`   ❌ ${funcName} not found (not deployed)`);
      } else {
        console.log(`   ⚠️  ${funcName} returned ${response.status}`);
      }
      
    } catch (error) {
      console.error(`   ❌ ${funcName} connection error:`, error.message);
    }
  }
}

async function runTests() {
  await testFunctionConnectivity();
  await testRealGuestAccess();
}

runTests();
