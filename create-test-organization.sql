-- Create a test organization for datmahseh@gmail.com
-- Run this if you don't have any organizations yet

-- STEP 1: Create the organization
INSERT INTO organizations.organizations (
  name,
  description,
  verification_status,
  logo_url
) VALUES (
  'Liventix Test Events',
  'Test organization for flashback events and demos',
  'pending',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400'  -- Event planning image
) RETURNING id, name;

-- ⚠️ Copy the returned 'id' from above, then run STEP 2 below:

-- STEP 2: Add datmahseh as owner
-- Replace <ORG_ID_FROM_STEP_1> with the UUID returned above
/*
INSERT INTO organizations.org_memberships (
  org_id,
  user_id,
  role,
  invited_by
) VALUES (
  '<ORG_ID_FROM_STEP_1>',              -- ← Replace with org id from STEP 1
  '86289a38-799e-4e76-b3dd-2f9615e56afa',  -- datmahseh@gmail.com
  'owner',
  '86289a38-799e-4e76-b3dd-2f9615e56afa'   -- Self-invited (bootstrap)
) RETURNING *;
*/

-- ============================================================================
-- After running both steps, you'll have:
-- ✅ Organization: "Liventix Test Events"
-- ✅ Member: datmahseh@gmail.com (owner role)
-- ✅ Ready to create flashback events!
-- ============================================================================

