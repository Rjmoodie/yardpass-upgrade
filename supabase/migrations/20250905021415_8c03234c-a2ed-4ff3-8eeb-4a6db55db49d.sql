-- Refresh PostgREST schema cache to recognize the foreign key relationship
NOTIFY pgrst, 'reload schema';