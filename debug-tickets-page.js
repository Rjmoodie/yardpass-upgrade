// Debug script to check if RefundRequestModal is properly imported
// Run this in browser console on /tickets page

console.log('🔍 Debugging Tickets Page...');

// Check if RefreshCcw icon is loaded
console.log('1. Checking icons...');
const icons = document.querySelectorAll('svg');
console.log(`   Found ${icons.length} SVG icons`);

// Check button count
const buttons = document.querySelectorAll('button');
console.log(`2. Found ${buttons.length} buttons on page`);

// Check for refund-related elements
const orangeButtons = document.querySelectorAll('[class*="orange"]');
console.log(`3. Found ${orangeButtons.length} orange-colored elements`);

// Check for "Refund" text
const refundText = document.body.innerText.includes('Refund');
console.log(`4. Page contains "Refund" text: ${refundText}`);

// Check ticket cards
const ticketCards = document.querySelectorAll('[class*="ticket"], [class*="card"]');
console.log(`5. Found ${ticketCards.length} potential ticket cards`);

// Log ticket actions
const actionGrids = document.querySelectorAll('[class*="grid"]');
console.log(`6. Found ${actionGrids.length} grid layouts (action buttons should be in grid)`);

console.log('\n✅ If you see 0 orange elements and "Refund" is false, the component needs to reload.');
console.log('   Try: Hard refresh (Cmd+Shift+R) or restart dev server\n');



