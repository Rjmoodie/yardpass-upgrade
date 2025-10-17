/**
 * =====================================================
 * YardPass Frontend Load Test: Ticketing System
 * =====================================================
 * Purpose: Test concurrent ticket purchases from frontend
 * 
 * Prerequisites:
 * 1. npm install @supabase/supabase-js
 * 2. Create .env file with SUPABASE_URL and SUPABASE_ANON_KEY
 * 3. Have test event and tier IDs ready
 * 
 * Run with: node tests/load/frontend-ticketing-test.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY',
  
  // Test parameters (update these with your test data)
  testEventId: 'YOUR_TEST_EVENT_ID',
  testTierId: 'YOUR_TEST_TIER_ID',
  
  // Load test settings
  concurrentUsers: 20,  // Number of simultaneous purchase attempts
  ticketsPerUser: 2,    // Tickets each user tries to buy
  totalAvailable: 50,   // Total tickets available in tier
};

// Create Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// =====================================================
// Helper Functions
// =====================================================

async function createTestUser(userNumber) {
  const email = `loadtest-user-${userNumber}-${Date.now()}@test.com`;
  const password = 'LoadTest123!';
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: `Load Test User ${userNumber}`,
      }
    }
  });
  
  if (error) {
    console.error(`❌ Failed to create user ${userNumber}:`, error.message);
    return null;
  }
  
  return { email, password, session: data.session };
}

async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('❌ Login failed:', error.message);
    return null;
  }
  
  return data.session;
}

async function attemptTicketPurchase(userNumber, session, eventId, tierId, quantity) {
  const startTime = Date.now();
  
  try {
    // Create authenticated client for this user
    const userSupabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    });
    
    console.log(`👤 User ${userNumber}: Initiating checkout for ${quantity} tickets...`);
    
    // Call enhanced-checkout function
    const { data, error } = await userSupabase.functions.invoke('enhanced-checkout', {
      body: {
        eventId: eventId,
        ticketSelections: [
          {
            tierId: tierId,
            quantity: quantity,
            faceValue: 50.00, // $50.00
          }
        ]
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error(`❌ User ${userNumber}: Checkout failed (${duration}ms)`, error.message);
      return {
        success: false,
        userNumber,
        duration,
        error: error.message,
      };
    }
    
    if (!data?.session_url) {
      console.error(`❌ User ${userNumber}: No checkout URL returned (${duration}ms)`);
      return {
        success: false,
        userNumber,
        duration,
        error: 'No checkout URL',
      };
    }
    
    console.log(`✅ User ${userNumber}: Checkout successful! (${duration}ms)`);
    console.log(`   Session ID: ${data.session_id}`);
    console.log(`   Checkout URL: ${data.session_url.substring(0, 50)}...`);
    
    return {
      success: true,
      userNumber,
      duration,
      sessionId: data.session_id,
      checkoutUrl: data.session_url,
    };
    
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ User ${userNumber}: Unexpected error (${duration}ms)`, err.message);
    return {
      success: false,
      userNumber,
      duration,
      error: err.message,
    };
  }
}

async function checkInventory(tierId) {
  const { data, error } = await supabase
    .from('ticket_tiers')
    .select('quantity, sold_quantity, reserved_quantity, total_quantity')
    .eq('id', tierId)
    .single();
  
  if (error) {
    console.error('❌ Failed to check inventory:', error.message);
    return null;
  }
  
  return {
    total: data.total_quantity,
    sold: data.sold_quantity || 0,
    reserved: data.reserved_quantity || 0,
    available: data.quantity - (data.sold_quantity || 0) - (data.reserved_quantity || 0),
  };
}

// =====================================================
// Test 1: Sequential Purchase Test (Baseline)
// =====================================================

async function test1_SequentialPurchase() {
  console.log('\n🧪 TEST 1: Sequential Purchase (Baseline Performance)');
  console.log('========================================');
  
  const inventory = await checkInventory(config.testTierId);
  if (!inventory) return;
  
  console.log('📊 Initial Inventory:');
  console.log(`   Total: ${inventory.total}`);
  console.log(`   Sold: ${inventory.sold}`);
  console.log(`   Reserved: ${inventory.reserved}`);
  console.log(`   Available: ${inventory.available}\n`);
  
  // Create and use a single test user
  const user = await createTestUser(1);
  if (!user || !user.session) {
    console.error('❌ Test 1 failed: Could not create test user');
    return;
  }
  
  const result = await attemptTicketPurchase(
    1,
    user.session,
    config.testEventId,
    config.testTierId,
    2
  );
  
  console.log('\n📈 Test 1 Results:');
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Duration: ${result.duration}ms`);
  console.log(`   Target: < 500ms`);
  
  // Check inventory after
  const inventoryAfter = await checkInventory(config.testTierId);
  if (inventoryAfter) {
    console.log(`\n📊 Final Inventory:`);
    console.log(`   Reserved: ${inventoryAfter.reserved}`);
    console.log(`   Available: ${inventoryAfter.available}`);
  }
  
  console.log('========================================');
}

// =====================================================
// Test 2: Concurrent Purchase Test (Race Condition)
// =====================================================

async function test2_ConcurrentPurchase() {
  console.log('\n🧪 TEST 2: Concurrent Purchase (Race Condition Test)');
  console.log('========================================');
  
  const inventory = await checkInventory(config.testTierId);
  if (!inventory) return;
  
  console.log('📊 Initial Inventory:');
  console.log(`   Available: ${inventory.available}`);
  console.log(`\n🚀 Creating ${config.concurrentUsers} users...`);
  
  // Create multiple test users
  const users = [];
  for (let i = 1; i <= config.concurrentUsers; i++) {
    const user = await createTestUser(i);
    if (user && user.session) {
      users.push({ userNumber: i, session: user.session });
    }
    
    // Show progress
    if (i % 5 === 0) {
      console.log(`   Created ${i} users...`);
    }
  }
  
  console.log(`\n✅ Created ${users.length} test users`);
  console.log(`\n⏱️  Starting concurrent checkout (${users.length} users × ${config.ticketsPerUser} tickets each)...`);
  
  const startTime = Date.now();
  
  // Launch all purchases simultaneously
  const purchasePromises = users.map(user => 
    attemptTicketPurchase(
      user.userNumber,
      user.session,
      config.testEventId,
      config.testTierId,
      config.ticketsPerUser
    )
  );
  
  const results = await Promise.all(purchasePromises);
  
  const totalDuration = Date.now() - startTime;
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log('\n📈 Test 2 Results:');
  console.log(`   Total Time: ${totalDuration}ms`);
  console.log(`   Successful Checkouts: ${successful.length}/${results.length}`);
  console.log(`   Failed Checkouts: ${failed.length}/${results.length}`);
  console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Min Duration: ${Math.min(...results.map(r => r.duration))}ms`);
  console.log(`   Max Duration: ${Math.max(...results.map(r => r.duration))}ms`);
  
  // Check final inventory
  const inventoryAfter = await checkInventory(config.testTierId);
  if (inventoryAfter) {
    console.log(`\n📊 Final Inventory:`);
    console.log(`   Reserved: ${inventoryAfter.reserved}`);
    console.log(`   Available: ${inventoryAfter.available}`);
    console.log(`   Expected Reserved: ${successful.length * config.ticketsPerUser}`);
    
    if (inventoryAfter.reserved === successful.length * config.ticketsPerUser) {
      console.log(`   ✅ Inventory matches expectations!`);
    } else {
      console.log(`   ❌ WARNING: Inventory mismatch!`);
    }
  }
  
  console.log('========================================');
}

// =====================================================
// Test 3: Overselling Prevention Test
// =====================================================

async function test3_OversellPrevention() {
  console.log('\n🧪 TEST 3: Overselling Prevention');
  console.log('========================================');
  
  const inventory = await checkInventory(config.testTierId);
  if (!inventory) return;
  
  console.log('📊 Current Inventory:');
  console.log(`   Available: ${inventory.available}`);
  
  const usersToCreate = Math.ceil(inventory.available / config.ticketsPerUser) + 10; // More users than tickets
  
  console.log(`\n🚀 Creating ${usersToCreate} users (more than available tickets)...`);
  console.log(`   Expected: ${Math.floor(inventory.available / config.ticketsPerUser)} successful`);
  console.log(`   Expected: ${usersToCreate - Math.floor(inventory.available / config.ticketsPerUser)} rejected`);
  
  // Create test users
  const users = [];
  for (let i = 1; i <= usersToCreate; i++) {
    const user = await createTestUser(i);
    if (user && user.session) {
      users.push({ userNumber: i, session: user.session });
    }
  }
  
  console.log(`\n✅ Created ${users.length} test users`);
  console.log(`\n⏱️  Starting overselling test...`);
  
  // Launch all purchases simultaneously
  const purchasePromises = users.map(user => 
    attemptTicketPurchase(
      user.userNumber,
      user.session,
      config.testEventId,
      config.testTierId,
      config.ticketsPerUser
    )
  );
  
  const results = await Promise.all(purchasePromises);
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const soldOutErrors = failed.filter(r => 
    r.error && (
      r.error.includes('insufficient') || 
      r.error.includes('sold out') ||
      r.error.includes('available')
    )
  );
  
  console.log('\n📈 Test 3 Results:');
  console.log(`   Successful: ${successful.length}`);
  console.log(`   Failed: ${failed.length}`);
  console.log(`   Sold Out Errors: ${soldOutErrors.length}`);
  
  // Check final inventory
  const inventoryAfter = await checkInventory(config.testTierId);
  if (inventoryAfter) {
    console.log(`\n📊 Final Inventory:`);
    console.log(`   Reserved: ${inventoryAfter.reserved}`);
    console.log(`   Available: ${inventoryAfter.available}`);
    
    const totalReserved = inventoryAfter.reserved;
    const totalInitial = inventory.total;
    
    if (totalReserved <= totalInitial) {
      console.log(`   ✅ NO OVERSELLING - System correctly prevented overbooking!`);
    } else {
      console.log(`   ❌ CRITICAL: OVERSELLING DETECTED!`);
    }
  }
  
  console.log('========================================');
}

// =====================================================
// Main Test Runner
// =====================================================

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   YardPass Frontend Ticketing Load Test Suite    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('\n');
  
  // Validate configuration
  if (config.supabaseUrl.includes('YOUR_')) {
    console.error('❌ ERROR: Please update Supabase URL in config');
    return;
  }
  
  if (config.testEventId.includes('YOUR_')) {
    console.error('❌ ERROR: Please update test event ID in config');
    console.log('\n💡 To get test IDs:');
    console.log('   1. Create a test event in your app');
    console.log('   2. Run this SQL in Supabase:');
    console.log('      SELECT id, title FROM events WHERE title LIKE \'%TEST%\';');
    console.log('      SELECT id, name FROM ticket_tiers WHERE event_id = \'YOUR_EVENT_ID\';');
    return;
  }
  
  console.log('⚙️  Configuration:');
  console.log(`   Supabase URL: ${config.supabaseUrl.substring(0, 40)}...`);
  console.log(`   Test Event ID: ${config.testEventId}`);
  console.log(`   Test Tier ID: ${config.testTierId}`);
  console.log(`   Concurrent Users: ${config.concurrentUsers}`);
  console.log(`   Tickets Per User: ${config.ticketsPerUser}`);
  console.log('\n');
  
  // Run tests sequentially
  try {
    await test1_SequentialPurchase();
    
    // Uncomment to run additional tests
    // await test2_ConcurrentPurchase();
    // await test3_OversellPrevention();
    
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║           ✅ All Tests Complete!                  ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('\n');
    
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
  }
}

// Run tests
runAllTests().catch(console.error);

