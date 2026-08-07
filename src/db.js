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
    highlight_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

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
