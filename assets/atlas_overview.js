/* Storm atlas, section 1: every track 1981-2024 on an Equal Earth map, with moving streaks along the tracks,
   basin names on the map, a basin card on hover or focus, a table view, and "Play 44 seasons".
   Needs atlas_core.js. Streaks only run while the map is on screen and never under reduced motion unless the
   reader presses Play. */
(function () {
  "use strict";
  var A = window.Atlas, fig = document.querySelector(".at-overview");
  if (!A || !fig) return;
  var box = fig.querySelector(".ao-map"), lab = fig.querySelector(".ao-labels"), leg = fig.querySelector(".ao-legend");
  var playB = document.getElementById("ao-play"), motB = document.getElementById("ao-motion"), yearEl = document.getElementById("ao-year");
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var LABEL_AT = { WP: [150, 33], NA: [-42, 36], EP: [-128, 4], NI: [72, 2], SI: [62, -33], SP: [178, -36], SA: [-25, -30] };
  var TX = {
    en: { play: "Play 44 seasons", stop: "Stop", pause: "Pause motion", resume: "Resume motion", so: "storms so far",
      card: { n: "{n} storms in {a}–{b}, about {m} a season", busy: "Busiest season: {y} ({n} storms)", top: "Strongest: {s}, {v} m/s ({k} km/h)",
        major: "Category 3 or stronger: {n} ({p}%)", cy: "Most storms near one place in one season: {c}, {y} ({n})", go: "Click to list its storms" },
      map: "Map of every tropical storm track from 1981 to 2024, coloured by the ocean basin where each storm formed." },
    vi: { play: "Phát 44 mùa bão", stop: "Dừng", pause: "Tạm dừng chuyển động", resume: "Tiếp tục chuyển động", so: "cơn bão tính đến nay",
      card: { n: "{n} cơn bão trong {a}–{b}, khoảng {m} cơn mỗi mùa", busy: "Mùa nhiều bão nhất: {y} ({n} cơn)", top: "Mạnh nhất: {s}, {v} m/s ({k} km/h)",
        major: "Từ cấp 3 trở lên: {n} ({p}%)", cy: "Nhiều bão nhất gần một nơi trong một mùa: {c}, {y} ({n} cơn)", go: "Bấm để xem danh sách bão của vùng này" },
      map: "Bản đồ đường đi của mọi cơn bão nhiệt đới từ 1981 đến 2024, tô màu theo vùng biển nơi bão hình thành." }
  };
  function tt() { return TX[A.lang()]; }
  function fmt(s, o) { return s.replace(/\{(\w)\}/g, function (_, k) { return o[k]; }); }
  var O = { hi: null, tracks: null, comets: [], run: false, vis: true, paused: reduce, mode: "ambient" };

  A.ready.then(function () { return A.getJSON(A.D + "lite.json"); }).then(function (L) {
    O.lite = L.tracks.map(function (a) {
      var x = a[0], y = a[1], co = [[x / L.q, y / L.q]];
      for (var j = 2; j < a.length; j += 2) { x += a[j]; y += a[j + 1]; co.push([x / L.q, y / L.q]); }
      return co;
    });
    stats();
    legend();
    size();
    wire();
  }).catch(A.fail);

  // ------------------------------------------------------------------ basin statistics (public IBTrACS counts only)
  function stats() {
    var y0 = A.IX.meta.seasons[0], y1 = A.IX.meta.seasons[1];
    O.st = {};
    A.BORDER.forEach(function (b) {
      var ss = A.IX.storms.filter(function (s) { return s.basin === b; });
      if (!ss.length) return;
      var by = {}, cy = {}, major = 0, top = ss[0];
      ss.forEach(function (s) {
        by[s.season] = (by[s.season] || 0) + 1;
        if (A.CLS.indexOf(s["class"]) >= 3) major++;
        if (s.vmax_ms > top.vmax_ms || (s.vmax_ms === top.vmax_ms && s.t > top.t)) top = s;
        s.near.forEach(function (c) { var k = c + ":" + s.season; cy[k] = (cy[k] || 0) + 1; });
      });
      var tops = ss.filter(function (s) { return s.vmax_ms === top.vmax_ms; }).sort(function (a, c) { return a.t - c.t; });
      var busy = Object.keys(by).sort(function (a, c) { return by[c] - by[a] || a - c; })[0];
      var bc = Object.keys(cy).sort(function (a, c) { return cy[c] - cy[a] || (+a.split(":")[1]) - (+c.split(":")[1]); })[0];
      O.st[b] = { n: ss.length, y0: y0, y1: y1, mean: ss.length / (y1 - y0 + 1), busy: +busy, busyN: by[busy], top: top, tops: tops, major: major,
        cy: bc ? { c: +bc.split(":")[0], y: +bc.split(":")[1], n: cy[bc] } : null };
    });
  }
  function card(b) {
    var T = tt().card, s = O.st[b], f = document.createDocumentFragment(), loc = A.lang();
    var h = A.el("div", "at-tip-h"), sw = A.el("span", "at-key");
    sw.style.background = A.BAS[b];
    h.appendChild(sw); h.appendChild(A.el("strong", null, A.tx().basin[b]));
    f.appendChild(h);
    var n = A.el("div", "at-tip-r");
    n.appendChild(A.el("strong", null, s.n.toLocaleString(loc)));
    n.appendChild(document.createTextNode(fmt(T.n, { n: "", a: s.y0, b: s.y1, m: s.mean.toFixed(s.mean < 1 ? 1 : 0) }).replace(/^\s*/, " ")));
    f.appendChild(n);
    f.appendChild(A.el("div", "at-tip-r", fmt(T.busy, { y: s.busy, n: s.busyN })));
    f.appendChild(A.el("div", "at-tip-r", fmt(T.top, { s: s.tops.slice(0, 2).map(function (x) { return A.nm(x) + " " + x.season; }).join(A.lang() === "vi" ? " và " : " and ") + (s.tops.length > 2 ? " …" : ""), v: s.top.vmax_ms, k: A.kmh(s.top.vmax_ms) })));
    f.appendChild(A.el("div", "at-tip-r", fmt(T.major, { n: s.major.toLocaleString(loc), p: Math.round(100 * s.major / s.n) })));
    if (s.cy) f.appendChild(A.el("div", "at-tip-r", fmt(T.cy, { c: A.cname(s.cy.c), y: s.cy.y, n: s.cy.n })));
    f.appendChild(A.el("div", "at-tip-m", T.go));
    return f;
  }

  // ------------------------------------------------------------------ layout
  function size() {
    var w = O.w = box.clientWidth, h = O.h = Math.round(w * 0.5), dpr = O.dpr = Math.min(2, window.devicePixelRatio || 1);
    box.style.height = h + "px";
    box.querySelectorAll("canvas").forEach(function (c) { c.remove(); });
    O.base = mk(); O.top = mk();
    O.base.setAttribute("role", "img");
    O.proj = d3.geoEqualEarth().rotate([-165, 0]).fitExtent([[2, 2], [w - 2, h - 2]], { type: "Sphere" });
    // projected tracks, split where they cross the map edge
    O.tracks = O.lite.map(function (co, i) {
      var s = A.IX.storms[i], segs = [], cur = [], prev = null;
      co.forEach(function (p) {
        var a = O.proj(p);
        if (!a) return;
        if (prev && Math.abs(a[0] - prev[0]) > w / 3) { if (cur.length > 1) segs.push(cur); cur = []; }
        cur.push(a); prev = a;
      });
      if (cur.length > 1) segs.push(cur);
      var len = 0;
      segs.forEach(function (g) { g.d = [0]; for (var k = 1; k < g.length; k++) g.d.push(g.d[k - 1] + Math.hypot(g[k][0] - g[k - 1][0], g[k][1] - g[k - 1][1])); len += g.d[g.length - 1]; });
      return { s: s, segs: segs, len: len, col: A.BAS[s.basin] };
    });
    // hover grid: storm-point counts per basin in 12 px cells
    var C = O.cell = 12, nx = O.nx = Math.ceil(w / C) + 1, grid = O.grid = {};
    O.tracks.forEach(function (tr) {
      tr.segs.forEach(function (g) {
        g.forEach(function (p) {
          var k = Math.floor(p[1] / C) * nx + Math.floor(p[0] / C), o = grid[k] || (grid[k] = {});
          o[tr.s.basin] = (o[tr.s.basin] || 0) + 1;
        });
      });
    });
    labels();
    paintBase();
    O.comets = [];
    var n = w < 600 ? 220 : 650;
    for (var i = 0; i < n; i++) O.comets.push(spawn(true));
    if (reduce) drawStill();
    kick();
  }
  function mk() {
    var c = document.createElement("canvas");
    c.width = O.w * O.dpr; c.height = O.h * O.dpr;
    c.style.width = O.w + "px"; c.style.height = O.h + "px";
    box.insertBefore(c, lab);
    var x = c.getContext("2d");
    x.setTransform(O.dpr, 0, 0, O.dpr, 0, 0);
    return c;
  }
  function labels() {
    lab.textContent = "";
    A.BORDER.forEach(function (b) {
      if (!O.st[b] || O.st[b].n < 10) return;
      var p = O.proj(LABEL_AT[b]), e = A.el("span", "ao-lab", A.tx().basin[b]);
      e.style.left = (p[0] / O.w * 100) + "%"; e.style.top = (p[1] / O.h * 100) + "%";
      e.setAttribute("data-b", b);
      lab.appendChild(e);
    });
  }
  // base: land, then every track faintly (or only the played seasons during Play)
  function paintBase(upTo) {
    var c = O.base.getContext("2d"), path = d3.geoPath(O.proj, c);
    c.clearRect(0, 0, O.w, O.h);
    c.beginPath(); path({ type: "Sphere" }); c.fillStyle = "#faf9f5"; c.fill(); c.strokeStyle = "#e4e1d8"; c.lineWidth = 1; c.stroke();
    c.beginPath(); path(A.land); c.fillStyle = "#e6e2d8"; c.fill();
    c.lineWidth = O.w < 600 ? 0.5 : 0.7; c.lineJoin = "round";
    A.BORDER.forEach(function (b) {
      c.strokeStyle = A.BAS[b];
      c.globalAlpha = O.hi ? (O.hi === b ? 0.42 : 0.04) : (O.mode === "play" ? 0.3 : O.paused ? 0.38 : 0.16); // still map: stronger lines, as no streaks carry the colour
      c.beginPath();
      O.tracks.forEach(function (tr) {
        if (tr.s.basin !== b || (upTo != null && !tr.done)) return;
        tr.segs.forEach(function (g) { c.moveTo(g[0][0], g[0][1]); for (var k = 1; k < g.length; k++) c.lineTo(g[k][0], g[k][1]); });
      });
      c.stroke();
    });
    c.globalAlpha = 1;
    O.base.setAttribute("aria-label", tt().map);
  }
  function drawStill() { var c = O.top.getContext("2d"); c.clearRect(0, 0, O.w, O.h); }

  // ------------------------------------------------------------------ streaks
  function at(tr, d) { // point at distance d along a track, null where it crosses the map edge
    for (var i = 0; i < tr.segs.length; i++) {
      var g = tr.segs[i], L = g.d[g.length - 1];
      if (d <= L) {
        var k = 1;
        while (k < g.length - 1 && g.d[k] < d) k++;
        var u = (d - g.d[k - 1]) / ((g.d[k] - g.d[k - 1]) || 1);
        return { x: g[k - 1][0] + u * (g[k][0] - g[k - 1][0]), y: g[k - 1][1] + u * (g[k][1] - g[k - 1][1]), seg: i };
      }
      d -= L;
    }
    return null;
  }
  function spawn(random) {
    var tr = O.tracks[Math.floor(Math.random() * O.tracks.length)];
    return { tr: tr, d: random ? Math.random() * tr.len : 0, v: (0.6 + Math.random() * 0.9) * Math.max(0.6, O.w / 1100), last: null };
  }
  function step() {
    var c = O.top.getContext("2d");
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = "rgba(0,0,0,0.075)";
    c.fillRect(0, 0, O.w, O.h);
    c.globalCompositeOperation = "source-over";
    c.lineWidth = O.w < 600 ? 1.1 : 1.5; c.lineCap = "round";
    O.comets.forEach(function (m, i) {
      if (m.wait > 0) { m.wait--; return; }
      m.d += m.v;
      var p = m.tr.segs.length ? at(m.tr, m.d) : null;
      if (!p) {
        if (O.mode === "play") { m.dead = true; if (!m.tr.done) { m.tr.done = true; O.dirty = true; } return; }
        O.comets[i] = spawn(false);
        return;
      }
      if (m.last && m.last.seg === p.seg) {
        c.strokeStyle = m.tr.col;
        c.globalAlpha = O.hi && O.hi !== m.tr.s.basin ? 0.12 : 0.9;
        c.beginPath(); c.moveTo(m.last.x, m.last.y); c.lineTo(p.x, p.y); c.stroke();
      }
      m.last = p;
    });
    c.globalAlpha = 1;
  }
  function frame(now) {
    O.raf = null;
    if (!O.vis || (O.paused && O.mode !== "play")) { O.run = false; return; }
    if (O.mode === "play") playStep(now);
    step();
    if (O.dirty) { O.dirty = false; paintBase(true); }
    O.run = true;
    O.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!O.raf && O.vis && (!O.paused || O.mode === "play")) O.raf = requestAnimationFrame(frame); }

  // ------------------------------------------------------------------ Play 44 seasons: each season in 0.9 s, storms start in their order within the season
  var SLOT = 900;
  function playStart() {
    O.mode = "play"; O.t0 = performance.now(); O.next = 0; O.count = 0;
    O.tracks.forEach(function (tr) { tr.done = false; });
    var y0 = A.IX.meta.seasons[0];
    O.queue = O.tracks.filter(function (tr) { return tr.segs.length; }).map(function (tr) {
      var s = tr.s, south = /^(SI|SP|SA)$/.test(s.basin), a = south ? Date.UTC(s.season - 1, 6, 1) : Date.UTC(s.season, 0, 1);
      var u = Math.max(0, Math.min(0.98, (s.t - a) / (365.25 * 864e5)));
      return { tr: tr, at: (s.season - y0 + u) * SLOT };
    }).sort(function (a, b) { return a.at - b.at; });
    O.comets = [];
    O.hi = null;
    paintBase(true);
    O.top.getContext("2d").clearRect(0, 0, O.w, O.h);
    yearEl.hidden = false;
    playB.textContent = tt().stop;
    kick();
  }
  function playStep(now) {
    var t = now - O.t0, y0 = A.IX.meta.seasons[0], y1 = A.IX.meta.seasons[1];
    while (O.next < O.queue.length && O.queue[O.next].at <= t) {
      var tr = O.queue[O.next++].tr;
      // fast enough to cross a long track within about 1.4 seasons
      O.comets.push({ tr: tr, d: 0, v: Math.max(1.6, tr.len / (SLOT * 1.4 / 16.7)), last: null });
      O.count++;
    }
    O.comets = O.comets.filter(function (m) { return !m.dead; });
    var y = Math.min(y1, y0 + Math.floor(t / SLOT));
    yearEl.textContent = "";
    yearEl.appendChild(A.el("strong", null, String(y)));
    yearEl.appendChild(document.createTextNode(" · " + O.count.toLocaleString(A.lang()) + " " + tt().so));
    if (O.next >= O.queue.length && !O.comets.length) playEnd();
  }
  function playEnd() {
    O.mode = "ambient";
    O.tracks.forEach(function (tr) { tr.done = false; });
    paintBase();
    O.comets = [];
    var n = O.w < 600 ? 220 : 650;
    for (var i = 0; i < n; i++) O.comets.push(spawn(true));
    playB.textContent = tt().play;
    setTimeout(function () { if (O.mode !== "play") yearEl.hidden = true; }, 2500);
    if (O.paused) drawStill();
  }

  // ------------------------------------------------------------------ hover, legend, table
  function basinAt(x, y) {
    var C = O.cell, cx = Math.floor(x / C), cy = Math.floor(y / C), sum = {}, best = null, bn = 0;
    for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) {
      var o = O.grid[(cy + j) * O.nx + cx + i];
      if (o) for (var b in o) sum[b] = (sum[b] || 0) + o[b];
    }
    for (var k in sum) if (sum[k] > bn) { bn = sum[k]; best = k; }
    return bn >= 4 ? best : null;
  }
  function highlight(b) {
    if (O.hi === b) return;
    O.hi = b;
    if (O.mode !== "play") paintBase();
    Array.prototype.forEach.call(lab.children, function (e) { e.classList.toggle("is-hi", e.getAttribute("data-b") === b); e.classList.toggle("is-dim", !!b && e.getAttribute("data-b") !== b); });
    Array.prototype.forEach.call(leg.querySelectorAll("button"), function (e) { e.setAttribute("aria-pressed", String(e.getAttribute("data-b") === b)); });
  }
  function choose(b) {
    A.setRegion("b:" + b);
    var t = document.getElementById("at-explore");
    if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  function legend() {
    leg.textContent = "";
    A.BORDER.forEach(function (b) {
      if (!O.st[b]) return;
      var bt = A.el("button"), sw = A.el("span", "at-key");
      bt.type = "button"; bt.setAttribute("data-b", b); bt.setAttribute("aria-pressed", "false");
      sw.style.background = A.BAS[b];
      bt.appendChild(sw); bt.appendChild(A.el("span"));
      bt.addEventListener("click", function () { choose(b); });
      bt.addEventListener("mouseenter", function () { highlight(b); });
      bt.addEventListener("mouseleave", function () { highlight(null); A.tipHide(); });
      bt.addEventListener("focus", function () { highlight(b); var r = bt.getBoundingClientRect(); A.tipShow(r.left, r.top, card(b)); });
      bt.addEventListener("blur", function () { highlight(null); A.tipHide(); });
      leg.appendChild(bt);
    });
    legText();
    table();
  }
  function legText() {
    Array.prototype.forEach.call(leg.children, function (bt) {
      var b = bt.getAttribute("data-b");
      bt.lastChild.textContent = A.tx().basin[b] + " · " + O.st[b].n.toLocaleString(A.lang());
    });
  }
  function table() {
    var tb = document.getElementById("ao-table");
    if (!tb) return;
    var T = A.lang() === "vi" ? ["Vùng biển", "Số cơn bão", "Mỗi mùa", "Mùa nhiều nhất", "Từ cấp 3", "Mạnh nhất"]
      : ["Ocean basin", "Storms", "Per season", "Busiest season", "Cat 3+", "Strongest"];
    tb.textContent = "";
    var thead = A.el("thead"), tr = A.el("tr");
    T.forEach(function (h) { var th = A.el("th", null, h); th.scope = "col"; tr.appendChild(th); });
    thead.appendChild(tr); tb.appendChild(thead);
    var body = A.el("tbody");
    A.BORDER.forEach(function (b) {
      var s = O.st[b];
      if (!s) return;
      var r = A.el("tr"), th = A.el("th", null, A.tx().basin[b]);
      th.scope = "row"; r.appendChild(th);
      [s.n.toLocaleString(A.lang()), s.mean.toFixed(1), s.busy + " (" + s.busyN + ")", s.major.toLocaleString(A.lang()),
        A.nm(s.tops[0]) + " " + s.tops[0].season + (s.tops.length > 1 ? " …" : "") + ", " + s.top.vmax_ms + " m/s"].forEach(function (v) { r.appendChild(A.el("td", null, v)); });
      body.appendChild(r);
    });
    tb.appendChild(body);
  }
  function wire() {
    box.addEventListener("pointermove", function (e) {
      var r = box.getBoundingClientRect(), b = basinAt(e.clientX - r.left, e.clientY - r.top);
      highlight(b);
      box.style.cursor = b ? "pointer" : "default";
      if (b && e.pointerType === "mouse") A.tipShow(e.clientX, e.clientY, card(b)); else if (!b) A.tipHide();
    });
    box.addEventListener("pointerleave", function () { highlight(null); A.tipHide(); });
    box.addEventListener("click", function (e) {
      var r = box.getBoundingClientRect(), b = basinAt(e.clientX - r.left, e.clientY - r.top);
      if (!b) return;
      if (e.pointerType && e.pointerType !== "mouse" && O.tapped !== b) { O.tapped = b; highlight(b); A.tipShow(e.clientX, e.clientY, card(b)); return; }
      O.tapped = null; A.tipHide(); choose(b);
    });
    playB.addEventListener("click", function () { if (O.mode === "play") playEnd(); else playStart(); });
    motB.addEventListener("click", function () {
      O.paused = !O.paused;
      motB.textContent = O.paused ? tt().resume : tt().pause;
      paintBase();
      if (O.paused) drawStill(); else kick();
    });
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { O.vis = es[0].isIntersecting; kick(); }).observe(box);
    var lw = box.clientWidth, rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (box.clientWidth !== lw) { lw = box.clientWidth; if (O.mode === "play") playEnd(); size(); } }, 150);
    });
    document.addEventListener("langchange", function () {
      labels(); legText(); table();
      playB.textContent = O.mode === "play" ? tt().stop : tt().play;
      motB.textContent = O.paused ? tt().resume : tt().pause;
      O.base.setAttribute("aria-label", tt().map);
    });
    playB.textContent = tt().play;
    motB.textContent = O.paused ? tt().resume : tt().pause;
  }
})();
