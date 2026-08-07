(function () {
  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatDuration(ms) {
    const totalSec = Math.floor((ms || 0) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return h + ":" + pad2(m) + ":" + pad2(s);
    return pad2(m) + ":" + pad2(s);
  }

  function formatDateLabel(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  async function api(url, opts) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
    if (res.status === 401) {
      window.location.href = "/login.html";
      throw new Error("Not authenticated");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const state = {
    workouts: [],
    selectedIdx: 0,
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
  };

  const el = (id) => document.getElementById(id);

  function selectByIndex(idx) {
    state.selectedIdx = idx;
    render();
  }

  function selectByIso(iso) {
    const idx = state.workouts.findIndex((w) => w.isoDate === iso);
    if (idx >= 0) selectByIndex(idx);
  }

  function renderSub() {
    el("history-sub").textContent = state.workouts.length + " workouts logged so far.";
  }

  function renderList() {
    const listEl = el("workout-list");
    if (state.workouts.length === 0) {
      listEl.innerHTML = '<div class="empty-note">No workouts yet — start the stopwatch on your Dashboard to log your first one.</div>';
      return;
    }
    listEl.innerHTML = state.workouts
      .map((w, i) => {
        const summary = w.distance || w.weight || "recovery";
        const selected = i === state.selectedIdx;
        return `<div class="workout-item${selected ? " selected" : ""}" data-idx="${i}">
          <div class="workout-item-top">
            <span class="workout-item-title">${escapeHtml(w.title)}</span>
            <span class="workout-item-date">${formatDateLabel(w.isoDate)}</span>
          </div>
          <div class="workout-item-meta">
            <span>${formatDuration(w.durationMs)}</span>
            <span>&middot;</span>
            <span>${escapeHtml(summary)}</span>
          </div>
        </div>`;
      })
      .join("");
    listEl.querySelectorAll("[data-idx]").forEach((node) => {
      node.addEventListener("click", () => selectByIndex(Number(node.getAttribute("data-idx"))));
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function renderDetail() {
    const card = el("detail-card");
    if (state.workouts.length === 0) {
      card.style.display = "none";
      return;
    }
    card.style.display = "flex";
    const w = state.workouts[state.selectedIdx];
    el("detail-date").textContent = formatDateLabel(w.isoDate);
    el("detail-title").textContent = w.title;
    el("detail-duration").textContent = formatDuration(w.durationMs);
    el("detail-reps").textContent = w.reps || "—";
    el("detail-weight").textContent = w.weight || "—";
    el("detail-distance").textContent = w.distance || "—";
    el("detail-rpe").textContent = w.rpe != null ? w.rpe + "/10" : "—";
    el("detail-notes").textContent = w.notes || "No notes.";
  }

  function renderCalendar() {
    const workoutDates = new Set(state.workouts.map((w) => w.isoDate));
    const selected = state.workouts[state.selectedIdx];
    const firstDay = new Date(state.calYear, state.calMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
    el("cal-month-label").textContent = firstDay.toLocaleString("en-US", { month: "long", year: "numeric" });

    let html = "";
    for (let i = 0; i < startWeekday; i++) html += '<div class="cal-cell"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = state.calYear + "-" + pad2(state.calMonth + 1) + "-" + pad2(d);
      const hasWorkout = workoutDates.has(iso);
      const isSelected = selected && iso === selected.isoDate;
      html += `<div class="cal-cell${hasWorkout ? " has-workout" : ""}${isSelected ? " selected" : ""}" ${hasWorkout ? `data-iso="${iso}"` : ""}>
        <span>${d}</span>${hasWorkout ? '<div class="cal-dot"></div>' : ""}
      </div>`;
    }
    el("cal-grid").innerHTML = html;
    el("cal-grid").querySelectorAll("[data-iso]").forEach((node) => {
      node.addEventListener("click", () => selectByIso(node.getAttribute("data-iso")));
    });

    const sameDayEl = el("cal-sameday");
    if (!selected) {
      sameDayEl.style.display = "none";
      return;
    }
    const sameDayIdx = state.workouts
      .map((w, i) => i)
      .filter((i) => state.workouts[i].isoDate === selected.isoDate);
    if (sameDayIdx.length > 1) {
      sameDayEl.style.display = "flex";
      sameDayEl.innerHTML =
        '<div class="cal-sameday-title">Logged that day</div>' +
        sameDayIdx
          .map(
            (i) =>
              `<button type="button" class="cal-sameday-btn${i === state.selectedIdx ? " selected" : ""}" data-idx="${i}">${escapeHtml(
                state.workouts[i].title
              )}</button>`
          )
          .join("");
      sameDayEl.querySelectorAll("[data-idx]").forEach((node) => {
        node.addEventListener("click", () => selectByIndex(Number(node.getAttribute("data-idx"))));
      });
    } else {
      sameDayEl.style.display = "none";
    }
  }

  function render() {
    renderSub();
    renderList();
    renderDetail();
    renderCalendar();
  }

  function wireEvents() {
    el("cal-prev").addEventListener("click", () => {
      state.calMonth -= 1;
      if (state.calMonth < 0) { state.calMonth = 11; state.calYear -= 1; }
      renderCalendar();
    });
    el("cal-next").addEventListener("click", () => {
      state.calMonth += 1;
      if (state.calMonth > 11) { state.calMonth = 0; state.calYear += 1; }
      renderCalendar();
    });
  }

  async function init() {
    wireEvents();
    const { workouts } = await api("/api/workouts");
    state.workouts = workouts;
    if (workouts.length > 0) {
      const d = new Date(workouts[0].isoDate + "T00:00:00");
      state.calYear = d.getFullYear();
      state.calMonth = d.getMonth();
    }
    render();
  }

  init();
})();
