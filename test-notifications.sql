-- Test Notifications Script
-- Run this in Supabase SQL Editor to create sample notifications
-- User ID: 34cce931-f181-4caf-8f05-4bcc7ee3ecaa

-- Insert test notifications
insert into public.notifications (user_id, title, message, type, action_url, event_type, created_at)
values
  -- Success notification
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '🎉 Welcome to Liventix!',
    'Your account has been successfully created. Start exploring events near you.',
    'success',
    '/search',
    'user_signup',
    now() - interval '2 minutes'
  ),
  
  -- Info notification about a new event
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '📅 New Event Posted',
    'Liventix Launch is happening on October 31st! Check it out.',
    'info',
    '/e/yardpass-launch',
    'event_created',
    now() - interval '5 minutes'
  ),
  
  -- Warning notification
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '⚠️ Ticket Sale Ends Soon',
    'Only 2 hours left to get tickets for Liventix Launch at the early bird price!',
    'warning',
    '/e/yardpass-launch',
    'ticket_reminder',
    now() - interval '15 minutes'
  ),
  
  -- Success notification for a like
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '❤️ Someone liked your post',
    'John Doe liked your post from Liventix Launch event.',
    'success',
    '/profile',
    'post_liked',
    now() - interval '30 minutes'
  ),
  
  -- Info notification for a comment
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '💬 New Comment',
    'Sarah commented on your post: "This looks amazing! Can''t wait to attend!"',
    'info',
    '/profile',
    'post_commented',
    now() - interval '1 hour'
  ),
  
  -- Success notification for ticket purchase
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '🎫 Ticket Confirmed',
    'Your ticket for Liventix Launch has been confirmed! See you there.',
    'success',
    '/tickets',
    'ticket_purchased',
    now() - interval '2 hours'
  ),
  
  -- Info about upcoming event
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '🔔 Event Tomorrow',
    'Liventix Launch starts tomorrow at 7:00 PM. Don''t forget to check in!',
    'info',
    '/tickets',
    'event_reminder',
    now() - interval '1 day'
  ),
  
  -- Error notification (optional, for testing)
  (
    '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
    '❌ Payment Failed',
    'Your payment method was declined. Please update your payment information.',
    'error',
    '/wallet',
    'payment_failed',
    now() - interval '3 hours'
  );

-- Check your notifications
select 
  title,
  message,
  type,
  action_url,
  read_at is null as unread,
  created_at
from public.notifications
where user_id = '34cce931-f181-4caf-8f05-4bcc7ee3ecaa'
order by created_at desc;

