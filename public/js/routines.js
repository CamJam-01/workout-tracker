(function () {
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

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  const state = { routines: [], editingId: null };

  const el = (id) => document.getElementById(id);

  const EDIT_ICON =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';

  function renderGrid() {
    const gridEl = el("routines-grid");
    const emptyEl = el("routines-empty");
    if (state.routines.length === 0) {
      gridEl.innerHTML = "";
      gridEl.style.display = "none";
      emptyEl.style.display = "block";
      return;
    }
    gridEl.style.display = "grid";
    emptyEl.style.display = "none";
    gridEl.innerHTML = state.routines
      .map(
        (r) => `<div class="routine-card">
          <div class="routine-card-top">
            <div class="routine-card-name">${escapeHtml(r.name)}</div>
            <div class="routine-card-actions">
              <button type="button" class="routine-icon-btn" aria-label="Edit routine" data-edit="${r.id}">${EDIT_ICON}</button>
              <button type="button" class="routine-icon-btn" aria-label="Delete routine" data-delete="${r.id}">&times;</button>
            </div>
          </div>
          <div class="routine-card-exercise">${escapeHtml(r.exercise || "—")}</div>
          <div class="routine-card-meta">
            <span>${escapeHtml(r.reps || "—")}</span>
            <span>&middot;</span>
            <span>${escapeHtml(r.weight || "—")}</span>
            <span>&middot;</span>
            <span>${escapeHtml(r.distance || "—")}</span>
          </div>
        </div>`
      )
      .join("");
    gridEl.querySelectorAll("[data-edit]").forEach((node) => {
      node.addEventListener("click", () => openEditModal(Number(node.getAttribute("data-edit"))));
    });
    gridEl.querySelectorAll("[data-delete]").forEach((node) => {
      node.addEventListener("click", () => handleDeleteRoutine(Number(node.getAttribute("data-delete"))));
    });
  }

  function openAddModal() {
    state.editingId = null;
    el("routine-modal-title").textContent = "New routine";
    el("routine-name").value = "";
    el("routine-exercise").value = "";
    el("routine-reps").value = "";
    el("routine-weight").value = "";
    el("routine-distance").value = "";
    el("routine-rpe").value = 5;
    el("routine-rpe-val").textContent = "5";
    el("routine-notes").value = "";
    el("routine-modal").style.display = "flex";
  }

  function openEditModal(id) {
    const r = state.routines.find((x) => x.id === id);
    if (!r) return;
    state.editingId = id;
    el("routine-modal-title").textContent = "Edit routine";
    el("routine-name").value = r.name || "";
    el("routine-exercise").value = r.exercise || "";
    el("routine-reps").value = r.reps || "";
    el("routine-weight").value = r.weight || "";
    el("routine-distance").value = r.distance || "";
    el("routine-rpe").value = r.rpe || 5;
    el("routine-rpe-val").textContent = String(r.rpe || 5);
    el("routine-notes").value = r.notes || "";
    el("routine-modal").style.display = "flex";
  }

  function closeModal() {
    el("routine-modal").style.display = "none";
    state.editingId = null;
  }

  async function loadRoutines() {
    const { routines } = await api("/api/routines");
    state.routines = routines;
    renderGrid();
  }

  async function handleSaveRoutine() {
    const name = el("routine-name").value.trim();
    if (!name) {
      el("routine-name").focus();
      return;
    }
    const body = {
      name,
      exercise: el("routine-exercise").value.trim(),
      reps: el("routine-reps").value.trim(),
      weight: el("routine-weight").value.trim(),
      distance: el("routine-distance").value.trim(),
      rpe: Number(el("routine-rpe").value),
      notes: el("routine-notes").value.trim(),
    };
    if (state.editingId) {
      await api("/api/routines/" + state.editingId, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/routines", { method: "POST", body: JSON.stringify(body) });
    }
    closeModal();
    await loadRoutines();
  }

  async function handleDeleteRoutine(id) {
    if (!window.confirm("Delete this routine?")) return;
    await api("/api/routines/" + id, { method: "DELETE" });
    await loadRoutines();
  }

  function wireEvents() {
    el("new-routine-btn").addEventListener("click", openAddModal);
    el("routine-cancel").addEventListener("click", closeModal);
    el("routine-save").addEventListener("click", handleSaveRoutine);
    el("routine-rpe").addEventListener("input", (e) => {
      el("routine-rpe-val").textContent = e.target.value;
    });
    el("routine-modal").addEventListener("click", (e) => {
      if (e.target.id === "routine-modal") closeModal();
    });
  }

  async function init() {
    wireEvents();
    await loadRoutines();
  }

  init();
})();
