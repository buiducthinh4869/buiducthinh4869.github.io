/* Housing atlas, section 1: play the ward map year by year (2D and 3D), as the storm atlas plays its seasons.
   Needs housing_core.js and housing_map.js (the map exposes figure._hsMap.frame(fn)). Data: map_years.json
   ({years, hn: {years, n: {year: listings}, w: {code: {year: [v_med, n, ppm2_med]}}}, hcm: ...}), written by
   PROJ\code\v2\web\export_web_v2.py. Without a year chosen the map shows 2024-2026 (wards_<c>.json). */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H) return;
  var TX = {
    en: { play: "Play the years", pause: "Pause", resume: "Resume", again: "Play again", back: "Back to 2024–2026", prev: "◀ 1 year", next: "1 year ▶",
      speed: "Seconds per year", from: "From", to: "to", all: "2024–2026", n: "{n} listings of houses and land",
      hint: "Price index: each ward against the city in the same year, so a ward that keeps its place keeps its colour. Choose Price per m² to see prices rise." },
    vi: { play: "Chạy theo năm", pause: "Tạm dừng", resume: "Tiếp tục", again: "Chạy lại", back: "Về 2024–2026", prev: "◀ 1 năm", next: "1 năm ▶",
      speed: "Giây mỗi năm", from: "Từ", to: "đến", all: "2024–2026", n: "{n} tin nhà và đất",
      hint: "Chỉ số giá: mỗi phường so với cả thành phố trong cùng năm, nên phường giữ nguyên vị trí thì giữ nguyên màu. Chọn Giá mỗi m² để thấy giá tăng." }
  };
  function tx(k) { return TX[H.lang()][k]; }

  function mount(fig) {
    var api = fig._hsMap;
    if (!api) return;
    var MY = null, st = { y: null, a: 0, b: 0, timer: null, ended: false }, fdMemo = {};
    var bar = H.el("div", "ao-bar hs-tbar"), play = H.el("button", "se-btn"), prev = H.el("button", "se-btn ao-step"), next = H.el("button", "se-btn ao-step"),
      back = H.el("button", "se-btn ao-step");
    [play, prev, next, back].forEach(function (b) { b.type = "button"; bar.appendChild(b); });
    play.setAttribute("data-act", "mplay"); back.setAttribute("data-act", "mback");
    var bar2 = H.el("div", "ao-bar hs-tbar"), sp = H.el("span", "ao-speed"), sl = H.el("label"), rng = H.el("input"), out = H.el("output");
    rng.type = "range"; rng.min = 2; rng.max = 15; rng.step = 1; rng.value = 5; rng.id = "hs-tspeed"; sl.htmlFor = rng.id;
    sp.appendChild(sl); sp.appendChild(rng); sp.appendChild(out);
    var rg = H.el("span", "ao-range"), l0 = H.el("label"), l1 = H.el("label"), s0 = H.el("select", "sg-select sg-y hs-tfrom"), s1 = H.el("select", "sg-select sg-y hs-tto");
    s0.id = "hs-tfrom"; s1.id = "hs-tto"; l0.htmlFor = s0.id; l1.htmlFor = s1.id;
    [l0, s0, l1, s1].forEach(function (e) { rg.appendChild(e); });
    bar2.appendChild(sp); bar2.appendChild(rg);
    var cnt = H.el("p", "hs-tcount"), yr = H.el("span", "hs-tyear"), nn = H.el("span", "hs-tn"), hint = H.el("p", "hs-thint");
    cnt.appendChild(yr); cnt.appendChild(nn);
    var plot = fig.querySelector(".hs-plot");
    [bar, bar2, cnt, hint].forEach(function (e) { fig.insertBefore(e, plot); });
    bar.hidden = bar2.hidden = cnt.hidden = hint.hidden = true; // shown once the data have loaded

    function city() { return api.cityNow(); }
    function years() { return MY && MY[city()] ? MY[city()].years : []; }
    function fd(c, y) {
      var k = c + y;
      if (!fdMemo[k]) { var o = {}, W = MY[c].w; Object.keys(W).forEach(function (code) { if (W[code][y]) o[code] = W[code][y]; }); fdMemo[k] = o; }
      return fdMemo[k];
    }
    function show() {
      var ms = st.timer ? Math.min(1600, rng.value * 450) : 700; // the change between two years takes 45% of a year's time, at most 1.6 s
      api.frame(st.y == null ? null : function (c) { return MY[c] && MY[c].w ? { key: String(st.y), w: fd(c, st.y), ms: ms } : null; });
      var c = city(), n = 0;
      if (st.y == null) [2024, 2025, 2026].forEach(function (y) { n += (MY[c].n[y] || 0); }); else n = MY[c].n[st.y] || 0;
      yr.textContent = st.y == null ? tx("all") : String(st.y);
      nn.textContent = " · " + tx("n").replace("{n}", H.nf(n));
      fig.setAttribute("data-year", st.y == null ? "all" : st.y);
      labels();
    }
    function labels() {
      play.textContent = st.timer ? tx("pause") : st.ended ? tx("again") : st.y != null ? tx("resume") : tx("play");
      play.setAttribute("aria-pressed", String(!!st.timer));
      prev.textContent = tx("prev"); next.textContent = tx("next"); back.textContent = tx("back");
      back.hidden = st.y == null && !st.timer;
      sl.textContent = tx("speed"); out.textContent = rng.value + " s";
      l0.textContent = tx("from"); l1.textContent = tx("to"); hint.textContent = tx("hint");
    }
    function opts() {
      var ys = years();
      [s0, s1].forEach(function (s) { s.textContent = ""; ys.forEach(function (y, i) { var o = H.el("option", null, String(y)); o.value = i; s.appendChild(o); }); });
      st.a = 0; st.b = ys.length - 1; s0.value = st.a; s1.value = st.b;
    }
    function stop() { if (st.timer) { clearTimeout(st.timer); st.timer = null; } }
    function tick() {
      var ys = years(), i = ys.indexOf(st.y);
      if (i < 0 || i >= st.b) { stop(); st.ended = true; labels(); return; }
      st.y = ys[i + 1]; show();
      st.timer = setTimeout(tick, rng.value * 1000);
    }
    function start() {
      var ys = years(), i = ys.indexOf(st.y);
      if (st.ended || i < st.a || i > st.b) { st.y = ys[st.a]; }
      st.ended = false; show();
      st.timer = setTimeout(tick, rng.value * 1000); labels();
    }
    play.addEventListener("click", function () { if (st.timer) { stop(); labels(); } else start(); });
    function step(d) {
      stop(); st.ended = false;
      var ys = years(), i = st.y == null ? (d > 0 ? st.a - 1 : st.b + 1) : ys.indexOf(st.y);
      i = Math.max(st.a, Math.min(st.b, i + d)); st.y = ys[i]; show();
    }
    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    back.addEventListener("click", function () { stop(); st.ended = false; st.y = null; show(); });
    rng.addEventListener("input", function () { out.textContent = rng.value + " s"; }); // takes effect from the next year
    s0.addEventListener("change", function () { st.a = +s0.value; if (st.b < st.a) { st.b = st.a; s1.value = st.b; } stop(); st.ended = false; st.y = years()[st.a]; show(); });
    s1.addEventListener("change", function () { st.b = +s1.value; if (st.a > st.b) { st.a = st.b; s0.value = st.a; } stop(); st.ended = false; st.y = years()[st.b]; show(); });
    var lastC = null;
    H.on("state", function () { // another city: start again from 2024-2026 with that city's years
      if (!MY || city() === lastC) return;
      lastC = city(); stop(); st.ended = false; st.y = null; opts(); show();
    });
    H.onLang(function () { if (MY) show(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && st.timer) { stop(); labels(); } });
    H.lazy(fig, function () {
      H.load("map_years").then(function (d) {
        MY = d; lastC = city(); opts();
        bar.hidden = bar2.hidden = cnt.hidden = hint.hidden = false;
        show();
      }).catch(function (e) { if (window.console) console.warn("housing atlas:", e); }); // the map keeps its 2024-2026 view
    }, "600px");
  }
  function mountAll() {
    document.querySelectorAll('[data-hs="map"]').forEach(function (f) { if (!f.hasAttribute("data-teaser")) mount(f); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll); else mountAll();
})();
