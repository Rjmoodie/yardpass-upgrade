# pgbench Database Load Testing

These scripts test the atomic reservation system directly at the database level using PostgreSQL's pgbench tool.

## Setup

1. **Initialize test mapping table** (run once):
```bash
pgbench -h <HOST> -p <PORT> -U <USER> -d <DB> -f init_pgbench_tiers.sql -n
```

## Test Scripts

### 1. Reserve-only Load Test
Hammers the `reserve_tickets_atomic` function to test reservation guards under high contention:

```bash
pgbench -h <HOST> -p <PORT> -U <USER> -d <DB> \
  -f reserve_only_via_fn.sql \
  -c 30 -j 6 -T 30 -M prepared
```

### 2. Full Flow Test
Simulates realistic user behavior - reserve → (release | issue):

```bash
pgbench -h <HOST> -p <PORT> -U <USER> -d <DB> \
  -f reserve_release_issue_via_fn.sql \
  -c 80 -j 16 -T 120 -M prepared
```

## Validation

Run these queries during/after testing to verify invariants:

```bash
psql -h <HOST> -p <PORT> -U <USER> -d <DB> -f validate_invariants.sql
```

## Tuning Parameters

- **-c**: Number of concurrent clients
- **-j**: Number of worker threads
- **-T**: Duration in seconds
- **TIERS_N**: Number of tiers in test (adjust in scripts)
- **QTY**: Tickets per reservation (1-6)
- **RELEASE_PCT**: Percentage of carts abandoned (35% default)

## Expected Results

- **Zero oversold tiers**: `reserved_quantity + issued_quantity <= total_quantity`
- **Zero negative availability**: `total_quantity - reserved_quantity - issued_quantity >= 0`
- Clean transaction completion with proper rollbacks on conflicts