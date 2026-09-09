begin;

select plan(14);

select ok((select relrowsecurity from pg_class where oid = 'public.user_notifications'::regclass), 'in-app notifications has RLS enabled');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_activity'), 'task activity is published to Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_notifications'), 'in-app notifications are published to Realtime');

set local role authenticated;
select set_config('request.jwt.claims', '{"amr":[{"method":"password"}]}', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);

select ok((select count(*) from public.user_notifications) > 0, 'an assignee can read their in-app notifications');
select is(
  (select count(*) from public.user_notifications where recipient_id <> '20000000-0000-0000-0000-000000000004'::uuid),
  0::bigint,
  'an assignee cannot read another user''s notifications'
);
select throws_ok(
  $$update public.user_notifications set title = 'Not allowed' where recipient_id = '20000000-0000-0000-0000-000000000004'$$,
  '42501',
  'permission denied for table user_notifications',
  'users cannot modify notification content'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$update public.tasks set priority = 'medium' where id = '40000000-0000-0000-0000-000000000001'$$,
  'a manager task edit succeeds'
);
select ok(
  exists (
    select 1 from public.task_activity
    where task_id = '40000000-0000-0000-0000-000000000001'
      and event_type = 'updated'
  ),
  'task edits are written to the activity log'
);
select lives_ok(
  $$delete from public.task_assignees where task_id = '40000000-0000-0000-0000-000000000001' and profile_id = '20000000-0000-0000-0000-000000000004'$$,
  'a manager can remove an assignee'
);
select ok(
  exists (
    select 1 from public.task_activity
    where task_id = '40000000-0000-0000-0000-000000000001'
      and event_type = 'unassigned'
  ),
  'assignee removals are written to the activity log'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select ok(exists (select 1 from public.user_notifications where notification_type = 'task_updated'), 'a task edit creates an in-app notification for the assignee');
select ok(exists (select 1 from public.user_notifications where notification_type = 'task_unassigned'), 'an assignee removal creates an in-app notification for the former assignee');
select lives_ok(
  $$update public.user_notifications set is_read = true, read_at = now() where is_read = false$$,
  'a user can mark their own notifications read'
);
select is((select count(*) from public.user_notifications where not is_read), 0::bigint, 'marking notifications read updates only the current user''s rows');

select * from finish();
rollback;
