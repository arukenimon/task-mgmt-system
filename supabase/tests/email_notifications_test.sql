begin;

select plan(18);

delete from public.email_outbox;
set constraints queue_task_escalation_email immediate;

set local role authenticated;
select set_config('request.jwt.claims', '{"amr":[{"method":"password"}]}', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.allocate_task(
    'Coordinate notification rollout',
    '',
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    array['20000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000005'::uuid],
    'high',
    current_date + 3
  )$$,
  'allocation succeeds with multiple assignees'
);
reset role;
select is((select count(*) from public.email_outbox), 2::bigint, 'each newly assigned active person receives one queued email');
select is(
  (select string_agg(recipient, ',' order by recipient) from public.email_outbox),
  'liam.chen@taskhub.demo,zoe.patel@taskhub.demo',
  'assignment mail is addressed only to the newly assigned people'
);

set local role authenticated;
update public.tasks
set due_date = due_date - 1
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 3::bigint, 'an earlier deadline queues one assignee alert');

set local role authenticated;
update public.tasks
set due_date = due_date + 2
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 3::bigint, 'a relaxed deadline does not queue an email');

set local role authenticated;
update public.tasks
set priority = 'urgent'
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 4::bigint, 'raising priority to urgent queues one assignee alert');

set local role authenticated;
update public.tasks
set priority = 'high'
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 4::bigint, 'lowering priority does not queue an email');

set local role authenticated;
update public.tasks
set status = 'blocked', completed_at = null
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 6::bigint, 'blocking queues alerts for the assignee and task creator');
select is(
  (select count(*) from public.email_outbox where recipient = 'sophie.turner@taskhub.demo' and subject like 'Task needs attention:%'),
  1::bigint,
  'the task creator receives the blocked alert'
);

set local role authenticated;
update public.tasks
set status = 'complete', completed_at = clock_timestamp()
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 7::bigint, 'completion queues one creator alert');
select is(
  (select count(*) from public.email_outbox where recipient = 'sophie.turner@taskhub.demo' and subject like 'Task complete:%'),
  1::bigint,
  'only the task creator receives the completion alert'
);

set local role authenticated;
update public.tasks
set title = 'Coordinate notification rollout wording'
where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*) from public.email_outbox), 7::bigint, 'cosmetic task edits do not queue an email');

set local role authenticated;
update public.profiles
set is_active = false
where id = '20000000-0000-0000-0000-000000000006';
update public.tasks
set due_date = due_date - 1
where id = '40000000-0000-0000-0000-000000000004';
reset role;
select is((select count(*) from public.email_outbox), 7::bigint, 'inactive assignees do not receive escalation emails');

delete from public.email_outbox;
insert into public.email_outbox (dedupe_key, recipient, subject, html)
values ('claim-test', 'worker@example.com', 'Claim test', '<p>Claim test</p>');
set local role service_role;
select is((select count(*) from public.claim_email_outbox(1, 'b3e5d1d5-5c66-4d4d-bd9e-1b960ef9c7d4')), 1::bigint, 'a worker can claim one pending email');
reset role;
select is(
  (select delivery_lease_id::text from public.email_outbox where dedupe_key = 'claim-test'),
  'b3e5d1d5-5c66-4d4d-bd9e-1b960ef9c7d4',
  'claiming records the delivery lease'
);
select is((select count(*) from public.claim_email_outbox(1, '1573e5c0-0829-4b81-9140-8159e98b26d2')), 0::bigint, 'a live lease prevents a concurrent claim');
update public.email_outbox set lease_expires_at = clock_timestamp() - interval '1 second' where dedupe_key = 'claim-test';
select is((select count(*) from public.claim_email_outbox(1, '886fcda5-64e7-4261-9f91-1a02d324f383')), 1::bigint, 'an expired lease can be recovered');

set local role authenticated;
select throws_ok(
  $$select public.claim_email_outbox(1, '18c6ce5a-fadd-4d5c-b5b5-2a6e3d4c52df')$$,
  '42501',
  'permission denied for function claim_email_outbox',
  'browser roles cannot claim the private email outbox'
);

select * from finish();
rollback;
