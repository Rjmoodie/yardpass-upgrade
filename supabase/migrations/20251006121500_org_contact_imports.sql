-- Contact import tables for organization-managed mailing lists
create table if not exists public.org_contact_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  source text,
  imported_by uuid references auth.users(id),
  imported_at timestamptz default now(),
  original_row_count integer default 0,
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.org_contact_import_entries (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.org_contact_imports(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  tags text[] default array[]::text[],
  consent text default 'unknown',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_org_contact_imports_org_id on public.org_contact_imports(org_id);
create index if not exists idx_org_contact_entries_import_id on public.org_contact_import_entries(import_id);
create index if not exists idx_org_contact_entries_email on public.org_contact_import_entries((lower(email)));
create index if not exists idx_org_contact_entries_phone on public.org_contact_import_entries(phone);

alter table public.org_contact_imports enable row level security;
alter table public.org_contact_import_entries enable row level security;

create policy select_contact_imports_for_members on public.org_contact_imports
  for select using (public.is_org_role(org_id, array['viewer','editor','admin','owner']));

create policy insert_contact_imports_for_editors on public.org_contact_imports
  for insert with check (public.is_org_role(org_id, array['editor','admin','owner']));

create policy update_contact_imports_for_editors on public.org_contact_imports
  for update using (public.is_org_role(org_id, array['editor','admin','owner']))
  with check (public.is_org_role(org_id, array['editor','admin','owner']));

create policy delete_contact_imports_for_admins on public.org_contact_imports
  for delete using (public.is_org_role(org_id, array['admin','owner']));

create policy select_contact_import_entries_for_members on public.org_contact_import_entries
  for select using (
    exists (
      select 1
      from public.org_contact_imports oci
      where oci.id = org_contact_import_entries.import_id
        and public.is_org_role(oci.org_id, array['viewer','editor','admin','owner'])
    )
  );

create policy insert_contact_import_entries_for_editors on public.org_contact_import_entries
  for insert with check (
    exists (
      select 1
      from public.org_contact_imports oci
      where oci.id = org_contact_import_entries.import_id
        and public.is_org_role(oci.org_id, array['editor','admin','owner'])
    )
  );

create policy update_contact_import_entries_for_editors on public.org_contact_import_entries
  for update using (
    exists (
      select 1
      from public.org_contact_imports oci
      where oci.id = org_contact_import_entries.import_id
        and public.is_org_role(oci.org_id, array['editor','admin','owner'])
    )
  )
  with check (
    exists (
      select 1
      from public.org_contact_imports oci
      where oci.id = org_contact_import_entries.import_id
        and public.is_org_role(oci.org_id, array['editor','admin','owner'])
    )
  );

create policy delete_contact_import_entries_for_admins on public.org_contact_import_entries
  for delete using (
    exists (
      select 1
      from public.org_contact_imports oci
      where oci.id = org_contact_import_entries.import_id
        and public.is_org_role(oci.org_id, array['admin','owner'])
    )
  );
