begin;

select plan(47);

select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.teams'::regclass), 'teams has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.clients'::regclass), 'clients has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.task_attachments'::regclass), 'task attachments has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.task_assignees'::regclass), 'task assignees has RLS enabled');

set local role authenticated;
select set_config('request.jwt.claims', '{"amr":[{"method":"password"}]}', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.tasks), 5::bigint, 'senior director can read all seeded tasks');
select is((select count(*) from public.task_assignees), 5::bigint, 'senior director can read all seeded task assignments');

select set_config('request.jwt.claims', '{"amr":[{"method":"invite"}]}', true);
select is((select count(*) from public.tasks), 0::bigint, 'an invitation session cannot read workspace data');
select set_config('request.jwt.claims', '{"amr":[{"method":"password"}]}', true);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.tasks), 3::bigint, 'North account director can read only North Team tasks');
select is((select count(*) from public.task_assignees), 3::bigint, 'North account director can read only North Team assignments');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.tasks), 2::bigint, 'South account director can read only South Team tasks');
select throws_ok(
  $$insert into public.task_assignees (task_id, profile_id) values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006')$$,
  '42501',
  'new row violates row-level security policy for table "task_assignees"',
  'account directors cannot assign a member from another team'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.tasks), 3::bigint, 'North team member can read their team tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);
