const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./src/routes/auth");
const workoutRoutes = require("./src/routes/workouts");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    name: "connect.sid",
    secret: process.env.SESSION_SECRET || "stride-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  })
);

app.use("/api", authRoutes);
app.use("/api/workouts", workoutRoutes);

app.use(express.static(path.join(__dirname, "public")));

function sendProtected(page) {
  return (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.redirect("/login.html");
    }
    res.sendFile(path.join(__dirname, "views", page));
  };
}

app.get("/dashboard", sendProtected("dashboard.html"));
app.get("/history", sendProtected("history.html"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

app.listen(PORT, () => {
  console.log(`Stride running at http://localhost:${PORT}`);
});
