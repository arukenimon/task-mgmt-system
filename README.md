# Bespoke Task Management System

Bespoke is a role-aware, tailored task management system for client-delivery teams. It supports individual, team, and leadership reporting alongside client filtering, deadline tracking, List, Calendar, Kanban, and Senior Director team-management views.

Every workspace route requires a Supabase Auth session. Team members sign in through an emailed one-time link; Supabase RLS independently enforces the same role and team boundaries at the database.

## Quick start

Use a WSL terminal from `/mnt/f/projects/task-management-system`.

```bash
npm install
cp .env.example .env.local
npm run db:start
npx supabase status -o env
npm run dev
```

Copy the local API URL, publishable key, and service-role key shown by `supabase status` into `.env.local`, then open `http://localhost:3000`. The service-role key is server-only and is required for Senior Directors to send Auth invitations or deactivate sign-in access. The app redirects to the passwordless sign-in screen until a session is established.

Local Mailpit is available at `http://localhost:55424`. Request a sign-in link for any seeded email, then open the link in Mailpit to authenticate. The local HTML template lives at `supabase/templates/magic-link.html`.

## Useful commands

```bash
npm run db:reset  # rebuild local Postgres and seed demo data
npm run db:lint   # database linting
npm run db:test   # pgTAP RLS tests
npm run build     # production build
```

See [architecture documentation](docs/architecture.md) and [local-development documentation](docs/local-development.md) for the full design and setup guidance.
# task-mgmt-system
