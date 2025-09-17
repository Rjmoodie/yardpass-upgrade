-- Add social links to user profiles
ALTER TABLE public.user_profiles 
ADD COLUMN social_links jsonb DEFAULT '[]'::jsonb;

-- Add a constraint to limit social links to maximum 3
ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_social_links_limit 
CHECK (jsonb_array_length(social_links) <= 3);

-- Create a function to validate social link structure
CREATE OR REPLACE FUNCTION public.validate_social_links(links jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Check if it's an array
  IF jsonb_typeof(links) != 'array' THEN
    RETURN false;
  END IF;
  
  -- Check array length
  IF jsonb_array_length(links) > 3 THEN
    RETURN false;
  END IF;
  
  -- Check each element structure
  FOR i IN 0..jsonb_array_length(links) - 1 LOOP
    IF NOT (
      links->i ? 'platform' AND 
      links->i ? 'url' AND 
      links->i ? 'is_primary' AND
      jsonb_typeof(links->i->'platform') = 'string' AND
      jsonb_typeof(links->i->'url') = 'string' AND
      jsonb_typeof(links->i->'is_primary') = 'boolean'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$;

-- Add constraint to validate social links structure
ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_social_links_structure 
CHECK (validate_social_links(social_links));

-- Create an index for faster queries on social links
CREATE INDEX idx_user_profiles_social_links ON public.user_profiles USING GIN (social_links);

-- Update existing users to have empty social links array
UPDATE public.user_profiles 
SET social_links = '[]'::jsonb 
WHERE social_links IS NULL;