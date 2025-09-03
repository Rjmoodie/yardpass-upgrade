-- Fix security issues detected by linter

-- 1. Fix function search paths for security
create or replace function public.is_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql stable 
set search_path = public
as $$
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
language sql stable 
set search_path = public
as $$
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
language sql stable 
set search_path = public
as $$
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
language sql stable 
set search_path = public
as $$
  select public.is_event_individual_owner(p_event_id) or public.is_event_org_editor(p_event_id);
$$;

create or replace function public.can_current_user_post(p_event_id uuid)
returns boolean
language sql stable 
set search_path = public
as $$
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

create or replace function public.trg_block_tier_delete_if_tickets()
returns trigger 
language plpgsql 
set search_path = public
as $$
begin
  if exists (select 1 from public.tickets t where t.tier_id = old.id) then
    raise exception 'Cannot delete tier with existing tickets';
  end if;
  return old;
end; $$;

create or replace function public.trg_block_tier_price_change_after_sale()
returns trigger 
language plpgsql 
set search_path = public
as $$
begin
  if new.price_cents <> old.price_cents then
    if exists (select 1 from public.tickets t where t.tier_id = old.id) then
      raise exception 'Price cannot change after sales; create a new tier';
    end if;
  end if;
  return new;
end; $$;

-- 2. Enable RLS on cultural_guides table (missing policies)
create policy cultural_guides_select_with_event
  on public.cultural_guides for select
  using (exists (select 1 from public.events e where e.id = event_id and (e.visibility='public' or public.is_event_manager(e.id))));

create policy cultural_guides_write_manager
  on public.cultural_guides for all
  using (exists (select 1 from public.events e where e.id = event_id and public.is_event_manager(e.id)))
  with check (exists (select 1 from public.events e where e.id = event_id and public.is_event_manager(e.id)));

-- 3. Add missing policies for event_reactions table
create policy event_reactions_select_public
  on public.event_reactions for select
  using (exists (select 1 from public.event_posts p where p.id = post_id));

create policy event_reactions_insert_auth
  on public.event_reactions for insert
  with check (auth.role() = 'authenticated');

create policy event_reactions_delete_self
  on public.event_reactions for delete
  using (user_id = auth.uid());