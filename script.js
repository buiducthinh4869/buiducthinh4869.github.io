(function () {
  "use strict";

  var posts = Array.prototype.slice.call(document.querySelectorAll(".post"));
  var markdownCache = {};
  var giscusConfig = document.getElementById("giscus-config");
  var GISCUS_ORIGIN = "https://giscus.app";

  // ---------- Markdown ----------

  function loadMarkdown(src) {
    if (!markdownCache[src]) {
      markdownCache[src] = fetch(src).then(function (res) {
        if (!res.ok) throw new Error(res.status + " " + res.statusText);
        return res.text();
      });
      // Allow a retry if the request fails.
      markdownCache[src].catch(function () { delete markdownCache[src]; });
    }
    return markdownCache[src];
  }

  // The post title is already shown in the list, so drop the file's leading H1.
  function stripLeadingTitle(md) {
    return md.replace(/^﻿?\s*#\s+[^\n]*\n+/, "");
  }

  function renderPost(post, lang) {
    var content = post.querySelector(".post-content");
    var titleLink = post.querySelector(".post-title a");

    post.dataset.currentLang = lang;
    content.setAttribute("lang", lang);
    titleLink.textContent = post.dataset["title" + (lang === "vi" ? "Vi" : "En")];

    post.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });

    content.innerHTML = '<p class="post-status">Loading…</p>';
    loadMarkdown(post.dataset["src" + (lang === "vi" ? "Vi" : "En")])
      .then(function (md) {
        if (post.dataset.currentLang !== lang) return; // a newer toggle won
        content.innerHTML = marked.parse(stripLeadingTitle(md));
      })
      .catch(function () {
        content.innerHTML = '<p class="post-status">Sorry, this post could not be loaded.</p>';
      });

    setGiscusLang(lang);
  }

  // ---------- Giscus ----------
  // Giscus supports one widget per page, so it is mounted into whichever post
  // is open (the accordion keeps at most one post open).

  function giscusConfigured() {
    return giscusConfig &&
      giscusConfig.dataset.repoId.indexOf("PLACEHOLDER") === -1 &&
      giscusConfig.dataset.categoryId.indexOf("PLACEHOLDER") === -1;
  }

  function unmountGiscus() {
    document.querySelectorAll(".post-comments").forEach(function (el) {
      el.innerHTML = "";
    });
  }

  function mountGiscus(post) {
    unmountGiscus();
    var slot = post.querySelector(".post-comments");

    if (!giscusConfigured()) {
      slot.innerHTML = '<p class="muted">Comments are coming soon.</p>';
      return;
    }

    var container = document.createElement("div");
    container.className = "giscus";
    slot.appendChild(container);

    var script = document.createElement("script");
    script.src = GISCUS_ORIGIN + "/client.js";
    Array.prototype.forEach.call(giscusConfig.attributes, function (attr) {
      if (attr.name.indexOf("data-") === 0) script.setAttribute(attr.name, attr.value);
    });
    script.setAttribute("data-term", post.id);
    script.setAttribute("data-lang", post.dataset.currentLang || "en");
    script.setAttribute("crossorigin", "anonymous");
    script.async = true;
    slot.appendChild(script);
  }

  function setGiscusLang(lang) {
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame) return;
    frame.contentWindow.postMessage({ giscus: { setConfig: { lang: lang } } }, GISCUS_ORIGIN);
  }

  // ---------- Accordion ----------

  function closePost(post) {
    post.querySelector(".post-body").hidden = true;
    post.querySelector(".post-title a").setAttribute("aria-expanded", "false");
    post.querySelector(".post-comments").innerHTML = "";
  }

  function openPost(post) {
    posts.forEach(function (other) {
      if (other !== post) closePost(other);
    });
    post.querySelector(".post-body").hidden = false;
    post.querySelector(".post-title a").setAttribute("aria-expanded", "true");
    renderPost(post, post.dataset.currentLang || "en");
    mountGiscus(post);
  }

  posts.forEach(function (post) {
    var titleLink = post.querySelector(".post-title a");

    titleLink.addEventListener("click", function (event) {
      event.preventDefault();
      if (post.querySelector(".post-body").hidden) {
        openPost(post);
        history.replaceState(null, "", "#" + post.id);
      } else {
        closePost(post);
        history.replaceState(null, "", "#blog");
      }
    });

    post.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.lang !== post.dataset.currentLang) renderPost(post, btn.dataset.lang);
      });
    });
  });

  // Open a post directly when its link is shared, e.g. /#how-i-found-my-way-into-research
  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var post = id && document.getElementById(id);
    if (post && post.classList.contains("post") && post.querySelector(".post-body").hidden) {
      openPost(post);
      post.scrollIntoView();
    }
  }

  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
