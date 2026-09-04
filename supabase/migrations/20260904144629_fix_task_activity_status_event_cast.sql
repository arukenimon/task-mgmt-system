create or replace function private.log_task_activity()
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
    values (
      new.id,
      acting_user_id,
      (case when new.status = 'complete' then 'completed' else 'status_changed' end)::public.task_event_type,
      'Status changed to ' || new.status::text,
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;
