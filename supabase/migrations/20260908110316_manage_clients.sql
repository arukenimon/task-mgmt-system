alter table public.clients
add column if not exists is_active boolean not null default true;

create index if not exists clients_active_name_idx on public.clients (is_active, name);

drop policy if exists "senior director manages clients" on public.clients;

create policy "senior directors create clients"
on public.clients for insert to authenticated
with check (private.is_senior_director());

create policy "senior directors update clients"
on public.clients for update to authenticated
using (private.is_senior_director())
with check (private.is_senior_director());

revoke delete on public.clients from authenticated;

create or replace function public.allocate_task(
  p_title text,
  p_description text,
  p_client_id uuid,
  p_team_id uuid,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_due_date date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_task_id uuid;
begin
  if coalesce(cardinality(p_assignee_ids), 0) = 0 then
    raise exception 'Select at least one active team member.';
  end if;
  if cardinality(p_assignee_ids) <> (select count(distinct profile_id) from unnest(p_assignee_ids) as assignee(profile_id)) then
    raise exception 'Each assignee can be selected only once.';
  end if;
  if not private.can_manage_team(p_team_id) then
    raise exception 'Only managers can allocate tasks for this team.';
  end if;
  if not exists (select 1 from public.clients client where client.id = p_client_id and client.is_active) then
    raise exception 'Select an active client.';
  end if;
  if (select count(*) from public.profiles profile where profile.id = any(p_assignee_ids) and profile.role = 'team_member' and profile.team_id = p_team_id and profile.is_active) <> cardinality(p_assignee_ids) then
    raise exception 'Every assignee must be an active member of the selected team.';
  end if;

  insert into public.tasks (title, description, client_id, team_id, owner_id, created_by_id, priority, due_date)
  values (p_title, p_description, p_client_id, p_team_id, p_assignee_ids[1], (select auth.uid()), p_priority, p_due_date)
  returning id into new_task_id;

  insert into public.task_assignees (task_id, profile_id)
  select new_task_id, assignee.profile_id from unnest(p_assignee_ids) as assignee(profile_id)
  on conflict (task_id, profile_id) do nothing;

  return new_task_id;
end;
$$;

grant execute on function public.allocate_task(text, text, uuid, uuid, uuid[], public.task_priority, date) to authenticated;
