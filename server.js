if (process.env.NODE_ENV !== "production") {
  try {
    require("dotenv").config();
  } catch {
    // dotenv is a devDependency; ignore if not installed (e.g. production)
  }
}

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { ensureSchema } = require("./src/db");
const { getUserIdFromReq } = require("./src/middleware/auth");
const authRoutes = require("./src/routes/auth");
const workoutRoutes = require("./src/routes/workouts");
const routineRoutes = require("./src/routes/routines");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.use("/api", async (req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    next(err);
  }
});

app.use("/api", authRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/routines", routineRoutes);

app.use(express.static(path.join(__dirname, "public")));

function sendProtected(page) {
  return (req, res) => {
    if (!getUserIdFromReq(req)) {
      return res.redirect("/login.html");
    }
    res.sendFile(path.join(__dirname, "views", page));
  };
}

app.get("/dashboard", sendProtected("dashboard.html"));
app.get("/history", sendProtected("history.html"));
app.get("/routines", sendProtected("routines.html"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Stride running at http://localhost:${PORT}`);
});
