alter table public.profiles
add column is_active boolean not null default true;

create index profiles_team_active_idx on public.profiles (team_id, is_active);

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
$$;

create or replace function private.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
$$;

create or replace function private.owner_belongs_to_team(target_owner_id uuid, target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_owner_id
      and p.team_id = target_team_id
      and p.role = 'team_member'
      and p.is_active
  )
$$;

grant insert on public.teams to authenticated;
grant update on public.profiles to authenticated;

drop policy "signed-in users can read teams" on public.teams;
create policy "active users can read teams"
on public.teams for select to authenticated
using (private.current_role() is not null);

create policy "senior directors create teams"
on public.teams for insert to authenticated
with check (private.is_senior_director());

drop policy "users can read relevant profiles" on public.profiles;
create policy "active users can read relevant profiles"
on public.profiles for select to authenticated
using (
  private.current_role() is not null
  and (
    id = (select auth.uid())
    or private.is_senior_director()
    or (team_id is not null and private.can_read_team(team_id))
  )
);

create policy "senior directors update other profiles"
on public.profiles for update to authenticated
using (private.is_senior_director() and id <> (select auth.uid()))
with check (private.is_senior_director() and id <> (select auth.uid()));

drop policy "signed-in users can read clients" on public.clients;
create policy "active users can read clients"
on public.clients for select to authenticated
using (private.current_role() is not null);
