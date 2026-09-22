(function () {
  function setNameField(root, name) {
    var input = root.querySelector("#submitter-name");
    if (input && !input.value) {
      input.value = name;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return !!input;
  }

  function attach(shadowRoot, name) {
    if (setNameField(shadowRoot, name)) return;
    var observer = new MutationObserver(function () {
      if (setNameField(shadowRoot, name)) observer.disconnect();
    });
    observer.observe(shadowRoot, { childList: true, subtree: true });
  }

  function watchForWidget(name) {
    var existing = document.querySelector("[data-feedback-widget]");
    if (existing && existing.shadowRoot) {
      attach(existing.shadowRoot, name);
      return;
    }
    // The widget's host element is appended to <body> asynchronously by the
    // loader script, so wait for it before we can reach into its shadow root.
    var bodyObserver = new MutationObserver(function () {
      var host = document.querySelector("[data-feedback-widget]");
      if (host && host.shadowRoot) {
        bodyObserver.disconnect();
        attach(host.shadowRoot, name);
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  fetch("/api/me", { headers: { "Content-Type": "application/json" } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      var name = data && data.user && data.user.name;
      if (name) watchForWidget(name);
    })
    .catch(function () {});
})();
