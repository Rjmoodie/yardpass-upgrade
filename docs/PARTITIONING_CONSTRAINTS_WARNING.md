# ⚠️ Partitioning Constraints Warning

## Critical Limitation: Primary Keys on Partitioned Tables

### The Problem

PostgreSQL requires that **all unique constraints (including PRIMARY KEY) must include the partition key column**. This means when partitioning by `created_at`, the primary key changes from:

```sql
-- Before partitioning
PRIMARY KEY (id)

-- After partitioning
PRIMARY KEY (id, created_at)
```

### Affected Tables

1. **`event_impressions`**: `PRIMARY KEY (id)` → `PRIMARY KEY (id, created_at)`
2. **`ticket_analytics`**: `PRIMARY KEY (id)` → `PRIMARY KEY (id, created_at)`
3. **`orders`**: `PRIMARY KEY (id)` → `PRIMARY KEY (id, created_at)`

### Impact on Foreign Keys

**⚠️ IMPORTANT:** If any tables have foreign keys pointing to these tables, those foreign keys will **break** after partitioning!

#### Example Problem:
```sql
-- This foreign key will FAIL after partitioning:
ALTER TABLE order_items
  ADD CONSTRAINT fk_order_id
  FOREIGN KEY (order_id) REFERENCES orders(id);

-- Error: there is no unique constraint matching given keys for referenced table "orders"
```

#### Solution:
You must update foreign keys to reference the composite key:

```sql
-- Add created_at to the referencing table
ALTER TABLE order_items
  ADD COLUMN order_created_at timestamptz;

-- Update the foreign key
ALTER TABLE order_items
  ADD CONSTRAINT fk_order_id
  FOREIGN KEY (order_id, order_created_at) 
  REFERENCES orders(id, created_at);
```

### Finding Affected Foreign Keys

```sql
-- Check for foreign keys pointing to orders
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('orders', 'event_impressions', 'ticket_analytics');
```

### Known Foreign Keys to Fix

Based on the schema provided:

#### `orders` table:
- `order_items.order_id` → References `orders(id)`
- `refunds.order_id` → References `orders(id)`
- `tickets.order_id` → References `orders(id)`
- `sponsorship_orders.order_id` (if it exists) → References `orders(id)`
- `inventory_operations.order_id` → References `orders(id)`

#### `event_impressions` table:
- Likely no foreign keys pointing TO this table (it's a fact table)

#### `ticket_analytics` table:
- Likely no foreign keys pointing TO this table (it's a fact table)

### Alternative: Skip Partitioning for Orders

If fixing all foreign keys is too disruptive, consider **NOT partitioning the `orders` table** and only partition:
- `event_impressions` (likely no FKs pointing to it)
- `ticket_analytics` (likely no FKs pointing to it)

These are pure fact/analytics tables with fewer dependencies.

### Migration Strategy

**Option 1: Fix Foreign Keys (Recommended for Production)**

1. Identify all foreign keys
2. Add `created_at` columns to referencing tables
3. Backfill `created_at` values
4. Update foreign key constraints
5. Run partition migration

**Option 2: Partition Only Analytics Tables**

1. Skip `orders` partitioning
2. Only partition `event_impressions` and `ticket_analytics`
3. These tables likely have no incoming foreign keys

**Option 3: Use Trigger-Based Partitioning (Legacy)**

Use triggers instead of declarative partitioning (not recommended for new systems).

### Testing Before Production

```sql
-- Test on a copy of production data
CREATE TABLE orders_test AS SELECT * FROM orders LIMIT 1000;

-- Try creating partitioned version
CREATE TABLE orders_test_p (
  LIKE orders_test
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Check if any queries break
EXPLAIN ANALYZE SELECT * FROM orders_test_p WHERE id = 'some-uuid';
```

### Performance Trade-offs

**Benefits:**
- ⚡ 5-10x faster time-range queries
- 📊 Easy data archival (drop old partitions)
- 💾 Smaller index sizes per partition

**Costs:**
- ⚠️ More complex primary keys
- ⚠️ Foreign key constraints need adjustment
- ⚠️ Some queries may need rewriting

### Recommendation

**For Liventix:**

1. **DO partition `event_impressions` and `ticket_analytics`** (analytics tables, no incoming FKs)
2. **SKIP `orders` partitioning for now** (has many foreign keys)
3. Monitor query performance
4. If `orders` queries are slow, plan a proper FK migration later

### Modified Migration

To skip `orders` partitioning, remove lines 147-226 from `20251021_0101_partition_facts.sql`.

---

**Status:** ⚠️ Review required before deployment  
**Risk Level:** Medium-High (foreign key breakage)  
**Recommendation:** Partition analytics tables only

