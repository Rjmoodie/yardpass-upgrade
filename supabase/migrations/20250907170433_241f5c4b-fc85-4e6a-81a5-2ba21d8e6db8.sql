-- Fix missing foreign key relationship between event_posts and user_profiles
-- Add the foreign key constraint that the system is looking for

ALTER TABLE event_posts 
ADD CONSTRAINT event_posts_author_user_id_fkey 
FOREIGN KEY (author_user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;