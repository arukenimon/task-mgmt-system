-- Email invitation and recovery sessions may set a password, but they must not
-- satisfy RLS. Only a fresh email-and-password session can access application data.
create function private.password_authenticated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'amr') @> '[{"method":"password"}]'::jsonb,
    false
  )
$$;

revoke all on function private.password_authenticated() from public;
grant execute on function private.password_authenticated() to authenticated;

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
    and private.password_authenticated()
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
    and private.password_authenticated()
$$;

create or replace function public.update_own_profile_name(new_full_name text, new_initials text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.password_authenticated() then
    raise exception 'Password authentication required';
  end if;

  if char_length(trim(new_full_name)) < 2 or char_length(trim(new_full_name)) > 80 then
    raise exception 'Full name must contain between 2 and 80 characters';
  end if;

  if char_length(trim(new_initials)) < 1 or char_length(trim(new_initials)) > 4 then
    raise exception 'Initials must contain between 1 and 4 characters';
  end if;

  update public.profiles
  set full_name = trim(new_full_name),
      initials = upper(trim(new_initials))
  where id = (select auth.uid())
    and is_active;

  if not found then
    raise exception 'Active profile not found';
  end if;
end;
$$;

revoke all on function public.update_own_profile_name(text, text) from public;
grant execute on function public.update_own_profile_name(text, text) to authenticated;
