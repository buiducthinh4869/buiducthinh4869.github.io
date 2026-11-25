/* Storm atlas (storms.html), section 3: the selected storms on a globe over night-time light.
   Needs atlas_core.js (data, region, selection, tooltip). Tracks and winds shown are IBTrACS; wind fields from
   the cyclone project (see CLAUDE.md). Night lights: global 0.2 degree, plus 0.05 degree tiles when zoomed in; during
   Play the image follows the season of the first storm (assets/ntl/, one 0.2 degree image per year, see ntl_layer.js).
   The Cells (0.1 degree) view is in globe_cells.js. */
(function () {
  "use strict";
  var A = window.Atlas, fig = document.querySelector(".storm-globe");
  if (!A || !fig) return;
  var D = A.D, RAD = Math.PI / 180, N = A.ntl, C = A.cells;
  if (!N || !A.ntlLayer || !C) { if (A.fail) A.fail(new Error("ntl_layer.js or globe_cells.js is missing")); fig.hidden = true; return; }
  var LEVELS = [17, 33, 43, 50, 58], OPAC = [0.4, 0.52, 0.65, 0.78, 0.9];
  var SEL = ["#1f5f7a", "#b08a5a", "#7a4f6e", "#4f6e3a"], MAXSEL = 4, ROWS = 60;
  var MSH = 125, WAKE = 9; // ms of screen time per storm hour (3 s per storm day by default; the slider sets 0.5 to 6 s)
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq("(prefers-reduced-motion: reduce)"), coarse = mq("(pointer: coarse)");
  var $ = function (id) { return document.getElementById(id); };
  var box = fig.querySelector(".sg-globe"), list = $("sg-list"), more = $("sg-more"), info = $("sg-info"), playBtn = $("sg-play"), clock = $("sg-clock"), sq = $("sg-q"), seekG = $("sg-seek");

  var TXT = {
    en: {
      unnamed: "Unnamed", peak: "Peak wind", near: "Passed within 200 km of", and: "and", others: "others",
      nofield: "No wind field.", remove: "Remove", none: "No storms match.", shown: "Showing {n} of {m}.",
      ramp: ["low", "high"], play: "Play", pause: "Pause", resume: "Resume", search: "e.g. Haiyan", storms: "storms", wind: "wind",
      mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      map: "Globe with the selected storms: tracks, lines of equal peak wind in m/s, over night-time light. Drag to turn it.",
      ov: "World map of all tropical storm tracks, coloured by ocean basin."
    },
    vi: {
      unnamed: "Không tên", peak: "Sức gió mạnh nhất", near: "Đi qua trong phạm vi 200 km quanh", and: "và", others: "nước khác",
      nofield: "Chưa có trường gió.", remove: "Bỏ chọn", none: "Không có cơn bão nào phù hợp.", shown: "Đang hiện {n} trên {m}.",
      ramp: ["thấp", "cao"], play: "Phát", pause: "Tạm dừng", resume: "Tiếp tục", search: "ví dụ: Haiyan", storms: "cơn bão", wind: "gió",
      map: "Quả địa cầu với các cơn bão đang chọn: đường đi, các đường đẳng tốc gió lớn nhất (m/s), trên nền ánh sáng ban đêm. Kéo để xoay.",
      ov: "Bản đồ thế giới với đường đi của mọi cơn bão nhiệt đới, tô màu theo vùng biển."
    }
  };
  function lang() { return A.lang(); }
  function tx() { var o = TXT[lang()], c = A.tx(); o.basin = c.basin; o.cls = c.cls; return o; }
  var nm = A.nm, cname = A.cname;
  function f1(v) { return v.toFixed(1); }

  function fail(err) { A.fail(err); fig.hidden = true; }
  var getJSON = A.getJSON;
  var IX, land, LT, DEF, G = {}, st = { rot: [-125, -15], k: 1, sel: A.st.sel, sort: "new", act: false, view: "lines", glint: !reduce };
  var seasons = {}, fields = {};

  A.ready.then(function () {
    IX = A.IX; land = A.land;
    init();
    return N.decode(D + "lights.png").then(lights, function (e) { if (window.console) console.warn(e); });
  }).catch(fail);

  // ------------------------------------------------------------------ lights: lit cells binned by colour
  var NB = 16, TW = 36; // tiles: 10-degree columns from -180, rows from -60
  function tid(lonDeg, latDeg) { return Math.floor((lonDeg + 180) / 10) + TW * Math.floor((latDeg + 60) / 10); }
  function binCells(im, b0, b3, c, out) {
    for (var j = 0; j < im.h; j++) for (var i = 0; i < im.w; i++) {
      var v = im.data[j * im.w + i];
      if (v < 24) continue; // the faintest glow is left out, as it is barely visible and costs time
      var lo = b0 + (i + 0.5) * c, la = b3 - (j + 0.5) * c, lat = la * RAD;
      out[Math.min(NB - 1, Math.floor(v / 256 * NB))].push(lo * RAD, Math.sin(lat), Math.cos(lat), tid(lo, la));
    }
  }
  function bins(im, b0, b3, c) {
    var raw = [], i;
    for (i = 0; i < NB; i++) raw.push([]);
    binCells(im, b0, b3, c, raw);
    return raw.map(function (a) { return new Float32Array(a); });
  }
  function lights(im) {
    var m = IX.meta.lights;
    LT = { cell: m.cell_deg * RAD, cols: A.ntl.colors(NB, m.scale.ink_from), bins: bins(im, m.bounds[0], m.bounds[3], m.cell_deg) };
    DEF = { bins: LT.bins, T: tileSet(m.tiles && m.tiles.list, m.tiles && m.tiles.cell_deg, D + "lights/") }; // lights.png with the 0.05 degree tiles
    NT.sync(); // takes the default layer (key text and redraw)
    fxStart();
  }
  // a layer's 0.05-degree tiles: keys "<west>_<south>" (array or comma string), cell in degrees, folder of the PNGs
  function tileSet(keys, cellDeg, dir) {
    var T = { list: {}, loaded: {}, want: {}, on: new Uint8Array(TW * 15), cell: cellDeg ? cellDeg * RAD : 0, deg: cellDeg, dir: dir };
    (typeof keys === "string" ? keys.split(",") : keys || []).forEach(function (k) { if (k) T.list[k] = 1; });
    return T;
  }
  // load the 0.05-degree tiles in view (of the layer on screen) once a 0.2-degree cell is wider than 2.5 px
  function tiles() {
    var TL = NT.cur && NT.cur.T;
    if (!LT || !TL || !TL.cell || G.R * st.k * LT.cell < 2.5) return;
    var c = [-st.rot[0], -st.rot[1]], r = 95 / st.k;
    for (var la = -60; la < 80; la += 10) for (var lo = -180; lo < 180; lo += 10) {
      var key = lo + "_" + la;
      if (!TL.list[key] || TL.loaded[key] || TL.want[key]) continue;
      if (d3.geoDistance([lo + 5, la + 5], c) * 180 / Math.PI > r + 8) continue;
      TL.want[key] = 1;
      (function (key, lo, la) {
        N.decode(TL.dir + key + ".png").then(function (im) {
          TL.loaded[key] = bins(im, lo, la + 10, TL.deg);
          TL.on[tid(lo + 5, la + 5)] = 1;
          draw();
        }).catch(function () { TL.loaded[key] = []; });
      })(key, lo, la);
    }
  }

  // ------------------------------------------------------------------ what ntl_layer.js and globe_cells.js need
  function ntlDraw(cx, L, keep, Rk) { // one layer: its 0.2 degree cells, and the 0.05 degree tiles of that layer that are loaded
    var TL = L.T;
    dots(cx, L.bins, LT.cell, Rk, TL ? TL.on : null, keep);
    if (TL) for (var k in TL.loaded) if (TL.loaded[k].length) dots(cx, TL.loaded[k], TL.cell, Rk, null, keep);
  }
  var NT = A.ntlLayer({
    lead: function () { return st.dur > 0 ? st.sel.filter(function (s) { return s.pts && s.pts.length > 1; })[0] : null; },
    build: function (im, y) {
      var m = IX.meta.lights;
      if (im.w !== m.width || im.h !== m.height) throw new Error("ntl image: wrong size");
      return N.load().then(function (d) { // the year's 0.05 degree tiles, if assets/ntl/index.json lists them
        var t = d && d.tiles, ks = t && t.list && t.list[y];
        return { bins: bins(im, m.bounds[0], m.bounds[3], m.cell_deg),
          T: ks ? tileSet(ks, t.cell_deg, N.dir + t.dir.replace("{year}", y)) : null };
      });
    },
    draw: ntlDraw, redraw: draw, reduce: function () { return reduce; }, changed: function () { ramp(); draw(); },
    defaultLayer: function () { return DEF ? { layer: DEF, year: IX.meta.lights.year } : null; }
  });
  C.env = { G: G, st: st, fields: fields, vis: vis };

  // ------------------------------------------------------------------ globe
  function build() {
    var w = G.w = box.clientWidth, h = G.h = Math.round(w * (w < 560 ? 1 : 0.86)), dpr = G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.R = Math.min(w, h) / 2 - 6;
    box.style.height = h + "px";
    var root = d3.select(box);
    root.selectAll("*").remove();
    G.cv = root.append("canvas").attr("width", w * dpr).attr("height", h * dpr).style("width", w + "px").style("height", h + "px").node();
    G.cx = G.cv.getContext("2d");
    G.ramp = root.append("div").attr("class", "sg-ramp se-text").attr("aria-hidden", "true").node();
    G.wkey = root.append("div").attr("class", "sg-ramp sg-wkey se-text").attr("aria-hidden", "true").node();
    ramp();
    G.fx = root.append("canvas").attr("width", w * dpr).attr("height", h * dpr).style("width", w + "px").style("height", h + "px").node();
    G.lc = document.createElement("canvas");
    G.lc.width = w * dpr; G.lc.height = h * dpr;
    var svg = G.svg = root.append("svg").attr("class", "sg-svg").attr("viewBox", "0 0 " + w + " " + h)
      .attr("width", w).attr("height", h).attr("tabindex", 0).attr("role", "img");
    var gr = svg.append("defs").append("radialGradient").attr("id", "sg-dimg");
    [[0, 0.95], [0.55, 0.6], [1, 0]].forEach(function (s) {
      gr.append("stop").attr("offset", s[0]).attr("stop-color", "#e6e2d8").attr("stop-opacity", s[1]);
    });
    G.proj = d3.geoOrthographic().clipAngle(90).translate([w / 2, h / 2]).precision(0.3);
    G.path = d3.geoPath(G.proj);
    G.dim = svg.append("g");
    G.fld = svg.append("g").attr("class", "sg-field");
    G.trk = svg.append("g").attr("class", "sg-trk");
    G.glyph = svg.append("g").attr("class", "se-storm");
    G.eye = svg.append("g").attr("class", "se-eye");
    G.lab = svg.append("g").attr("class", "sg-lab");
    G.hit = svg.append("g").attr("class", "sg-hit");
    G.hit.on("pointermove", function (ev) {
      if (ev.buttons || ev.pointerType !== "mouse") return;
      var s = ev.target.__data__;
      if (s) A.tipShow(ev.clientX, ev.clientY, A.card(s));
    }).on("pointerleave", A.tipHide);
    svg.style("touch-action", coarse ? "pan-y" : "none");
    var p0 = null;
    svg.on("pointerdown", function (ev) {
      st.act = true;
      p0 = [ev.clientX, ev.clientY, st.rot.slice()];
      G.moving = true;
      svg.classed("is-drag", true);
      if (svg.node().setPointerCapture) svg.node().setPointerCapture(ev.pointerId);
    }).on("pointermove", function (ev) {
      if (!p0) { if (ev.pointerType === "mouse" && !(ev.target && ev.target.__data__)) C.tip(ev); return; }
      var s = 180 / Math.PI / (G.R * st.k);
      st.follow = false;
      st.rot = [p0[2][0] + (ev.clientX - p0[0]) * s, Math.max(-85, Math.min(85, p0[2][1] - (ev.clientY - p0[1]) * s))];
      if (st.tw) st.tw = null;
      draw();
    }).on("pointerup pointercancel", function () { p0 = null; G.moving = false; svg.classed("is-drag", false); draw(); })
      .on("pointerleave", A.tipHide);
    svg.on("wheel", function (ev) {
      if (!(ev.ctrlKey || st.act || document.activeElement === svg.node())) return; // no scroll trap before the reader engages
      ev.preventDefault();
      zoomBy(Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.002)));
    });
  }
  function zoomBy(f) { st.k = Math.max(1, Math.min(10, st.k * f)); st.tw = null; draw(); }

  var queued = false;
  function draw() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; render(performance.now()); }); } }
  function render(now) {
    if (!G.cx) return;
    var w = G.w, h = G.h, Rk = G.R * st.k, cx = G.cx, P = G.proj.rotate([st.rot[0], st.rot[1]]).scale(Rk);
    cx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    var cp = d3.geoPath(P, cx);
    cx.beginPath(); cp({ type: "Sphere" }); cx.fillStyle = "#faf9f5"; cx.fill();
    cx.beginPath(); cp(land); cx.fillStyle = "#e6e2d8"; cx.fill();
    cx.lineWidth = 0.6; cx.strokeStyle = "#c9c4b8"; cx.stroke();
    if (LT) {
      var lc = G.lc.getContext("2d");
      lc.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
      lc.clearRect(0, 0, w, h);
      G.sp = [];
      NT.paint(lc, now, Rk);
      cx.save();
      cx.setTransform(1, 0, 0, 1, 0, 0);
      // a soft halo under the crisp cells, so lights read as glow rather than squares
      if (!G.moving && !st.raf && cx.filter !== undefined) {
        cx.filter = "blur(" + Math.max(1, Math.min(6, Rk * LT.cell * 0.6)) * G.dpr + "px)";
        cx.globalAlpha = 0.55;
        cx.drawImage(G.lc, 0, 0);
        cx.filter = "none";
      }
      cx.globalAlpha = 0.9;
      cx.drawImage(G.lc, 0, 0);
      cx.restore();
      tiles();
    }
    if (st.view === "cells") C.draw(cx, Rk);
    cx.beginPath(); cp({ type: "Sphere" }); cx.lineWidth = 1; cx.strokeStyle = "#e4e1d8"; cx.stroke();
    drawStorms(now);
  }

  // orthographic forward projection by hand, about 20 times faster than through d3 for this many points
  function dots(cx, bins, cell, Rk, on, keep) { // on: tiles loaded for this layer (its 0.2 degree cells there are skipped), or null
    var w = G.w, h = G.h, L0 = -st.rot[0] * RAD, p0 = -st.rot[1] * RAD, sp = Math.sin(p0), cq = Math.cos(p0), X = w / 2, Y = h / 2;
    var sz = Math.max(0.8, Rk * cell * 1.05);
    for (var b = 0; b < bins.length; b++) {
      var a = bins[b];
      cx.fillStyle = LT.cols[b];
      for (var i = 0; i < a.length; i += 4) {
        if (on && on[a[i + 3]]) continue;
        var l = a[i] - L0, cl = Math.cos(l), cosc = sp * a[i + 1] + cq * a[i + 2] * cl;
        if (cosc <= 0.02) continue;
        var x = X + Rk * a[i + 2] * Math.sin(l), y = Y - Rk * (cq * a[i + 1] - sp * a[i + 2] * cl);
        if (x < -2 || x > w + 2 || y < -2 || y > h + 2) continue;
        cx.fillRect(x - sz / 2, y - sz / 2, sz, sz * cosc + 0.3);
        if (keep && b >= SPB && G.sp.length < 24000) G.sp.push(x, y, sz);
      }
    }
  }
  // twinkle: bright cells glint in turn (decoration; off under reduced motion)
  var SPB = 9, FX = { vis: true };
  function fxClear() { if (G.fx) G.fx.getContext("2d").clearRect(0, 0, G.fx.width, G.fx.height); }
  function fxStart() { if (!FX.raf && st.glint && FX.vis && !document.hidden) FX.raf = requestAnimationFrame(fxLoop); }
  function fxLoop(now) {
    FX.raf = null;
    if (!st.glint || !FX.vis || document.hidden) { fxClear(); return; }
    if (now - (FX.t || 0) > 40) { FX.t = now; fxDraw(now); }
    FX.raf = requestAnimationFrame(fxLoop);
  }
  function fxDraw(now) {
    var c = G.fx.getContext("2d"), a = G.sp, n = a ? a.length / 3 : 0, step = Math.max(1, Math.floor(n / 700));
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    c.clearRect(0, 0, G.w, G.h);
    if (G.moving || !n) return;
    for (var k = 0; k < n; k += step) {
      var u = (now / (1800 + 2600 * ((k * 0.7548776662) % 1)) + (k * 0.6180339887) % 1) % 1;
      if (u > 0.14) continue;
      var e = Math.sin(u / 0.14 * Math.PI), x = a[3 * k], y = a[3 * k + 1], r = Math.max(1.2, a[3 * k + 2]);
      var g = c.createRadialGradient(x, y, 0, x, y, r * (2 + 2.5 * e));
      g.addColorStop(0, "rgba(255,248,226," + (0.95 * e).toFixed(3) + ")");
      g.addColorStop(0.35, "rgba(201,219,226," + (0.55 * e).toFixed(3) + ")");
      g.addColorStop(1, "rgba(201,219,226,0)");
      c.fillStyle = g;
      c.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    }
  }
  function vis(p) { return d3.geoDistance(p, [-st.rot[0], -st.rot[1]]) < Math.PI / 2 - 0.01; }
  function drawStorms(now) {
    var P = G.proj, path = G.path;
    G.dim.selectAll("*").remove(); G.fld.selectAll("*").remove(); G.trk.selectAll("*").remove();
    G.glyph.selectAll("*").remove(); G.eye.selectAll("*").remove(); G.hit.selectAll("*").remove(); G.lab.selectAll("*").remove();
    var used = [];
    st.sel.forEach(function (s) {
      var f = fields[s.id];
      if (f && f.iso && st.view === "lines") f.iso.forEach(function (o) {
        G.fld.append("path").attr("class", "sg-fill").attr("d", path(o.p)).style("fill", s.col);
        G.fld.append("path").attr("d", path(o.g)).attr("stroke", s.col).attr("stroke-opacity", OPAC[LEVELS.indexOf(o.lev)])
          .classed("is-ts", o.lev === 17);
      });
      if (f && f.iso && !st.raf && st.view === "lines") f.iso.forEach(function (o) { label(o, used); });
      if (!s.pts) return;
      s.lines.forEach(function (ln) {
        var d = path(ln);
        if (!d) return;
        G.trk.append("path").attr("d", d).attr("stroke", s.col);
        G.hit.append("path").attr("d", d).datum(s);
      });
      s.pts.forEach(function (p) {
        if (!p.syn || !vis(p.xy)) return;
        var a = P(p.xy);
        G.trk.append("circle").attr("cx", a[0]).attr("cy", a[1]).attr("r", 2).attr("fill", s.col);
      });
      var c = s.cur;
      if (!c || !vis(c.xy)) return;
      var e = P(c.xy), tr = "translate(" + f1(e[0]) + "," + f1(e[1]) + ")";
      if (st.raf && !s.done) {
        var sv = Math.min(1, Math.max(0, (c.v - 17) / 33)), dpx = G.R * st.k * RAD;
        if (now - (s.fl || 0) > 70) { s.fl = now; s.fo = Math.min(1, 0.25 + sv) * (0.45 + 0.55 * Math.random()); }
        G.dim.append("circle").attr("cx", e[0]).attr("cy", e[1]).attr("r", dpx * (0.8 + 1.8 * sv))
          .attr("fill", "url(#sg-dimg)").attr("opacity", s.fo);
        var r = 11 + 0.5 * c.v, ph = now / 1400, g = G.glyph.append("g").attr("transform", tr).style("color", s.col);
        [0, 1, 2].forEach(function (k) {
          var u = (ph + k / 3) % 1;
          g.append("circle").attr("r", r * (0.35 + 1.3 * u)).attr("stroke-opacity", 0.55 * (1 - u));
        });
        // southern-hemisphere storms turn clockwise
        g.append("path").attr("d", SPIRAL).attr("transform", "rotate(" + ((c.xy[1] < 0 ? 1 : -1) * (now / 2400 * 360 % 360)) +
          ") scale(" + (c.xy[1] < 0 ? -r / 100 : r / 100) + "," + r / 100 + ")").attr("stroke-opacity", Math.min(0.85, 0.25 + c.v / 70));
      }
      var ey = G.eye.append("g").attr("transform", tr);
      ey.append("circle").attr("r", 5.5);
      ey.append("circle").attr("r", 1.8).attr("class", "se-eye-c");
    });
  }
  // one label per isotach: the middle of its longest visible line, skipped when it would touch another label
  function label(o, used) {
    var best = null, bl = 0, P = G.proj;
    o.g.coordinates.forEach(function (ln) { if (ln.length > bl) { bl = ln.length; best = ln; } });
    if (!best || bl < 6) return;
    for (var k = 0; k < 6; k++) {
      var q = best[Math.floor(((k * 0.37 + 0.5) % 1) * best.length)];
      if (!vis(q)) continue;
      var a = P(q);
      if (a[0] < 20 || a[0] > G.w - 20 || a[1] < 10 || a[1] > G.h - 10) continue;
      if (used.some(function (u) { return Math.abs(u[0] - a[0]) < 34 && Math.abs(u[1] - a[1]) < 14; })) continue;
      used.push(a);
      G.lab.append("text").attr("x", a[0]).attr("y", a[1]).text(o.lev === 17 ? "17 m/s" : o.lev);
      return;
    }
  }
  var SPIRAL = (function () {
    var d = "";
    [0, Math.PI].forEach(function (a0) {
      for (var i = 0; i <= 24; i++) {
        var a = a0 + i / 24 * 1.6 * Math.PI, r = 0.18 * Math.exp(0.33 * (a - a0));
        d += (i ? "L" : "M") + f1(100 * r * Math.cos(a)) + "," + f1(100 * r * Math.sin(a));
      }
    });
    return d;
  })();

  // ease the globe to a centre and zoom
  function fly(lon, lat, k) {
    k = Math.max(1, Math.min(10, k));
    var r0 = st.rot.slice(), k0 = st.k, r1 = [-lon, -lat];
    r1[0] = r0[0] + ((((r1[0] - r0[0]) % 360) + 540) % 360 - 180); // the short way round
    if (reduce) { st.rot = r1; st.k = k; draw(); return; }
    var t0 = performance.now(), tw = st.tw = {};
    (function step(now) {
      if (st.tw !== tw) return;
      var u = d3.easeCubicInOut(Math.min(1, (now - t0) / 900));
      st.rot = [r0[0] + u * (r1[0] - r0[0]), r0[1] + u * (r1[1] - r0[1])];
      st.k = k0 * Math.pow(k / k0, u);
      render(now);
      G.moving = u < 1;
      if (u < 1) requestAnimationFrame(step); else { st.tw = null; render(performance.now()); }
    })(t0);
  }
  function flyTo(s, k) {
    if (!s.pts || !s.pts.length) return;
    var xs = [], ys = [];
    s.pts.forEach(function (p) { xs.push(p.xy[0]); ys.push(p.xy[1]); });
    var lon0 = d3.mean(xs), span = Math.max(d3.max(xs) - d3.min(xs), (d3.max(ys) - d3.min(ys)) * 1.3, 8);
    fly(lon0, (d3.min(ys) + d3.max(ys)) / 2, k == null ? Math.min(4, 95 / span) : k);
  }

  // ------------------------------------------------------------------ storm data
  function loadSeason(y) {
    if (!seasons[y]) seasons[y] = getJSON(D + "tracks/" + y + ".json").catch(function (e) { delete seasons[y]; throw e; });
    return seasons[y];
  }
  function prep(s, T) {
    var raw = T[s.id] || [], h0 = new Date(s.t).getUTCHours(), ln = [], cur = null;
    s.pts = raw.map(function (p) {
      var o = { t: s.t + p[0] * 36e5, xy: [p[1], p[2]], v: p[3], brk: p[4] === 1, syn: (p[0] + h0) % 6 === 0 };
      if (!cur || o.brk) { cur = []; ln.push(cur); }
      cur.push(o.xy);
      return o;
    });
    s.lines = ln.filter(function (c) { return c.length > 1; }).map(function (c) { return { type: "LineString", coordinates: c }; });
  }
  function loadField(s) {
    if (!s.wind_bbox) return Promise.resolve(null);
    if (fields[s.id]) return Promise.resolve(fields[s.id]);
    return N.decode(D + "wind/" + s.id + ".png").then(function (im) {
      var n2 = im.w + 2, m2 = im.h + 2, v = new Float32Array(n2 * m2);
      for (var j = 0; j < im.h; j++) for (var i = 0; i < im.w; i++) v[(j + 1) * n2 + i + 1] = im.data[j * im.w + i];
      var f = fields[s.id] = { v: v, n2: n2, m2: m2, b: s.wind_bbox, res: IX.meta.wind_res };
      f.iso = iso(f, v);
      return f;
    }).catch(function (e) { if (window.console) console.warn(e); return null; });
  }
  // isotachs as lines (no fill, so ring direction on the sphere does not matter)
  function iso(f, vals) {
    var pt = function (c) { return [f.b[0] + (c[0] - 1) * f.res, f.b[3] - (c[1] - 1) * f.res]; };
    return d3.contours().size([f.n2, f.m2]).thresholds(LEVELS)(vals).map(function (mp) {
      var lines = [], polys = [];
      mp.coordinates.forEach(function (poly) {
        var rings = poly.map(function (r) { return r.map(pt); });
        rings.forEach(function (r) { lines.push(r); });
        if (d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI) rings.forEach(function (r) { r.reverse(); });
        polys.push(rings);
      });
      return { lev: mp.value, g: { type: "MultiLineString", coordinates: lines }, p: { type: "MultiPolygon", coordinates: polys } };
    }).filter(function (o) { return o.g.coordinates.length; });
  }

  function toggle(s, k) {
    var i = st.sel.indexOf(s);
    stopPlay(true);
    if (i >= 0) { st.sel.splice(i, 1); recolor(); refresh(); draw(); A.selChanged(); return; }
    if (st.sel.length >= MAXSEL) st.sel.shift();
    st.sel.push(s);
    recolor();
    refresh();
    A.selChanged();
    loadSeason(s.season).then(function (T) {
      prep(s, T);
      if (st.sel.indexOf(s) < 0) return null;
      flyTo(s, k);
      return loadField(s);
    }).then(function () { refresh(); draw(); }).catch(function (e) { if (window.console) console.warn(e); });
  }
  function recolor() {
    var used = st.sel.map(function (s) { return s.col; });
    st.sel.forEach(function (s) {
      if (!s.col || used.indexOf(s.col) !== used.lastIndexOf(s.col)) {
        s.col = SEL.filter(function (c) { return used.indexOf(c) < 0; })[0] || SEL[0];
        used = st.sel.map(function (x) { return x.col; });
      }
    });
    IX.storms.forEach(function (s) { if (st.sel.indexOf(s) < 0) s.col = null; });
    if (G.wkey) C.key(G.wkey, st.view); // the lines key takes the first storm's colour
  }

  // ------------------------------------------------------------------ side panel
  function matches() {
    // a typed name searches every region: looking for a storm by name means that storm, wherever it was
    var v = A.norm(sq.value), named = function (s) { return !v || (" " + s.key).indexOf(" " + v) >= 0; };
    var y0 = +$("sg-y0").value, y1 = +$("sg-y1").value;
    var out = IX.storms.filter(function (s) { return named(s) && st.cat[s["class"]] && s.season >= Math.min(y0, y1) && s.season <= Math.max(y0, y1) && (v || st.scope === "all" || A.inRegion(s)) && (A.st.year == null || s.season === A.st.year); });
    return out.sort(st.sort === "new" ? function (a, b) { return b.t - a.t; } : function (a, b) { return b.vmax_ms - a.vmax_ms || b.t - a.t; });
  }
  function refresh() {
    var T = tx(), m = matches();
    list.textContent = "";
    m.slice(0, st.limit).forEach(function (s) {
      var li = document.createElement("li"), b = document.createElement("button"), sw = document.createElement("span"), mt = document.createElement("span");
      b.type = "button";
      b.setAttribute("aria-pressed", String(st.sel.indexOf(s) >= 0));
      sw.className = "sg-sw";
      if (s.col) sw.style.background = s.col;
      mt.className = "sg-meta";
      mt.textContent = " " + s.vmax_ms + " m/s · " + T.basin[s.basin];
      b.appendChild(sw);
      b.appendChild(document.createTextNode(nm(s) + " " + s.season));
      b.appendChild(mt);
      b.addEventListener("click", function () { toggle(s); });
      b.addEventListener("mouseenter", function (e) { A.tipShow(e.clientX, e.clientY, A.card(s)); });
      b.addEventListener("mouseleave", A.tipHide);
      li.appendChild(b);
      list.appendChild(li);
    });
    var n = Math.min(st.limit, m.length), mb = $("sg-morebtn");
    more.textContent = !m.length ? T.none : m.length > n ? T.shown.replace("{n}", n.toLocaleString(lang())).replace("{m}", m.length.toLocaleString(lang())) : "";
    mb.hidden = m.length <= n;
    mb.textContent = lang() === "vi" ? "Xem thêm " + Math.min(ROWS, m.length - n) + " cơn" : "Show " + Math.min(ROWS, m.length - n) + " more";
    info.textContent = "";
    st.sel.forEach(function (s) {
      var p = document.createElement("p"), sw = document.createElement("span"), b = document.createElement("strong"), x = document.createElement("button");
      sw.className = "sg-sw"; sw.style.background = s.col;
      b.textContent = nm(s) + ", " + s.season + ".";
      var r = A.st.region, rc = r && r[0] === "c" ? +r.slice(2) : -1;
      var k = s.near.filter(function (c) { return c === rc; }).concat(s.near.filter(function (c) { return c !== rc; })).map(cname), ks = k.length > 5 ? k.slice(0, 4).join(", ") + " " + T.and + " " + (k.length - 4) + " " + T.others : k.join(", ");
      var f = fields[s.id];
      p.appendChild(sw); p.appendChild(b);
      p.appendChild(document.createTextNode(" " + T.basin[s.basin] + ". " + T.peak + " " + s.vmax_ms + " m/s (" + T.cls[s["class"]] + ")." +
        (k.length ? " " + T.near + " " + ks + "." : "") + (!s.wind_bbox || (s.pts && !f) ? " " + T.nofield : "") + " "));
      x.type = "button"; x.className = "se-link"; x.textContent = T.remove;
      x.addEventListener("click", function () { toggle(s); });
      p.appendChild(x);
      info.appendChild(p);
    });
    playBtn.disabled = !st.sel.some(function (s) { return s.pts && s.pts.length > 1; });
    playLabel();
  }

  // ------------------------------------------------------------------ play: all selected storms from their first fix
  function playLabel() {
    playBtn.textContent = st.raf ? tx().pause : st.tau > 0 && st.tau < st.dur ? tx().resume : tx().play;
    $("sg-stop").hidden = !st.dur; // Stop shows once a play-time state is on screen
  }
  function stopPlay(reset, hold) {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = null;
    if (reset) {
      st.tau = 0; st.dur = 0;
      st.sel.forEach(function (s) { s.cur = null; s.done = false; s.pi = 0; var f = fields[s.id]; if (f && f.full) { f.iso = f.full; f.cur = null; } });
      clock.textContent = "";
      NT.reset(hold); // back to the 2025 layer, unless Play is about to pick the year
    }
    playLabel();
  }
  function closest(s, f) {
    var p = s.pts, dense = [], i, j, k;
    for (i = 0; i < p.length - 1; i++) {
      var n = p[i + 1].brk ? 1 : Math.max(1, Math.round((p[i + 1].t - p[i].t) / 36e5));
      for (k = 0; k < n; k++) {
        var u = k / n;
        dense.push([p[i].xy[0] + u * (p[i + 1].xy[0] - p[i].xy[0]), p[i].xy[1] + u * (p[i + 1].xy[1] - p[i].xy[1]), p[i].t + u * (p[i + 1].t - p[i].t)]);
      }
    }
    dense.push([p[p.length - 1].xy[0], p[p.length - 1].xy[1], p[p.length - 1].t]);
    var tc = new Float64Array(f.v.length);
    for (j = 0; j < f.m2; j++) for (i = 0; i < f.n2; i++) {
      var c = j * f.n2 + i;
      if (f.v[c] < 10) continue;
      var lon = f.b[0] + (i - 0.5) * f.res, lat = f.b[3] - (j - 0.5) * f.res, cl = Math.cos(lat * RAD), bd = 1e9, bt = 0;
      for (k = 0; k < dense.length; k++) {
        var dx = (dense[k][0] - lon) * cl, dy = dense[k][1] - lat, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; bt = dense[k][2]; }
      }
      tc[c] = bt;
    }
    f.tc = tc; f.w = new Float32Array(f.v.length); f.full = f.iso;
  }
  function advance(s, t) {
    var p = s.pts, i = s.pi || 0;
    while (i < p.length - 1 && p[i + 1].t <= t) i++;
    s.pi = i;
    var a = p[i], b = p[Math.min(i + 1, p.length - 1)], u = b.t > a.t && !b.brk ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
    var va = a.v == null ? b.v : a.v, vb = b.v == null ? va : b.v, v = va == null ? 20 : va + u * (vb - va);
    s.cur = { xy: [a.xy[0] + u * (b.xy[0] - a.xy[0]), a.xy[1] + u * (b.xy[1] - a.xy[1])], v: v, t: t, fix: a };
    s.done = t >= p[p.length - 1].t;
  }
  function tick(now) {
    st.tau = Math.min(st.dur, st.tau + Math.max(0, Math.min(100, now - st.last)) / MSH);
    st.last = now;
    apply(now, false);
    if (st.tau >= st.dur) { st.raf = null; st.sel.forEach(function (s) { var f = fields[s.id]; if (f && f.full) { f.iso = f.full; f.cur = null; } }); render(now); playLabel(); return; }
    st.raf = requestAnimationFrame(tick);
  }
  // the whole picture at play time st.tau (hours since the first storm's first fix), so stepping back works too
  function apply(now, force) {
    var redo = force || now - (st.ff || 0) > 50, lead = null;
    if (redo) st.ff = now;
    st.sel.forEach(function (s) {
      if (!s.pts || s.pts.length < 2) return;
      var t = s.pts[0].t + st.tau * 36e5, f = fields[s.id];
      advance(s, t);
      if (!lead) lead = s;
      if (f && f.tc && redo) {
        var R = WAKE * 36e5;
        for (var c = 0; c < f.v.length; c++) f.w[c] = f.v[c] < 10 ? f.v[c] : f.v[c] * Math.max(0, Math.min(1, 1 - (f.tc[c] - t) / R));
        f.iso = s.done ? f.full : iso(f, f.w);
        f.cur = s.done ? null : f.w;
      }
    });
    if (lead && st.follow) { // the globe turns with the first storm
      var tr = [-lead.cur.xy[0], -lead.cur.xy[1]], d = ((tr[0] - st.rot[0]) % 360 + 540) % 360 - 180;
      st.rot = [st.rot[0] + d * 0.06, st.rot[1] + (tr[1] - st.rot[1]) * 0.06];
    }
    if (lead) clockText(lead);
    NT.sync();
    render(now);
    if (seekG) seekG.value = Math.round(st.tau);
  }
  // prepare Play without starting it (for a step or the scrubber before the first Play)
  function ready() {
    var ok = st.sel.filter(function (s) { return s.pts && s.pts.length > 1; });
    if (!ok.length) return false;
    st.dur = d3.max(ok, function (s) { return (s.pts[s.pts.length - 1].t - s.pts[0].t) / 36e5; });
    ok.forEach(function (s) { var f = fields[s.id]; if (f && !f.tc) closest(s, f); });
    if (seekG) seekG.max = Math.ceil(st.dur);
    return true;
  }
  // one step lands on the next (or previous) 6-hourly synoptic time of the first storm: a real IBTrACS record
  function stepG(dir) {
    if (!st.dur && !ready()) return;
    var lead = st.sel.filter(function (s) { return s.pts && s.pts.length > 1; })[0];
    var h0 = new Date(lead.pts[0].t).getUTCHours(), cur = st.tau + h0;
    var next = dir > 0 ? Math.floor(cur / 6 + 1e-6) * 6 + 6 : Math.ceil(cur / 6 - 1e-6) * 6 - 6;
    seekTo(next - h0);
  }
  function seekTo(h) {
    if (!st.dur && !ready()) return;
    st.tau = Math.max(0, Math.min(st.dur, h));
    st.sel.forEach(function (s) { s.pi = 0; });
    st.follow = true;
    var now = performance.now();
    st.last = now;
    // turn straight to the lead storm, then draw
    apply(now, true);
    var lead = st.sel.filter(function (s) { return s.cur; })[0];
    if (lead) { st.rot = [-lead.cur.xy[0], -lead.cur.xy[1]]; render(now); }
    playLabel();
  }
  function clockText(s) {
    var c = s.cur, i = s.pts.indexOf(c.fix);
    while (i > 0 && !s.pts[i].syn) i--;
    var f = s.pts[Math.max(i, 0)], d = new Date(f.t), z = function (n) { return (n < 10 ? "0" : "") + n; };
    var day = lang() === "vi" ? z(d.getUTCDate()) + "/" + z(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() : d.getUTCDate() + " " + TXT.en.mon[d.getUTCMonth()] + " " + d.getUTCFullYear();
    clock.textContent = nm(s) + ": " + day + ", " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + " UTC" + (f.v == null ? "" : " · " + tx().wind + "\u00a0" + f.v + "\u00a0m/s");
  }
  // Play is started by the reader, so it runs even when the system asks for reduced motion; Pause stops it
  function togglePlay() {
    var ok = st.sel.filter(function (s) { return s.pts && s.pts.length > 1; });
    if (!ok.length) return;
    if (st.raf) { stopPlay(); return; }
    // a fresh start resets first, then prepares (the reset clears the play length)
    if (!(st.dur && st.tau > 0 && st.tau < st.dur)) { stopPlay(true, true); ready(); }
    st.follow = true;
    st.tw = null;
    st.last = performance.now();
    st.raf = requestAnimationFrame(tick);
    playLabel();
  }

  // ------------------------------------------------------------------ wiring
  function goRegion(r) {
    st.follow = false;
    refresh();
    if (!r) fly(-st.rot[0], -st.rot[1], 1);
    else if (r[0] === "b") fly(A.BAT[r.slice(2)][0], A.BAT[r.slice(2)][1], 1.6);
    else { var c = IX.countries[+r.slice(2)]; fly(c[2], c[3], Math.min(3, 40 / Math.max(2, c[4]))); }
  }
  // key for the night lights: the same colour steps as drawn, low to high
  function ramp() {
    if (!G.ramp) return;
    C.key(G.wkey, st.view);
    if (!LT || !NT.cur) return;
    var T = tx().ramp, r = G.ramp;
    r.textContent = "";
    r.appendChild(A.el("span", "sg-ramp-t", N.keyText(NT.year, NT.pre, lang())));
    var bar = A.el("span", "sg-ramp-bar");
    LT.cols.forEach(function (c) { var k = A.el("span"); k.style.background = c; bar.appendChild(k); });
    r.appendChild(bar);
    var lh = A.el("span", "sg-ramp-lh");
    lh.appendChild(A.el("span", null, T[0])); lh.appendChild(A.el("span", null, T[1]));
    r.appendChild(lh);
  }
  function labels() { G.svg.attr("aria-label", tx().map); sq.placeholder = lang() === "vi" ? "ví dụ: Haiyan, Katrina" : "e.g. Haiyan, Katrina"; ramp(); refresh(); }
  function init() {
    build();
    Array.prototype.forEach.call(fig.querySelectorAll("[data-sort]"), function (b) {
      b.addEventListener("click", function () {
        st.sort = b.getAttribute("data-sort");
        Array.prototype.forEach.call(fig.querySelectorAll("[data-sort]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        refresh();
      });
    });
    Array.prototype.forEach.call(fig.querySelectorAll("[data-scope]"), function (b) {
      b.addEventListener("click", function () {
        st.scope = b.getAttribute("data-scope");
        Array.prototype.forEach.call(fig.querySelectorAll("[data-scope]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        refresh();
      });
    });
    // filters: any change starts the list again from its first 60 rows
    var again = function () { st.limit = ROWS; refresh(); };
    st.limit = ROWS; st.cat = {};
    A.CLS.forEach(function (c) { st.cat[c] = true; });
    ["sg-y0", "sg-y1"].forEach(function (id, k) {
      var sel = $(id);
      for (var y = IX.meta.seasons[0]; y <= IX.meta.seasons[1]; y++) { var o = document.createElement("option"); o.value = o.textContent = y; sel.appendChild(o); }
      sel.value = IX.meta.seasons[k];
      sel.addEventListener("change", again);
    });
    Array.prototype.forEach.call(fig.querySelectorAll("[data-cat]"), function (b) {
      b.addEventListener("click", function () { var c = b.getAttribute("data-cat"); st.cat[c] = !st.cat[c]; b.setAttribute("aria-pressed", String(st.cat[c])); again(); });
    });
    $("sg-morebtn").addEventListener("click", function () { st.limit += ROWS; refresh(); });
    Array.prototype.forEach.call(fig.querySelectorAll("[data-view]"), function (b) {
      b.addEventListener("click", function () {
        st.view = b.getAttribute("data-view");
        Array.prototype.forEach.call(fig.querySelectorAll("[data-view]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        C.key(G.wkey, st.view);
        draw();
      });
    });
    var twb = $("sg-tw");
    twb.checked = st.glint;
    twb.addEventListener("change", function () { st.glint = twb.checked; if (st.glint) fxStart(); else fxClear(); });
    document.addEventListener("visibilitychange", fxStart);
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { FX.vis = e[0].isIntersecting; fxStart(); }).observe(box);
    sq.addEventListener("input", again);
    var gs = $("sg-speed"), gsv = $("sg-speed-v");
    gs.addEventListener("input", function () { MSH = 1000 * +gs.value / 24; gsv.textContent = gs.value + " s"; });
    playBtn.addEventListener("click", togglePlay);
    $("sg-stop").addEventListener("click", function () { stopPlay(true); seekG.value = 0; draw(); }); // back to the start, with the 2025 lights
    $("sg-back").addEventListener("click", function () { stepG(-1); });
    $("sg-fwd").addEventListener("click", function () { stepG(1); });
    seekG.addEventListener("input", function () { seekTo(+seekG.value); });
    $("sg-reset").addEventListener("click", function () { st.follow = false; fly(-st.rot[0], -st.rot[1], 1); });
    $("sg-in").addEventListener("click", function () { zoomBy(1.6); });
    $("sg-out").addEventListener("click", function () { zoomBy(1 / 1.6); });
    document.addEventListener("langchange", labels);
    A.on("region", goRegion);
    A.on("year", refresh);
    A.on("pick", function (s) {
      if (st.sel.indexOf(s) < 0) toggle(s); else if (s.pts) flyTo(s);
      var t = $("at-close");
      if (t && t.getBoundingClientRect().top > window.innerHeight * 0.6) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    // start: the region and storms in the link, else Vietnam with Yagi 2024
    var h = A.fromHash(), vn = IX.countries.filter(function (c) { return c[0] === "Vietnam"; })[0];
    var r = h.region != null ? h.region : vn ? "c:" + vn.i : "";
    A.setRegion(r, true);
    A.emit("region", r);
    if (h.year != null) A.setYear(h.year);
    var first = h.sel.length ? h.sel : IX.storms.filter(function (s) { return s.name === "Yagi" && s.season === 2024; });
    first.slice(0, MAXSEL).forEach(function (s, i) { toggle(s, i === 0 ? 1.4 : null); });
    labels();
    var lw = box.clientWidth, rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (box.clientWidth !== lw) { lw = box.clientWidth; build(); labels(); draw(); } }, 120);
    });
    draw();
  }
})();
