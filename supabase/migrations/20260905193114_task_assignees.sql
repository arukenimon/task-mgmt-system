create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);

create index task_assignees_profile_task_idx on public.task_assignees (profile_id, task_id);

-- Preserve every existing assignment while moving from the legacy single-owner
-- field to the join table. `owner_id` remains as the task's primary assignee
-- for backwards-compatible data access.
insert into public.task_assignees (task_id, profile_id)
select id, owner_id from public.tasks;

alter table public.task_assignees enable row level security;

grant select, insert, delete on public.task_assignees to authenticated;

create policy "users can read assignees for visible tasks"
on public.task_assignees for select to authenticated
using (
  exists (
    select 1 from public.tasks task
    where task.id = task_id and private.can_read_team(task.team_id)
  )
);

create policy "managers assign active team members"
on public.task_assignees for insert to authenticated
with check (
  exists (
    select 1
    from public.tasks task
    join public.profiles profile on profile.id = profile_id
    where task.id = task_id
      and private.can_manage_team(task.team_id)
      and profile.role = 'team_member'
      and profile.team_id = task.team_id
      and profile.is_active
  )
);

create policy "managers remove task assignees"
on public.task_assignees for delete to authenticated
using (
  exists (
    select 1 from public.tasks task
    where task.id = task_id and private.can_manage_team(task.team_id)
  )
);

drop policy "managers or owners update tasks" on public.tasks;

create policy "managers or assignees update tasks"
on public.tasks for update to authenticated
using (
  private.can_manage_team(team_id)
  or exists (
    select 1 from public.task_assignees assignee
    where assignee.task_id = id and assignee.profile_id = (select auth.uid())
  )
)
with check (
  private.can_manage_team(team_id)
  or (
    team_id = private.current_team_id()
    and exists (
      select 1 from public.task_assignees assignee
      where assignee.task_id = id and assignee.profile_id = (select auth.uid())
    )
  )
);

drop trigger queue_assignment_email on public.tasks;
drop function private.enqueue_assignment_email();

create function private.log_task_assignee_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.task_activity (task_id, actor_id, event_type, summary, metadata)
  values (
    new.task_id,
    (select coalesce(auth.uid(), task.created_by_id) from public.tasks task where task.id = new.task_id),
    'assigned',
    'Task assigned',
    jsonb_build_object('profile_id', new.profile_id)
  );
  return new;
end;
$$;

create function private.enqueue_task_assignee_email()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  recipient_email text;
  client_name text;
  task_title text;
  task_due_date date;
begin
  select profile.email into recipient_email from public.profiles profile where profile.id = new.profile_id;
  select task.title, task.due_date, client.name
  into task_title, task_due_date, client_name
  from public.tasks task
  join public.clients client on client.id = task.client_id
  where task.id = new.task_id;

  insert into public.email_outbox (dedupe_key, recipient, subject, html)
  values (
    'assignment:' || new.task_id::text || ':' || new.profile_id::text || ':' || new.assigned_at::text,
    recipient_email,
    'New task: ' || task_title,
    '<h1>New task assigned</h1><p><strong>' || task_title || '</strong></p><p>Client: ' || client_name || '<br>Due: ' || task_due_date::text || '</p>'
  );
  return new;
end;
$$;

create trigger log_task_assignee_activity
after insert on public.task_assignees
for each row execute function private.log_task_assignee_activity();

create trigger queue_task_assignee_email
after insert on public.task_assignees
for each row execute function private.enqueue_task_assignee_email();

create function private.ensure_task_owner_is_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_assignees (task_id, profile_id)
  values (new.id, new.owner_id)
  on conflict (task_id, profile_id) do nothing;
  return new;
end;
$$;

create trigger ensure_task_owner_is_assigned
after insert or update of owner_id on public.tasks
for each row execute function private.ensure_task_owner_is_assigned();

create function public.allocate_task(
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
