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

Copy `API_URL`, the publishable key, and `SERVICE_ROLE_KEY` from `supabase status` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key server-only; it is required for invitation and account-deactivation actions and must never use a `NEXT_PUBLIC_` prefix.

The local services use these default addresses:

- Studio: `http://localhost:55423`
- Mailpit inbox: `http://localhost:55424`
- Mailpit SMTP: `127.0.0.1:55425`
- Supabase API: `http://127.0.0.1:55421`

Mailpit captures Supabase Auth emails and Bespoke’s SMTP email adapter. Set `EMAIL_PROVIDER=smtp` locally; use `EMAIL_PROVIDER=resend` and Vercel environment variables in production.

## Passwordless local sign-in

The app intentionally has no unauthenticated demo route. Visit `http://localhost:3000`, enter one of the seeded work emails, and open the one-time sign-in link in Mailpit. The template is versioned at `supabase/templates/magic-link.html` and is configured through `supabase/config.toml`. Local Supabase must keep its email provider enabled; application login remains invite-only because it requests links with `shouldCreateUser: false` and unprofiled users cannot read any workspace data.

For a hosted Supabase project, copy that HTML and the subject `Your Bespoke sign-in link` into **Authentication → Email Templates → Magic Link**. Keep the link target exactly as shown: it must send `token_hash` to your deployed `/auth/confirm` route. Ensure the production Site URL and its `/auth/confirm` route are included in the project’s Auth URL configuration, then configure a production SMTP provider—Mailpit is local-only.

Senior Directors can use `/team` to create teams, send Supabase Auth invitations, change roles and team assignments, or deactivate access. Hosted deployments must set `SUPABASE_SERVICE_ROLE_KEY` in Vercel as a server-only environment variable before those Auth administration actions will work.

## Database workflow

```bash
npx supabase migration new descriptive_change
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
```

Never edit a migration that has been applied to a shared remote environment. Create a new migration, verify it locally, then review the SQL and RLS policy tests before pushing.

## Seeded accounts

The seeded accounts are invited identities. They can sign in via a magic link (and retain `DemoPass!2026` only for direct password-flow diagnostics):

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
