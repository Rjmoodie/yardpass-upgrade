-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true);

-- Create storage policies for organization logos
CREATE POLICY "Organization logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'org-logos');

CREATE POLICY "Authenticated users can upload organization logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Organization owners can update their logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Organization owners can delete their logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');