/* Storm explorer on research.html: one storm at a time, its wind field over night-time light.
   Data (built by _materials/storm_map/): assets/data/storms_vn.json, land_outline.json, lights_vn.json + .png,
   wind/<id>.png (8-bit grey, value = m/s rounded down, 0 = below 10, row 0 = north). Tracks are IBTrACS fixes.
   Needs D3 v7, loaded before this file. If D3 or the data fail, the static PNG is shown instead. */
(function () {
  "use strict";
  var fig = document.querySelector(".storm-explorer");
  if (!fig) return;

  var W = 100, E = 118, S = 6, N = 25, RES = 0.1;
  var ASPECT = (N - S) / ((E - W) * Math.cos(15.5 * Math.PI / 180)); // map height / width
  var LEVELS = [17, 33, 43, 50, 58], OPAC = [0.35, 0.49, 0.63, 0.76, 0.9];
  var KT = 0.5144, CUTS = [34, 64, 83, 96, 113, 137].map(function (k) { return k * KT; }); // class limits, m/s
  var CLS = ["TS", "C1", "C2", "C3", "C4", "C5", "W"];
  var PICKS = [["Damrey", 2017], ["Yagi", 2024], ["Xangsane", 2006], ["Ketsana", 2009], ["Usagi", 2018], ["Linda", 1997]];
  var FADE = 400, DRAW = 1200, FIT = 600, MSH = 150, WAKE = 9; // Play: ms of screen time per storm hour; hours over which a place's lines grow in
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq("(prefers-reduced-motion: reduce)"), coarse = mq("(pointer: coarse)");
  var $ = function (id) { return document.getElementById(id); };
  var mapBox = fig.querySelector(".se-map"), tlBox = fig.querySelector(".se-tl");
  var info = $("se-info"), playBtn = $("se-play"), resetBtn = $("se-reset"), clock = $("se-clock");
  var q = $("se-q"), sugg = $("se-sugg"), picks = $("se-picks");

  var TXT = {
    en: {
      cls: { TS: "tropical storm", C1: "category 1", C2: "category 2", C3: "category 3", C4: "category 4",
        C5: "category 5", TD: "tropical depression" },
      unnamed: "Unnamed", peak: "Peak wind", near: "within 200 km of Vietnam",
      nofield: "Wind field not available for this storm.",
      search: "e.g. Yagi", play: "Play", pause: "Pause", resume: "Resume",
      ts: "tropical-storm force", ramp: ["Night-time light", "low", "high"],
      band: ["TS", "1", "2", "3", "4", "5"], nd: "no wind data", wind: "wind",
      tip: { TS: "TS: 17–32 m/s (61–115 km/h)", C1: "Cat 1: 33–42 m/s (119–151 km/h)", C2: "Cat 2: 43–49 m/s (155–176 km/h)",
        C3: "Cat 3: 50–57 m/s (180–205 km/h)", C4: "Cat 4: 58–69 m/s (209–248 km/h)", C5: "Cat 5: 70 m/s and above (252 km/h and above)",
        W: "Weaker / no data: below 17 m/s (61 km/h) near Vietnam, or no wind record" },
      mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      map: "Map of the selected storm: lines of equal peak wind in m/s and the track, over night-time light in 2025.",
      tl: "Timeline, one dot per storm: date of closest approach to Vietnam across, peak wind within 200 km of Vietnam up. Left and right arrow keys step through the storms; Enter selects.",
      fallback: "Map of the wind field and track of Damrey 2017 over night-time light in 2025."
    },
    vi: {
      cls: { TS: "bão nhiệt đới", C1: "cấp 1", C2: "cấp 2", C3: "cấp 3", C4: "cấp 4", C5: "cấp 5",
        TD: "áp thấp nhiệt đới" },
      unnamed: "Không tên", peak: "Sức gió mạnh nhất", near: "trong phạm vi 200 km quanh Việt Nam",
      nofield: "Chưa có trường gió cho cơn bão này.",
      search: "ví dụ: Yagi", play: "Phát", pause: "Tạm dừng", resume: "Tiếp tục",
      ts: "gió bão nhiệt đới", ramp: ["Ánh sáng ban đêm", "thấp", "cao"],
      band: ["BNĐ", "C1", "C2", "C3", "C4", "C5"], nd: "không có số liệu gió", wind: "gió",
      tip: { TS: "Bão nhiệt đới: 17–32 m/s (61–115 km/h)", C1: "Cấp 1: 33–42 m/s (119–151 km/h)", C2: "Cấp 2: 43–49 m/s (155–176 km/h)",
        C3: "Cấp 3: 50–57 m/s (180–205 km/h)", C4: "Cấp 4: 58–69 m/s (209–248 km/h)", C5: "Cấp 5: từ 70 m/s (từ 252 km/h)",
        W: "Yếu hơn / không có số liệu: dưới 17 m/s (61 km/h) khi gần Việt Nam, hoặc không có số liệu gió" },
      map: "Bản đồ cơn bão đang chọn: các đường đẳng tốc gió lớn nhất (m/s) và đường đi của bão, trên nền ánh sáng ban đêm năm 2025.",
      tl: "Trục thời gian, mỗi chấm là một cơn bão: trục ngang là ngày bão đến gần Việt Nam nhất, trục dọc là sức gió mạnh nhất trong phạm vi 200 km quanh Việt Nam. Dùng phím mũi tên trái, phải để chuyển giữa các cơn bão; Enter để chọn.",
      fallback: "Bản đồ trường gió và đường đi của bão Damrey 2017 trên nền ánh sáng ban đêm năm 2025."
    }
  };
  function lang() { return document.documentElement.getAttribute("data-lang") === "vi" ? "vi" : "en"; }
  function tx() { return TXT[lang()]; }
  function nm(s) { return s.name === "Unnamed" ? tx().unnamed : s.name; }
  function norm(v) {
    return v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
  }

  function fail(err) {
    if (err && window.console) console.warn("storm explorer:", err);
    if (fig.classList.contains("se-failed")) return;
    fig.classList.add("se-failed");
    var img = new Image();
    img.className = "se-fallback";
    img.src = "assets/storm_map_static.png";
    img.width = 1600; img.height = 1753;
    img.alt = tx().fallback;
    fig.insertBefore(img, fig.querySelector("figcaption"));
    document.addEventListener("langchange", function () { img.alt = tx().fallback; });
  }
  if (!window.d3 || !d3.contours || !window.fetch || !window.Promise) { fail("D3 or fetch unavailable"); return; }

  function getJSON(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  }
  var storms, land, lights, bySlug = {}, st, M = {}, P = {}, cache = {};

  Promise.all([getJSON("assets/data/storms_vn.json"), getJSON("assets/data/land_outline.json"),
    getJSON("assets/data/lights_vn.json")]).then(init).catch(fail);

  function init(res) {
    storms = res[0].storms; land = res[1]; lights = res[2];
    storms.sort(function (a, b) { return a.t_near - b.t_near || (a.id < b.id ? -1 : 1); });
    var base = {};
    storms.forEach(function (s) {
      s.key = CLS.indexOf(s.class_near) >= 0 ? s.class_near : "W"; // TD near Vietnam or no wind: "weaker / no data"
      s.slug = s.season + "-" + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      base[s.slug] = (base[s.slug] || 0) + 1;
    });
    storms.forEach(function (s) {
      var dup = base[s.slug] > 1;
      s.label = s.name + " " + s.season + (dup ? " (" + s.id + ")" : "");
      if (dup) s.slug += "-" + s.id.toLowerCase();
      bySlug[s.slug] = s;
    });
    st = { on: {}, sel: null, k: 1, t: d3.zoomIdentity, act: false, pi: -1, timer: null, tok: 0 };
    CLS.forEach(function (c) { st.on[c] = true; });
    PICKS.forEach(function (p) {
      var s = storms.filter(function (x) { return x.name === p[0] && x.season === p[1]; })[0];
      if (!s) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "se-link"; b.textContent = s.name + " " + s.season;
      b.addEventListener("click", function () { select(s, { animate: true, user: true }); });
      picks.appendChild(b);
      s.pick = b;
    });
    wire();
    build();
    select(fromHash() || bySlug["2017-damrey"] || storms[0], { animate: true });
    window.addEventListener("hashchange", function () {
      var s = fromHash();
      if (s && s !== st.sel) select(s, { animate: true });
    });
    document.addEventListener("langchange", labels);
    var lastW = mapBox.clientWidth, lastT = tlBox.clientWidth, rt;
    var onResize = function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (mapBox.clientWidth === lastW && tlBox.clientWidth === lastT) return;
        lastW = mapBox.clientWidth; lastT = tlBox.clientWidth;
        build();
        select(st.sel, {});
      }, 120);
    };
    if (window.ResizeObserver) { var ro = new ResizeObserver(onResize); ro.observe(mapBox); ro.observe(tlBox); }
    else window.addEventListener("resize", onResize);
  }

  function fromHash() {
    var m = /storm=([\w-]+)/.exec(location.hash);
    return m ? bySlug[m[1].toLowerCase()] : null;
  }

  // ------------------------------------------------------------------ map
  function proj(p) { return [(p[0] - W) / (E - W) * M.w, (N - p[1]) / (N - S) * M.h]; }
  function f1(v) { return v.toFixed(1); }

  function rampColors(n) {
    var t95 = lights.scale.ink_from, out = [];
    var lo = d3.interpolateRgb("#faf9f5", "#1f5f7a"), hi = d3.interpolateRgb("#1f5f7a", "#23272b");
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, a = Math.min(1, t / t95);
      var c = d3.rgb(t <= t95 ? lo(t / t95) : hi((t - t95) / (1 - t95)));
      out.push(d3.interpolateRgb("#e6e2d8", c)(a)); // as drawn on land
    }
    return out;
  }

  function buildMap() {
    var w = M.w = mapBox.clientWidth, h = M.h = Math.round(w * ASPECT);
    var root = d3.select(mapBox);
    root.selectAll("*").remove();
    var svg = M.svg = root.append("svg").attr("class", "se-map-svg").attr("viewBox", "0 0 " + w + " " + h)
      .attr("width", w).attr("height", h).attr("tabindex", 0).attr("role", "img");
    var g = M.g = svg.append("g").attr("class", "se-zoom");
    var geo = d3.geoPath(d3.geoTransform({
      point: function (x, y) { var a = proj([x, y]); this.stream.point(a[0], a[1]); }
    }));
    g.append("path").attr("class", "se-land").attr("d", geo(land));
    g.append("image").attr("class", "se-lights").attr("href", "assets/data/lights_vn.png")
      .attr("x", 0).attr("y", 0).attr("width", w).attr("height", h).attr("preserveAspectRatio", "none");
    // Play only: a soft disc that dims the lights near the eye (illustration, not measured outages)
    var gr = svg.append("defs").append("radialGradient").attr("id", "se-dimg");
    gr.append("stop").attr("offset", "0").attr("stop-color", "#e6e2d8").attr("stop-opacity", 0.95);
    gr.append("stop").attr("offset", "0.55").attr("stop-color", "#e6e2d8").attr("stop-opacity", 0.6);
    gr.append("stop").attr("offset", "1").attr("stop-color", "#e6e2d8").attr("stop-opacity", 0);
    M.dim = g.append("circle").attr("class", "se-dim").attr("fill", "url(#se-dimg)").style("display", "none");
    M.field = g.append("g").attr("class", "se-field");
    M.trk = g.append("g").attr("class", "se-trk");
    M.fix = g.append("g").attr("class", "se-fix");
    // Play only: rings that spread from the eye and two spiral bands turning anticlockwise, sized by the IBTrACS wind
    M.storm = g.append("g").attr("class", "se-storm").style("display", "none");
    M.rings = M.storm.selectAll("circle").data([0, 1, 2]).join("circle");
    M.arms = M.storm.append("path").attr("d", spiral());
    M.eye = g.append("g").attr("class", "se-eye").style("display", "none");
    M.eye.append("circle").attr("r", 5.5);
    M.eye.append("circle").attr("r", 1.8).attr("class", "se-eye-c");
    M.lab = svg.append("g").attr("class", "se-lab");

    var rw = Math.round(Math.min(150, Math.max(84, w * 0.2))), rh = 5, cols = rampColors(24);
    var rx = proj([115.8, 0])[0] - rw, ry = Math.min(proj([0, 6.75])[1], h - 24);
    var R = svg.append("g").attr("class", "se-ramp").attr("transform", "translate(" + rx + "," + ry + ")");
    R.selectAll("rect").data(cols).join("rect").attr("x", function (c, i) { return i * rw / cols.length; })
      .attr("width", rw / cols.length + 0.4).attr("height", rh).attr("fill", function (c) { return c; });
    M.rT = R.append("text").attr("x", rw / 2).attr("y", -6).attr("text-anchor", "middle");
    M.rLo = R.append("text").attr("x", 0).attr("y", rh + 13);
    M.rHi = R.append("text").attr("x", rw).attr("y", rh + 13).attr("text-anchor", "end");
    M.rbox = [rx - 8, rx + rw + 8, ry - 22, ry + rh + 18];

    st.k = 1; st.t = d3.zoomIdentity;
    M.zoom = d3.zoom().scaleExtent([1, 6]).extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]])
      .filter(function (ev) {
        // the wheel zooms only once the reader has clicked or focused the map, so it does not trap page scrolling
        if (ev.type === "wheel") return ev.ctrlKey || st.act || document.activeElement === svg.node();
        return !ev.button;
      })
      .on("zoom", function (ev) {
        var t = st.t = ev.transform;
        st.k = t.k;
        g.attr("transform", t).style("--k", t.k);
        M.fix.selectAll("circle").attr("r", 2.2 / t.k);
        svg.style("touch-action", t.k > 1 ? "none" : "pan-x pan-y").classed("is-zoomed", t.k > 1);
        placeEye();
        M.lab.style("display", "none");
      })
      .on("end", placeLabels);
    svg.call(M.zoom).style("touch-action", "pan-x pan-y");
    svg.on("pointerdown.act", function () { st.act = true; });
  }

  // decode wind/<id>.png and trace the isotachs; returns {lev: [{d, rings}]} in unzoomed map pixels
  function loadField(s) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.onload = function () {
        try {
          var nx = im.naturalWidth, ny = im.naturalHeight, b = s.wind_bbox;
          var c = document.createElement("canvas");
          c.width = nx; c.height = ny;
          var cx = c.getContext("2d", { willReadFrequently: true });
          cx.drawImage(im, 0, 0);
          var px = cx.getImageData(0, 0, nx, ny).data, n2 = nx + 2, m2 = ny + 2, v = new Float32Array(n2 * m2), mx = 0;
          for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
            var z = px[(j * nx + i) * 4];
            v[(j + 1) * n2 + i + 1] = z;
            if (z > mx) mx = z;
          }
          if (mx !== s.wind_max_ms || Math.abs(nx - (b[2] - b[0]) / RES) > 0.01) throw new Error("wind png " + s.id);
          // one extra ring: copied where the field is cut by the map edge (the line then leaves the map), zero elsewhere
          for (j = 1; j <= ny; j++) {
            if (b[0] <= W) v[j * n2] = v[j * n2 + 1];
            if (b[2] >= E) v[j * n2 + n2 - 1] = v[j * n2 + n2 - 2];
          }
          for (i = 0; i < n2; i++) {
            if (b[3] >= N) v[i] = v[n2 + i];
            if (b[1] <= S) v[(m2 - 1) * n2 + i] = v[(m2 - 2) * n2 + i];
          }
          ok({ v: v, n2: n2, m2: m2, b: b });
        } catch (e) { no(e); }
      };
      im.onerror = function () { no(new Error("wind png missing " + s.id)); };
      im.src = "assets/data/wind/" + s.id + ".png";
    });
  }
  function spiral() { // two log-spiral bands, unit radius
    var d = "";
    [0, Math.PI].forEach(function (a0) {
      for (var i = 0; i <= 24; i++) {
        var a = a0 + i / 24 * 1.6 * Math.PI, r = 0.18 * Math.exp(0.33 * (a - a0));
        d += (i ? "L" : "M") + f1(100 * r * Math.cos(a)) + "," + f1(100 * r * Math.sin(a));
      }
    });
    return d;
  }
  function isotachs(f, vals) {
    // grid value (i, j) sits at contour coordinate (i + 0.5, j + 0.5); one pad cell on each side
    var pt = function (c) { return proj([f.b[0] + (c[0] - 1) * RES, f.b[3] - (c[1] - 1) * RES]); };
    return d3.contours().size([f.n2, f.m2]).thresholds(LEVELS)(vals || f.v).map(function (mp) {
      var d = "", rings = [];
      mp.coordinates.forEach(function (poly) {
        poly.forEach(function (ring) {
          var r = ring.map(pt);
          rings.push(r);
          d += "M" + r.map(function (a) { return f1(a[0]) + "," + f1(a[1]); }).join("L") + "Z";
        });
      });
      return { lev: mp.value, d: d, rings: rings };
    }).filter(function (o) { return o.d; });
  }

  function loadStorm(s) {
    if (!cache[s.id]) {
      cache[s.id] = (s.wind_bbox ? loadField(s).catch(function (e) { if (window.console) console.warn(e); return null; })
        : Promise.resolve(null)).then(function (f) { return { f: f }; });
    }
    return cache[s.id];
  }

  function drawStorm(d, animate) {
    var s = st.sel;
    st.d = d;
    M.field.interrupt().selectAll("*").remove();
    M.trk.selectAll("*").interrupt().remove();
    M.fix.selectAll("*").remove();
    M.lab.selectAll("*").remove();
    M.eye.style("display", "none");
    st.iso = d.f ? isotachs(d.f) : [];
    st.tc = null; st.cur = null;
    renderField(st.iso);
    // IBTrACS fixes for Play (three-element points are window-edge crossings); 6-hourly fixes as dots
    st.pts = []; st.pi = -1; st.tp = null; hideStorm();
    var t0 = Date.parse(s.t0), h0 = new Date(t0).getUTCHours(), fx = [];
    (s.runs || []).forEach(function (run) {
      M.trk.append("path").attr("d", "M" + run.map(function (p) { var a = proj([p[1], p[2]]); return f1(a[0]) + "," + f1(a[1]); }).join("L"));
      var first = true;
      run.forEach(function (p) {
        if (p.length < 4) return;
        // brk: first fix of a later run; the storm was outside the window in between, so Play does not glide across
        st.pts.push({ t: t0 + p[0] * 36e5, xy: [p[1], p[2]], v: p[3], brk: first && st.pts.length > 0 });
        first = false;
        if ((p[0] + h0) % 6 === 0) fx.push(p);
      });
    });
    M.fix.selectAll("circle").data(fx).join("circle").attr("r", 2.2 / st.k)
      .attr("cx", function (p) { return proj([p[1], p[2]])[0]; }).attr("cy", function (p) { return proj([p[1], p[2]])[1]; });
    playBtn.disabled = st.pts.length < 2;
    clock.textContent = "";
    playLabel();
    fit(s, animate);
    var ps = M.trk.selectAll("path");
    if (!animate) { M.field.style("opacity", 1); showEye(); placeLabels(); return; }
    M.fix.style("opacity", 0);
    M.field.style("opacity", 0).transition().duration(FADE).style("opacity", 1);
    var len = ps.nodes().map(function (n) { return n.getTotalLength(); }), tot = d3.sum(len) || 1, acc = 0;
    if (!len.length) { showEye(); return; }
    ps.each(function (_, i) {
      var el = d3.select(this), l = len[i];
      el.attr("stroke-dasharray", l + " " + l).attr("stroke-dashoffset", l)
        .transition().delay(FADE + acc / tot * DRAW).duration(l / tot * DRAW).ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end", function () {
          el.attr("stroke-dasharray", null);
          if (i === len.length - 1) { M.fix.style("opacity", 1); showEye(); }
        });
      acc += l;
    });
  }

  function renderField(iso) {
    M.field.selectAll("*").remove();
    iso.forEach(function (o) {
      M.field.append("path").attr("class", "se-fill").attr("d", o.d);
      M.field.append("path").attr("class", "se-iso" + (o.lev === 17 ? " is-ts" : "")).attr("d", o.d)
        .attr("stroke-opacity", OPAC[LEVELS.indexOf(o.lev)]);
    });
  }

  // ease the view to the storm's wind box (not on touch screens, where a zoomed map would trap page scrolling)
  function fit(s, animate) {
    var t = d3.zoomIdentity, b = s.wind_bbox;
    if (b && !coarse) {
      var a = proj([b[0], b[3]]), c = proj([b[2], b[1]]), pad = 16;
      var k = Math.max(1, Math.min(6, Math.min(M.w / (c[0] - a[0] + 2 * pad), M.h / (c[1] - a[1] + 2 * pad))));
      // zoom.transform does not apply translateExtent, so keep the map edge on the frame here
      var cl = function (v, size) { return Math.min(0, Math.max(size - k * size, v)); };
      t = d3.zoomIdentity.translate(cl(M.w / 2 - k * (a[0] + c[0]) / 2, M.w), cl(M.h / 2 - k * (a[1] + c[1]) / 2, M.h)).scale(k);
    }
    M.svg.interrupt();
    if (animate) M.svg.transition().duration(FIT).call(M.zoom.transform, t);
    else M.svg.call(M.zoom.transform, t);
  }

  function eyeAt() { return st.cur ? st.cur.xy : st.sel && st.sel.eye; }
  function placeEye() {
    var p = eyeAt();
    if (!p) return;
    var tr = "translate(" + proj(p) + ") scale(" + 1 / st.k + ")";
    M.eye.attr("transform", tr);
    M.storm.attr("transform", tr);
  }
  function showEye() {
    if (!eyeAt()) return;
    placeEye();
    M.eye.style("display", null);
  }

  // one label per isotach, on its longest ring, in screen space; skipped when no free spot is in view
  function placeLabels() {
    if (!M.lab || !st.iso) return;
    M.lab.style("display", null).selectAll("*").remove();
    if (st.tp != null && st.pts && st.tp < st.pts[st.pts.length - 1].t) return; // field only partly drawn during Play
    var T = tx(), used = [M.rbox], e = eyeAt(), t = st.t;
    if (e) { e = t.apply(proj(e)); used.push([e[0] - 10, e[0] + 10, e[1] - 10, e[1] + 10]); }
    st.iso.forEach(function (o) {
      var text = o.lev === 17 ? "17 m/s · " + T.ts : String(o.lev), hw = text.length * 3.2 + 5, best = null, bl = 0;
      o.rings.forEach(function (r) {
        var l = 0;
        for (var i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
        if (l > bl) { bl = l; best = r; }
      });
      if (!best || bl * t.k < 40) return;
      for (var c = 0; c < 20; c++) {
        var p = t.apply(best[Math.floor(((c * 7 + 5) % 20) / 20 * best.length)]);
        var bx = [p[0] - hw, p[0] + hw, p[1] - 8, p[1] + 8];
        if (bx[0] < 4 || bx[1] > M.w - 4 || bx[2] < 4 || bx[3] > M.h - 4) continue;
        if (used.some(function (u) { return !(bx[1] < u[0] || u[1] < bx[0] || bx[3] < u[2] || u[3] < bx[2]); })) continue;
        used.push(bx);
        M.lab.append("text").attr("x", p[0]).attr("y", p[1]).text(text);
        return;
      }
    });
  }

  // ------------------------------------------------------------------ timeline
  function buildTimeline() {
    var w = P.w = tlBox.clientWidth, h = P.h = tlBox.clientHeight || 220;
    var m = { t: 16, r: 10, b: 58, l: 30 }, yb = h - m.b;
    var root = d3.select(tlBox);
    root.selectAll("*").remove();
    var svg = P.svg = root.append("svg").attr("class", "se-tl-svg").attr("viewBox", "0 0 " + w + " " + h)
      .attr("width", w).attr("height", h).attr("role", "group");
    var top = Math.max(76, (d3.max(storms, function (s) { return s.vmax_near_kt || 0; }) || 0) * KT + 4);
    var x = d3.scaleLinear().domain([1981, 2025]).range([m.l, w - m.r]);
    var y = d3.scaleLinear().domain([8, top]).range([yb, m.t]);
    var cuts = CUTS.concat([top]);
    svg.append("g").selectAll("rect").data(d3.range(0, 6, 2)).join("rect").attr("class", "se-band")
      .attr("x", m.l).attr("width", w - m.r - m.l).attr("y", function (i) { return y(cuts[i + 1]); })
      .attr("height", function (i) { return y(cuts[i]) - y(cuts[i + 1]); });
    svg.append("g").attr("class", "se-axis").attr("transform", "translate(0," + yb + ")")
      .call(d3.axisBottom(x).tickValues(d3.range(1985, 2025, w < 480 ? 10 : 5)).tickFormat(d3.format("d")).tickSize(4).tickSizeOuter(0));
    svg.append("g").attr("class", "se-axis").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).tickValues([20, 40, 60]).tickSize(4).tickSizeOuter(0));
    svg.append("text").attr("x", 0).attr("y", 10).text("m/s");
    var ys = yb + 31;
    svg.append("circle").attr("class", "se-dot is-nd").attr("r", 2.5).attr("cx", m.l + 3).attr("cy", yb + 48).style("cursor", "default");
    P.nd = svg.append("text").attr("x", m.l + 11).attr("y", yb + 52);
    // positions; dots within 4 px of an earlier one (SID order) move up or down by up to 3 px
    var done = [];
    storms.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (s) {
      s.cx = x(s.t_near);
      var y0 = s.vmax_near_kt == null ? ys : y(s.vmax_near_kt * KT);
      s.cy = y0;
      var bd = -1;
      [0, -3, 3, -1.5, 1.5].some(function (o) { // first free offset, else the one farthest from its neighbours
        var d = d3.min(done, function (u) { return Math.hypot(u.cx - s.cx, u.cy - (y0 + o)); });
        if (d == null) d = 99;
        if (d > bd) { bd = d; s.cy = y0 + o; }
        return d >= 4;
      });
      done.push(s);
    });
    P.dots = svg.append("g").selectAll("circle").data(storms).join("circle")
      .attr("class", function (s) { return "se-dot" + (s.vmax_near_kt == null ? " is-nd" : ""); })
      .attr("r", function (s) { return s.vmax_near_kt == null ? 2.5 : 3.5; })
      .attr("cx", function (s) { return s.cx; }).attr("cy", function (s) { return s.cy; })
      .attr("tabindex", -1).attr("role", "button").attr("aria-label", function (s) { return s.label; });
    P.band = svg.append("g").selectAll("text").data(d3.range(6)).join("text").attr("class", "se-bandl").attr("x", m.l + 5)
      .attr("y", function (i) { return (y(cuts[i]) + y(cuts[i + 1])) / 2; }).attr("dominant-baseline", "central")
      .style("display", function (i) { return y(cuts[i]) - y(cuts[i + 1]) < 8 ? "none" : null; });
    P.hov = svg.append("text").attr("class", "se-name");
    P.name = svg.append("text").attr("class", "se-name");
    svg.on("pointermove", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var s = nearest(ev, 12);
      nameAt(P.hov, s && s !== st.sel ? s : null);
    }).on("pointerleave", function () { nameAt(P.hov, null); }).on("click", function (ev) {
      var s = nearest(ev, 22);
      nameAt(P.hov, null);
      if (s && s !== st.sel) select(s, { animate: true, user: true });
    });
  }
  function nameAt(el, s) {
    if (!s) { el.text(""); return; }
    var right = s.cx > P.w - 110;
    el.text(nm(s) + " " + s.season).attr("x", s.cx + (right ? -9 : 9)).attr("y", Math.max(10, s.cy - 8))
      .attr("text-anchor", right ? "end" : "start");
  }
  function nearest(ev, r) {
    if (!P.del) return null;
    var p = d3.pointer(ev, P.svg.node()), s = P.pts[P.del.find(p[0], p[1])];
    if (!s || Math.hypot(s.cx - p[0], s.cy - p[1]) > r) return null;
    if (s === st.sel && ev.type === "click") { // overlapping dots: step to the next one under the pointer
      var o = P.pts.filter(function (u) { return Math.hypot(u.cx - s.cx, u.cy - s.cy) < 4; });
      s = o[(o.indexOf(s) + 1) % o.length];
    }
    return s;
  }
  function visible() { return storms.filter(function (s) { return st.on[s.key]; }); }

  // ------------------------------------------------------------------ state
  function build() { stopPlay(); buildMap(); buildTimeline(); update(); labels(); }

  function update() {
    P.pts = visible();
    P.del = P.pts.length ? d3.Delaunay.from(P.pts, function (s) { return s.cx; }, function (s) { return s.cy; }) : null;
    markSel();
  }
  function markSel() {
    var s = st.sel;
    P.dots.classed("is-sel", function (x) { return x === s; })
      .attr("r", function (x) { return x === s ? 6 : x.vmax_near_kt == null ? 2.5 : 3.5; })
      .attr("tabindex", function (x) { return x === s ? 0 : -1; })
      .style("display", function (x) { return st.on[x.key] || x === s ? null : "none"; });
    P.dots.filter(function (x) { return x === s; }).raise();
    nameAt(P.name, s);
    storms.forEach(function (x) { if (x.pick) x.pick.setAttribute("aria-current", String(x === s)); });
  }

  function select(s, o) {
    if (!s) return;
    o = o || {};
    stopPlay();
    if (M.storm) { hideStorm(); st.cur = null; }
    st.sel = s;
    if (o.user && window.history && history.replaceState) history.replaceState(null, "", "#storm=" + s.slug);
    markSel();
    writeInfo();
    var tok = ++st.tok;
    loadStorm(s).then(function (d) {
      if (tok !== st.tok) return;
      drawStorm(d, !!o.animate && !reduce);
      writeInfo();
    });
  }

  function writeInfo() {
    var s = st.sel, T = tx();
    if (!s) return;
    var near = s.vmax_near_ms == null ? "—" : s.vmax_near_ms + " m/s (" + T.cls[s.class_near] + ")";
    var b = document.createElement("strong");
    b.textContent = nm(s) + ", " + s.season + ".";
    info.textContent = "";
    info.appendChild(b);
    info.appendChild(document.createTextNode(" " + T.peak + " " + s.vmax_ms + " m/s (" + T.cls[s["class"]] + "); " +
      T.near + " " + near + "." + (!s.wind_bbox || (st.d && st.sel === s && cache[s.id] && st.d.f === null) ? " " + T.nofield : "")));
  }

  function labels() {
    var T = tx();
    M.svg.attr("aria-label", T.map);
    P.svg.attr("aria-label", T.tl);
    M.rT.text(T.ramp[0]); M.rLo.text(T.ramp[1]); M.rHi.text(T.ramp[2]);
    P.band.text(function (i) { return T.band[i]; });
    P.nd.text(T.nd);
    q.placeholder = T.search;
    Array.prototype.forEach.call(fig.querySelectorAll("[data-cls]"), function (b) {
      var c = b.getAttribute("data-cls"), id = "se-tip-" + c, tip = $(id);
      if (!tip) {
        tip = document.createElement("span");
        tip.id = id; tip.className = "sr-only";
        b.parentNode.parentNode.appendChild(tip);
        b.setAttribute("aria-describedby", id);
      }
      tip.textContent = b.title = T.tip[c];
    });
    nameAt(P.name, st.sel);
    playLabel();
    clockText();
    placeLabels();
    writeInfo();
  }

  // ------------------------------------------------------------------ play: the eye steps through the IBTrACS fixes
  function clockText() {
    var p = st.pts && st.pts[st.pi];
    if (!p) { clock.textContent = ""; return; }
    var d = new Date(p.t + 7 * 36e5), z = function (n) { return (n < 10 ? "0" : "") + n; };
    var hm = z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + " (UTC+7)";
    var day = lang() === "vi" ? z(d.getUTCDate()) + "/" + z(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear()
      : d.getUTCDate() + " " + TXT.en.mon[d.getUTCMonth()] + " " + d.getUTCFullYear();
    clock.textContent = day + ", " + hm + (p.v == null ? "" : " · " + tx().wind + " " + p.v + " m/s");
  }
  function playLabel() {
    var T = tx(), end = !st.pts || st.tp == null || st.tp >= st.pts[st.pts.length - 1].t;
    playBtn.textContent = st.raf ? T.pause : st.tp != null && !end ? T.resume : T.play;
  }
  function stopPlay() {
    if (!st) return;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = null;
    if (st.pts) playLabel();
  }
  function hideStorm() { M.storm.style("display", "none"); M.dim.style("display", "none"); }

  // for each wind cell, the time (ms) at which the eye passes closest; the cell's lines grow in over WAKE hours before it
  function closest() {
    var f = st.d && st.d.f, p = st.pts;
    if (!f || st.tc) return;
    var dense = [], i, j, k;
    for (i = 0; i < p.length - 1; i++) {
      var n = p[i + 1].brk ? 1 : Math.max(1, Math.round((p[i + 1].t - p[i].t) / 36e5));
      for (k = 0; k < n; k++) {
        var u = k / n;
        dense.push([p[i].xy[0] + u * (p[i + 1].xy[0] - p[i].xy[0]), p[i].xy[1] + u * (p[i + 1].xy[1] - p[i].xy[1]), p[i].t + u * (p[i + 1].t - p[i].t)]);
      }
    }
    dense.push([p[p.length - 1].xy[0], p[p.length - 1].xy[1], p[p.length - 1].t]);
    var tc = st.tc = new Float64Array(f.v.length);
    for (j = 0; j < f.m2; j++) for (i = 0; i < f.n2; i++) {
      var c = j * f.n2 + i;
      if (f.v[c] < 10) continue;
      var lon = f.b[0] + (i - 0.5) * RES, lat = f.b[3] - (j - 0.5) * RES, cl = Math.cos(lat * Math.PI / 180), bd = 1e9, bt = 0;
      for (k = 0; k < dense.length; k++) {
        var dx = (dense[k][0] - lon) * cl, dy = dense[k][1] - lat, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; bt = dense[k][2]; }
      }
      tc[c] = bt;
    }
    st.wv = new Float32Array(f.v.length);
  }
  function wakeField(t) {
    var f = st.d.f, v = f.v, tc = st.tc, w = st.wv, R = WAKE * 36e5;
    for (var c = 0; c < v.length; c++) w[c] = v[c] < 10 ? v[c] : v[c] * Math.max(0, Math.min(1, 1 - (tc[c] - t) / R));
    renderField(isotachs(f, w));
  }
  function frameAt(now) {
    var p = st.pts, t = st.tp, i = st.pi < 0 ? 0 : st.pi;
    while (i < p.length - 1 && p[i + 1].t <= t) i++;
    st.pi = i;
    var a = p[i], b = p[Math.min(i + 1, p.length - 1)], u = b.t > a.t && !b.brk ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
    var va = a.v == null ? b.v : a.v, vb = b.v == null ? va : b.v, v = va == null ? 20 : va + u * ((vb == null ? va : vb) - va);
    st.cur = { xy: [a.xy[0] + u * (b.xy[0] - a.xy[0]), a.xy[1] + u * (b.xy[1] - a.xy[1])], v: v };
    placeEye();
    M.eye.style("display", null);
    // glyph: size by wind, rings spread over 1.4 s, bands turn once every 2.4 s
    var r = 11 + 0.5 * v, ph = now / 1400;
    M.storm.style("display", null);
    M.rings.attr("r", function (k) { return r * (0.35 + 1.3 * ((ph + k / 3) % 1)); })
      .attr("stroke-opacity", function (k) { return 0.55 * (1 - (ph + k / 3) % 1); });
    M.arms.attr("transform", "rotate(" + (-(now / 2400) * 360 % 360) + ") scale(" + r / 100 + ")")
      .attr("stroke-opacity", Math.min(0.85, 0.25 + v / 70));
    // lights near the eye flicker, more so in stronger wind
    if (now - (st.fl || 0) > 70) {
      st.fl = now;
      var c = proj(st.cur.xy), dpx = M.w / (E - W), s = Math.min(1, Math.max(0, (v - 17) / 33));
      M.dim.style("display", null).attr("cx", c[0]).attr("cy", c[1]).attr("r", dpx * (0.8 + 1.8 * s))
        .attr("opacity", Math.min(1, 0.25 + s) * (0.45 + 0.55 * Math.random()));
    }
    if (st.tc && now - (st.ff || 0) > 45) { st.ff = now; wakeField(t); }
    clockText();
  }
  function tick(now) {
    var end = st.pts[st.pts.length - 1].t;
    st.tp = Math.min(end, st.tp + Math.max(0, Math.min(100, now - st.last)) / MSH * 36e5);
    st.last = now;
    frameAt(now);
    if (st.tp >= end) { finish(); return; }
    st.raf = requestAnimationFrame(tick);
  }
  function finish() {
    st.raf = null;
    hideStorm();
    if (st.d && st.d.f) renderField(st.iso);
    playLabel(); placeLabels();
  }
  // Play is started by the reader, so it runs smoothly even when the system asks for reduced motion; Pause stops it
  function togglePlay() {
    var n = st.pts.length;
    if (n < 2) return;
    M.trk.selectAll("path").interrupt().attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
    M.fix.style("opacity", 1);
    M.field.interrupt().style("opacity", 1);
    if (st.raf) { stopPlay(); return; }
    if (st.tp == null || st.tp >= st.pts[n - 1].t) { st.tp = st.pts[0].t; st.pi = -1; }
    closest();
    M.lab.style("display", "none");
    st.last = performance.now();
    st.raf = requestAnimationFrame(tick);
    playLabel();
  }

  // ------------------------------------------------------------------ search
  function matches() {
    var v = norm(q.value);
    if (!v) return [];
    var a = [], b = [];
    for (var i = storms.length - 1; i >= 0; i--) { // newest first; names that start with the text before the rest
      var s = storms[i], k;
      if (!st.on[s.key]) continue;
      k = norm(s.label).indexOf(v);
      if (k === 0) a.push(s); else if (k > 0) b.push(s);
    }
    return a.concat(b).slice(0, 8);
  }
  function showSugg() {
    var m = matches();
    sugg.textContent = "";
    m.forEach(function (s, i) {
      var li = document.createElement("li");
      li.id = "se-opt-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(i === 0));
      li.textContent = s.label;
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); choose(s); });
      sugg.appendChild(li);
    });
    st.m = m; st.mi = 0;
    sugg.hidden = !m.length;
    q.setAttribute("aria-expanded", String(!!m.length));
    if (m.length) q.setAttribute("aria-activedescendant", "se-opt-0"); else q.removeAttribute("aria-activedescendant");
  }
  function hideSugg() { sugg.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); }
  function choose(s) {
    q.value = s.label;
    hideSugg();
    if (s !== st.sel) select(s, { animate: true, user: true });
  }

  function wire() {
    Array.prototype.forEach.call(fig.querySelectorAll("[data-cls]"), function (b) {
      b.addEventListener("click", function () {
        var c = b.getAttribute("data-cls");
        st.on[c] = !st.on[c];
        b.setAttribute("aria-pressed", String(st.on[c]));
        update();
      });
    });
    playBtn.addEventListener("click", togglePlay);
    resetBtn.addEventListener("click", function () { M.svg.interrupt().call(M.zoom.transform, d3.zoomIdentity); });

    q.addEventListener("input", showSugg);
    q.addEventListener("focus", function () { if (q.value) showSugg(); });
    q.addEventListener("blur", hideSugg);
    q.addEventListener("keydown", function (ev) {
      var m = st.m || [], open = !sugg.hidden && m.length;
      if (ev.key === "Enter") { ev.preventDefault(); if (!open) { showSugg(); m = st.m; } if (m.length) choose(m[st.mi]); }
      else if (ev.key === "Escape") hideSugg();
      else if (open && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
        ev.preventDefault();
        st.mi = (st.mi + (ev.key === "ArrowDown" ? 1 : -1) + m.length) % m.length;
        Array.prototype.forEach.call(sugg.children, function (li, i) { li.setAttribute("aria-selected", String(i === st.mi)); });
        q.setAttribute("aria-activedescendant", "se-opt-" + st.mi);
      }
    });

    // one-finger drags at full view scroll the page; d3-zoom only sees them once the map is zoomed in
    mapBox.addEventListener("touchmove", function (ev) {
      if (st.k <= 1 && ev.touches.length < 2) ev.stopPropagation();
    }, { capture: true, passive: true });

    tlBox.addEventListener("keydown", function (ev) {
      var t = ev.target;
      if (!t.classList || !t.classList.contains("se-dot")) return;
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        var v = visible();
        if (!v.length) return;
        var i = v.indexOf(t.__data__), n = ev.key === "ArrowRight" ? 1 : -1;
        var s = v[i < 0 ? (n > 0 ? 0 : v.length - 1) : (i + n + v.length) % v.length];
        ev.preventDefault();
        select(s, { animate: true, user: true });
        P.dots.filter(function (x) { return x === s; }).node().focus();
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (t.__data__ !== st.sel) select(t.__data__, { animate: true, user: true });
      }
    });
  }
})();
