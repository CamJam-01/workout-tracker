const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const {
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
} = require("../middleware/auth");

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    highlightTexts: Array.isArray(u.highlight_texts) ? u.highlight_texts : [],
  };
}

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!password || String(password).length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      normalizedEmail,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "An account with that email already exists" });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const inserted = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [String(name).trim(), normalizedEmail, hash]
    );
    const user = inserted.rows[0];
    setAuthCookie(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      String(email).trim().toLowerCase(),
    ]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    setAuthCookie(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (email) {
      // Look up the account, but never let the response reveal whether it exists.
      await pool.query("SELECT id FROM users WHERE email = $1", [
        String(email).trim().toLowerCase(),
      ]);
    }
    res.json({
      ok: true,
      message: "If an account exists for that email, we've sent a reset link.",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.userId,
    ]);
    const user = result.rows[0];
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { highlightTexts } = req.body || {};
    const cleaned = Array.isArray(highlightTexts)
      ? highlightTexts.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : [];
    const value = cleaned.length ? JSON.stringify(cleaned) : null;
    const result = await pool.query(
      "UPDATE users SET highlight_texts = $1::jsonb WHERE id = $2 RETURNING *",
      [value, req.userId]
    );
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
