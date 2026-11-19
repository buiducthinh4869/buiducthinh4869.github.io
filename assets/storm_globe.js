/* Storm globe on research.html: tropical cyclones worldwide, a few at a time, on a globe over night-time light,
   plus an overview of all tracks by ocean basin. Data in assets/data/globe/ (contract in CLAUDE.md):
   index.json, land.json, lights.png, lite.json, tracks/<season>.json, wind/<id>.png. Tracks and winds are IBTrACS.
   Needs D3 v7, loaded before this file. If D3 or the data fail, the figure is hidden. */
(function () {
  "use strict";
  var fig = document.querySelector(".storm-globe"), ov = document.querySelector(".storm-overview");
  if (!fig) return;
  var D = "assets/data/globe/", RAD = Math.PI / 180;
  var LEVELS = [17, 33, 43, 50, 58], OPAC = [0.4, 0.52, 0.65, 0.78, 0.9];
  var SEL = ["#1f5f7a", "#b08a5a", "#7a4f6e", "#4f6e3a"], MAXSEL = 4, ROWS = 60;
  var BAS = { WP: ["#1f5f7a", 140, 18], NA: ["#b08a5a", -62, 26], EP: ["#8a9a5b", -115, 15],
    NI: ["#a65e4e", 82, 14], SI: ["#7a5c8a", 68, -16], SP: ["#6b6f72", 165, -18], SA: ["#9a8f80", -35, -25] };
  var BORDER = ["WP", "NA", "EP", "NI", "SI", "SP", "SA"];
  var MSH = 60, WAKE = 9;
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq("(prefers-reduced-motion: reduce)"), coarse = mq("(pointer: coarse)");
  var $ = function (id) { return document.getElementById(id); };
  var box = fig.querySelector(".sg-globe"), regionSel = $("sg-region"), q = $("sg-q"), list = $("sg-list"),
    more = $("sg-more"), info = $("sg-info"), playBtn = $("sg-play"), clock = $("sg-clock");

  var TXT = {
    en: {
      basin: { WP: "Western Pacific", NA: "North Atlantic", EP: "Eastern Pacific", NI: "North Indian", SI: "South Indian", SP: "South Pacific", SA: "South Atlantic" },
      all: "All regions", basins: "Ocean basins", countries: "Countries and territories",
      cls: { TS: "tropical storm", C1: "category 1", C2: "category 2", C3: "category 3", C4: "category 4", C5: "category 5" },
      unnamed: "Unnamed", peak: "Peak wind", near: "Passed within 200 km of", and: "and", others: "others",
      nofield: "No wind field.", remove: "Remove", none: "No storms match.", shown: "Showing {n} of {m}. Narrow the search to see the rest.",
      play: "Play", pause: "Pause", resume: "Resume", search: "e.g. Haiyan", storms: "storms", wind: "wind",
      mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      map: "Globe with the selected storms: tracks, lines of equal peak wind in m/s, over night-time light. Drag to turn it.",
      ov: "World map of all tropical storm tracks, coloured by ocean basin."
    },
    vi: {
      basin: { WP: "Tây Thái Bình Dương", NA: "Bắc Đại Tây Dương", EP: "Đông Thái Bình Dương", NI: "Bắc Ấn Độ Dương", SI: "Nam Ấn Độ Dương", SP: "Nam Thái Bình Dương", SA: "Nam Đại Tây Dương" },
      all: "Tất cả khu vực", basins: "Vùng biển", countries: "Quốc gia và vùng lãnh thổ",
      cls: { TS: "bão nhiệt đới", C1: "cấp 1", C2: "cấp 2", C3: "cấp 3", C4: "cấp 4", C5: "cấp 5" },
      unnamed: "Không tên", peak: "Sức gió mạnh nhất", near: "Đi qua trong phạm vi 200 km quanh", and: "và", others: "nước khác",
      nofield: "Chưa có trường gió.", remove: "Bỏ chọn", none: "Không có cơn bão nào phù hợp.", shown: "Đang hiện {n} trên {m}. Thu hẹp tìm kiếm để xem phần còn lại.",
      play: "Phát", pause: "Tạm dừng", resume: "Tiếp tục", search: "ví dụ: Haiyan", storms: "cơn bão", wind: "gió",
      map: "Quả địa cầu với các cơn bão đang chọn: đường đi, các đường đẳng tốc gió lớn nhất (m/s), trên nền ánh sáng ban đêm. Kéo để xoay.",
      ov: "Bản đồ thế giới với đường đi của mọi cơn bão nhiệt đới, tô màu theo vùng biển."
    }
  };
  function lang() { return document.documentElement.getAttribute("data-lang") === "vi" ? "vi" : "en"; }
  function tx() { return TXT[lang()]; }
  function nm(s) { return s.name === "Unnamed" || s.name === "UNNAMED" ? tx().unnamed : s.name; }
  function norm(v) { return v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim(); }
  function cname(i) { var c = IX.countries[i]; return lang() === "vi" ? c[1] : c[0]; }
  function f1(v) { return v.toFixed(1); }

  function fail(err) {
    if (err && window.console) console.warn("storm globe:", err);
    fig.hidden = true;
    if (ov) ov.hidden = true;
  }
  if (!window.d3 || !d3.geoOrthographic || !window.fetch || !window.Promise) { fail("D3 or fetch unavailable"); return; }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  function getImg(u) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas");
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        var cx = c.getContext("2d", { willReadFrequently: true });
        cx.drawImage(im, 0, 0);
        ok({ w: c.width, h: c.height, px: cx.getImageData(0, 0, c.width, c.height).data });
      };
      im.onerror = function () { no(new Error(u + " missing")); };
      im.src = u;
    });
  }

  var IX, land, LT, G = {}, st = { rot: [-125, -15], k: 1, sel: [], region: "", sort: "new", act: false };
  var seasons = {}, fields = {};

  Promise.all([getJSON(D + "index.json"), getJSON(D + "land.json")]).then(function (r) {
    IX = r[0]; land = r[1];
    IX.storms.forEach(function (s) {
      s.label = s.name + " " + s.season;
      s.key = norm(s.label);
      s.t = Date.parse(s.t0);
    });
    init();
    return getImg(D + "lights.png").then(lights, function (e) { if (window.console) console.warn(e); });
  }).catch(fail);

  // ------------------------------------------------------------------ lights: lit cells binned by colour
  function rampColors(n, t95) {
    var lo = d3.interpolateRgb("#faf9f5", "#1f5f7a"), hi = d3.interpolateRgb("#1f5f7a", "#23272b"), out = [];
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, a = Math.min(1, t / t95);
      out.push(d3.interpolateRgb("#e6e2d8", d3.rgb(t <= t95 ? lo(t / t95) : hi((t - t95) / (1 - t95))))(a));
    }
    return out;
  }
  function lights(im) {
    var m = IX.meta.lights, b = m.bounds, c = m.cell_deg, NB = 16, raw = [], i, j;
    for (i = 0; i < NB; i++) raw.push([]);
    for (j = 0; j < im.h; j++) for (i = 0; i < im.w; i++) {
      var v = im.px[(j * im.w + i) * 4];
      if (v < 24) continue; // the faintest glow is left out, as it is barely visible and costs time
      var lat = (b[3] - (j + 0.5) * c) * RAD;
      raw[Math.min(NB - 1, Math.floor(v / 256 * NB))].push((b[0] + (i + 0.5) * c) * RAD, Math.sin(lat), Math.cos(lat));
    }
    LT = { cell: c * RAD, cols: rampColors(NB, m.scale.ink_from), bins: raw.map(function (a) { return new Float32Array(a); }) };
    draw();
  }

  // ------------------------------------------------------------------ globe
  function build() {
    var w = G.w = box.clientWidth, h = G.h = Math.round(w * (w < 560 ? 1 : 0.86)), dpr = G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.R = Math.min(w, h) / 2 - 6;
    box.style.height = h + "px";
    var root = d3.select(box);
    root.selectAll("*").remove();
    G.cv = root.append("canvas").attr("width", w * dpr).attr("height", h * dpr).style("width", w + "px").style("height", h + "px").node();
    G.cx = G.cv.getContext("2d");
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
    svg.style("touch-action", coarse ? "pan-y" : "none");
    var p0 = null;
    svg.on("pointerdown", function (ev) {
      st.act = true;
      p0 = [ev.clientX, ev.clientY, st.rot.slice()];
      svg.classed("is-drag", true);
      if (svg.node().setPointerCapture) svg.node().setPointerCapture(ev.pointerId);
    }).on("pointermove", function (ev) {
      if (!p0) return;
      var s = 180 / Math.PI / (G.R * st.k);
      st.follow = false;
      st.rot = [p0[2][0] + (ev.clientX - p0[0]) * s, Math.max(-85, Math.min(85, p0[2][1] - (ev.clientY - p0[1]) * s))];
      if (st.tw) st.tw = null;
      draw();
    }).on("pointerup pointercancel", function () { p0 = null; svg.classed("is-drag", false); });
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
    if (LT) { // orthographic forward projection by hand, about 20 times faster than through d3 for this many points
      var L0 = -st.rot[0] * RAD, p0 = -st.rot[1] * RAD, sp = Math.sin(p0), cq = Math.cos(p0), X = w / 2, Y = h / 2;
      var sz = Math.max(1, Rk * LT.cell * 1.05);
      for (var b = 0; b < LT.bins.length; b++) {
        var a = LT.bins[b];
        cx.fillStyle = LT.cols[b];
        for (var i = 0; i < a.length; i += 3) {
          var l = a[i] - L0, cl = Math.cos(l), cosc = sp * a[i + 1] + cq * a[i + 2] * cl;
          if (cosc <= 0.02) continue;
          var x = X + Rk * a[i + 2] * Math.sin(l), y = Y - Rk * (cq * a[i + 1] - sp * a[i + 2] * cl);
          if (x < -2 || x > w + 2 || y < -2 || y > h + 2) continue;
          cx.fillRect(x - sz / 2, y - sz / 2, sz, sz * cosc + 0.4);
        }
      }
    }
    cx.beginPath(); cp({ type: "Sphere" }); cx.lineWidth = 1; cx.strokeStyle = "#e4e1d8"; cx.stroke();
    drawStorms(now);
  }

  function vis(p) { return d3.geoDistance(p, [-st.rot[0], -st.rot[1]]) < Math.PI / 2 - 0.01; }
  function drawStorms(now) {
    var P = G.proj, path = G.path;
    G.dim.selectAll("*").remove(); G.fld.selectAll("*").remove(); G.trk.selectAll("*").remove();
    G.glyph.selectAll("*").remove(); G.eye.selectAll("*").remove();
    st.sel.forEach(function (s) {
      var f = fields[s.id];
      if (f && f.iso) f.iso.forEach(function (o) {
        G.fld.append("path").attr("d", path(o.g)).attr("stroke", s.col).attr("stroke-opacity", OPAC[LEVELS.indexOf(o.lev)])
          .classed("is-ts", o.lev === 17);
      });
      if (!s.pts) return;
      s.lines.forEach(function (ln) { G.trk.append("path").attr("d", path(ln)).attr("stroke", s.col); });
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
      if (u < 1) requestAnimationFrame(step); else st.tw = null;
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
    return getImg(D + "wind/" + s.id + ".png").then(function (im) {
      var n2 = im.w + 2, m2 = im.h + 2, v = new Float32Array(n2 * m2);
      for (var j = 0; j < im.h; j++) for (var i = 0; i < im.w; i++) v[(j + 1) * n2 + i + 1] = im.px[(j * im.w + i) * 4];
      var f = fields[s.id] = { v: v, n2: n2, m2: m2, b: s.wind_bbox, res: IX.meta.wind_res };
      f.iso = iso(f, v);
      return f;
    }).catch(function (e) { if (window.console) console.warn(e); return null; });
  }
  // isotachs as lines (no fill, so ring direction on the sphere does not matter)
  function iso(f, vals) {
    var pt = function (c) { return [f.b[0] + (c[0] - 1) * f.res, f.b[3] - (c[1] - 1) * f.res]; };
    return d3.contours().size([f.n2, f.m2]).thresholds(LEVELS)(vals).map(function (mp) {
      var lines = [];
      mp.coordinates.forEach(function (poly) { poly.forEach(function (r) { lines.push(r.map(pt)); }); });
      return { lev: mp.value, g: { type: "MultiLineString", coordinates: lines } };
    }).filter(function (o) { return o.g.coordinates.length; });
  }

  function toggle(s, k) {
    var i = st.sel.indexOf(s);
    stopPlay(true);
    if (i >= 0) { st.sel.splice(i, 1); recolor(); refresh(); draw(); return; }
    if (st.sel.length >= MAXSEL) st.sel.shift();
    st.sel.push(s);
    recolor();
    refresh();
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
  }

  // ------------------------------------------------------------------ side panel
  function regionOptions() {
    var T = tx(), v = regionSel.value;
    regionSel.textContent = "";
    var add = function (par, val, text) { var o = document.createElement("option"); o.value = val; o.textContent = text; par.appendChild(o); };
    add(regionSel, "", T.all);
    var g1 = document.createElement("optgroup"); g1.label = T.basins; regionSel.appendChild(g1);
    BORDER.forEach(function (b) { if (IX.storms.some(function (s) { return s.basin === b; })) add(g1, "b:" + b, T.basin[b]); });
    var g2 = document.createElement("optgroup"); g2.label = T.countries; regionSel.appendChild(g2);
    IX.countries.map(function (c, i) { return i; }).sort(function (a, b) { return cname(a).localeCompare(cname(b), lang()); })
      .forEach(function (i) { add(g2, "c:" + i, cname(i)); });
    regionSel.value = v;
  }
  function matches() {
    var r = st.region, v = norm(q.value), out = IX.storms.filter(function (s) {
      if (r[0] === "b" && s.basin !== r.slice(2)) return false;
      if (r[0] === "c" && s.near.indexOf(+r.slice(2)) < 0) return false;
      return !v || s.key.indexOf(v) >= 0;
    });
    return out.sort(st.sort === "new" ? function (a, b) { return b.t - a.t; } : function (a, b) { return b.vmax_ms - a.vmax_ms || b.t - a.t; });
  }
  function refresh() {
    var T = tx(), m = matches();
    list.textContent = "";
    m.slice(0, ROWS).forEach(function (s) {
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
      li.appendChild(b);
      list.appendChild(li);
    });
    more.textContent = !m.length ? T.none : m.length > ROWS ? T.shown.replace("{n}", ROWS).replace("{m}", m.length.toLocaleString(lang())) : "";
    info.textContent = "";
    st.sel.forEach(function (s) {
      var p = document.createElement("p"), sw = document.createElement("span"), b = document.createElement("strong"), x = document.createElement("button");
      sw.className = "sg-sw"; sw.style.background = s.col;
      b.textContent = nm(s) + ", " + s.season + ".";
      var k = s.near.map(cname), ks = k.length > 5 ? k.slice(0, 4).join(", ") + " " + T.and + " " + (k.length - 4) + " " + T.others : k.join(", ");
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
  function playLabel() { playBtn.textContent = st.raf ? tx().pause : st.tau > 0 && st.tau < st.dur ? tx().resume : tx().play; }
  function stopPlay(reset) {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = null;
    if (reset) {
      st.tau = 0;
      st.sel.forEach(function (s) { s.cur = null; s.done = false; s.pi = 0; var f = fields[s.id]; if (f && f.full) f.iso = f.full; });
      clock.textContent = "";
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
    var redo = now - (st.ff || 0) > 50, lead = null;
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
      }
    });
    if (lead && st.follow) { // the globe turns with the first storm
      var tr = [-lead.cur.xy[0], -lead.cur.xy[1]], d = ((tr[0] - st.rot[0]) % 360 + 540) % 360 - 180;
      st.rot = [st.rot[0] + d * 0.06, st.rot[1] + (tr[1] - st.rot[1]) * 0.06];
    }
    if (lead) clockText(lead);
    render(now);
    if (st.tau >= st.dur) { st.raf = null; st.sel.forEach(function (s) { var f = fields[s.id]; if (f && f.full) f.iso = f.full; }); render(now); playLabel(); return; }
    st.raf = requestAnimationFrame(tick);
  }
  function clockText(s) {
    var c = s.cur, d = new Date(c.t), z = function (n) { return (n < 10 ? "0" : "") + n; };
    var day = lang() === "vi" ? z(d.getUTCDate()) + "/" + z(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() : d.getUTCDate() + " " + TXT.en.mon[d.getUTCMonth()] + " " + d.getUTCFullYear();
    clock.textContent = nm(s) + ": " + day + ", " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + " UTC" + (c.fix.v == null ? "" : " · " + tx().wind + " " + c.fix.v + " m/s");
  }
  // Play is started by the reader, so it runs even when the system asks for reduced motion; Pause stops it
  function togglePlay() {
    var ok = st.sel.filter(function (s) { return s.pts && s.pts.length > 1; });
    if (!ok.length) return;
    if (st.raf) { stopPlay(); return; }
    st.dur = d3.max(ok, function (s) { return (s.pts[s.pts.length - 1].t - s.pts[0].t) / 36e5; });
    if (!(st.tau > 0 && st.tau < st.dur)) stopPlay(true);
    ok.forEach(function (s) { var f = fields[s.id]; if (f && !f.tc) closest(s, f); });
    st.follow = true;
    st.tw = null;
    st.last = performance.now();
    st.raf = requestAnimationFrame(tick);
    playLabel();
  }

  // ------------------------------------------------------------------ overview: every track, coloured by genesis basin
  function overview() {
    if (!ov) return;
    var cbox = ov.querySelector(".so-map"), leg = ov.querySelector(".so-legend"), O = {}, data = null;
    var counts = {};
    IX.storms.forEach(function (s) { counts[s.basin] = (counts[s.basin] || 0) + 1; });
    leg.textContent = "";
    BORDER.forEach(function (b) {
      var bt = document.createElement("button"), sw = document.createElement("span"), lab = document.createElement("span");
      bt.type = "button"; bt.setAttribute("aria-pressed", "false"); bt.setAttribute("data-b", b);
      bt.hidden = !counts[b];
      sw.className = "sg-sw"; sw.style.background = BAS[b][0];
      bt.appendChild(sw); bt.appendChild(lab);
      bt.addEventListener("click", function () {
        var on = O.hi !== b;
        O.hi = on ? b : null;
        paint();
        setRegion(on ? "b:" + b : "");
      });
      leg.appendChild(bt);
    });
    function legend() {
      Array.prototype.forEach.call(leg.children, function (bt) {
        var b = bt.getAttribute("data-b");
        bt.lastChild.textContent = tx().basin[b] + " (" + (counts[b] || 0).toLocaleString(lang()) + ")";
        bt.setAttribute("aria-pressed", String(O.hi === b));
      });
    }
    function size() {
      var w = cbox.clientWidth, h = Math.round(w * 0.5), dpr = Math.min(2, window.devicePixelRatio || 1);
      cbox.textContent = "";
      O.cv = document.createElement("canvas");
      O.cv.width = w * dpr; O.cv.height = h * dpr; O.cv.style.width = w + "px"; O.cv.style.height = h + "px";
      O.cv.setAttribute("role", "img");
      cbox.appendChild(O.cv);
      O.w = w; O.h = h; O.dpr = dpr;
      O.proj = d3.geoEqualEarth().rotate([-150, 0]).fitExtent([[2, 2], [w - 2, h - 2]], { type: "Sphere" });
      paint();
    }
    function paint() {
      legend();
      O.cv.setAttribute("aria-label", tx().ov);
      var c = O.cv.getContext("2d"), path = d3.geoPath(O.proj, c);
      c.setTransform(O.dpr, 0, 0, O.dpr, 0, 0);
      c.clearRect(0, 0, O.w, O.h);
      c.beginPath(); path({ type: "Sphere" }); c.fillStyle = "#faf9f5"; c.fill(); c.strokeStyle = "#e4e1d8"; c.lineWidth = 1; c.stroke();
      c.beginPath(); path(land); c.fillStyle = "#e6e2d8"; c.fill();
      if (!data) return;
      c.lineWidth = O.w < 600 ? 0.4 : 0.6;
      c.lineJoin = "round";
      BORDER.forEach(function (b) {
        c.globalAlpha = O.hi && O.hi !== b ? 0.05 : O.hi ? 0.5 : 0.28;
        c.strokeStyle = BAS[b][0];
        c.beginPath();
        data[b].forEach(function (ln) { path(ln); });
        c.stroke();
      });
      c.globalAlpha = 1;
    }
    O.paint = paint;
    ov.paint = function (b) { O.hi = b; paint(); };
    size();
    var lw = cbox.clientWidth;
    window.addEventListener("resize", function () { if (cbox.clientWidth !== lw) { lw = cbox.clientWidth; size(); } });
    document.addEventListener("langchange", paint);
    getJSON(D + "lite.json").then(function (L) {
      data = {};
      BORDER.forEach(function (b) { data[b] = []; });
      L.tracks.forEach(function (a, i) {
        var s = IX.storms[i], x = a[0], y = a[1], co = [[x / L.q, y / L.q]];
        for (var j = 2; j < a.length; j += 2) { x += a[j]; y += a[j + 1]; co.push([x / L.q, y / L.q]); }
        if (s && data[s.basin]) data[s.basin].push({ type: "LineString", coordinates: co });
      });
      paint();
    }).catch(function (e) { if (window.console) console.warn(e); });
  }

  // ------------------------------------------------------------------ wiring
  function setRegion(v) {
    regionSel.value = v;
    st.region = regionSel.value;
    if (ov && ov.paint) ov.paint(v[0] === "b" ? v.slice(2) : null);
    st.follow = false;
    refresh();
    if (v[0] === "b") fly(BAS[v.slice(2)][1], BAS[v.slice(2)][2], 1.6);
    else if (v[0] === "c") { var c = IX.countries[+v.slice(2)]; fly(c[2], c[3], 40 / Math.max(2, c[4])); }
  }
  function labels() {
    G.svg.attr("aria-label", tx().map);
    q.placeholder = tx().search;
    regionOptions();
    refresh();
  }
  function init() {
    build();
    regionOptions();
    regionSel.addEventListener("change", function () { setRegion(regionSel.value); });
    q.addEventListener("input", refresh);
    Array.prototype.forEach.call(fig.querySelectorAll("[data-sort]"), function (b) {
      b.addEventListener("click", function () {
        st.sort = b.getAttribute("data-sort");
        Array.prototype.forEach.call(fig.querySelectorAll("[data-sort]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        refresh();
      });
    });
    playBtn.addEventListener("click", togglePlay);
    $("sg-reset").addEventListener("click", function () { st.follow = false; fly(-st.rot[0], -st.rot[1], 1); });
    $("sg-in").addEventListener("click", function () { zoomBy(1.6); });
    $("sg-out").addEventListener("click", function () { zoomBy(1 / 1.6); });
    document.addEventListener("langchange", labels);
    labels();
    overview();
    var first = IX.storms.filter(function (s) { return s.name === "Yagi" && s.season === 2024; })[0] ||
      IX.storms.slice().sort(function (a, b) { return b.t - a.t; })[0];
    if (first) toggle(first, 1.15); // first view: the whole globe, turned to the storm
    var lw = box.clientWidth, rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (box.clientWidth !== lw) { lw = box.clientWidth; build(); labels(); draw(); } }, 120);
    });
    draw();
  }
})();
