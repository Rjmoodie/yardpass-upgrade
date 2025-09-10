-- 01_enums.sql
create type role_type as enum ('organizer','scanner','staff','volunteer','vendor','guest');
create type message_channel as enum ('email','sms');
create type job_status as enum ('draft','queued','sending','sent','failed');
create type invite_status as enum ('pending','accepted','expired','revoked');

-- 02_roles.sql
create table if not exists event_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role role_type not null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id, role)
);

create table if not exists role_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  role role_type not null,
  email text,
  phone text,
  token text not null unique,
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  accepted_user_id uuid,
  status invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  check ((email is not null) or (phone is not null))
);

create index on event_roles (event_id, role);
create index on role_invites (event_id, role, status);
create index on role_invites (token);

-- 03_messaging.sql
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  channel message_channel not null,
  subject text,
  body text,
  sms_body text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists message_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  channel message_channel not null,
  template_id uuid references message_templates(id) on delete set null,
  subject text,
  body text,
  sms_body text,
  from_name text,
  from_email text,
  status job_status not null default 'draft',
  batch_size int not null default 200,
  scheduled_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists message_job_recipients (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references message_jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  phone text,
  status text not null default 'pending',
  error text,
  sent_at timestamptz
);

create index on message_jobs (event_id, status, scheduled_at);
create index on message_job_recipients (job_id, status);

-- RLS (keep it strict)
alter table event_roles enable row level security;
alter table role_invites enable row level security;
alter table message_templates enable row level security;
alter table message_jobs enable row level security;
alter table message_job_recipients enable row level security;

-- event_roles
create policy select_my_event_roles on event_roles
  for select using (
    auth.uid() = user_id
    or is_event_manager(event_id)
  );

create policy modify_event_roles_as_admin on event_roles
  for all using (is_event_manager(event_id));

-- role_invites
create policy read_invites_as_admin on role_invites
  for select using (is_event_manager(event_id));

create policy modify_invites_as_admin on role_invites
  for all using (is_event_manager(event_id));

-- message_templates
create policy crud_templates_as_admin on message_templates
  for all using (
    exists (
      select 1 from org_memberships om
      where om.org_id = message_templates.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'editor')
    )
  );

-- message_jobs
create policy crud_jobs_as_admin on message_jobs
  for all using (is_event_manager(event_id));

-- recipients: readable by job creator/admin
create policy read_recipients_for_my_job on message_job_recipients
  for select using (
    exists (
      select 1 from message_jobs j
      where j.id = message_job_recipients.job_id
        and (j.created_by = auth.uid() or is_event_manager(j.event_id))
    )
  );

-- RPC: accept invite (token)
create or replace function accept_role_invite(p_token text)
returns void
language plpgsql
security definer
as $$
declare
  v_inv role_invites%rowtype;
begin
  select * into v_inv
  from role_invites
  where token = p_token
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invite invalid or expired';
  end if;

  insert into event_roles (event_id, user_id, role, created_by)
  values (v_inv.event_id, auth.uid(), v_inv.role, auth.uid())
  on conflict (event_id, user_id, role) do nothing;

  update role_invites
  set status = 'accepted', accepted_user_id = auth.uid()
  where id = v_inv.id;
end;
$$;