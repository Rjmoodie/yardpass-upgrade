// Test search intelligence
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yieslxnrfeqchbcmgavz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY'
);

async function testSearchIntelligence() {
  console.log('🔍 Testing Search Intelligence...\n');

  const testCases = [
    {
      name: 'Empty query - should show trending events',
      query: '',
      filters: {}
    },
    {
      name: 'Simple keyword search',
      query: 'music',
      filters: {}
    },
    {
      name: 'Location-based search',
      query: '',
      filters: { location: 'New York' }
    },
    {
      name: 'Category filter',
      query: '',
      filters: { category: 'Music' }
    },
    {
      name: 'Date range filter',
      query: '',
      filters: { 
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31'
      }
    },
    {
      name: 'Complex search - music in NYC',
      query: 'jazz',
      filters: { 
        location: 'New York',
        category: 'Music'
      }
    },
    {
      name: 'Organizer search',
      query: 'Brooklyn',
      filters: {}
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    console.log(`   Query: "${testCase.query}"`);
    console.log(`   Filters:`, testCase.filters);
    
    try {
      const { data, error } = await supabase.rpc('search_all', {
        p_user: null,
        p_q: testCase.query || null,
        p_category: testCase.filters.category || null,
        p_date_from: testCase.filters.dateFrom || null,
        p_date_to: testCase.filters.dateTo || null,
        p_only_events: true,
        p_limit: 5,
        p_offset: 0,
        p_location: testCase.filters.location || null
      });

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Found ${data.length} events`);
        if (data.length > 0) {
          data.forEach((event, i) => {
            console.log(`      ${i + 1}. ${event.title} (${event.organizer_name})`);
            console.log(`         📅 ${event.start_at ? new Date(event.start_at).toLocaleDateString() : 'No date'}`);
            console.log(`         📍 ${event.location || 'No location'}`);
            console.log(`         🏷️  ${event.category || 'No category'}`);
          });
        }
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
    
    console.log('');
  }

  // Test search ranking
  console.log('🎯 Testing Search Ranking...\n');
  
  const rankingTests = [
    {
      query: 'music',
      expected: 'Should rank events with "music" in title higher'
    },
    {
      query: 'jazz concert',
      expected: 'Should handle multi-word queries intelligently'
    },
    {
      query: 'Brooklyn music',
      expected: 'Should match both location and category'
    }
  ];

  for (const test of rankingTests) {
    console.log(`🔍 Query: "${test.query}"`);
    console.log(`   Expected: ${test.expected}`);
    
    try {
      const { data, error } = await supabase.rpc('search_all', {
        p_user: null,
        p_q: test.query,
        p_only_events: true,
        p_limit: 3,
        p_offset: 0
      });

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Results (ranked):`);
        data.forEach((event, i) => {
          console.log(`      ${i + 1}. ${event.title}`);
          console.log(`         📍 ${event.location || 'No location'}`);
          console.log(`         🏷️  ${event.category || 'No category'}`);
        });
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
    
    console.log('');
  }
}

testSearchIntelligence().catch(console.error);
