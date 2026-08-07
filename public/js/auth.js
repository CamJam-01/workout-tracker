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
