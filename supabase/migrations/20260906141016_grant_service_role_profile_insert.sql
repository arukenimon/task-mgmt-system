-- The server-only Admin client creates the public profile after Supabase Auth
-- has issued an invitation. service_role bypasses RLS but still needs table
-- privileges for this Data API write.
grant insert on table public.profiles to service_role;
