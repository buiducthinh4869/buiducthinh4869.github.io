/* Language switch shared by every page.
   The <head> of each page sets html[data-lang] before paint, so this file only
   wires the EN/VI buttons and keeps the page title in step. */
(function () {
  "use strict";

  var root = document.documentElement;

  function current() {
    return root.getAttribute("data-lang") === "vi" ? "vi" : "en";
  }

  function apply(lang) {
    root.setAttribute("data-lang", lang);
    root.lang = lang;

    var title = root.getAttribute("data-title-" + lang);
    if (title) document.title = title;

    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });

    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: lang } }));
  }

  document.querySelectorAll(".lang-switch button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = btn.dataset.lang;
      if (lang === current()) return;
      try { localStorage.setItem("lang", lang); } catch (e) { /* storage blocked: switch still works */ }
      apply(lang);
    });
  });

  apply(current());
})();
