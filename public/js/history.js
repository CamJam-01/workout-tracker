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

  function parseDurationToMs(str) {
    const parts = String(str || "").split(":").map((p) => Number(p.trim()));
    if (parts.some((p) => !Number.isFinite(p))) return 0;
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) [h, m, s] = parts;
    else if (parts.length === 2) [m, s] = parts;
    else if (parts.length === 1) [s] = parts;
    return Math.max(0, Math.round((h * 3600 + m * 60 + s) * 1000));
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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
    addDraft: null,
    addSplits: [],
    editDraft: null,
    editSplits: [],
    editRemovedSplitIds: [],
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

  function groupSiblings(iso, excludeId) {
    return state.workouts.filter((w) => w.isoDate === iso && w.id !== excludeId);
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

    const siblings = groupSiblings(w.isoDate, w.id);
    const splitsEl = el("detail-splits");
    if (siblings.length === 0) {
      splitsEl.style.display = "none";
    } else {
      splitsEl.style.display = "block";
      el("detail-splits-row").innerHTML = siblings
        .map(
          (s) =>
            `<div class="lap-chip"><span class="lap-label">${escapeHtml(s.title)}</span><span class="lap-time">${formatDuration(s.durationMs)}</span></div>`
        )
        .join("");
    }
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

  function renderSplitsEditor(containerEl, splits, onLabelChange, onTimeChange, onRemove) {
    containerEl.innerHTML = splits
      .map(
        (s, i) =>
          `<div class="splits-editor-row">
            <input type="text" class="splits-label" placeholder="Label" data-idx="${i}" value="${escapeHtml(s.label)}">
            <input type="text" class="splits-time" placeholder="mm:ss" data-idx="${i}" value="${escapeHtml(s.time)}">
            <button type="button" class="splits-remove-btn" data-idx="${i}" aria-label="Remove split">&times;</button>
          </div>`
      )
      .join("");
    containerEl.querySelectorAll(".splits-label").forEach((node) => {
      node.addEventListener("input", () => onLabelChange(Number(node.getAttribute("data-idx")), node.value));
    });
    containerEl.querySelectorAll(".splits-time").forEach((node) => {
      node.addEventListener("input", () => onTimeChange(Number(node.getAttribute("data-idx")), node.value));
    });
    containerEl.querySelectorAll(".splits-remove-btn").forEach((node) => {
      node.addEventListener("click", () => onRemove(Number(node.getAttribute("data-idx"))));
    });
  }

  function renderAddSplits() {
    renderSplitsEditor(
      el("add-splits-list"),
      state.addSplits,
      (i, v) => { state.addSplits[i].label = v; },
      (i, v) => { state.addSplits[i].time = v; },
      (i) => { state.addSplits.splice(i, 1); renderAddSplits(); }
    );
  }

  function renderEditSplits() {
    renderSplitsEditor(
      el("edit-splits-list"),
      state.editSplits,
      (i, v) => { state.editSplits[i].label = v; },
      (i, v) => { state.editSplits[i].time = v; },
      (i) => {
        const removed = state.editSplits.splice(i, 1)[0];
        if (removed && removed.id != null) state.editRemovedSplitIds.push(removed.id);
        renderEditSplits();
      }
    );
  }

  function openAddModal() {
    const selected = state.workouts[state.selectedIdx];
    const iso = selected ? selected.isoDate : todayIso();
    state.addDraft = { isoDate: iso, title: "", duration: "", rpe: "", reps: "", weight: "", distance: "", notes: "" };
    state.addSplits = [];
    el("add-date-label").textContent = new Date(iso + "T00:00:00").toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
    el("add-title").value = "";
    el("add-duration").value = "";
    el("add-rpe").value = "";
    el("add-reps").value = "";
    el("add-weight").value = "";
    el("add-distance").value = "";
    el("add-notes").value = "";
    renderAddSplits();
    el("workout-add-modal").style.display = "flex";
  }

  function closeAddModal() {
    el("workout-add-modal").style.display = "none";
    state.addDraft = null;
    state.addSplits = [];
  }

  function openEditModal() {
    const w = state.workouts[state.selectedIdx];
    if (!w) return;
    state.editDraft = w;
    state.editSplits = groupSiblings(w.isoDate, w.id).map((s) => ({ id: s.id, label: s.title, time: formatDuration(s.durationMs) }));
    state.editRemovedSplitIds = [];
    el("edit-title").value = w.title || "";
    el("edit-duration").value = formatDuration(w.durationMs);
    el("edit-rpe").value = w.rpe != null ? w.rpe : "";
    el("edit-reps").value = w.reps || "";
    el("edit-weight").value = w.weight || "";
    el("edit-distance").value = w.distance || "";
    el("edit-notes").value = w.notes || "";
    renderEditSplits();
    el("workout-edit-modal").style.display = "flex";
  }

  function closeEditModal() {
    el("workout-edit-modal").style.display = "none";
    state.editDraft = null;
    state.editSplits = [];
    state.editRemovedSplitIds = [];
  }

  async function reloadWorkouts(keepIso) {
    const { workouts } = await api("/api/workouts");
    state.workouts = workouts;
    if (keepIso) {
      const idx = state.workouts.findIndex((w) => w.isoDate === keepIso);
      state.selectedIdx = idx >= 0 ? idx : 0;
    } else if (state.selectedIdx >= state.workouts.length) {
      state.selectedIdx = 0;
    }
    render();
  }

  async function handleSaveAdd() {
    const draft = state.addDraft;
    const isoDate = draft.isoDate;
    const primary = await api("/api/workouts", {
      method: "POST",
      body: JSON.stringify({
        title: el("add-title").value.trim() || "Workout",
        isoDate,
        durationMs: parseDurationToMs(el("add-duration").value),
        rpe: el("add-rpe").value ? Number(el("add-rpe").value) : null,
        reps: el("add-reps").value.trim(),
        weight: el("add-weight").value.trim(),
        distance: el("add-distance").value.trim(),
        notes: el("add-notes").value.trim(),
      }),
    });
    for (const split of state.addSplits) {
      await api("/api/workouts", {
        method: "POST",
        body: JSON.stringify({
          title: split.label || "Split",
          isoDate,
          durationMs: parseDurationToMs(split.time),
        }),
      });
    }
    closeAddModal();
    await reloadWorkouts(primary.workout.isoDate);
  }

  async function handleSaveEdit() {
    const w = state.editDraft;
    await api("/api/workouts/" + w.id, {
      method: "PUT",
      body: JSON.stringify({
        title: el("edit-title").value.trim() || "Workout",
        durationMs: parseDurationToMs(el("edit-duration").value),
        rpe: el("edit-rpe").value ? Number(el("edit-rpe").value) : null,
        reps: el("edit-reps").value.trim(),
        weight: el("edit-weight").value.trim(),
        distance: el("edit-distance").value.trim(),
        notes: el("edit-notes").value.trim(),
      }),
    });
    for (const split of state.editSplits) {
      if (split.id != null) {
        await api("/api/workouts/" + split.id, {
          method: "PUT",
          body: JSON.stringify({ title: split.label || "Split", durationMs: parseDurationToMs(split.time) }),
        });
      } else {
        await api("/api/workouts", {
          method: "POST",
          body: JSON.stringify({ title: split.label || "Split", isoDate: w.isoDate, durationMs: parseDurationToMs(split.time) }),
        });
      }
    }
    for (const id of state.editRemovedSplitIds) {
      await api("/api/workouts/" + id, { method: "DELETE" });
    }
    const keepIso = w.isoDate;
    closeEditModal();
    await reloadWorkouts(keepIso);
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

    el("cal-add-btn").addEventListener("click", openAddModal);
    el("detail-edit-btn").addEventListener("click", openEditModal);

    el("add-cancel").addEventListener("click", closeAddModal);
    el("add-save").addEventListener("click", () => { handleSaveAdd().catch((err) => alert(err.message)); });
    el("add-split-btn").addEventListener("click", () => {
      state.addSplits.push({ label: "Lap " + (state.addSplits.length + 1), time: "" });
      renderAddSplits();
    });
    el("workout-add-modal").addEventListener("click", (e) => {
      if (e.target.id === "workout-add-modal") closeAddModal();
    });

    el("edit-cancel").addEventListener("click", closeEditModal);
    el("edit-save").addEventListener("click", () => { handleSaveEdit().catch((err) => alert(err.message)); });
    el("edit-split-btn").addEventListener("click", () => {
      state.editSplits.push({ id: null, label: "Lap " + (state.editSplits.length + 1), time: "" });
      renderEditSplits();
    });
    el("workout-edit-modal").addEventListener("click", (e) => {
      if (e.target.id === "workout-edit-modal") closeEditModal();
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
