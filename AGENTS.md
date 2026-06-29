<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is **Planner Tropini**, a single Next.js 16 (App Router) + Prisma + PostgreSQL field-sales CRM (Italian UI). Package manager is **npm**. Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`).

Service / DB notes (non-obvious):
- **PostgreSQL is required.** The cloud VM runs a local Postgres 16 cluster. If it is not running, start it with `sudo pg_ctlcluster 16 main start`. The dev DB is `planner_tropini` (user/password `postgres`/`postgres`).
- **`DATABASE_URL` is set in a git-ignored `.env`** at the repo root (Prisma reads it). The update script does not create `.env`, so if `.env` is missing, recreate it: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/planner_tropini?schema=public"`.
- After dependency installs or schema changes, run `npx prisma generate` (no npm script wires this up) and `npx prisma migrate deploy` to apply migrations. The update script already does both.
- Start the app in dev with `npm run dev` (Turbopack, http://localhost:3000). Health check: `GET /api/health` returns `{"status":"ok"}`. Root `/` redirects (307) to the dashboard.
- `npm run lint` currently reports pre-existing errors/warnings in `src/components/RoutePanel.tsx` and `src/app/mappa/page.tsx` (React hooks rules) unrelated to env setup.
- Optional external integrations: route optimization needs `ORS_API_KEY` (OpenRouteService) or `/api/route` fails; geocoding uses public OpenStreetMap Nominatim (needs internet, no key). Neither is required to run the core app.
