const { Pool } = require("pg");

// Lazily constructed so simply requiring this module (e.g. during framework
// detection/build) never throws — only an actual query does, if the env var
// is still missing at that point.
let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) environment variable is required. " +
        "Set it to a Postgres connection string (see .env.example)."
    );
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  _pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  return _pool;
}

// Proxy so existing call sites (`pool.query(...)`) keep working unchanged
// while the real Pool is only created the first time it's actually used.
const pool = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getPool();
      const val = real[prop];
      return typeof val === "function" ? val.bind(real) : val;
    },
  }
);

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    highlight_texts JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- One-time migration for schemas created before highlight_texts existed:
  -- carries the old single string forward as a one-item array, then drops it.
  -- No-op forever after (and on fresh deploys, which never had highlight_text).
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'highlight_text'
    ) THEN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS highlight_texts JSONB;
      UPDATE users SET highlight_texts = to_jsonb(ARRAY[highlight_text])
        WHERE highlight_texts IS NULL AND highlight_text IS NOT NULL AND highlight_text <> '';
      ALTER TABLE users DROP COLUMN highlight_text;
    END IF;
  END $$;

  CREATE TABLE IF NOT EXISTS workouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    iso_date TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    reps TEXT,
    weight TEXT,
    distance TEXT,
    rpe INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
  CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, iso_date);

  CREATE TABLE IF NOT EXISTS routines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    exercise TEXT,
    reps TEXT,
    weight TEXT,
    distance TEXT,
    rpe INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
`;

// Serverless cold starts each get a fresh module instance, so this promise
// caches the CREATE-TABLE-IF-NOT-EXISTS work once per warm instance rather
// than re-running it on every request.
let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL).catch((err) => {
      schemaReady = null; // let the next request retry instead of wedging forever
      throw err;
    });
  }
  return schemaReady;
}

module.exports = { pool, ensureSchema };
