/* Renders one blog post from its Markdown source in the reader's language,
   and mounts Giscus comments below it.
   The <article id="post"> element names its sources:
     data-src-en, data-src-vi  (either may be missing)                       */
(function () {
  "use strict";

  var article = document.getElementById("post");
  if (!article) return;

  var body = article.querySelector(".prose");
  var note = article.querySelector(".lang-note");
  var cache = {};
  var shown = null;
  var GISCUS = "https://giscus.app";

  function siteLang() {
    return document.documentElement.getAttribute("data-lang") === "vi" ? "vi" : "en";
  }

  function load(src) {
    if (!cache[src]) {
      cache[src] = fetch(src).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      });
      cache[src].catch(function () { delete cache[src]; });
    }
    return cache[src];
  }

  // The page heading already shows the title, so drop the file's own H1.
  function stripTitle(md) {
    return md.replace(/^﻿?\s*#\s+[^\n]*\n+/, "");
  }

  function render(lang) {
    var src = article.dataset["src" + (lang === "vi" ? "Vi" : "En")];
    var fallback = false;
    if (!src) {
      lang = lang === "vi" ? "en" : "vi";
      src = article.dataset["src" + (lang === "vi" ? "Vi" : "En")];
      fallback = true;
    }
    if (note) note.hidden = !fallback;
    if (lang === shown) return;
    shown = lang;

    body.setAttribute("lang", lang);
    body.innerHTML = '<p class="small">' + (lang === "vi" ? "Đang tải…" : "Loading…") + "</p>";

    load(src).then(function (md) {
      if (shown !== lang) return; // a later switch won
      body.innerHTML = marked.parse(stripTitle(md));
    }).catch(function () {
      if (shown !== lang) return;
      body.innerHTML = '<p class="small">' +
        (lang === "vi" ? "Không tải được bài viết. Hãy tải lại trang." : "This post could not be loaded. Reload the page to try again.") +
        "</p>";
    });

    setGiscusLang(lang);
  }

  // ---------- Comments (Giscus) ----------

  function mountGiscus() {
    var slot = document.getElementById("giscus-slot");
    var cfg = document.getElementById("giscus-config");
    if (!slot || !cfg) return;

    if (/PLACEHOLDER/.test(cfg.dataset.repoId + cfg.dataset.categoryId)) {
      slot.innerHTML =
        '<p class="small"><span data-l="en">Comments will open soon.</span>' +
        '<span data-l="vi" lang="vi">Phần bình luận sắp được mở.</span></p>';
      return;
    }

    var s = document.createElement("script");
    s.src = GISCUS + "/client.js";
    Array.prototype.forEach.call(cfg.attributes, function (a) {
      if (a.name.indexOf("data-") === 0) s.setAttribute(a.name, a.value);
    });
    s.setAttribute("data-lang", siteLang());
    s.crossOrigin = "anonymous";
    s.async = true;
    slot.appendChild(s);
  }

  function setGiscusLang(lang) {
    var frame = document.querySelector("iframe.giscus-frame");
    if (frame) frame.contentWindow.postMessage({ giscus: { setConfig: { lang: lang } } }, GISCUS);
  }

  document.addEventListener("langchange", function (e) { render(e.detail.lang); });
  render(siteLang());
  mountGiscus();
})();
