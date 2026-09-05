create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index task_attachments_task_created_idx on public.task_attachments (task_id, created_at);

alter table public.task_attachments enable row level security;

grant select, insert, delete on public.task_attachments to authenticated;

create policy "users can read attachments for visible tasks"
on public.task_attachments for select to authenticated
using (
  exists (
    select 1
    from public.tasks task
    where task.id = task_id
      and private.can_read_team(task.team_id)
  )
);

create policy "managers add attachments to managed tasks"
on public.task_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.tasks task
    where task.id = task_id
      and private.can_manage_team(task.team_id)
  )
);

create policy "managers remove attachments from managed tasks"
on public.task_attachments for delete to authenticated
using (
  exists (
    select 1
    from public.tasks task
    where task.id = task_id
      and private.can_manage_team(task.team_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function private.task_attachment_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  task_id_text text := split_part(object_name, '/', 1);
begin
  if task_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return task_id_text::uuid;
  end if;
  return null;
end;
$$;

create function private.can_read_task_attachment_storage_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks task
    where task.id = private.task_attachment_id_from_storage_path(object_name)
      and private.can_read_team(task.team_id)
  )
$$;

create function private.can_manage_task_attachment_storage_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks task
    where task.id = private.task_attachment_id_from_storage_path(object_name)
      and private.can_manage_team(task.team_id)
  )
$$;

revoke all on function private.task_attachment_id_from_storage_path(text) from public;
revoke all on function private.can_read_task_attachment_storage_path(text) from public;
revoke all on function private.can_manage_task_attachment_storage_path(text) from public;
grant execute on function private.task_attachment_id_from_storage_path(text) to authenticated;
grant execute on function private.can_read_task_attachment_storage_path(text) to authenticated;
grant execute on function private.can_manage_task_attachment_storage_path(text) to authenticated;

create policy "users read task attachment objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'task-attachments'
  and private.can_read_task_attachment_storage_path(name)
);

create policy "managers upload task attachment objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'task-attachments'
  and private.can_manage_task_attachment_storage_path(name)
);

create policy "managers delete task attachment objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and private.can_manage_task_attachment_storage_path(name)
);
