begin;

select plan(20);

select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.teams'::regclass), 'teams has RLS enabled');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.tasks), 5::bigint, 'senior director can read all seeded tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.tasks), 3::bigint, 'North account director can read only North Team tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.tasks), 2::bigint, 'South account director can read only South Team tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.tasks), 3::bigint, 'North team member can read their team tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);
select is((select count(*) from public.tasks), 2::bigint, 'South team member cannot read North Team tasks');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
insert into public.teams (name) values ('East Team');
select is((select count(*) from public.teams where name = 'East Team'), 1::bigint, 'senior director can create a team');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$insert into public.teams (name) values ('Unauthorised Team')$$,
  '42501',
  'new row violates row-level security policy for table "teams"',
  'account director cannot create a team'
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
