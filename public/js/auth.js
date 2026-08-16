(function () {
  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("login-error");
      const submitBtn = document.getElementById("login-submit");
      errorEl.textContent = "";
      submitBtn.disabled = true;
      try {
        await postJson("/api/login", {
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
        });
        window.location.href = "/dashboard";
      } catch (err) {
        errorEl.textContent = err.message;
        submitBtn.disabled = false;
      }
    });
  }

  const togglePasswordBtn = document.getElementById("toggle-password");
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", () => {
      const passwordInput = document.getElementById("password");
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      togglePasswordBtn.textContent = showing ? "Show" : "Hide";
      togglePasswordBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
  }

  const resetModal = document.getElementById("reset-modal");
  if (resetModal) {
    const resetStatusEl = document.getElementById("reset-status");
    const openBtn = document.getElementById("open-reset-modal");
    const closeModal = () => {
      resetModal.style.display = "none";
      document.getElementById("reset-email").value = "";
      resetStatusEl.textContent = "";
      resetStatusEl.className = "reset-status";
    };
    openBtn.addEventListener("click", () => {
      resetModal.style.display = "flex";
    });
    document.getElementById("reset-cancel").addEventListener("click", closeModal);
    resetModal.addEventListener("click", (e) => {
      if (e.target === resetModal) closeModal();
    });
    document.getElementById("reset-send").addEventListener("click", async () => {
      const email = document.getElementById("reset-email").value.trim();
      if (!email) {
        resetStatusEl.textContent = "Enter an email address.";
        resetStatusEl.className = "reset-status error";
        return;
      }
      try {
        await postJson("/api/forgot-password", { email });
      } catch (err) {
        // ignore transport errors; always show the same generic message below
      }
      resetStatusEl.textContent = "If an account exists for that email, we've sent a reset link.";
      resetStatusEl.className = "reset-status success";
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("signup-error");
      const submitBtn = document.getElementById("signup-submit");
      errorEl.textContent = "";
      submitBtn.disabled = true;
      try {
        await postJson("/api/signup", {
          name: document.getElementById("name").value,
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
        });
        window.location.href = "/dashboard";
      } catch (err) {
        errorEl.textContent = err.message;
        submitBtn.disabled = false;
      }
    });
  }
})();
