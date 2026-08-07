const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const insertUser = db.prepare(
  "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
);
const findByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const findById = db.prepare("SELECT * FROM users WHERE id = ?");
const updateHighlight = db.prepare(
  "UPDATE users SET highlight_text = ? WHERE id = ?"
);

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    highlightText: u.highlight_text || null,
  };
}

router.post("/signup", (req, res) => {
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
  if (findByEmail.get(normalizedEmail)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const info = insertUser.run(String(name).trim(), normalizedEmail, hash);
  req.session.userId = info.lastInsertRowid;
  const user = findById.get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const user = findByEmail.get(String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  const user = findById.get(req.session.userId);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ user: publicUser(user) });
});

router.put("/me", requireAuth, (req, res) => {
  const { highlightText } = req.body || {};
  updateHighlight.run(
    highlightText && String(highlightText).trim()
      ? String(highlightText).trim()
      : null,
    req.session.userId
  );
  const user = findById.get(req.session.userId);
  res.json({ user: publicUser(user) });
});

module.exports = router;
