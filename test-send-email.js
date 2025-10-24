// Manual Email Test Script
// Run this to test email sending for a specific order

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testEmail() {
  const orderId = '90e3a1d7-7e55-4e44-bb27-6c4802f144be';
  
  console.log('🧪 Testing email for order:', orderId);
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      events (
        id,
        title,
        start_at,
        venue,
        city
      )
    `)
    .eq('id', orderId)
    .single();
  
  if (orderError || !order) {
    console.error('❌ Order not found:', orderError);
    return;
  }
  
  console.log('✅ Order found:', {
    id: order.id,
    status: order.status,
    email: order.contact_email,
    eventTitle: order.events?.title
  });
  
  // Get user email
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const user = authUser?.users?.find(u => u.id === order.user_id);
  const userEmail = user?.email || order.contact_email;
  
  console.log('📧 Email address:', userEmail);
  
  // Get tickets
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id')
    .eq('order_id', order.id);
  
  const ticketIds = (tickets || []).map(t => t.id);
  console.log('🎫 Tickets:', ticketIds.length);
  
  // Get ticket tier
  const { data: firstTier } = await supabase
    .from('order_items')
    .select('ticket_tiers(name)')
    .eq('order_id', order.id)
    .limit(1)
    .maybeSingle();
  
  const ticketType = firstTier?.ticket_tiers?.name || 'General Admission';
  
  // Format event date
  const eventDate = order.events?.start_at
    ? new Date(order.events.start_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'TBA';
  
  const eventLocation = [order.events?.venue, order.events?.city]
    .filter(Boolean)
    .join(', ') || 'TBA';
  
  console.log('📋 Email payload:', {
    customerName: order.contact_name || 'Customer',
    customerEmail: userEmail,
    eventTitle: order.events?.title || 'Event',
    eventDate,
    eventLocation,
    ticketType,
    quantity: ticketIds.length,
    totalAmount: order.total_cents,
    orderId: order.id,
    ticketIds,
    eventId: order.event_id
  });
  
  // Call send-purchase-confirmation
  console.log('📤 Calling send-purchase-confirmation...');
  
  const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-purchase-confirmation', {
    body: {
      customerName: order.contact_name || 'Customer',
      customerEmail: userEmail,
      eventTitle: order.events?.title || 'Event',
      eventDate,
      eventLocation,
      ticketType,
      quantity: ticketIds.length,
      totalAmount: order.total_cents,
      orderId: order.id,
      ticketIds,
      eventId: order.event_id
    }
  });
  
  if (emailError) {
    console.error('❌ Email error:', emailError);
  } else {
    console.log('✅ Email sent successfully:', emailResponse);
  }
}

testEmail().catch(console.error);




