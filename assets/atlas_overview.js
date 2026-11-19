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
    en: { play: "Play the seasons", stop: "Stop", pause: "Pause motion", resume: "Resume motion", so: "storms this year", tot: "storms", pause2: "Pause", resume2: "Resume", back: "◀ 1 month", fwd: "1 month ▶",
      card: { n: "{n} storms in {a}–{b}, about {m} a season", busy: "Busiest season: {y} ({n} storms)", top: "Strongest: {s}, {v} m/s ({k} km/h)",
        major: "Category 3 or stronger: {n} ({p}%)", cy: "Most storms near one place in one season: {c}, {y} ({n})", go: "Click to list its storms" },
      map: "Map of every tropical storm track from 1981 to 2024, coloured by the ocean basin where each storm formed." },
    vi: { play: "Phát theo mùa", stop: "Dừng", pause: "Tạm dừng chuyển động", resume: "Tiếp tục chuyển động", so: "cơn bão trong năm", tot: "cơn bão", pause2: "Tạm dừng", resume2: "Tiếp tục", back: "◀ 1 tháng", fwd: "1 tháng ▶",
      card: { n: "{n} cơn bão trong {a}–{b}, khoảng {m} cơn mỗi mùa", busy: "Mùa nhiều bão nhất: {y} ({n} cơn)", top: "Mạnh nhất: {s}, {v} m/s ({k} km/h)",
        major: "Từ cấp 3 trở lên: {n} ({p}%)", cy: "Nhiều bão nhất gần một nơi trong một mùa: {c}, {y} ({n} cơn)", go: "Bấm để xem danh sách bão của vùng này" },
      map: "Bản đồ đường đi của mọi cơn bão nhiệt đới từ 1981 đến 2024, tô màu theo vùng biển nơi bão hình thành." }
  };
  function tt() { return TX[A.lang()]; }
  function fmt(s, o) { return s.replace(/\{(\w)\}/g, function (_, k) { return o[k]; }); }
  var seek = document.getElementById("ao-seek");
  var O = { hi: null, tracks: null, comets: [], run: false, vis: true, paused: reduce, mode: "ambient", speed: 0.18 }; // speed 1 = 0.9 s per season; the slider sets 1 to 30 s (5 s by default)

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
    O.mbox = A.el("div", "ao-months");
    O.mbox.hidden = true;
    O.mbox.setAttribute("aria-hidden", "true");
    box.appendChild(O.mbox);
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
  // basin names on the map; during Play each name carries that year's storm count underneath
  function labels(by) {
    lab.textContent = "";
    A.BORDER.forEach(function (b) {
      if (!O.st[b] || O.st[b].n < 10) return;
      var p = O.proj(LABEL_AT[b]), e = A.el("span", "ao-lab", A.tx().basin[b]);
      if (by) {
        var n = by[b] || 0, c = A.el("span", "ao-lab-n");
        c.appendChild(A.el("strong", null, String(n)));
        c.appendChild(document.createTextNode(" " + (n === 1 && A.lang() === "en" ? "storm" : tt().tot)));
        e.appendChild(c);
      }
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
        if (tr.s.basin !== b || (upTo != null && (!tr.done || tr.yr !== O.curY))) return;
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
    // trails fade in step with the play speed, so slow play keeps visible streaks
    c.fillStyle = "rgba(0,0,0," + (O.mode === "play" ? Math.max(0.012, Math.min(0.075, 0.075 * O.speed / 0.6)) : 0.075) + ")";
    c.fillRect(0, 0, O.w, O.h);
    c.globalCompositeOperation = "source-over";
    c.lineWidth = O.w < 600 ? 1.1 : 1.5; c.lineCap = "round";
    O.comets.forEach(function (m, i) {
      if (m.wait > 0) { m.wait--; return; }
      m.d += m.v * (O.mode === "play" ? O.speed : 1);
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
    if (O.mode === "play") { if (O.hold) { O.run = false; return; } playStep(now); }
    step();
    if (O.dirty) { O.dirty = false; paintBase(true); }
    O.run = true;
    O.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!O.raf && O.vis && (!O.paused || O.mode === "play")) O.raf = requestAnimationFrame(frame); }

  // ------------------------------------------------------------------ Play 44 seasons: each season in 0.9 s, storms start in their order within the season
  var SLOT = 900;
  // Play works like a video: the state at play time t (in season slots) is computed from t alone, so it can pause,
  // step a month back or forward, or jump anywhere with the scrubber
  var MO = SLOT / 12, CROSS = 0.8;
  function playStart() {
    var ya = +document.getElementById("ao-y0").value, yb = +document.getElementById("ao-y1").value;
    O.ya = Math.min(ya, yb); O.yb = Math.max(ya, yb);
    O.mode = "play"; O.hold = false; O.tt = 0; O.last = performance.now(); O.curY = null; O.hi = null;
    legText();
    // calendar years (January to December in both hemispheres), so the months line up; a storm counts in the year it formed
    O.byYear = {};
    O.tracks.forEach(function (tr) {
      var d = new Date(tr.s.t); tr.yr = d.getUTCFullYear(); tr.mo = d.getUTCMonth(); tr.done = false; tr.lp = null;
      if (!tr.segs.length || tr.yr < O.ya || tr.yr > O.yb) return;
      var a = Date.UTC(tr.yr, 0, 1), u = Math.max(0, Math.min(0.995, (tr.s.t - a) / (Date.UTC(tr.yr + 1, 0, 1) - a)));
      (O.byYear[tr.yr] = O.byYear[tr.yr] || []).push({ tr: tr, at: (tr.yr - O.ya + u) * SLOT });
    });
    O.end = (O.yb - O.ya + 1) * SLOT;
    O.comets = [];
    seek.max = (O.yb - O.ya + 1) * 12 - 1;
    ctrls(true);
    stateAt(0, true);
    kick();
  }
  function partial(c, tr, dist) { // the track from its start to distance dist
    var left = dist;
    tr.segs.forEach(function (g) {
      if (left <= 0) return;
      c.beginPath(); c.moveTo(g[0][0], g[0][1]);
      for (var k = 1; k < g.length; k++) {
        if (g.d[k] >= left) { var u = (left - g.d[k - 1]) / ((g.d[k] - g.d[k - 1]) || 1); c.lineTo(g[k - 1][0] + u * (g[k][0] - g[k - 1][0]), g[k - 1][1] + u * (g[k][1] - g[k - 1][1])); break; }
        c.lineTo(g[k][0], g[k][1]);
      }
      c.stroke();
      left -= g.d[g.length - 1];
    });
  }
  // snap: redraw the moving storms from scratch (after a pause, a step or a jump); otherwise extend their streaks
  function stateAt(t, snap) {
    var y = Math.min(O.yb, O.ya + Math.floor(t / SLOT)), c = O.top.getContext("2d"), dirty = false;
    if (y !== O.curY) {
      O.curY = y; snap = true;
      var by = {}, n = 0;
      O.monTot = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      O.tracks.forEach(function (tr) { if (tr.yr === y) { by[tr.s.basin] = (by[tr.s.basin] || 0) + 1; n++; O.monTot[tr.mo]++; } });
      O.seasonN = n;
      labels(by);
      O.tracks.forEach(function (tr) { if (tr.yr !== y) tr.done = false; });
      dirty = true; // a new year always repaints the base: only this year's finished tracks
    }
    if (snap) c.clearRect(0, 0, O.w, O.h);
    c.lineWidth = O.w < 600 ? 1.1 : 1.5; c.lineCap = "round"; c.lineJoin = "round"; c.globalAlpha = 0.9;
    O.mon = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    (O.byYear[y] || []).forEach(function (it) {
      var tr = it.tr, f = (t - it.at) / (CROSS * SLOT);
      if (f < 0) { if (tr.done) { tr.done = false; dirty = true; } tr.lp = null; return; }
      O.mon[tr.mo]++;
      var done = f >= 1;
      if (done !== tr.done) { tr.done = done; dirty = true; }
      if (done) { tr.lp = null; return; }
      var p = at(tr, f * tr.len);
      if (!p) return;
      c.strokeStyle = tr.col;
      if (snap) partial(c, tr, f * tr.len);
      else if (tr.lp && tr.lp.seg === p.seg) { c.beginPath(); c.moveTo(tr.lp.x, tr.lp.y); c.lineTo(p.x, p.y); c.stroke(); }
      tr.lp = p;
    });
    c.globalAlpha = 1;
    if (dirty) paintBase(true);
    var mi = Math.min(11, Math.max(0, Math.floor((t / SLOT - (y - O.ya)) * 12)));
    months(mi);
    yearEl.textContent = "";
    yearEl.appendChild(A.el("strong", null, String(y) + " · " + (A.lang() === "vi" ? "tháng " + (mi + 1) : A.TXT.en.mon[mi])));
    yearEl.appendChild(document.createTextNode(" · " + O.seasonN.toLocaleString(A.lang()) + " " + tt().so));
    seek.value = Math.floor(t / MO);
  }
  function playStep(now) {
    O.tt += Math.max(0, Math.min(100, now - O.last)) * O.speed; O.last = now;
    if (O.tt >= O.end) { playEnd(); return; }
    stateAt(O.tt, false);
  }
  function jump(t) {
    O.tt = Math.max(0, Math.min(O.end - 1, t));
    O.last = performance.now();
    stateAt(O.tt, true);
  }
  function pauseToggle() {
    O.hold = !O.hold;
    O.last = performance.now();
    if (!O.hold) { stateAt(O.tt, true); kick(); }
    playLabel();
  }
  function playLabel() { playB.textContent = O.mode !== "play" ? tt().play : O.hold ? tt().resume2 : tt().pause2; }
  function ctrls(on) {
    ["ao-back", "ao-fwd", "ao-stop", "ao-seek"].forEach(function (id) { document.getElementById(id).hidden = !on; });
    document.getElementById("ao-back").textContent = tt().back;
    document.getElementById("ao-fwd").textContent = tt().fwd;
    document.getElementById("ao-stop").textContent = tt().stop;
    playLabel();
  }
  function playEnd() {
    O.mode = "ambient"; O.hold = false;
    O.tracks.forEach(function (tr) { tr.done = false; });
    paintBase();
    O.top.getContext("2d").clearRect(0, 0, O.w, O.h);
    O.comets = [];
    var n = O.w < 600 ? 220 : 650;
    for (var i = 0; i < n; i++) O.comets.push(spawn(true));
    O.curY = null;
    ctrls(false);
    labels();
    legText();
    O.mbox.hidden = true;
    summary();
    if (O.paused) drawStill();
    kick();
  }

  // the counter line when not playing: the chosen range and its storm count
  function summary() {
    var a = +document.getElementById("ao-y0").value, b = +document.getElementById("ao-y1").value, lo = Math.min(a, b), hi = Math.max(a, b);
    var n = A.IX.storms.filter(function (s) { return s.season >= lo && s.season <= hi; }).length;
    yearEl.hidden = false;
    yearEl.textContent = "";
    yearEl.appendChild(A.el("strong", null, lo === hi ? String(lo) : lo + "–" + hi));
    yearEl.appendChild(document.createTextNode(" · " + n.toLocaleString(A.lang()) + " " + tt().tot));
  }
  // twelve small bars: storms formed in each month of the year being played; they grow as storms start; the current month is dark
  function months(cur) {
    var mb = O.mbox;
    if (!mb.firstChild) for (var i = 0; i < 12; i++) {
      var c = A.el("span", "ao-m"), bar = A.el("span", "ao-m-bar"), lab = A.el("span", "ao-m-l");
      c.appendChild(A.el("span", "ao-m-n")); c.appendChild(bar); c.appendChild(lab); mb.appendChild(c);
    }
    mb.hidden = false;
    var top = Math.max(4, d3.max(O.monTot));
    Array.prototype.forEach.call(mb.children, function (c, i) {
      c.children[0].textContent = O.mon[i] ? O.mon[i] : "";
      c.children[1].style.height = (O.mon[i] / top * 100) + "%";
      c.children[2].textContent = A.lang() === "vi" ? "T" + (i + 1) : A.TXT.en.mon[i].charAt(0);
      c.classList.toggle("is-now", i === cur);
    });
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
  // basin counts: for one season during Play, for the whole period otherwise
  function legText(by) {
    Array.prototype.forEach.call(leg.children, function (bt) {
      var b = bt.getAttribute("data-b");
      var n = by ? by[b] || 0 : O.st[b].n;
      // during Play the counts sit on the map, so the legend keeps only the names
      bt.lastChild.textContent = O.mode === "play" ? A.tx().basin[b] : A.tx().basin[b] + " · " + n.toLocaleString(A.lang()) + " " + (n === 1 && A.lang() === "en" ? "storm" : tt().tot);
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
    // the seasons to play: any range; the default is every season
    ["ao-y0", "ao-y1"].forEach(function (id, k) {
      var sel = document.getElementById(id);
      for (var y = A.IX.meta.seasons[0]; y <= A.IX.meta.seasons[1]; y++) { var o = document.createElement("option"); o.value = o.textContent = y; sel.appendChild(o); }
      sel.value = A.IX.meta.seasons[k];
      sel.addEventListener("change", function () { if (O.mode !== "play") summary(); });
    });
    summary();
    playB.addEventListener("click", function () { if (O.mode === "play") pauseToggle(); else playStart(); });
    document.getElementById("ao-stop").addEventListener("click", playEnd);
    document.getElementById("ao-back").addEventListener("click", function () { jump(O.tt - MO); });
    document.getElementById("ao-fwd").addEventListener("click", function () { jump(O.tt + MO); });
    seek.addEventListener("input", function () { if (O.mode === "play") jump(+seek.value * MO + 1); });
    var sp = document.getElementById("ao-speed"), spv = document.getElementById("ao-speed-v");
    sp.addEventListener("input", function () { O.speed = 0.9 / +sp.value; spv.textContent = sp.value + " s"; });
    motB.addEventListener("click", function () {
      O.paused = !O.paused;
      motB.textContent = O.paused ? tt().resume : tt().pause;
      if (O.mode === "play") stateAt(O.tt, true); // Play keeps its own map: only this year's storms
      else { paintBase(); if (O.paused) drawStill(); else kick(); }
    });
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { O.vis = es[0].isIntersecting; kick(); }).observe(box);
    var lw = box.clientWidth, rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (box.clientWidth !== lw) { lw = box.clientWidth; if (O.mode === "play") playEnd(); size(); } }, 150);
    });
    document.addEventListener("langchange", function () {
      labels(); legText(); table(); if (O.mode !== "play") summary();
      if (O.mode === "play") { ctrls(true); O.curY = null; stateAt(O.tt, true); } else playLabel(); // curY reset rebuilds the year's counts on the map
      motB.textContent = O.paused ? tt().resume : tt().pause;
      O.base.setAttribute("aria-label", tt().map);
    });
    playB.textContent = tt().play;
    motB.textContent = O.paused ? tt().resume : tt().pause;
  }
})();
