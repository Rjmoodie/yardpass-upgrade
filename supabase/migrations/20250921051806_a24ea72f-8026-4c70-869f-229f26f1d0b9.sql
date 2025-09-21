-- Clear all comments, reactions, views, clicks and reset counts
DELETE FROM event_comment_reactions;
DELETE FROM event_comments;
DELETE FROM event_reactions;
DELETE FROM post_views;
DELETE FROM post_clicks;

-- Reset like and comment counts on all posts
UPDATE event_posts 
SET like_count = 0, comment_count = 0;