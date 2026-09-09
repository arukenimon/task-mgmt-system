-- Deliveries are claimed with a short lease so simultaneous Server Action
-- callbacks and the cron worker cannot send the same outbox item twice.
alter table public.email_outbox
  add column delivery_lease_id uuid,
  add column lease_expires_at timestamptz,
  add constraint email_outbox_delivery_lease_pair_check
    check ((delivery_lease_id is null) = (lease_expires_at is null));

create index email_outbox_claimable_idx
  on public.email_outbox (send_after, lease_expires_at, created_at)
  where delivery_status = 'pending';

create function public.claim_email_outbox(p_limit integer, p_lease_id uuid)
returns table (
  id uuid,
  recipient text,
  subject text,
  html text,
  attempts integer,
  delivery_lease_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'The email outbox claim limit must be between 1 and 50.';
  end if;
  if p_lease_id is null then
    raise exception 'An email outbox lease id is required.';
  end if;

  return query
  with claimable as (
    select outbox.id
    from public.email_outbox outbox
    where outbox.delivery_status = 'pending'
      and outbox.send_after <= clock_timestamp()
      and (outbox.lease_expires_at is null or outbox.lease_expires_at <= clock_timestamp())
    order by outbox.created_at asc
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.email_outbox outbox
    set
      delivery_lease_id = p_lease_id,
      lease_expires_at = clock_timestamp() + interval '5 minutes'
    from claimable
    where outbox.id = claimable.id
    returning outbox.id, outbox.recipient, outbox.subject, outbox.html, outbox.attempts, outbox.delivery_lease_id, outbox.created_at
  )
  select claimed.id, claimed.recipient, claimed.subject, claimed.html, claimed.attempts, claimed.delivery_lease_id
  from claimed
  order by claimed.created_at asc;
end;
$$;

revoke all on function public.claim_email_outbox(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer, uuid) to service_role;

create or replace function private.email_html(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

create or replace function private.email_subject(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(value, '[\r\n]+', ' ', 'g')
$$;

-- Assignment records are the single source of assignment mail. They are
-- created by both allocation and reassignment flows, and only active people
-- can receive them.
create or replace function private.enqueue_task_assignee_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_email text;
  recipient_name text;
  client_name text;
  task_title text;
  task_due_date date;
begin
  select profile.email, profile.full_name
  into recipient_email, recipient_name
  from public.profiles profile
  where profile.id = new.profile_id and profile.is_active;

  if not found then
    return new;
  end if;

  select task.title, task.due_date, client.name
  into task_title, task_due_date, client_name
  from public.tasks task
  join public.clients client on client.id = task.client_id
  where task.id = new.task_id;

  insert into public.email_outbox (dedupe_key, recipient, subject, html)
  values (
    'assignment:' || new.task_id::text || ':' || new.profile_id::text || ':' || new.assigned_at::text,
    recipient_email,
    'New task: ' || private.email_subject(task_title),
    '<h1>New task assigned</h1><p>Hello ' || private.email_html(recipient_name) || ',</p><p><strong>' || private.email_html(task_title) || '</strong></p><p>Client: ' || private.email_html(client_name) || '<br>Due: ' || private.email_html(task_due_date::text) || '</p>'
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create or replace function private.enqueue_task_escalation_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_title text;
  client_name text;
  details_html text := '';
begin
  if new.status is distinct from old.status and new.status = 'complete' then
    select task.title, client.name
    into task_title, client_name
    from public.tasks task
    join public.clients client on client.id = task.client_id
    where task.id = new.id;

    insert into public.email_outbox (dedupe_key, recipient, subject, html)
    select
      'completion:' || new.id::text || ':' || profile.id::text || ':' || new.updated_at::text,
      profile.email,
      'Task complete: ' || private.email_subject(task_title),
      '<h1>Task complete</h1><p>Hello ' || private.email_html(profile.full_name) || ',</p><p><strong>' || private.email_html(task_title) || '</strong> for ' || private.email_html(client_name) || ' has been marked complete.</p>'
    from public.profiles profile
    where profile.id = new.created_by_id and profile.is_active
    on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if new.due_date < old.due_date then
    details_html := details_html || '<li>Deadline moved earlier to <strong>' || private.email_html(new.due_date::text) || '</strong></li>';
  end if;
  if old.priority is distinct from 'urgent' and new.priority = 'urgent' then
    details_html := details_html || '<li>Priority is now <strong>Urgent</strong></li>';
  end if;
  if new.status is distinct from old.status and new.status = 'blocked' then
    details_html := details_html || '<li>The task is now <strong>Blocked</strong></li>';
  end if;

  if details_html = '' then
    return new;
  end if;

  select task.title, client.name
  into task_title, client_name
  from public.tasks task
  join public.clients client on client.id = task.client_id
  where task.id = new.id;

  insert into public.email_outbox (dedupe_key, recipient, subject, html)
  with recipients as (
    select profile.id, profile.email, profile.full_name
    from public.task_assignees assignee
    join public.profiles profile on profile.id = assignee.profile_id
    where assignee.task_id = new.id and profile.is_active

    union

    select profile.id, profile.email, profile.full_name
    from public.profiles profile
    where new.status is distinct from old.status
      and new.status = 'blocked'
      and profile.id = new.created_by_id
      and profile.is_active
  )
  select
    'escalation:' || new.id::text || ':' || recipient_profile.id::text || ':' || new.due_date::text || ':' || new.priority::text || ':' || new.status::text || ':' || new.updated_at::text,
    recipient_profile.email,
    'Task needs attention: ' || private.email_subject(task_title),
    '<h1>Task needs attention</h1><p>Hello ' || private.email_html(recipient_profile.full_name) || ',</p><p><strong>' || private.email_html(task_title) || '</strong> for ' || private.email_html(client_name) || ' has changed.</p><ul>' || details_html || '</ul>'
  from recipients recipient_profile
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists queue_task_escalation_email on public.tasks;
create constraint trigger queue_task_escalation_email
after update on public.tasks
deferrable initially deferred
for each row
execute function private.enqueue_task_escalation_email();
