(function () {
  const FACTOIDS = [
    "Just 30 minutes of exercise a day can boost your mood for up to 12 hours.",
    "Regular cardio lowers resting heart rate and strengthens your heart muscle.",
    "Strength training twice a week helps preserve muscle mass as you age.",
    "Exercise increases BDNF, a protein that supports memory and learning.",
    "A brisk walk after meals can measurably lower blood sugar spikes.",
    "Consistent movement improves sleep quality, even in short sessions.",
    "Exercise releases endorphins that reduce perceived stress within minutes.",
  ];

  function pad(n, len) { return String(n).padStart(len, "0"); }
  function formatClock(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSec = Math.floor(ms / 1000);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60);
    return pad(min, 2) + ":" + pad(sec, 2) + "." + pad(cs, 2);
  }
  function formatLap(ms) {
    const totalSec = Math.floor(ms / 1000);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60);
    return pad(min, 2) + ":" + pad(sec, 2);
  }
  function formatDurationLong(ms) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return h + "h " + pad(m, 2) + "m";
    return m + "m";
  }
  function todayIso() {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  async function api(url, opts) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (res.status === 401) {
      window.location.href = "/login.html";
      throw new Error("Not authenticated");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const state = {
    running: false,
    startTs: null,
    elapsedMs: 0,
    laps: [],
    view: "dashboard",
    quoteIdx: Math.floor(Math.random() * FACTOIDS.length),
    customHighlight: null,
    editingHighlight: false,
    segments: [],
    forms: [],
    activePage: 0,
    tickInterval: null,
    quoteInterval: null,
  };

  const el = (id) => document.getElementById(id);

  function renderHighlight() {
    el("highlight-kicker").textContent = state.customHighlight ? "Your focus" : "Did you know";
    el("highlight-text").textContent = state.customHighlight || FACTOIDS[state.quoteIdx];
    el("highlight-edit-btn").textContent = state.customHighlight ? "Edit" : "Set your own";
    el("highlight-edit-btn").style.display = state.editingHighlight ? "none" : "";
    el("highlight-edit-row").style.display = state.editingHighlight ? "flex" : "none";
    if (state.editingHighlight) el("highlight-input").value = state.customHighlight || "";
  }

  function renderStopwatch() {
    el("stopwatch-time").textContent = formatClock(state.elapsedMs);
    el("stopwatch-status").textContent = state.running
      ? "Recording"
      : state.elapsedMs > 0
      ? "Paused"
      : "Ready when you are";
    const toggleBtn = el("toggle-btn");
    toggleBtn.className = "toggle-btn " + (state.running ? "running" : "stopped");
    toggleBtn.setAttribute("aria-label", state.running ? "Stop workout" : "Start workout");
    el("toggle-icon").className = state.running ? "icon-stop" : "icon-play";
    el("lap-btn").disabled = !state.running;
    el("lap-btn").style.opacity = state.running ? 1 : 0.45;

    const lapsRow = el("laps-row");
    if (state.laps.length === 0) {
      lapsRow.style.display = "none";
      lapsRow.innerHTML = "";
    } else {
      lapsRow.style.display = "flex";
      lapsRow.innerHTML = [...state.laps]
        .reverse()
        .map(
          (lap) =>
            `<div class="lap-chip"><span class="lap-label">${lap.label}</span><span class="lap-time">${lap.display}</span></div>`
        )
        .join("");
    }
  }

  function tick() {
    state.elapsedMs = Date.now() - state.startTs;
    renderStopwatch();
  }

  function handleToggle() {
    if (!state.running) {
      state.startTs = Date.now() - state.elapsedMs;
      state.tickInterval = setInterval(tick, 50);
      state.running = true;
      renderStopwatch();
    } else {
      clearInterval(state.tickInterval);
      const priorLaps = state.laps;
      const finalLabel = priorLaps.length === 0 ? "Workout" : "Lap " + (priorLaps.length + 1);
      const finalSegment = { label: finalLabel, display: formatLap(state.elapsedMs), ms: state.elapsedMs };
      state.segments = [...priorLaps, finalSegment];
      state.forms = state.segments.map(() => ({ exercise: "", reps: "", weight: "", distance: "", notes: "", rpe: 5 }));
      state.activePage = 0;
      state.running = false;
      enterEntryView();
    }
  }

  function handleLap() {
    if (!state.running) return;
    const label = "Lap " + (state.laps.length + 1);
    state.laps.push({ label, display: formatLap(state.elapsedMs), ms: state.elapsedMs });
    state.startTs = Date.now();
    state.elapsedMs = 0;
    renderStopwatch();
  }

  function resetWorkout() {
    state.view = "dashboard";
    state.elapsedMs = 0;
    state.laps = [];
    state.startTs = null;
    state.segments = [];
    state.forms = [];
    state.activePage = 0;
    el("view-dashboard").style.display = "";
    el("view-entry").style.display = "none";
    renderStopwatch();
  }

  function renderEntryPages() {
    const isMulti = state.segments.length > 1;
    const pagesEl = el("entry-pages");
    const headerEl = el("entry-form-header");
    if (!isMulti) {
      pagesEl.style.display = "none";
      headerEl.style.display = "none";
      return;
    }
    pagesEl.style.display = "flex";
    headerEl.style.display = "";
    pagesEl.innerHTML =
      '<div class="entry-pages-title">Splits</div>' +
      state.segments
        .map((seg, i) => {
          const active = i === state.activePage;
          return `<button type="button" class="entry-page-btn" data-page="${i}" style="background:${
            active ? "var(--color-accent)" : "transparent"
          };color:${active ? "var(--color-bg)" : "var(--color-text)"}"><span>${seg.label}</span><span class="dur">${seg.display}</span></button>`;
        })
        .join("");
    pagesEl.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        saveActiveFormFromInputs();
        state.activePage = Number(btn.getAttribute("data-page"));
        renderEntryForm();
      });
    });
    const seg = state.segments[state.activePage];
    headerEl.innerHTML = `${seg.label} <span class="dur">&middot; ${seg.display}</span>`;
  }

  function saveActiveFormFromInputs() {
    const idx = state.activePage;
    state.forms[idx] = {
      exercise: el("f-exercise").value,
      reps: el("f-reps").value,
      weight: el("f-weight").value,
      distance: el("f-distance").value,
      notes: el("f-notes").value,
      rpe: Number(el("f-rpe").value),
    };
  }

  function renderEntryForm() {
    const form = state.forms[state.activePage] || { exercise: "", reps: "", weight: "", distance: "", notes: "", rpe: 5 };
    el("f-exercise").value = form.exercise;
    el("f-reps").value = form.reps;
    el("f-weight").value = form.weight;
    el("f-distance").value = form.distance;
    el("f-notes").value = form.notes;
    el("f-rpe").value = form.rpe;
    el("f-rpe-val").textContent = form.rpe;
    renderEntryPages();
  }

  function enterEntryView() {
    const totalMs = state.segments.reduce((a, s) => a + s.ms, 0);
    el("entry-summary").textContent =
      "Total time " + formatLap(totalMs) + (state.segments.length > 1 ? " across " + state.segments.length + " splits" : "");
    renderEntryForm();
    el("view-dashboard").style.display = "none";
    el("view-entry").style.display = "";
  }

  async function handleSaveWorkout() {
    saveActiveFormFromInputs();
    const saveBtn = el("entry-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const iso = todayIso();
      for (let i = 0; i < state.segments.length; i++) {
        const seg = state.segments[i];
        const form = state.forms[i];
        await api("/api/workouts", {
          method: "POST",
          body: JSON.stringify({
            title: form.exercise && form.exercise.trim() ? form.exercise.trim() : seg.label,
            isoDate: iso,
            durationMs: seg.ms,
            reps: form.reps,
            weight: form.weight,
            distance: form.distance,
            rpe: form.rpe,
            notes: form.notes,
          }),
        });
      }
      resetWorkout();
      loadStats();
    } catch (err) {
      alert(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save workout";
    }
  }

  function handleDiscard() {
    resetWorkout();
  }

  async function loadStats() {
    const s = await api("/api/workouts/stats");
    el("stat-total-workouts").textContent = s.totalWorkouts;
    el("stat-total-time").textContent = formatDurationLong(s.totalTimeMs);

    const maxMs = Math.max(...s.weekDates.map((d) => s.weekMsByDate[d]), 1);
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    el("week-bars").innerHTML = s.weekDates
      .map((d, i) => {
        const ms = s.weekMsByDate[d];
        const heightPct = Math.max(6, Math.round((ms / maxMs) * 100));
        const color = ms > 0 ? "var(--color-accent)" : "rgba(32,30,29,0.12)";
        return `<div class="week-bar-col"><div class="week-bar" style="height:${heightPct}%;background:${color};"></div><div class="week-bar-label">${labels[i]}</div></div>`;
      })
      .join("");

    el("pr-max-weight").textContent = s.maxWeight != null ? s.maxWeight + (s.maxWeightUnit ? " " + s.maxWeightUnit : "") : "—";
    el("pr-longest").textContent = s.longestWorkoutMs ? formatDurationLong(s.longestWorkoutMs) : "—";
    el("pr-best-week").textContent = s.bestWeekMs ? formatDurationLong(s.bestWeekMs) : "—";
  }

  async function loadMe() {
    const { user } = await api("/api/me");
    el("avatar").textContent = (user.name || "?").trim().charAt(0).toUpperCase();
    state.customHighlight = user.highlightText || null;
    renderHighlight();
    return user;
  }

  function initHighlightRotation() {
    state.quoteInterval = setInterval(() => {
      if (!state.customHighlight) {
        state.quoteIdx = (state.quoteIdx + 1) % FACTOIDS.length;
        renderHighlight();
      }
    }, 6000);
  }

  function wireEvents() {
    el("toggle-btn").addEventListener("click", handleToggle);
    el("lap-btn").addEventListener("click", handleLap);
    el("entry-discard").addEventListener("click", handleDiscard);
    el("entry-save").addEventListener("click", handleSaveWorkout);
    el("f-rpe").addEventListener("input", () => {
      el("f-rpe-val").textContent = el("f-rpe").value;
    });

    el("highlight-edit-btn").addEventListener("click", () => {
      state.editingHighlight = true;
      renderHighlight();
      el("highlight-input").focus();
    });
    el("highlight-save").addEventListener("click", async () => {
      const v = el("highlight-input").value.trim();
      state.customHighlight = v || null;
      state.editingHighlight = false;
      renderHighlight();
      try {
        await api("/api/me", { method: "PUT", body: JSON.stringify({ highlightText: state.customHighlight }) });
      } catch (err) {
        // ignore; UI already reflects the local change
      }
    });

    el("logout-link").addEventListener("click", async (e) => {
      e.preventDefault();
      await api("/api/logout", { method: "POST" });
      window.location.href = "/";
    });
  }

  function initDateLabel() {
    const d = new Date();
    el("today-label").textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  async function init() {
    wireEvents();
    initDateLabel();
    renderStopwatch();
    renderHighlight();
    initHighlightRotation();
    try {
      await loadMe();
      await loadStats();
    } catch (err) {
      // loadMe/loadStats already redirect to login on 401
    }
  }

  init();
})();
