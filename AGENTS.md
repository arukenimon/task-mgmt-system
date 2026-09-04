<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Task Hub engineering rules

- Keep the feature-aligned MVC boundaries: views render, controllers authenticate and validate, services own use cases, and repositories own Supabase queries.
- Use the WSL terminal and the project-local Supabase CLI for all Node, Docker, and database work. Do not mix Windows and Linux `node_modules`.
- Create migrations with `npx supabase migration new <name>`; verify with `npm run db:reset`, `npm run db:lint`, and `npm run db:test` before applying a schema change remotely.
- Enable and test RLS on every exposed table. Never use editable Supabase `user_metadata` for authorisation and never expose a service-role key to browser code.
- Use Server Components for reads, Server Actions for internal UI mutations, and Route Handlers only for HTTP boundaries such as Vercel Cron.
- Keep production secrets in Vercel environment variables and local secrets in `.env.local`; only `.env.example` is committed.
