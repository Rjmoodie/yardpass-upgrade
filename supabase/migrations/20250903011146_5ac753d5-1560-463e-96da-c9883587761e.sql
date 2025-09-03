-- YardPass V1 Database Schema Migration
-- Based on yardpass_schema.md specification

-- 0) Enums
create type org_role as enum ('viewer','editor','admin','owner');
create type event_visibility as enum ('public','unlisted','private');
create type ticket_status as enum ('issued','transferred','refunded','redeemed','void');
create type order_status as enum ('pending','paid','refunded','canceled');
create type verification_status as enum ('none','pending','verified','pro');
create type owner_context as enum ('individual','organization');

-- 1) Identity & Organizations
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  photo_url text,
  role text default 'attendee',
  verification_status verification_status default 'none',
  created_at timestamptz default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text unique,
  logo_url text,
  verification_status verification_status default 'none',
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.org_memberships (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role org_role not null default 'viewer',
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- 2) Events & Cultural Guide
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_context_type owner_context not null,
  owner_context_id uuid not null,
  created_by uuid not null references auth.users(id),
  title text not null,
  description text,
  category text,
  cover_image_url text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text,
  venue text,
  address text,
  city text,
  country text,
  lat double precision,
  lng double precision,
  visibility event_visibility default 'public',
  refund_cutoff_days int default 7,
  hold_payout_until_end boolean default true,
  slug text unique,
  created_at timestamptz default now()
);

create table if not exists public.cultural_guides (
  event_id uuid primary key references public.events(id) on delete cascade,
  roots_summary text,
  themes text[] default '{}',
  community text[] default '{}',
  history_long text,
  etiquette_tips text[]
);

-- 3) Ticketing: Tiers → Orders → Tickets
create table if not exists public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  badge_label text,
  price_cents int not null default 0,
  currency text not null default 'USD',
  quantity int,
  max_per_order int default 6,
  sales_start timestamptz,
  sales_end timestamptz,
  status text default 'active',
  sort_index int default 0,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  event_id uuid not null references public.events(id) on delete cascade,
  status order_status not null default 'pending',
  subtotal_cents int not null default 0,
  fees_cents int not null default 0,
  total_cents int not null default 0,
  currency text not null default 'USD',
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  payout_destination_owner owner_context,
  payout_destination_id uuid,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  tier_id uuid not null references public.ticket_tiers(id),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  created_at timestamptz default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tier_id uuid not null references public.ticket_tiers(id),
  order_id uuid references public.orders(id) on delete set null,
  owner_user_id uuid not null references auth.users(id),
  status ticket_status not null default 'issued',
  qr_code text unique not null,
  wallet_pass_url text,
  redeemed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_cents int not null,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 4) Posts, Comments, Reactions (event-scoped)
create table if not exists public.event_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  ticket_tier_id uuid references public.ticket_tiers(id),
  text text,
  media_urls text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.event_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  text text not null,
  created_at timestamptz default now()
);

create table if not exists public.event_reactions (
  post_id uuid references public.event_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text default 'like',
  created_at timestamptz default now(),
  primary key (post_id, user_id, kind)
);

-- 5) Payout Accounts (Stripe Connect)
create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  context_type owner_context not null,
  context_id uuid not null,
  stripe_connect_id text unique,
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  details_submitted boolean default false,
  created_at timestamptz default now(),
  unique (context_type, context_id)
);

-- 6) Views for Badges & Posting Eligibility
create or replace view public.user_event_badge_v as
select
  t.owner_user_id as user_id,
  t.event_id,
  (
    select tt.badge_label
    from public.ticket_tiers tt
    where tt.id = t.tier_id
    order by tt.price_cents desc nulls last, tt.sort_index asc
    limit 1
  ) as badge_label
from public.tickets t
where t.status in ('issued','transferred','redeemed')
group by t.owner_user_id, t.event_id;

create or replace view public.user_can_post_event_v as
select
  u.id as user_id,
  e.id as event_id,
  (
    exists (
      select 1
      from public.tickets t
      where t.event_id = e.id
        and t.owner_user_id = u.id
        and t.status in ('issued','transferred','redeemed')
    )
    or
    (
      e.owner_context_type = 'organization'
      and exists (
        select 1
        from public.org_memberships m
        where m.org_id = e.owner_context_id
          and m.user_id = u.id
          and m.role in ('editor','admin','owner')
      )
    )
    or
    (
      e.owner_context_type = 'individual'
      and e.owner_context_id = u.id
    )
  ) as can_post
from auth.users u cross join public.events e;

-- 7) Helper Functions (for RLS & permissions)
create or replace function public.is_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role::text = any (p_roles)
  );
$$;

create or replace function public.is_event_individual_owner(p_event_id uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_context_type = 'individual'
      and e.owner_context_id = auth.uid()
  );
$$;

create or replace function public.is_event_org_editor(p_event_id uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_context_type = 'organization'
      and public.is_org_role(e.owner_context_id, array['editor','admin','owner'])
  );
$$;

create or replace function public.is_event_manager(p_event_id uuid)
returns boolean
language sql stable as $$
  select public.is_event_individual_owner(p_event_id) or public.is_event_org_editor(p_event_id);
$$;

create or replace function public.can_current_user_post(p_event_id uuid)
returns boolean
language sql stable as $$
  select
    public.is_event_manager(p_event_id)
    or exists (
      select 1
      from public.tickets t
      where t.event_id = p_event_id
        and t.owner_user_id = auth.uid()
        and t.status in ('issued','transferred','redeemed')
    );
$$;

