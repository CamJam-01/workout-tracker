(function () {
  var LOADER_ID = "feedback-widget-loader";

  // The widget script is async, so window.ClientFeedback may not exist yet when
  // this runs; wait for the loader's load event before touching the API.
  function widgetReady() {
    return new Promise(function (resolve, reject) {
      if (window.ClientFeedback) {
        resolve();
        return;
      }
      var loader = document.getElementById(LOADER_ID);
      if (!loader) {
        reject();
        return;
      }
      loader.addEventListener("load", function () {
        if (window.ClientFeedback) {
          resolve();
        } else {
          reject();
        }
      }, { once: true });
      loader.addEventListener("error", reject, { once: true });
    }).then(function () {
      return window.ClientFeedback.ready();
    });
  }

  function currentUserName() {
    return fetch("/api/me", { headers: { "Content-Type": "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { return data && data.user && data.user.name; });
  }

  Promise.all([widgetReady(), currentUserName()])
    .then(function (results) {
      var name = results[1];
      if (name) window.ClientFeedback.prefill({ name: name });
    })
    .catch(function () {});
})();
