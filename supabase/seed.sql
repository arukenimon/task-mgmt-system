-- Local-only assessment users. All accounts use DemoPass!2026.
-- The seed creates six users, then the application profiles and realistic sample workload.
insert into public.teams (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'North Team'),
  ('10000000-0000-0000-0000-000000000002', 'South Team')
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex.morgan@taskhub.demo', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sophie.turner@taskhub.demo', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus.reed@taskhub.demo', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe.patel@taskhub.demo', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'liam.chen@taskhub.demo', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olivia.grant@taskhub.demo', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) values
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', jsonb_build_object('sub','20000000-0000-0000-0000-000000000001','email','alex.morgan@taskhub.demo'), 'email', 'alex.morgan@taskhub.demo', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', jsonb_build_object('sub','20000000-0000-0000-0000-000000000002','email','sophie.turner@taskhub.demo'), 'email', 'sophie.turner@taskhub.demo', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', jsonb_build_object('sub','20000000-0000-0000-0000-000000000003','email','marcus.reed@taskhub.demo'), 'email', 'marcus.reed@taskhub.demo', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', jsonb_build_object('sub','20000000-0000-0000-0000-000000000004','email','zoe.patel@taskhub.demo'), 'email', 'zoe.patel@taskhub.demo', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', jsonb_build_object('sub','20000000-0000-0000-0000-000000000005','email','liam.chen@taskhub.demo'), 'email', 'liam.chen@taskhub.demo', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', jsonb_build_object('sub','20000000-0000-0000-0000-000000000006','email','olivia.grant@taskhub.demo'), 'email', 'olivia.grant@taskhub.demo', now(), now(), now())
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, full_name, email, initials, role, team_id) values
  ('20000000-0000-0000-0000-000000000001', 'Alex Morgan', 'alex.morgan@taskhub.demo', 'AM', 'senior_director', null),
  ('20000000-0000-0000-0000-000000000002', 'Sophie Turner', 'sophie.turner@taskhub.demo', 'ST', 'account_director', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', 'Marcus Reed', 'marcus.reed@taskhub.demo', 'MR', 'account_director', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', 'Zoe Patel', 'zoe.patel@taskhub.demo', 'ZP', 'team_member', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', 'Liam Chen', 'liam.chen@taskhub.demo', 'LC', 'team_member', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000006', 'Olivia Grant', 'olivia.grant@taskhub.demo', 'OG', 'team_member', '10000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into public.clients (id, name, account_lead_id) values
  ('30000000-0000-0000-0000-000000000001', 'Internal operations', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', 'Atlas Automotive', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', 'Solstice Motors', '20000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000004', 'Helix Vehicle Group', '20000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.tasks (id, title, description, client_id, team_id, owner_id, created_by_id, status, priority, due_date, completed_at) values
  ('40000000-0000-0000-0000-000000000001', 'Approve Q4 campaign budget', 'Consolidate channel forecasts and prepare the approval note.', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'in_progress', 'urgent', current_date, null),
  ('40000000-0000-0000-0000-000000000002', 'Build dealer launch email journey', 'Map the lead nurture sequence for the new showroom opening.', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'todo', 'high', current_date + 2, null),
  ('40000000-0000-0000-0000-000000000003', 'Validate May sales-event feed', 'Reconcile the event feed before the client dashboard refresh.', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'blocked', 'urgent', current_date - 1, null),
  ('40000000-0000-0000-0000-000000000004', 'Prepare dealer performance report', 'Review campaign performance and draft account commentary.', '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'in_progress', 'high', current_date + 4, null),
  ('40000000-0000-0000-0000-000000000005', 'Update shared client briefing template', 'Add the revised GDPR wording and standard handover fields.', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'todo', 'medium', current_date + 7, null)
on conflict (id) do nothing;
