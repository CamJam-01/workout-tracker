const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const insertWorkout = db.prepare(`
  INSERT INTO workouts (user_id, title, iso_date, duration_ms, reps, weight, distance, rpe, notes)
  VALUES (@user_id, @title, @iso_date, @duration_ms, @reps, @weight, @distance, @rpe, @notes)
`);
const listWorkouts = db.prepare(`
  SELECT * FROM workouts WHERE user_id = ? ORDER BY iso_date DESC, created_at DESC, id DESC
`);

function serialize(w) {
  return {
    id: w.id,
    title: w.title,
    isoDate: w.iso_date,
    durationMs: w.duration_ms,
    reps: w.reps,
    weight: w.weight,
    distance: w.distance,
    rpe: w.rpe,
    notes: w.notes,
    createdAt: w.created_at,
  };
}

router.get("/", (req, res) => {
  const rows = listWorkouts.all(req.session.userId);
  res.json({ workouts: rows.map(serialize) });
});

router.post("/", (req, res) => {
  const b = req.body || {};
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(b.isoDate)
    ? b.isoDate
    : new Date().toISOString().slice(0, 10);
  const durationMs = Number.isFinite(Number(b.durationMs))
    ? Math.max(0, Math.round(Number(b.durationMs)))
    : 0;
  let rpe = Number(b.rpe);
  if (!Number.isFinite(rpe)) rpe = null;
  else rpe = Math.min(10, Math.max(1, Math.round(rpe)));

  const info = insertWorkout.run({
    user_id: req.session.userId,
    title: (b.title && String(b.title).trim()) || "Workout",
    iso_date: isoDate,
    duration_ms: durationMs,
    reps: b.reps ? String(b.reps).trim() : null,
    weight: b.weight ? String(b.weight).trim() : null,
    distance: b.distance ? String(b.distance).trim() : null,
    rpe,
    notes: b.notes ? String(b.notes).trim() : null,
  });
  const row = db
    .prepare("SELECT * FROM workouts WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json({ workout: serialize(row) });
});

function isoWeekKey(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

function parseLeadingNumber(text) {
  if (!text) return null;
  const m = String(text).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

router.get("/stats", (req, res) => {
  const rows = listWorkouts.all(req.session.userId);

  const totalWorkouts = rows.length;
  const totalTimeMs = rows.reduce((a, w) => a + (w.duration_ms || 0), 0);

  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayDow);
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d.toISOString().slice(0, 10));
  }
  const weekMsByDate = Object.fromEntries(weekDates.map((d) => [d, 0]));
  for (const w of rows) {
    if (w.iso_date in weekMsByDate) weekMsByDate[w.iso_date] += w.duration_ms || 0;
  }

  let maxWeight = null;
  let maxWeightUnit = "";
  let longestWorkoutMs = 0;
  const weekTotals = {};
  for (const w of rows) {
    const wt = parseLeadingNumber(w.weight);
    if (wt !== null && (maxWeight === null || wt > maxWeight)) {
      maxWeight = wt;
      const unitMatch = String(w.weight).match(/[a-zA-Z]+/);
      maxWeightUnit = unitMatch ? unitMatch[0] : "";
    }
    if ((w.duration_ms || 0) > longestWorkoutMs) longestWorkoutMs = w.duration_ms || 0;
    const wk = isoWeekKey(w.iso_date);
    weekTotals[wk] = (weekTotals[wk] || 0) + (w.duration_ms || 0);
  }
  const bestWeekMs = Object.values(weekTotals).reduce((a, v) => Math.max(a, v), 0);

  res.json({
    totalWorkouts,
    totalTimeMs,
    weekDates,
    weekMsByDate,
    maxWeight,
    maxWeightUnit,
    longestWorkoutMs,
    bestWeekMs,
  });
});

module.exports = router;
