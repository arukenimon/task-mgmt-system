# Task Hub

Task Hub is a role-aware internal workflow tool for client-delivery teams. It demonstrates individual, team, and leadership reporting alongside client filtering, deadline tracking, List, Calendar, and Kanban views.

The interface opens with interactive seeded demo data, so it can be presented before local infrastructure is configured. Running Supabase locally turns the same architecture into a password-protected, RLS-enforced application foundation.

## Quick start

Use a WSL terminal from `/mnt/f/projects/task-management-system`.

```bash
npm install
cp .env.example .env.local
npm run db:start
npx supabase status -o env
npm run dev
```

Copy the local API URL and publishable key shown by `supabase status` into `.env.local`. Open `http://localhost:3000` for the interactive demo, or `http://localhost:3000/login` for Supabase Auth.

Local Mailpit is available at `http://localhost:54324`. The seeded accounts use `DemoPass!2026`.

## Useful commands

```bash
npm run db:reset  # rebuild local Postgres and seed demo data
npm run db:lint   # database linting
npm run db:test   # pgTAP RLS tests
npm run build     # production build
```

See [architecture documentation](docs/architecture.md) and [local-development documentation](docs/local-development.md) for the full design and setup guidance.
# task-mgmt-system
