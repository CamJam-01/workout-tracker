# Stride

Stride is a small, self-hosted workout tracker. Log your lifts with a built-in
stopwatch, review your history on a calendar, and see stats like weekly
volume, your max weight, and your longest workout — all from a lightweight
Express + vanilla JS app with no build step required.

## Features

- **Accounts** — simple email/password signup and login, with sessions kept
  server-side.
- **Dashboard entry form** — a stopwatch-driven workout logger. Start the
  clock, record a lap for each set/segment, and save them together as a
  session.
- **History** — a calendar view of past workouts, grouped by day, so you can
  see what you did and when.
- **Stats** — this week's activity, your heaviest lift, your longest workout,
  and your best week, all computed live from your logged data.

## Getting started

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Tech stack

- **Backend**: Node.js + Express, with `express-session` for auth sessions
  and `bcryptjs` for password hashing.
- **Database**: SQLite via Node's built-in `node:sqlite` module — no native
  build tooling required. Data is stored locally in `data/app.db`.
- **Frontend**: plain HTML, CSS, and JavaScript — no framework or bundler.
  Each page talks to the backend through a small JSON API.

No test or lint tooling is configured yet.

## Project layout

```
server.js       # app entrypoint — routes, sessions, static files
src/            # backend: routes, auth middleware, database access
public/         # unauthenticated static assets — landing/login/signup pages, css, js
views/          # authenticated pages (dashboard, history), served through server.js
```

See [CLAUDE.md](CLAUDE.md) for a deeper architectural walkthrough.
