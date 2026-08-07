# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install   # install dependencies
npm start     # run the server at http://localhost:3000 (node server.js)
```

Requires `DATABASE_URL` and `JWT_SECRET` env vars locally (see `.env.example`) — `dotenv` loads `.env` automatically outside production. There are no build, lint, or test scripts/tooling configured in this repo.

## Architecture

Stride is a small full-stack workout tracker deployed on Vercel: Express backend + vanilla HTML/CSS/JS frontend, no bundler/build step. Vercel auto-detects it as an "Express" framework project directly from `server.js` calling `app.listen()` — no `vercel.json` or `/api` serverless-function restructuring needed.

**Database**: `src/db.js` uses `pg` (`node-postgres`) against a Postgres connection string (`DATABASE_URL` or `POSTGRES_URL`). This used to be SQLite (`node:sqlite`, then briefly `better-sqlite3`), but Vercel's serverless filesystem is ephemeral/read-only in production, so a real hosted Postgres is required — currently no managed DB is provisioned for this project (Supabase was blocked by a free-tier project-count limit on the account's org; no Vercel-storage-provisioning tool was available either), so **`DATABASE_URL` must be set manually** in Vercel project env vars before the deployed app can do anything beyond serve static pages. The `pool` export is a `Proxy` that lazily constructs the real `pg.Pool` on first query (not at module load) — this matters because Vercel's framework detection imports `server.js` to look for `app.listen()`, and an eager throw on a missing env var at import time would break that detection before the app ever gets a chance to run. `ensureSchema()` runs idempotent `CREATE TABLE IF NOT EXISTS` DDL, cached per warm serverless instance via a module-level promise. Two tables: `users` and `workouts` (one row per stopwatch segment/lap saved from the Dashboard entry form — a single stopwatch session with laps produces multiple `workouts` rows sharing the same date, matching how History's "same day" grouping displays them).

**Auth**: Stateless — no session store. `src/middleware/auth.js` signs a JWT (`jsonwebtoken`, payload `{ sub: userId }`, 30-day expiry) into an httpOnly cookie (`stride_token`) on signup/login; `requireAuth` middleware and `getUserIdFromReq` just verify that cookie, no server-side session state at all. This was a deliberate switch from the original `express-session`/`MemoryStore` design, which doesn't work across serverless invocations (no shared memory between them). `JWT_SECRET` is read lazily inside `getSecret()` for the same import-time-safety reason as the DB pool above. Passwords are hashed with `bcryptjs`.

**Routing / file layout**:
- `server.js` — app entrypoint: JSON body parsing, `cookie-parser`, an `ensureSchema()` gate before `/api/*`, mounts `src/routes/auth.js` at `/api` (`/api/signup`, `/api/login`, `/api/logout`, `/api/me`) and `src/routes/workouts.js` at `/api/workouts` (`GET /`, `POST /`, `GET /stats`), serves `public/` statically, and defines the two auth-gated page routes (`/dashboard`, `/history`) that check the JWT cookie directly and `sendFile` from `views/` (or redirect to `/login.html`).
- `public/` — everything served statically and unauthenticated: `landing.html`, `login.html`, `signup.html`, `css/styles.css` (design-system tokens/components, copied verbatim from the source Claude Design file — retune colors/spacing there), `css/app.css` (page layout built on those tokens), and `js/{auth,dashboard,history}.js` (per-page vanilla JS, talk to the JSON API via `fetch`).
- `views/` — `dashboard.html` and `history.html`, only ever reachable through the auth-checked routes in `server.js` (not under `public/`, so they can't be fetched directly and bypass the check).

**Frontend pattern**: no client-side router or component framework. Each page is static HTML with a matching `public/js/<page>.js` that renders into fixed DOM ids/classes and re-renders on state change (see `dashboard.js`'s stopwatch/entry-form state machine and `history.js`'s workout-list/calendar state). All persistence goes through the JSON API in `src/routes/`.

**Stats aggregation** (`GET /api/workouts/stats` in `src/routes/workouts.js`): computed server-side in JS from all of the user's `workouts` rows on every call (no caching/materialized columns) — this-week bars, max weight (parsed from the free-text `weight` field via regex), longest workout, and best week (grouped by Monday-start ISO week).

## Deployment (Vercel)

Project: `stride` under the `camjam01's projects` Vercel team (`prj_Qg8szPeABFrBLWmno1KbZLnEWSVi`), deployed via the `deploy_to_vercel` MCP tool (no GitHub integration — redeploying means re-running that tool with the full current file set, since it's a one-shot file-tree upload, not a git-triggered build).

Two things are **not yet wired up** and need to be set as env vars in the Vercel project (Settings → Environment Variables) before the live app works beyond static pages:
- `DATABASE_URL` — a Postgres connection string. Easiest path: Vercel dashboard → the `stride` project → Storage → Create Database → Postgres (Neon-backed), then connect it to the project, which auto-injects the connection env var.
- `JWT_SECRET` — any long random string (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

Vercel's default "Vercel Authentication" (SSO) deployment protection was disabled for this project (with explicit user confirmation — it's a security-posture change, not something to toggle unprompted) so the `*.vercel.app` URL is actually publicly reachable rather than gated behind a Vercel team login.

There is a legacy `Workout History.html` at the repo root — a static bundled export from the original Claude Design preview, unrelated to the app in `public/`/`views/`; leave it alone.
