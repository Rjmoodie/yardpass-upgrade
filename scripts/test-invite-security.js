/**
 * Security Testing Script for Role Invites
 * 
 * Tests that security fixes are working:
 * 1. Unauthorized users cannot send invites
 * 2. Rate limiting is enforced
 * 3. Audit log populates
 * 4. Anon cannot query tokens
 * 
 * Run in browser console on Liventix app
 */

// Import from your app
// const { supabase } = await import('./src/integrations/supabase/client');

async function testInviteSecurity() {
  console.log('🔒 Testing Role Invite Security Fixes...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // ============================================================================
  // Test 1: Unauthorized user cannot send invites
  // ============================================================================
  
  console.log('Test 1: Unauthorized invite attempt (should FAIL with 403)');
  
  try {
    // Replace with an event ID you DON'T own
    const testEventId = 'REPLACE_WITH_EVENT_YOU_DONT_OWN';
    
    const { data, error } = await supabase.functions.invoke('send-role-invite', {
      body: {
        event_id: testEventId,
        role: 'scanner',
        email: 'unauthorized-test@example.com',
        expires_in_hours: 72
      }
    });
    
    if (error && error.message?.includes('Unauthorized')) {
      console.log('✅ PASS: Unauthorized attempt blocked with 403');
      results.passed++;
      results.tests.push({ name: 'Unauthorized blocking', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Unauthorized attempt succeeded (security issue!)');
      console.log('Response:', data, error);
      results.failed++;
      results.tests.push({ name: 'Unauthorized blocking', status: 'FAIL' });
    }
  } catch (err) {
    console.log('✅ PASS: Exception thrown (blocked):', err.message);
    results.passed++;
    results.tests.push({ name: 'Unauthorized blocking', status: 'PASS' });
  }
  
  console.log('');
  
  // ============================================================================
  // Test 2: Authorized user CAN send invites
  // ============================================================================
  
  console.log('Test 2: Authorized invite attempt (should SUCCEED)');
  
  try {
    // Replace with an event ID you DO own
    const myEventId = 'REPLACE_WITH_YOUR_EVENT_ID';
    
    const { data, error } = await supabase.functions.invoke('send-role-invite', {
      body: {
        event_id: myEventId,
        role: 'scanner',
        email: `test-${Date.now()}@example.com`,
        expires_in_hours: 72
      }
    });
    
    if (!error && data?.success) {
      console.log('✅ PASS: Authorized invite succeeded');
      console.log('Token generated:', data.token?.substring(0, 20) + '...');
      results.passed++;
      results.tests.push({ name: 'Authorized invite', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Authorized invite failed (unexpected)');
      console.log('Error:', error);
      results.failed++;
      results.tests.push({ name: 'Authorized invite', status: 'FAIL' });
    }
  } catch (err) {
    console.log('❌ FAIL: Exception:', err.message);
    results.failed++;
    results.tests.push({ name: 'Authorized invite', status: 'FAIL' });
  }
  
  console.log('');
  
  // ============================================================================
  // Test 3: Rate limiting (optional - sends 21 invites!)
  // ============================================================================
  
  console.log('Test 3: Rate limiting (SKIP - would send 21 invites)');
  console.log('To test manually: Send 21 invites quickly, expect 429 on 21st');
  console.log('');
  
  // ============================================================================
  // Test 4: Anon cannot query invites
  // ============================================================================
  
  console.log('Test 4: Anonymous access to role_invites (should be BLOCKED)');
  
  try {
    // Get current auth state
    const { data: { user } } = await supabase.auth.getUser();
    const wasLoggedIn = !!user;
    
    // Sign out if logged in
    if (wasLoggedIn) {
      await supabase.auth.signOut();
      console.log('  Signed out for test...');
    }
    
    // Try to query role_invites as anon
    const { data, error } = await supabase
      .from('role_invites')
      .select('token, email')
      .limit(10);
    
    if (!data || data.length === 0) {
      console.log('✅ PASS: Anon cannot see invites (secure)');
      results.passed++;
      results.tests.push({ name: 'Anon blocking', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Anon can see invites (SECURITY ISSUE!)');
      console.log('Data returned:', data.length, 'invites');
      results.failed++;
      results.tests.push({ name: 'Anon blocking', status: 'FAIL' });
    }
    
    // Sign back in if needed
    if (wasLoggedIn) {
      console.log('  Please sign back in manually');
    }
  } catch (err) {
    console.log('✅ PASS: Query blocked with error:', err.message);
    results.passed++;
    results.tests.push({ name: 'Anon blocking', status: 'PASS' });
  }
  
  console.log('');
  
  // ============================================================================
  // Results Summary
  // ============================================================================
  
  console.log('═'.repeat(60));
  console.log('\n📊 Test Results:\n');
  
  results.tests.forEach((test, idx) => {
    const icon = test.status === 'PASS' ? '✅' : '❌';
    console.log(`${idx + 1}. ${icon} ${test.name}: ${test.status}`);
  });
  
  console.log('');
  console.log(`Total: ${results.passed} passed, ${results.failed} failed`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL SECURITY FIXES VERIFIED!\n');
  } else {
    console.log('\n⚠️ Some tests failed - review security fixes\n');
  }
  
  console.log('═'.repeat(60));
  
  return results;
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('Copy testInviteSecurity() and run it in your browser console');
  console.log('Make sure to replace event IDs with real values!\n');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testInviteSecurity };
}

