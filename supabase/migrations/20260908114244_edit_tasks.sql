create function public.update_task(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_client_id uuid,
  p_team_id uuid,
  p_assignee_ids uuid[],
  p_priority public.task_priority,
  p_due_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_team_id uuid;
  current_client_id uuid;
begin
  select task.team_id, task.client_id
  into current_team_id, current_client_id
  from public.tasks task
  where task.id = p_task_id;

  if not found then
    raise exception 'Task not found or not available to this account.';
  end if;

  if not private.can_manage_team(current_team_id) or not private.can_manage_team(p_team_id) then
    raise exception 'Only managers can edit tasks for this team.';
  end if;

  if coalesce(cardinality(p_assignee_ids), 0) = 0 then
    raise exception 'Select at least one active team member.';
  end if;

  if cardinality(p_assignee_ids) <> (select count(distinct assignee.profile_id) from unnest(p_assignee_ids) as assignee(profile_id)) then
    raise exception 'Each assignee can be selected only once.';
  end if;

  if not exists (
    select 1
    from public.clients client
    where client.id = p_client_id
      and (client.is_active or client.id = current_client_id)
  ) then
    raise exception 'Select an active client.';
  end if;

  if (select count(*) from public.profiles profile where profile.id = any(p_assignee_ids) and profile.role = 'team_member' and profile.team_id = p_team_id and profile.is_active) <> cardinality(p_assignee_ids) then
    raise exception 'Every assignee must be an active member of the selected team.';
  end if;

  update public.tasks task
  set
    title = p_title,
    description = p_description,
    client_id = p_client_id,
    team_id = p_team_id,
    owner_id = p_assignee_ids[1],
    priority = p_priority,
    due_date = p_due_date
  where task.id = p_task_id;

  delete from public.task_assignees assignee
  where assignee.task_id = p_task_id
    and not (assignee.profile_id = any(p_assignee_ids));

  insert into public.task_assignees (task_id, profile_id)
  select p_task_id, assignee.profile_id
  from unnest(p_assignee_ids) as assignee(profile_id)
  on conflict (task_id, profile_id) do nothing;
end;
$$;

grant execute on function public.update_task(uuid, text, text, uuid, uuid, uuid[], public.task_priority, date) to authenticated;
