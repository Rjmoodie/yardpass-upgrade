-- Fix the missing RLS policies for kv_store table
CREATE POLICY "kv_store_read_all" 
ON public.kv_store_d42c04e8 
FOR SELECT 
USING (true);

CREATE POLICY "kv_store_write_all" 
ON public.kv_store_d42c04e8 
FOR ALL 
USING (true) 
WITH CHECK (true);