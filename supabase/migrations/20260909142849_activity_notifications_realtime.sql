alter type public.task_event_type add value if not exists 'updated';
alter type public.task_event_type add value if not exists 'unassigned';

create type public.in_app_notification_type as enum (
  'task_assigned',
  'task_unassigned',
  'task_updated',
  'task_status_changed',
  'task_completed'
);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete cascade,
  activity_id uuid not null references public.task_activity(id) on delete cascade,
  notification_type public.in_app_notification_type not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, activity_id),
  check ((is_read and read_at is not null) or (not is_read and read_at is null))
);

create index user_notifications_recipient_created_idx
  on public.user_notifications (recipient_id, created_at desc, id desc);

create index user_notifications_unread_idx
  on public.user_notifications (recipient_id, created_at desc, id desc)
  where not is_read;

alter table public.user_notifications enable row level security;
alter table public.task_activity replica identity full;
alter table public.user_notifications replica identity full;

revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
grant update (is_read, read_at) on public.user_notifications to authenticated;

create policy "users can read their own in-app notifications"
on public.user_notifications for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "users can mark their own notifications read"
on public.user_notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create or replace function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := coalesce(auth.uid(), new.created_by_id);
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, actor_id, event_type, summary)
    values (new.id, acting_user_id, 'created', 'Task created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, actor_id, event_type, summary, metadata)
    values (
      new.id,
      acting_user_id,
      (case when new.status = 'complete' then 'completed' else 'status_changed' end)::public.task_event_type,
      'Status changed to ' || new.status::text,
      jsonb_build_object('status', new.status)
    );
  end if;

  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.client_id is distinct from old.client_id
    or new.team_id is distinct from old.team_id
    or new.priority is distinct from old.priority
    or new.due_date is distinct from old.due_date then
    insert into public.task_activity (task_id, actor_id, event_type, summary, metadata)
    values (
      new.id,
      acting_user_id,
      'updated',
      'Task details updated',
      jsonb_build_object(
        'title_changed', new.title is distinct from old.title,
        'description_changed', new.description is distinct from old.description,
        'client_changed', new.client_id is distinct from old.client_id,
        'team_changed', new.team_id is distinct from old.team_id,
        'priority_changed', new.priority is distinct from old.priority,
        'due_date_changed', new.due_date is distinct from old.due_date
      )
    );
  end if;

  return new;
end;
$$;

create or replace function private.log_task_assignee_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_task_id uuid;
  affected_profile_id uuid;
  acting_user_id uuid;
begin
  if tg_op = 'INSERT' then
    affected_task_id := new.task_id;
    affected_profile_id := new.profile_id;
  else
    affected_task_id := old.task_id;
    affected_profile_id := old.profile_id;
  end if;

  select coalesce(auth.uid(), task.created_by_id)
  into acting_user_id
  from public.tasks task
  where task.id = affected_task_id;

  -- A cascading task deletion removes assignees after the parent row is no
  -- longer readable. The task and its activity are being deleted together, so
  -- there is no durable event to create in that case.
  if acting_user_id is null then
    return coalesce(new, old);
  end if;

  insert into public.task_activity (task_id, actor_id, event_type, summary, metadata)
  values (
    affected_task_id,
    acting_user_id,
    (case when tg_op = 'INSERT' then 'assigned' else 'unassigned' end)::public.task_event_type,
    case when tg_op = 'INSERT' then 'Task assigned' else 'Task unassigned' end,
    jsonb_build_object('profile_id', affected_profile_id)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists log_task_assignee_activity on public.task_assignees;
create trigger log_task_assignee_activity
after insert or delete on public.task_assignees
for each row execute function private.log_task_assignee_activity();

create or replace function private.create_in_app_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_kind public.in_app_notification_type;
  task_title text;
  target_profile_id uuid;
begin
  if new.event_type = 'created' then
    return new;
  end if;

  select task.title into task_title
  from public.tasks task
  where task.id = new.task_id;

  notification_kind := case new.event_type
    when 'assigned' then 'task_assigned'
    when 'unassigned' then 'task_unassigned'
    when 'updated' then 'task_updated'
    when 'completed' then 'task_completed'
    else 'task_status_changed'
  end;

  if new.event_type in ('assigned', 'unassigned') then
    target_profile_id := nullif(new.metadata ->> 'profile_id', '')::uuid;

    insert into public.user_notifications (
      recipient_id,
      actor_id,
      task_id,
      activity_id,
      notification_type,
      title,
      body
    )
    select
      profile.id,
      new.actor_id,
      new.task_id,
      new.id,
      notification_kind,
      task_title,
      new.summary
    from public.profiles profile
    where profile.id = target_profile_id
      and profile.is_active
      and profile.id <> new.actor_id
    on conflict (recipient_id, activity_id) do nothing;

    return new;
  end if;

  insert into public.user_notifications (
    recipient_id,
    actor_id,
    task_id,
    activity_id,
    notification_type,
    title,
    body
  )
  with recipients as (
    select task.created_by_id as profile_id
    from public.tasks task
    where task.id = new.task_id

    union

    select assignee.profile_id
    from public.task_assignees assignee
    where assignee.task_id = new.task_id
  )
  select
    profile.id,
    new.actor_id,
    new.task_id,
    new.id,
    notification_kind,
    task_title,
    new.summary
  from recipients recipient
  join public.profiles profile on profile.id = recipient.profile_id
  where profile.is_active
    and profile.id <> new.actor_id
  on conflict (recipient_id, activity_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_in_app_notifications on public.task_activity;
create trigger create_in_app_notifications
after insert on public.task_activity
for each row execute function private.create_in_app_notifications();

alter publication supabase_realtime add table public.task_activity;
alter publication supabase_realtime add table public.user_notifications;