-- 8) Enable RLS & Core Policies
alter table public.user_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.refunds enable row level security;
alter table public.event_posts enable row level security;
alter table public.event_comments enable row level security;
alter table public.event_reactions enable row level security;
alter table public.payout_accounts enable row level security;

-- Profiles
create policy user_profiles_read_all
  on public.user_profiles for select using (true);

create policy user_profiles_update_self
  on public.user_profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_profiles_insert_self
  on public.user_profiles for insert with check (auth.uid() = user_id);

-- Orgs & Memberships
create policy orgs_read_all
  on public.organizations for select using (true);

create policy orgs_insert_auth
  on public.organizations for insert with check (auth.role() = 'authenticated');

create policy orgs_update_admin
  on public.organizations for update
  using (public.is_org_role(id, array['admin','owner']))
  with check (public.is_org_role(id, array['admin','owner']));

create policy orgs_delete_owner
  on public.organizations for delete using (public.is_org_role(id, array['owner']));

create policy org_memberships_read_self
  on public.org_memberships for select
  using (user_id = auth.uid() or public.is_org_role(org_id, array['admin','owner']));

create policy org_memberships_write_admin
  on public.org_memberships for all
  using (public.is_org_role(org_id, array['admin','owner']))
  with check (public.is_org_role(org_id, array['admin','owner']));

-- Events
create policy events_read_public_or_manager
  on public.events for select
  using (
    visibility = 'public'
    or public.is_event_manager(id)
    or (owner_context_type = 'organization' and public.is_org_role(owner_context_id, array['viewer','editor','admin','owner']))
  );

create policy events_insert_owner_or_editor
  on public.events for insert
  with check (
    (owner_context_type = 'individual' and owner_context_id = auth.uid())
    or (owner_context_type = 'organization' and public.is_org_role(owner_context_id, array['editor','admin','owner']))
  );

create policy events_update_owner_or_editor
  on public.events for update
  using (public.is_event_manager(id))
  with check (public.is_event_manager(id));

-- Ticket tiers (creator controls)
create policy tiers_read_public
  on public.ticket_tiers for select
  using (exists (select 1 from public.events e where e.id = event_id and (e.visibility='public' or public.is_event_manager(e.id))));

create policy tiers_write_manager
  on public.ticket_tiers for all
  using (public.is_event_manager(event_id)) with check (public.is_event_manager(event_id));

-- Orders/Items/Tickets/Refunds (reads limited; writes via service role only)
create policy orders_select_owner_or_manager
  on public.orders for select
  using (user_id = auth.uid() or public.is_event_manager(event_id));

create policy order_items_select_owner_or_manager
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_event_manager(o.event_id))));

create policy tickets_select_owner_or_manager
  on public.tickets for select
  using (owner_user_id = auth.uid() or public.is_event_manager(event_id));

create policy refunds_select_owner_or_manager
  on public.refunds for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_event_manager(o.event_id))));

-- Posts (ticket-gated creation)
create policy posts_read_public
  on public.event_posts for select
  using (exists (select 1 from public.events e where e.id = event_id and (e.visibility='public' or public.is_event_manager(e.id))));

create policy posts_insert_ticket_or_org
  on public.event_posts for insert
  with check (public.can_current_user_post(event_id));

create policy posts_update_author_or_admin
  on public.event_posts for update
  using (author_user_id = auth.uid() or public.is_event_manager(event_id))
  with check (author_user_id = auth.uid() or public.is_event_manager(event_id));

create policy posts_delete_author_or_admin
  on public.event_posts for delete
  using (author_user_id = auth.uid() or public.is_event_manager(event_id));

-- Comments/Reactions
create policy comments_select_public
  on public.event_comments for select
  using (exists (select 1 from public.event_posts p where p.id = post_id));

create policy comments_insert_any_auth
  on public.event_comments for insert
  with check (auth.role() = 'authenticated');

create policy comments_update_author_or_admin
  on public.event_comments for update
  using (
    author_user_id = auth.uid()
    or exists (select 1 from public.event_posts p where p.id = post_id and public.is_event_manager(p.event_id))
  )
  with check (
    author_user_id = auth.uid()
    or exists (select 1 from public.event_posts p where p.id = post_id and public.is_event_manager(p.event_id))
  );

create policy comments_delete_author_or_admin
  on public.event_comments for delete
  using (
    author_user_id = auth.uid()
    or exists (select 1 from public.event_posts p where p.id = post_id and public.is_event_manager(p.event_id))
  );

-- Payout accounts (self or org admin)
create policy payout_accounts_select_self
  on public.payout_accounts for select
  using (
    (context_type='individual' and context_id = auth.uid())
    or (context_type='organization' and public.is_org_role(context_id, array['admin','owner']))
  );

-- 9) Safety Triggers (no delete if sold; no price change after sales)
create or replace function public.trg_block_tier_delete_if_tickets()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.tickets t where t.tier_id = old.id) then
    raise exception 'Cannot delete tier with existing tickets';
  end if;
  return old;
end; $$;

drop trigger if exists block_delete_sold_tier on public.ticket_tiers;
create trigger block_delete_sold_tier
  before delete on public.ticket_tiers
  for each row execute function public.trg_block_tier_delete_if_tickets();

create or replace function public.trg_block_tier_price_change_after_sale()
returns trigger language plpgsql as $$
begin
  if new.price_cents <> old.price_cents then
    if exists (select 1 from public.tickets t where t.tier_id = old.id) then
      raise exception 'Price cannot change after sales; create a new tier';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists block_price_change_after_sale on public.ticket_tiers;
create trigger block_price_change_after_sale
  before update on public.ticket_tiers
  for each row execute function public.trg_block_tier_price_change_after_sale();