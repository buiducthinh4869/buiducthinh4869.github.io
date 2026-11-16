/* Storm and night-light explorer on research.html.
   Public data only: assets/data/storms_vn.json (IBTrACS), land_outline.json (Natural Earth, dissolved),
   lights_vn.json + lights_vn.png (NPP-VIIRS-like 2025). Built by _materials/storm_map/build_storm_map.py.
   Needs D3 v7, loaded before this file. If D3 or the data fail, the static PNG is shown instead. */
(function () {
  "use strict";
  var fig = document.querySelector(".storm-explorer");
  if (!fig) return;

  var W = 100, E = 118, S = 6, N = 25;
  var ASPECT = (N - S) / ((E - W) * Math.cos(15.5 * Math.PI / 180)); // map height / width
  var SC_RATIO = 0.4, SC_MIN = 180, DRAW_MS = 1500, PLAY_MS = 12000, HOVER_MS = 90;
  var CLS = ["TS", "C1", "C2", "C3", "C4", "C5", "W"];
  var KT2MS = 0.5144, GUIDES = [34, 64, 83, 96, 113, 137].map(function (k) { return k * KT2MS; }); // class thresholds (kt) in m/s
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var $ = function (id) { return document.getElementById(id); };
  var mapBox = fig.querySelector(".se-map"), scBox = fig.querySelector(".se-scatter");
  var info = $("se-info"), countEl = $("se-count"), playBtn = $("se-play"), resetBtn = $("se-reset");
  var fromEl = $("se-from"), toEl = $("se-to"), rangeOut = $("se-range-out"), fill = fig.querySelector(".se-dual-fill");
  var q = $("se-q"), list = $("se-list");

  var TXT = {
    en: {
      cls: { TS: "tropical storm", C1: "category 1", C2: "category 2", C3: "category 3", C4: "category 4",
        C5: "category 5", TD: "tropical depression" },
      unnamed: "Unnamed",
      count: function (n) { return n + (n === 1 ? " storm shown" : " storms shown"); },
      peak: "Peak wind", near: "within 200 km of Vietnam",
      lit: function (z) { return "While at tropical-storm strength or above, its path came within 100 km of " + z + " of Vietnam's night-time light."; },
      unlit: "It did not pass within 100 km of Vietnam's lit areas at storm strength.",
      small: "less than 0.1%", search: "e.g. Yagi",
      play: "Play", pause: "Pause", resume: "Resume", step: "Next year",
      x: "Strongest wind within 200 km of Vietnam (m/s)",
      y: "Night-time light near the track (% of Vietnam's total)",
      nodata: ["no", "data"], ramp: ["Night-time light", "low", "high"], guide: ["TS", "Cat 1"],
      map: "Map of tropical storm tracks within 200 km of Vietnam, 1981 to 2024, over night-time light in 2025. Use the left and right arrow keys to step through the storms shown.",
      sc: "Scatter plot, one dot per storm: wind within 200 km of Vietnam across, share of Vietnam's night-time light near the track up.",
      fallback: "Map of tropical storm tracks near Vietnam, 1981 to 2024, over night-time light in 2025, with Damrey 2017 highlighted."
    },
    vi: {
      cls: { TS: "bão nhiệt đới", C1: "cấp 1", C2: "cấp 2", C3: "cấp 3", C4: "cấp 4", C5: "cấp 5",
        TD: "áp thấp nhiệt đới" },
      unnamed: "Không tên",
      count: function (n) { return "Đang hiển thị " + n + " cơn bão"; },
      peak: "Sức gió mạnh nhất", near: "trong phạm vi 200 km quanh Việt Nam",
      lit: function (z) { return "Khi còn ở cường độ bão nhiệt đới trở lên, đường đi của bão đến gần trong vòng 100 km với " + z + " ánh sáng ban đêm của Việt Nam."; },
      unlit: "Bão không đi qua trong vòng 100 km các vùng có ánh sáng của Việt Nam khi còn ở cường độ bão.",
      small: "dưới 0,1%", search: "ví dụ: Yagi",
      play: "Phát", pause: "Tạm dừng", resume: "Tiếp tục", step: "Năm tiếp theo",
      x: "Gió mạnh nhất trong phạm vi 200 km quanh Việt Nam (m/s)",
      y: "Ánh sáng ban đêm gần đường đi của bão (% tổng của Việt Nam)",
      nodata: ["không có", "số liệu"], ramp: ["Ánh sáng ban đêm", "thấp", "cao"], guide: ["BNĐ", "Cấp 1"],
      map: "Bản đồ đường đi của các cơn bão nhiệt đới trong phạm vi 200 km quanh Việt Nam, 1981 đến 2024, trên nền ánh sáng ban đêm năm 2025. Dùng phím mũi tên trái, phải để chuyển giữa các cơn bão đang hiển thị.",
      sc: "Biểu đồ phân tán, mỗi chấm là một cơn bão: trục ngang là sức gió trong phạm vi 200 km quanh Việt Nam, trục dọc là tỷ lệ ánh sáng ban đêm của Việt Nam gần đường đi của bão.",
      fallback: "Bản đồ đường đi của các cơn bão nhiệt đới gần Việt Nam, 1981 đến 2024, trên nền ánh sáng ban đêm năm 2025, nổi bật cơn bão Damrey 2017."
    }
  };
  function lang() { return document.documentElement.getAttribute("data-lang") === "vi" ? "vi" : "en"; }
  function tx() { return TXT[lang()]; }
  function num(x, d) { var s = x.toFixed(d); return lang() === "vi" ? s.replace(".", ",") : s; }

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
  if (!window.d3 || !window.fetch || !window.Promise) { fail("D3 or fetch unavailable"); return; }

  function getJSON(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  }
  var storms, land, lights, bySlug = {}, byLabel = {}, st, M = {}, P = {}, hT;

  Promise.all([getJSON("assets/data/storms_vn.json"), getJSON("assets/data/land_outline.json"),
    getJSON("assets/data/lights_vn.json")]).then(init).catch(fail);

  function init(res) {
    storms = res[0].storms; land = res[1]; lights = res[2];
    var base = {};
    storms.forEach(function (s, i) {
      s.i = i;
      s.key = CLS.indexOf(s.class_near) >= 0 ? s.class_near : "W"; // TD near Vietnam or no wind: "weaker / no data"
      s.slug = s.season + "-" + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      base[s.slug] = (base[s.slug] || 0) + 1;
    });
    var opts = document.createDocumentFragment();
    storms.forEach(function (s) {
      var dup = base[s.slug] > 1;
      s.label = s.name + " " + s.season + (dup ? " (" + s.id + ")" : "");
      if (dup) s.slug += "-" + s.id.toLowerCase();
      bySlug[s.slug] = s;
      byLabel[s.label.toLowerCase()] = s;
      var o = document.createElement("option");
      o.value = s.label;
      opts.appendChild(o);
    });
    list.appendChild(opts);
    st = { lo: +fromEl.min, hi: +toEl.max, on: {}, sel: null, play: null, timer: null, k: 1, n: 0 };
    fromEl.value = st.lo; toEl.value = st.hi;
    CLS.forEach(function (c) { st.on[c] = true; });
    wire();
    build();
    select(fromHash() || storms.filter(function (s) { return s.name === "Damrey" && s.season === 2017; })[0] || storms[0],
      { animate: true });
    window.addEventListener("hashchange", function () {
      var s = fromHash();
      if (s && s !== st.sel) select(s, { animate: true });
    });
    document.addEventListener("langchange", labels);
    var lastW = mapBox.clientWidth, rt;
    var onResize = function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (mapBox.clientWidth === lastW) return;
        lastW = mapBox.clientWidth;
        build();
        select(st.sel, {});
      }, 120);
    };
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(mapBox);
    else window.addEventListener("resize", onResize);
  }

  function fromHash() {
    var m = /storm=([\w-]+)/.exec(location.hash);
    return m ? bySlug[m[1].toLowerCase()] : null;
  }
  function vis(s) {
    return s.season >= st.lo && s.season <= (st.play != null ? st.play : st.hi) && st.on[s.key];
  }

  // ------------------------------------------------------------------ map
  function proj(p) { return [(p[0] - W) / (E - W) * M.w, (N - p[1]) / (N - S) * M.h]; }
  function dPiece(pc) {
    return "M" + pc.map(function (p) { var a = proj(p); return a[0].toFixed(1) + "," + a[1].toFixed(1); }).join("L");
  }
  function dStorm(s) { return s.paths.map(dPiece).join(""); }

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
    g.append("g").attr("class", "se-bg").selectAll("path").data(storms).join("path").attr("d", dStorm);
    g.append("image").attr("class", "se-lights").attr("href", "assets/data/lights_vn.png")
      .attr("x", 0).attr("y", 0).attr("width", w).attr("height", h).attr("preserveAspectRatio", "none");
    M.trk = g.append("g").attr("class", "se-trk").selectAll("path").data(storms).join("path").attr("d", dStorm);
    M.hit = g.append("g").attr("class", "se-hit").selectAll("path").data(storms).join("path").attr("d", dStorm)
      .on("pointerenter", function (ev, s) { if (ev.pointerType === "mouse") hoverSoon(s); })
      .on("pointerleave", hoverCancel)
      .on("click", function (ev, s) { hoverCancel(); if (s !== st.sel) select(s, { animate: true, user: true }); });
    M.sel = g.append("g").attr("class", "se-sel");
    M.eye = g.append("g").attr("class", "se-eye").style("display", "none");
    M.eye.append("circle").attr("r", 5.5);
    M.eye.append("circle").attr("r", 1.6).attr("class", "se-eye-c");

    M.year = svg.append("text").attr("class", "se-year").attr("text-anchor", "end")
      .attr("x", proj([117.5, 0])[0]).attr("y", proj([0, 20.2])[1])
      .style("font-size", Math.round(Math.max(34, w * 0.085)) + "px");

    var rw = Math.round(Math.min(150, Math.max(84, w * 0.2))), rh = 5, cols = rampColors(24);
    var rx = proj([115.8, 0])[0] - rw, ry = Math.min(proj([0, 6.75])[1], h - 24);
    var R = svg.append("g").attr("class", "se-ramp").attr("transform", "translate(" + rx + "," + ry + ")");
    R.selectAll("rect").data(cols).join("rect").attr("x", function (c, i) { return i * rw / cols.length; })
      .attr("width", rw / cols.length + 0.4).attr("height", rh).attr("fill", function (c) { return c; });
    M.rT = R.append("text").attr("x", rw / 2).attr("y", -6).attr("text-anchor", "middle");
    M.rLo = R.append("text").attr("x", 0).attr("y", rh + 13);
    M.rHi = R.append("text").attr("x", rw).attr("y", rh + 13).attr("text-anchor", "end");

    st.k = 1;
    M.zoom = d3.zoom().scaleExtent([1, 6]).extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]])
      .filter(function (ev) {
        // the wheel zooms only once the map has focus (or is zoomed), so it does not trap page scrolling
        if (ev.type === "wheel") return st.k > 1 || ev.ctrlKey || document.activeElement === svg.node();
        return !ev.button;
      })
      .on("zoom", function (ev) {
        var t = ev.transform;
        st.k = t.k;
        g.attr("transform", t).style("--k", t.k);
        svg.style("touch-action", t.k > 1 ? "none" : "pan-x pan-y").classed("is-zoomed", t.k > 1);
        placeEye();
      });
    svg.call(M.zoom).style("touch-action", "pan-x pan-y");
  }

  function drawSel(animate) {
    var s = st.sel;
    M.sel.selectAll("path").interrupt().remove();
    M.eye.style("display", "none");
    var ps = M.sel.selectAll("path").data(s.paths).join("path").attr("d", dPiece);
    if (!animate) { showEye(); return; }
    var len = ps.nodes().map(function (n) { return n.getTotalLength(); });
    var tot = d3.sum(len) || 1, acc = 0;
    ps.each(function (_, i) {
      var el = d3.select(this), l = len[i];
      el.attr("stroke-dasharray", l + " " + l).attr("stroke-dashoffset", l)
        .transition().delay(acc / tot * DRAW_MS).duration(l / tot * DRAW_MS).ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end", function () { el.attr("stroke-dasharray", null); if (i === len.length - 1) showEye(); });
      acc += l;
    });
  }
  function placeEye() {
    var s = st.sel;
    if (!s || !s.eye) return;
    M.eye.attr("transform", "translate(" + proj(s.eye) + ") scale(" + 1 / st.k + ")");
  }
  function showEye() {
    if (!st.sel || !st.sel.eye) return;
    placeEye();
    M.eye.style("display", null);
  }

  // ------------------------------------------------------------------ scatter
  function buildScatter() {
    var w = P.w = scBox.clientWidth, h = P.h = Math.max(SC_MIN, Math.round(w * ASPECT * SC_RATIO));
    var m = { t: 36, r: 14, b: 44, l: 80 };
    var root = d3.select(scBox);
    root.selectAll("*").remove();
    var svg = P.svg = root.append("svg").attr("class", "se-sc-svg").attr("viewBox", "0 0 " + w + " " + h)
      .attr("width", w).attr("height", h).attr("role", "group");
    var nearMax = d3.max(storms, function (s) { return s.vmax_near_ms; }) || 60; // dots sit at unrounded kt x 0.5144
    var shareMax = d3.max(storms, function (s) { return s.light_share_vn; }) || 0.4;
    var x = d3.scaleLinear().domain([10, Math.max(60, Math.ceil((nearMax + 2) / 5) * 5)]).range([m.l, w - m.r]);
    var y = d3.scaleSqrt().domain([0, Math.ceil(shareMax * 10) / 10]).range([h - m.b - 7, m.t]);
    var guides = GUIDES.filter(function (v) { return v > x.domain()[0] && v <= x.domain()[1]; });
    var gg = svg.append("g").attr("class", "se-guides");
    gg.selectAll("line").data(guides).join("line").attr("x1", x).attr("x2", x).attr("y1", m.t - 4).attr("y2", h - m.b);
    P.guide = gg.selectAll("text").data(guides).join("text").attr("x", function (v) { return x(v) + 3; }).attr("y", m.t - 7);
    svg.append("g").attr("class", "se-axis").attr("transform", "translate(0," + (h - m.b) + ")")
      .call(d3.axisBottom(x).ticks(w < 480 ? 5 : 10).tickSize(4).tickSizeOuter(0));
    svg.append("g").attr("class", "se-axis").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).tickValues([0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5].filter(function (v) { return v <= y.domain()[1]; }))
        .tickFormat(function (v) { return Math.round(v * 100) + "%"; }).tickSize(4).tickSizeOuter(0));
    P.xT = svg.append("text").attr("class", "se-title").attr("x", w - m.r).attr("y", h - 6).attr("text-anchor", "end");
    P.yT = svg.append("text").attr("class", "se-title").attr("x", 0).attr("y", 12);
    var ndx = P.ndx = m.l - 52;
    P.nd = svg.append("text").attr("class", "se-title").attr("x", ndx).attr("y", y(0) - 30).attr("text-anchor", "middle");
    storms.forEach(function (s) {
      s.cx = s.vmax_near_kt == null ? ndx + ((s.i * 7) % 15 - 7) : x(s.vmax_near_kt * KT2MS);
      s.cy = y(s.light_share_vn);
    });
    P.dots = svg.append("g").attr("class", "se-dots").selectAll("circle").data(storms).join("circle")
      .attr("class", "se-dot").attr("r", 3.5).attr("cx", function (s) { return s.cx; }).attr("cy", function (s) { return s.cy; })
      .attr("tabindex", -1).attr("role", "button").attr("aria-label", function (s) { return s.label; });
    svg.on("pointermove", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var s = nearest(ev, 14);
      if (s && s !== st.sel) hoverSoon(s); else hoverCancel();
    }).on("pointerleave", hoverCancel).on("click", function (ev) {
      var s = nearest(ev, 24);
      hoverCancel();
      if (s && s !== st.sel) select(s, { animate: true, user: true });
    });
  }
  function nearest(ev, r) {
    if (!P.del) return null;
    var p = d3.pointer(ev, P.svg.node()), s = P.pts[P.del.find(p[0], p[1])];
    return s && Math.hypot(s.cx - p[0], s.cy - p[1]) <= r ? s : null;
  }

  // ------------------------------------------------------------------ state
  function build() { buildMap(); buildScatter(); update(); labels(); }

  function update() {
    st.n = 0;
    storms.forEach(function (s) { s.v = vis(s); if (s.v) st.n++; });
    var show = function (s) { return s.v ? null : "none"; };
    M.trk.style("display", show);
    M.hit.style("display", show);
    P.dots.style("display", function (s) { return s.v || s === st.sel ? null : "none"; });
    P.pts = storms.filter(function (s) { return s.v; });
    P.del = P.pts.length ? d3.Delaunay.from(P.pts, function (s) { return s.cx; }, function (s) { return s.cy; }) : null;
    countEl.textContent = tx().count(st.n);
    M.year.text(st.play != null ? st.play : "");
    rangeOut.textContent = st.lo + "–" + st.hi;
    var span = +toEl.max - +fromEl.min;
    fill.style.left = (st.lo - +fromEl.min) / span * 100 + "%";
    fill.style.right = (+toEl.max - st.hi) / span * 100 + "%";
  }

  function select(s, o) {
    if (!s) return;
    o = o || {};
    st.sel = s;
    if (o.user && window.history && history.replaceState) history.replaceState(null, "", "#storm=" + s.slug);
    drawSel(!!o.animate && !reduce);
    P.dots.classed("is-sel", function (x) { return x === s; }).attr("tabindex", function (x) { return x === s ? 0 : -1; })
      .style("display", function (x) { return x.v || x === s ? null : "none"; });
    P.dots.filter(function (x) { return x === s; }).raise();
    writeInfo();
  }
  function hoverSoon(s) {
    clearTimeout(hT);
    hT = setTimeout(function () { if (s !== st.sel) select(s, { animate: true, user: true }); }, HOVER_MS);
  }
  function hoverCancel() { clearTimeout(hT); }

  function writeInfo() {
    var s = st.sel, T = tx();
    if (!s) return;
    var near = s.vmax_near_ms == null ? "—" : s.vmax_near_ms + " m/s (" + T.cls[s.class_near] + ")";
    var z = s.light_share_vn * 100;
    var light = z > 0 ? T.lit(z < 0.05 ? T.small : num(z, 1) + "%") : T.unlit;
    var b = document.createElement("strong");
    b.textContent = (s.name === "Unnamed" ? T.unnamed : s.name) + ", " + s.season + ".";
    info.textContent = "";
    info.appendChild(b);
    info.appendChild(document.createTextNode(" " + T.peak + " " + s.vmax_ms + " m/s (" + T.cls[s["class"]] + "); " +
      T.near + " " + near + ". " + light));
  }

  function labels() {
    var T = tx();
    M.svg.attr("aria-label", T.map);
    P.svg.attr("aria-label", T.sc);
    M.rT.text(T.ramp[0]); M.rLo.text(T.ramp[1]); M.rHi.text(T.ramp[2]);
    P.xT.text(T.x); P.yT.text(T.y);
    P.nd.selectAll("tspan").data(T.nodata).join("tspan").attr("x", P.ndx)
      .attr("dy", function (d, i) { return i ? "1.15em" : 0; }).text(function (d) { return d; });
    P.guide.text(function (v, i) { return i < 2 ? T.guide[i] : String(i); });
    countEl.textContent = T.count(st.n);
    q.placeholder = T.search;
    playLabel();
    writeInfo();
  }

  // ------------------------------------------------------------------ controls
  function playLabel() {
    var T = tx(), k;
    if (st.timer) k = T.pause;
    else if (reduce && st.play != null) k = T.step;
    else if (st.play != null && st.play < st.hi) k = T.resume;
    else k = T.play;
    playBtn.textContent = k;
  }
  function stopPlay(reset) {
    clearInterval(st.timer);
    st.timer = null;
    if (reset) st.play = null;
    playLabel();
  }
  function togglePlay() {
    if (reduce) { // no animation: one year per press
      st.play = st.play == null ? st.lo : st.play + 1;
      if (st.play > st.hi) st.play = null;
      update(); playLabel();
      return;
    }
    if (st.timer) { stopPlay(false); return; }
    if (st.play == null || st.play >= st.hi) st.play = st.lo;
    update();
    st.timer = setInterval(function () {
      if (st.play >= st.hi) { stopPlay(false); return; }
      st.play++;
      update();
    }, PLAY_MS / (st.hi - st.lo + 1));
    playLabel();
  }

  function wire() {
    var onRange = function (ev) {
      var a = +fromEl.value, b = +toEl.value;
      if (a > b) { if (ev.target === fromEl) fromEl.value = a = b; else toEl.value = b = a; }
      st.lo = a; st.hi = b;
      stopPlay(true);
      update();
    };
    fromEl.addEventListener("input", onRange);
    toEl.addEventListener("input", onRange);
    Array.prototype.forEach.call(fig.querySelectorAll("[data-cls]"), function (b) {
      b.addEventListener("click", function () {
        var c = b.getAttribute("data-cls");
        st.on[c] = !st.on[c];
        b.setAttribute("aria-pressed", String(st.on[c]));
        update();
      });
    });
    playBtn.addEventListener("click", togglePlay);
    resetBtn.addEventListener("click", function () { M.svg.call(M.zoom.transform, d3.zoomIdentity); });

    var pick = function (loose) {
      var v = q.value.trim().toLowerCase(), s = byLabel[v];
      if (!v) return;
      if (!s && loose) { // newest storm whose name starts with (else contains) the text
        for (var i = storms.length - 1; i >= 0 && !s; i--) if (storms[i].label.toLowerCase().indexOf(v) === 0) s = storms[i];
        for (i = storms.length - 1; i >= 0 && !s; i--) if (storms[i].label.toLowerCase().indexOf(v) > 0) s = storms[i];
      }
      if (s && s !== st.sel) select(s, { animate: true, user: true });
    };
    q.addEventListener("input", function () { pick(false); });
    q.addEventListener("change", function () { pick(true); });
    q.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); pick(true); } });

    // one-finger drags at full view scroll the page; d3-zoom only sees them once the map is zoomed in
    mapBox.addEventListener("touchmove", function (ev) {
      if (st.k <= 1 && ev.touches.length < 2) ev.stopPropagation();
    }, { capture: true, passive: true });

    fig.addEventListener("keydown", function (ev) {
      var t = ev.target;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var isDot = t.classList && t.classList.contains("se-dot");
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        var v = storms.filter(function (s) { return s.v; });
        if (!v.length) return;
        var i = v.indexOf(st.sel), n = ev.key === "ArrowRight" ? 1 : -1;
        var s = v[i < 0 ? (n > 0 ? 0 : v.length - 1) : (i + n + v.length) % v.length];
        ev.preventDefault();
        select(s, { animate: true, user: true });
        if (isDot) P.dots.filter(function (x) { return x === s; }).node().focus();
      } else if (isDot && (ev.key === "Enter" || ev.key === " ")) {
        ev.preventDefault();
        if (t.__data__ !== st.sel) select(t.__data__, { animate: true, user: true });
      }
    });
  }
})();
