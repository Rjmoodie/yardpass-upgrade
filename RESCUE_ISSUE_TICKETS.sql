-- EMERGENCY: Issue Tickets for Paid Orders
-- Run this to manually issue tickets for orders that were paid but tickets failed to generate

-- ============================================================================
-- STEP 1: Find orders that need tickets
-- ============================================================================

DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_tier RECORD;
  v_tickets_created INT := 0;
  v_total_orders INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🆘 TICKET RESCUE OPERATION';
  RAISE NOTICE '==========================';
  RAISE NOTICE '';
  
  -- Find all paid orders from last 24 hours with no tickets
  FOR v_order IN 
    SELECT 
      o.id as order_id,
      o.user_id,
      o.event_id,
      o.created_at
    FROM orders o
    WHERE o.status = 'paid'
      AND o.paid_at > now() - interval '24 hours'
      AND o.tickets_issued_count = 0
      AND NOT EXISTS (
        SELECT 1 FROM ticketing.tickets t WHERE t.order_id = o.id
      )
    ORDER BY o.created_at DESC
  LOOP
    v_total_orders := v_total_orders + 1;
    
    RAISE NOTICE '📦 Processing Order: %', v_order.order_id;
    RAISE NOTICE '   User: %', v_order.user_id;
    RAISE NOTICE '   Event: %', v_order.event_id;
    
    -- Get order items
    FOR v_item IN
      SELECT 
        tier_id,
        quantity
      FROM order_items
      WHERE order_id = v_order.order_id
    LOOP
      -- Get tier details
      SELECT * INTO v_tier
      FROM ticket_tiers
      WHERE id = v_item.tier_id;
      
      RAISE NOTICE '   Creating % tickets for tier: %', v_item.quantity, v_tier.name;
      
      -- Create tickets
      FOR i IN 1..v_item.quantity LOOP
        INSERT INTO ticketing.tickets (
          order_id,
          event_id,
          tier_id,
          owner_user_id,
          status
        ) VALUES (
          v_order.order_id,
          v_order.event_id,
          v_item.tier_id,
          v_order.user_id,
          'issued'
        );
        
        v_tickets_created := v_tickets_created + 1;
      END LOOP;
    END LOOP;
    
    -- Update order tickets_issued_count
    UPDATE orders
    SET tickets_issued_count = (
      SELECT COUNT(*) FROM ticketing.tickets WHERE order_id = v_order.order_id
    )
    WHERE id = v_order.order_id;
    
    RAISE NOTICE '   ✅ Issued % tickets for order %', 
      (SELECT COUNT(*) FROM ticketing.tickets WHERE order_id = v_order.order_id),
      v_order.order_id;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '==========================';
  RAISE NOTICE '✅ RESCUE COMPLETE';
  RAISE NOTICE '   Orders processed: %', v_total_orders;
  RAISE NOTICE '   Tickets created: %', v_tickets_created;
  RAISE NOTICE '';
  
  IF v_total_orders = 0 THEN
    RAISE NOTICE '⚠️  No orders found needing rescue';
    RAISE NOTICE '   (All paid orders already have tickets)';
  ELSE
    RAISE NOTICE '🎫 Tickets are now in your account!';
    RAISE NOTICE '   Check your Tickets page in the app.';
  END IF;
  
  RAISE NOTICE '';
END $$;


