// Simple test script to check webhook accessibility
import https from 'https';

const webhookUrl = 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/stripe-webhook';

// You need to replace 'YOUR_SUPABASE_ANON_KEY' with your actual anon key
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

console.log('Testing webhook endpoint:', webhookUrl);

// Stripe webhook test payload
const postData = JSON.stringify({
  id: "evt_test_webhook",
  object: "event",
  api_version: "2023-10-16",
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: "cs_test_123",
      object: "checkout.session",
      payment_status: "paid",
      customer_email: "test@example.com"
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: null,
    idempotency_key: null
  },
  type: "checkout.session.completed"
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(webhookUrl, options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
