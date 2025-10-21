-- Ensure org_contact_imports table exists with proper structure
-- This fixes the 404 error for org_contact_imports queries

-- Create org_contact_imports table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.org_contact_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  source text,
  imported_by uuid REFERENCES auth.users(id),
  imported_at timestamptz DEFAULT now(),
  original_row_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create org_contact_import_entries table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.org_contact_import_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.org_contact_imports(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  tags text[] DEFAULT array[]::text[],
  consent text DEFAULT 'unknown',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_org_contact_imports_org_id ON public.org_contact_imports(org_id);
CREATE INDEX IF NOT EXISTS idx_org_contact_imports_imported_at ON public.org_contact_imports(imported_at);
CREATE INDEX IF NOT EXISTS idx_org_contact_entries_import_id ON public.org_contact_import_entries(import_id);
CREATE INDEX IF NOT EXISTS idx_org_contact_entries_email ON public.org_contact_import_entries((lower(email)));
CREATE INDEX IF NOT EXISTS idx_org_contact_entries_phone ON public.org_contact_import_entries(phone);

-- Enable RLS
ALTER TABLE public.org_contact_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contact_import_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS select_contact_imports_for_members ON public.org_contact_imports;
CREATE POLICY select_contact_imports_for_members ON public.org_contact_imports
  FOR SELECT USING (public.is_org_role(org_id, array['viewer','editor','admin','owner']));

DROP POLICY IF EXISTS insert_contact_imports_for_editors ON public.org_contact_imports;
CREATE POLICY insert_contact_imports_for_editors ON public.org_contact_imports
  FOR INSERT WITH CHECK (public.is_org_role(org_id, array['editor','admin','owner']));

DROP POLICY IF EXISTS update_contact_imports_for_editors ON public.org_contact_imports;
CREATE POLICY update_contact_imports_for_editors ON public.org_contact_imports
  FOR UPDATE USING (public.is_org_role(org_id, array['editor','admin','owner']))
  WITH CHECK (public.is_org_role(org_id, array['editor','admin','owner']));

DROP POLICY IF EXISTS delete_contact_imports_for_editors ON public.org_contact_imports;
CREATE POLICY delete_contact_imports_for_editors ON public.org_contact_imports
  FOR DELETE USING (public.is_org_role(org_id, array['editor','admin','owner']));

-- Policies for org_contact_import_entries
DROP POLICY IF EXISTS select_contact_entries_for_members ON public.org_contact_import_entries;
CREATE POLICY select_contact_entries_for_members ON public.org_contact_import_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_contact_imports oci 
      WHERE oci.id = import_id 
      AND public.is_org_role(oci.org_id, array['viewer','editor','admin','owner'])
    )
  );

DROP POLICY IF EXISTS insert_contact_entries_for_editors ON public.org_contact_import_entries;
CREATE POLICY insert_contact_entries_for_editors ON public.org_contact_import_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_contact_imports oci 
      WHERE oci.id = import_id 
      AND public.is_org_role(oci.org_id, array['editor','admin','owner'])
    )
  );

DROP POLICY IF EXISTS update_contact_entries_for_editors ON public.org_contact_import_entries;
CREATE POLICY update_contact_entries_for_editors ON public.org_contact_import_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_contact_imports oci 
      WHERE oci.id = import_id 
      AND public.is_org_role(oci.org_id, array['editor','admin','owner'])
    )
  );

DROP POLICY IF EXISTS delete_contact_entries_for_editors ON public.org_contact_import_entries;
CREATE POLICY delete_contact_entries_for_editors ON public.org_contact_import_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.org_contact_imports oci 
      WHERE oci.id = import_id 
      AND public.is_org_role(oci.org_id, array['editor','admin','owner'])
    )
  );
