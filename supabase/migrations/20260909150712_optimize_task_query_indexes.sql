-- Kanban loads one cursor-paginated page per status.  Senior directors can
-- view all teams, so the team-leading index alone cannot serve this core path.
create index tasks_status_due_id_idx
  on public.tasks (status, due_date, id);

-- Preserve the existing team-scoped lookup while extending it to the complete
-- cursor ordering used by the board endpoint.
create index tasks_team_status_due_id_idx
  on public.tasks (team_id, status, due_date, id);

drop index if exists public.tasks_team_status_due_idx;

-- Client-filtered kanban pages always constrain status and use the same
-- due-date/id cursor ordering.
create index tasks_status_client_due_id_idx
  on public.tasks (status, client_id, due_date, id);

-- Activity pages use a compound (created_at, id) cursor.  Adding the UUID
-- tiebreaker avoids a sort when activity rows share a timestamp.
create index task_activity_task_created_id_idx
  on public.task_activity (task_id, created_at desc, id desc);

drop index if exists public.task_activity_task_created_idx;