select is((select count(*) from public.tasks), 2::bigint, 'South team member cannot read North Team tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
insert into public.task_attachments (task_id, storage_path, file_name, mime_type, byte_size, uploaded_by)
values (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.png',
  'brief.png',
  'image/png',
  1024,
  '20000000-0000-0000-0000-000000000001'
);
select is((select count(*) from public.task_attachments), 1::bigint, 'senior director can add an attachment');
insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'task-attachments',
  '40000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.png',
  '20000000-0000-0000-0000-000000000001',
  '{"mimetype":"image/png","size":1024}'::jsonb
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.task_attachments), 1::bigint, 'team member can read attachments for visible tasks');
select is((select count(*) from storage.objects where bucket_id = 'task-attachments'), 1::bigint, 'team member can read image objects for visible tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);
select is((select count(*) from public.task_attachments), 0::bigint, 'other teams cannot read task attachments');
select is((select count(*) from storage.objects where bucket_id = 'task-attachments'), 0::bigint, 'other teams cannot read image objects');
select throws_ok(
  $$insert into public.task_attachments (task_id, storage_path, file_name, mime_type, byte_size, uploaded_by) values ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002.png', 'not-allowed.png', 'image/png', 1024, '20000000-0000-0000-0000-000000000006')$$,
  '42501',
  'new row violates row-level security policy for table "task_attachments"',
  'team members cannot add task attachments'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
insert into public.teams (name) values ('East Team');
select is((select count(*) from public.teams where name = 'East Team'), 1::bigint, 'senior director can create a team');
update public.teams set name = 'East Region' where name = 'East Team';
select is((select count(*) from public.teams where name = 'East Region'), 1::bigint, 'senior director can rename a team');

insert into public.clients (name, account_lead_id) values ('Archive test client', '20000000-0000-0000-0000-000000000002');
select is((select count(*) from public.clients where name = 'Archive test client'), 1::bigint, 'senior director can create a client');
select throws_ok(
  $$delete from public.clients where id = '30000000-0000-0000-0000-000000000004'$$,
  '42501',
  'permission denied for table clients',
  'clients can be archived but not deleted'
);
update public.clients set is_active = false where id = '30000000-0000-0000-0000-000000000004';
select is((select is_active from public.clients where id = '30000000-0000-0000-0000-000000000004'), false, 'senior director can archive a client');
select throws_ok(
  $$select public.allocate_task(
    'Do not allocate archived work',
    '',
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    array['20000000-0000-0000-0000-000000000004'::uuid],
    'medium',
    current_date + 1
  )$$,
  'P0001',
  'Select an active client.',
  'managers cannot allocate work to archived clients'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$insert into public.teams (name) values ('Unauthorised Team')$$,
  '42501',
  'new row violates row-level security policy for table "teams"',
  'account director cannot create a team'
);
select throws_ok(
  $$insert into public.clients (name) values ('Unauthorised client')$$,
  '42501',
  'new row violates row-level security policy for table "clients"',
  'account director cannot create a client'
);
update public.teams set name = 'Unauthorised rename' where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select name from public.teams where id = '10000000-0000-0000-0000-000000000001'),
  'North Team',
  'account director cannot rename a team'
);
update public.profiles
set full_name = 'Not permitted'
where id = '20000000-0000-0000-0000-000000000004';
select is(
  (select full_name from public.profiles where id = '20000000-0000-0000-0000-000000000004'),
  'Zoe Patel',
  'account director cannot edit a team member profile'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.allocate_task(
    'Coordinate launch checklist',
    'Work together on the final client handover.',
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    array['20000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000005'::uuid],
    'high',
    current_date + 3
  )$$,
  'a manager can allocate one task to multiple active team members'
);
select is(
  (select count(*) from public.task_assignees assignee join public.tasks task on task.id = assignee.task_id where task.title = 'Coordinate launch checklist'),
  2::bigint,
  'one allocated task stores every selected assignee'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.update_task(
    '40000000-0000-0000-0000-000000000001',
    'Approve revised Q4 campaign budget',
    'Consolidate revised channel forecasts and prepare the approval note.',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    array['20000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000005'::uuid],
    'high',
    current_date + 5
  )$$,
  'an account director can edit a task in their team'
);
select is(
  (select title from public.tasks where id = '40000000-0000-0000-0000-000000000001'),
  'Approve revised Q4 campaign budget',
  'task edits update the task fields'
);
select is(
  (select client_id::text || '|' || priority::text || '|' || due_date::text from public.tasks where id = '40000000-0000-0000-0000-000000000001'),
  '30000000-0000-0000-0000-000000000001|high|' || (current_date + 5)::text,
  'task edits update the client, priority, and deadline'
);
select is(
  (select count(*) from public.task_assignees where task_id = '40000000-0000-0000-0000-000000000001'),
  2::bigint,
  'task edits update the complete assignee set'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select public.update_task(
    '40000000-0000-0000-0000-000000000001',
    'Unauthorised task edit',
    '',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    array['20000000-0000-0000-0000-000000000004'::uuid],
    'medium',
    current_date + 1
  )$$,
  'P0001',
  'Only managers can edit tasks for this team.',
  'team members cannot edit task assignment details'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
update public.profiles
set role = 'account_director', team_id = '10000000-0000-0000-0000-000000000001'
where id = '20000000-0000-0000-0000-000000000005';
select is(
  (select role::text from public.profiles where id = '20000000-0000-0000-0000-000000000005'),
  'account_director',
  'senior director can change another member role'
);
update public.profiles
set is_active = false
where id = '20000000-0000-0000-0000-000000000004';
select is(
  (select is_active from public.profiles where id = '20000000-0000-0000-0000-000000000004'),
  false,
  'senior director can deactivate another member'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.tasks), 0::bigint, 'deactivated member cannot read tasks');
select is((select count(*) from public.teams), 0::bigint, 'deactivated member cannot read teams');
select is((select count(*) from public.clients), 0::bigint, 'deactivated member cannot read clients');
select is((select count(*) from public.profiles), 0::bigint, 'deactivated member cannot read profiles');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);
select lives_ok(
  $$select public.update_own_profile_name('Priya Nair Updated', 'PN')$$,
  'active user can update their own display name through the scoped function'
);
select is(
  (select full_name from public.profiles where id = '20000000-0000-0000-0000-000000000006'),
  'Priya Nair Updated',
  'scoped profile update persists the current user name'
);
select is(
  (select role::text from public.profiles where id = '20000000-0000-0000-0000-000000000006'),
  'team_member',
  'scoped profile update preserves the current user role'
);

select * from finish();
rollback;
