create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('senior_director', 'account_director', 'team_member');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'complete');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_event_type as enum ('created', 'assigned', 'status_changed', 'completed');
create type public.email_delivery_status as enum ('pending', 'sent', 'failed');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  initials text not null check (char_length(initials) between 1 and 4),
  role public.app_role not null,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'senior_director' and team_id is null) or (role <> 'senior_director' and team_id is not null))
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_lead_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '',
  client_id uuid not null references public.clients(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_by_id uuid not null references public.profiles(id) on delete restrict,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'complete' and completed_at is not null) or (status <> 'complete' and completed_at is null))
);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type public.task_event_type not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  recipient text not null,
  subject text not null,
  html text not null,
  delivery_status public.email_delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_team_status_due_idx on public.tasks (team_id, status, due_date);
create index tasks_owner_status_due_idx on public.tasks (owner_id, status, due_date);
create index tasks_client_due_idx on public.tasks (client_id, due_date);
create index task_activity_task_created_idx on public.task_activity (task_id, created_at desc);
create index email_outbox_pending_idx on public.email_outbox (delivery_status, send_after) where delivery_status = 'pending';

create function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger set_clients_updated_at before update on public.clients for each row execute function private.set_updated_at();
create trigger set_tasks_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger set_outbox_updated_at before update on public.email_outbox for each row execute function private.set_updated_at();

create function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create function private.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_id from public.profiles p where p.id = (select auth.uid())
$$;

create function private.is_senior_director()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() = 'senior_director', false)
$$;

create function private.can_read_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_senior_director() or private.current_team_id() = target_team_id
$$;

create function private.can_manage_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_senior_director()
    or (private.current_role() = 'account_director' and private.current_team_id() = target_team_id)
$$;

create function private.owner_belongs_to_team(target_owner_id uuid, target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_owner_id and p.team_id = target_team_id and p.role = 'team_member'
  )
$$;

create function private.guard_task_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if private.current_role() = 'team_member' then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.client_id is distinct from old.client_id
      or new.team_id is distinct from old.team_id
      or new.owner_id is distinct from old.owner_id
      or new.created_by_id is distinct from old.created_by_id
      or new.priority is distinct from old.priority
      or new.due_date is distinct from old.due_date then
      raise exception 'Team members can only update their task status';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_task_updates before update on public.tasks for each row execute function private.guard_task_update();

create function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  acting_user_id uuid := coalesce(auth.uid(), new.created_by_id);
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, actor_id, event_type, summary)
    values (new.id, acting_user_id, 'created', 'Task created');
  elsif new.owner_id is distinct from old.owner_id then
    insert into public.task_activity (task_id, actor_id, event_type, summary)
    values (new.id, acting_user_id, 'assigned', 'Task owner changed');
  elsif new.status is distinct from old.status then
    insert into public.task_activity (task_id, actor_id, event_type, summary, metadata)
    values (new.id, acting_user_id, case when new.status = 'complete' then 'completed' else 'status_changed' end, 'Status changed to ' || new.status::text, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

create trigger log_task_activity after insert or update on public.tasks for each row execute function private.log_task_activity();

create function private.enqueue_assignment_email()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  recipient_email text;
  client_name text;
begin
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    select p.email into recipient_email from public.profiles p where p.id = new.owner_id;
    select c.name into client_name from public.clients c where c.id = new.client_id;
    insert into public.email_outbox (dedupe_key, recipient, subject, html)
    values (
      'assignment:' || new.id::text || ':' || new.owner_id::text || ':' || new.updated_at::text,
      recipient_email,
      'New task: ' || new.title,
      '<h1>New task assigned</h1><p><strong>' || new.title || '</strong></p><p>Client: ' || client_name || '<br>Due: ' || new.due_date::text || '</p>'
    );
  end if;
  return new;
end;
$$;

create trigger queue_assignment_email after insert or update of owner_id on public.tasks for each row execute function private.enqueue_assignment_email();

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activity enable row level security;
alter table public.email_outbox enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

grant select on public.teams, public.profiles, public.clients, public.tasks, public.task_activity to authenticated;
grant insert, update, delete on public.clients to authenticated;
grant insert, update, delete on public.tasks to authenticated;

create policy "signed-in users can read teams"
on public.teams for select to authenticated using (true);

create policy "users can read relevant profiles"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_senior_director() or (team_id is not null and private.can_read_team(team_id)));

create policy "signed-in users can read clients"
on public.clients for select to authenticated using (true);

create policy "senior director manages clients"
on public.clients for all to authenticated
using (private.is_senior_director()) with check (private.is_senior_director());

create policy "users can read team tasks"
on public.tasks for select to authenticated
using (private.can_read_team(team_id));

create policy "managers allocate team tasks"
on public.tasks for insert to authenticated
with check (private.can_manage_team(team_id) and private.owner_belongs_to_team(owner_id, team_id) and created_by_id = (select auth.uid()));

create policy "managers or owners update tasks"
on public.tasks for update to authenticated
using (private.can_manage_team(team_id) or (owner_id = (select auth.uid()) and private.can_read_team(team_id)))
with check (private.can_manage_team(team_id) or (owner_id = (select auth.uid()) and team_id = private.current_team_id()));

create policy "senior director deletes tasks"
on public.tasks for delete to authenticated using (private.is_senior_director());

create policy "users can read activity for visible tasks"
on public.task_activity for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_id and private.can_read_team(t.team_id)));
