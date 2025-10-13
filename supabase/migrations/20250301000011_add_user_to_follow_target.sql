-- Add 'user' to follow_target enum
-- This must be in a separate migration from any code that uses it

ALTER TYPE follow_target ADD VALUE 'user';

