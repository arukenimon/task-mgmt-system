# Local development: WSL, Supabase, and Mailpit

## Readiness check

1. Start Docker Desktop and enable WSL integration for your chosen Linux distribution.
2. Open WSL and work from `/mnt/f/projects/task-management-system`.
3. Keep Node/npm and the Supabase CLI in WSL for this project. Reinstall dependencies there if the existing `node_modules` were produced from Windows.
4. Confirm `docker version` shows both client and server before starting Supabase.

## Start the stack

```bash
cp .env.example .env.local
npm run db:start
npx supabase status -o env
```

Copy `API_URL` and the publishable key from `supabase status` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Keep the service-role key server-only.

The local services use these default addresses:

- Studio: `http://localhost:55423`
- Mailpit inbox: `http://localhost:55424`
- Mailpit SMTP: `127.0.0.1:55425`
- Supabase API: `http://127.0.0.1:55421`

Mailpit captures Supabase Auth emails and Task Hub’s SMTP email adapter. Set `EMAIL_PROVIDER=smtp` locally; use `EMAIL_PROVIDER=resend` and Vercel environment variables in production.

## Database workflow

```bash
npx supabase migration new descriptive_change
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
```

Never edit a migration that has been applied to a shared remote environment. Create a new migration, verify it locally, then review the SQL and RLS policy tests before pushing.

## Demo accounts

All seeded accounts use `DemoPass!2026`:

- `alex.morgan@taskhub.demo` — Senior Director
- `sophie.turner@taskhub.demo` — North Account Director
- `marcus.reed@taskhub.demo` — South Account Director
- `zoe.patel@taskhub.demo` — North team member
- `liam.chen@taskhub.demo` — North team member
- `olivia.grant@taskhub.demo` — South team member

## Common recovery commands

```bash
npm run db:stop
npm run db:start
npm run db:reset
```

If `supabase start` cannot contact Docker, fix Docker Desktop/WSL integration first. Do not expose the local stack to a public network; it is a development environment only.
