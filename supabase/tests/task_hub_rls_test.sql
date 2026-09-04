begin;

select plan(7);

select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');

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

select * from finish();
rollback;
