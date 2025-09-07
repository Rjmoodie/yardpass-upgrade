-- Add missing foreign key between event_posts and user_profiles
-- This will allow proper joins in queries

ALTER TABLE event_posts 
ADD CONSTRAINT event_posts_author_user_id_user_profiles_fkey 
FOREIGN KEY (author_user_id) 
REFERENCES user_profiles(user_id) 
ON DELETE CASCADE;