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

Copy `API_URL`, the publishable key, and `SERVICE_ROLE_KEY` from `supabase status` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally and to the canonical HTTPS application URL in production. Keep the service-role key server-only; it is required for invitation and account-deactivation actions and must never use a `NEXT_PUBLIC_` prefix.

The local services use these default addresses:

- Studio: `http://localhost:56423`
- Mailpit inbox: `http://localhost:56424`
- Mailpit SMTP: `127.0.0.1:56425`
- Supabase API: `http://127.0.0.1:56421`

Mailpit captures Supabase Auth emails and Bespoke’s SMTP email adapter. Set `EMAIL_PROVIDER=smtp` locally; use `EMAIL_PROVIDER=brevo` with a server-only `BREVO_API_KEY` in Vercel for application notifications. Supabase Auth invitation and recovery mail still require production SMTP configured in Supabase.

## Password-based local sign-in

The app intentionally has no unauthenticated demo route. Visit `http://localhost:3000`, enter a seeded work email and its password, then sign in. All seeded accounts use `DemoPass!2026`. The application remains invite-only: a Senior Director creates the user through the Team screen, and the recipient receives an email invitation to confirm their address and choose a password. Workspace routes accept only sessions that were authenticated with a password.

For a hosted Supabase project, configure **Authentication → URL Configuration** with the deployed Site URL (for example `https://plane.forgekeep.online`). In **Authentication → Email Templates**, copy `supabase/templates/invite.html` into **Invite user** and `supabase/templates/recovery.html` into **Reset password**. Both links must send `token_hash` and the correct `type` to the deployed `/auth/confirm` route. Configure the password policy to require 12 characters, upper- and lowercase letters, a number, and a symbol. Finally, configure a production SMTP provider—Supabase's default sender is restricted and rate-limited, while Mailpit is local-only.

Senior Directors can use `/team` to create teams, send Supabase Auth invitations, change roles and team assignments, or deactivate access. Hosted deployments must set `SUPABASE_SERVICE_ROLE_KEY` in Vercel as a server-only environment variable before those Auth administration actions will work.

## Database workflow

```bash
npx supabase migration new descriptive_change
npm run db:backup
npm run db:reset -- --confirm
npm run db:lint
npm run db:test
npm run db:types
```

## Local data safety

The local database persists through normal Docker Desktop and PC restarts. Stop it with `npm run db:stop` and resume it with `npm run db:start`; never use `supabase stop --no-backup` unless intentionally discarding every local record.

Before a reset, use `npm run db:backup` to save a complete recovery snapshot to `backups/local-supabase/`. The directory is Git-ignored because snapshots can contain real user data. `npm run db:reset` will back up the database automatically but refuses to run until `-- --confirm` is supplied. Do not call `npx supabase db reset` directly: it bypasses the backup and confirmation safeguard.

Never edit a migration that has been applied to a shared remote environment. Create a new migration, verify it locally, then review the SQL and RLS policy tests before pushing.

## Seeded accounts

The seeded accounts use the password `DemoPass!2026`:

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
npm run db:backup
npm run db:reset -- --confirm
```

If `supabase start` cannot contact Docker, fix Docker Desktop/WSL integration first. Do not expose the local stack to a public network; it is a development environment only.
