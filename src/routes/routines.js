const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function serialize(r) {
  return {
    id: r.id,
    name: r.name,
    exercise: r.exercise,
    reps: r.reps,
    weight: r.weight,
    distance: r.distance,
    rpe: r.rpe,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function clampRpe(value) {
  const rpe = Number(value);
  if (!Number.isFinite(rpe)) return null;
  return Math.min(10, Math.max(1, Math.round(rpe)));
}

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM routines WHERE user_id = $1 ORDER BY created_at DESC, id DESC",
      [req.userId]
    );
    res.json({ routines: result.rows.map(serialize) });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const result = await pool.query(
      `INSERT INTO routines (user_id, name, exercise, reps, weight, distance, rpe, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.userId,
        String(b.name).trim(),
        b.exercise ? String(b.exercise).trim() : null,
        b.reps ? String(b.reps).trim() : null,
        b.weight ? String(b.weight).trim() : null,
        b.distance ? String(b.distance).trim() : null,
        clampRpe(b.rpe),
        b.notes ? String(b.notes).trim() : null,
      ]
    );
    res.status(201).json({ routine: serialize(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await pool.query(
      "SELECT * FROM routines WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    const current = existing.rows[0];
    if (!current) return res.status(404).json({ error: "Routine not found" });

    const b = req.body || {};
    if ("name" in b && !String(b.name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const name = "name" in b ? String(b.name).trim() : current.name;
    const exercise =
      "exercise" in b ? (b.exercise ? String(b.exercise).trim() : null) : current.exercise;
    const reps = "reps" in b ? (b.reps ? String(b.reps).trim() : null) : current.reps;
    const weight = "weight" in b ? (b.weight ? String(b.weight).trim() : null) : current.weight;
    const distance =
      "distance" in b ? (b.distance ? String(b.distance).trim() : null) : current.distance;
    const rpe = "rpe" in b ? clampRpe(b.rpe) : current.rpe;
    const notes = "notes" in b ? (b.notes ? String(b.notes).trim() : null) : current.notes;

    const result = await pool.query(
      `UPDATE routines SET name = $1, exercise = $2, reps = $3, weight = $4,
         distance = $5, rpe = $6, notes = $7
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [name, exercise, reps, weight, distance, rpe, notes, req.params.id, req.userId]
    );
    res.json({ routine: serialize(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM routines WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Routine not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
