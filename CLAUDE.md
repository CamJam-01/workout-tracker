# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install   # install dependencies
npm start     # run the server at http://localhost:3000 (node server.js)
```

There are no build, lint, or test scripts/tooling configured in this repo.

## Architecture

Stride is a small full-stack workout tracker: Express backend + vanilla HTML/CSS/JS frontend, no bundler/framework/build step.

**Database**: `src/db.js` uses Node's **built-in `node:sqlite`** module (`DatabaseSync`), not the `better-sqlite3` npm package — `better-sqlite3` was tried first but its native build failed on this machine (incompatible system Python/node-gyp), so the built-in module was substituted since it requires no compilation. It is still an experimental Node API (emits an `ExperimentalWarning` on startup) but has an API compatible with `better-sqlite3` (`db.prepare(sql).run/get/all`, named `@param` and positional `?` placeholders). The SQLite file lives at `data/app.db` (gitignored) and is created/migrated (via `CREATE TABLE IF NOT EXISTS`) on require. Two tables: `users` and `workouts` (one row per stopwatch segment/lap saved from the Dashboard entry form — a single stopwatch session with laps produces multiple `workouts` rows sharing the same date, matching how History's "same day" grouping displays them).

**Auth**: `express-session` with the default in-memory `MemoryStore` — sessions do NOT survive a server restart (users get logged out), but all user/workout data is durable in SQLite. Passwords are hashed with `bcryptjs`. `src/middleware/requireAuth.js` guards JSON API routes (401 if no `req.session.userId`); `server.js` separately guards the two HTML page routes (`/dashboard`, `/history`) by checking the session directly and redirecting to `/login.html` if absent.

**Routing / file layout**:
- `server.js` — app entrypoint: session middleware, mounts `src/routes/auth.js` at `/api` (`/api/signup`, `/api/login`, `/api/logout`, `/api/me`) and `src/routes/workouts.js` at `/api/workouts` (`GET /`, `POST /`, `GET /stats`), serves `public/` statically, and defines the two auth-gated page routes that `sendFile` from `views/`.
- `public/` — everything served statically and unauthenticated: `landing.html`, `login.html`, `signup.html`, `css/styles.css` (design-system tokens/components, copied verbatim from the source Claude Design file — retune colors/spacing there), `css/app.css` (page layout built on those tokens), and `js/{auth,dashboard,history}.js` (per-page vanilla JS, talk to the JSON API via `fetch`).
- `views/` — `dashboard.html` and `history.html`, only ever reachable through the session-checked routes in `server.js` (not under `public/`, so they can't be fetched directly and bypass the auth check).

**Frontend pattern**: no client-side router or component framework. Each page is static HTML with a matching `public/js/<page>.js` that renders into fixed DOM ids/classes and re-renders on state change (see `dashboard.js`'s stopwatch/entry-form state machine and `history.js`'s workout-list/calendar state). All persistence goes through the JSON API in `src/routes/`.

**Stats aggregation** (`GET /api/workouts/stats` in `src/routes/workouts.js`): computed server-side in JS from all of the user's `workouts` rows on every call (no caching/materialized columns) — this-week bars, max weight (parsed from the free-text `weight` field via regex), longest workout, and best week (grouped by Monday-start ISO week).

There is a legacy `Workout History.html` at the repo root — a static bundled export from the original Claude Design preview, unrelated to the app in `public/`/`views/`; leave it alone.
