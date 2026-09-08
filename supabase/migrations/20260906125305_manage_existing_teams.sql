grant update (name) on public.teams to authenticated;

create policy "senior directors rename teams"
on public.teams for update to authenticated
using (private.is_senior_director())
with check (private.is_senior_director());
