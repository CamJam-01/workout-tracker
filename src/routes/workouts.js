const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

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

async function listWorkouts(userId) {
  const result = await pool.query(
    "SELECT * FROM workouts WHERE user_id = $1 ORDER BY iso_date DESC, created_at DESC, id DESC",
    [userId]
  );
  return result.rows;
}

router.get("/", async (req, res, next) => {
  try {
    const rows = await listWorkouts(req.userId);
    res.json({ workouts: rows.map(serialize) });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
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

    const result = await pool.query(
      `INSERT INTO workouts (user_id, title, iso_date, duration_ms, reps, weight, distance, rpe, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.userId,
        (b.title && String(b.title).trim()) || "Workout",
        isoDate,
        durationMs,
        b.reps ? String(b.reps).trim() : null,
        b.weight ? String(b.weight).trim() : null,
        b.distance ? String(b.distance).trim() : null,
        rpe,
        b.notes ? String(b.notes).trim() : null,
      ]
    );
    res.status(201).json({ workout: serialize(result.rows[0]) });
  } catch (err) {
    next(err);
  }
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

router.get("/stats", async (req, res, next) => {
  try {
    const rows = await listWorkouts(req.userId);

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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
