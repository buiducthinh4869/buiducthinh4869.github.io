/* Storm atlas, section 2: a timeline of the storms of the chosen region.
   Country: one dot per storm (x = date of closest approach, y = peak wind within 200 km), category bands.
   Ocean basin or whole world: storms per season, stacked by category; a bar filters the list to that season.
   Needs atlas_core.js. */
(function () {
  "use strict";
  var A = window.Atlas, fig = document.querySelector(".at-timeline");
  if (!A || !fig) return;
  var box = fig.querySelector(".atl-plot"), head = document.getElementById("atl-title"), how = document.getElementById("atl-how"),
    keyEl = fig.querySelector(".atl-key"), yrEl = document.getElementById("atl-year");
  var TX = {
    en: {
      tDots: "Storms that came within 200 km of {r}", tBars: "Storms per season, {r}",
      hDots: "Each dot is one storm. Higher dots brought stronger wind near {r}. Hover a dot for details; click it to see the storm on the globe below.",
      hDotsLife: "Each dot is one storm, placed by the date it formed and its strongest wind anywhere. Hover for details; click to see it on the globe.",
      hBars: "Each bar is one season, split by each storm's strongest category. Hover a bar for the numbers; click it to list that season's storms.",
      y: "m/s", yBars: "storms", nd: "no wind record nearby", season: "Season {y}", storms: "{n} storms", major: "{n} of category 3 or stronger"
    },
    vi: {
      tDots: "Các cơn bão đi qua trong phạm vi 200 km quanh {r}", tBars: "Số cơn bão mỗi mùa, {r}",
      hDots: "Mỗi chấm là một cơn bão. Chấm càng cao, gió gần {r} càng mạnh. Rê chuột vào chấm để xem chi tiết; bấm để xem cơn bão trên quả địa cầu bên dưới.",
      hDotsLife: "Mỗi chấm là một cơn bão, đặt theo ngày hình thành và sức gió mạnh nhất trong đời bão. Rê chuột để xem chi tiết; bấm để xem trên quả địa cầu.",
      hBars: "Mỗi cột là một mùa bão, chia theo cấp mạnh nhất của từng cơn. Rê chuột vào cột để xem số liệu; bấm để liệt kê các cơn bão của mùa đó.",
      y: "m/s", yBars: "cơn bão", nd: "không có số liệu gió gần đó", season: "Mùa bão {y}", storms: "{n} cơn bão", major: "{n} cơn từ cấp 3 trở lên"
    }
  };
  function tt() { return TX[A.lang()]; }
  var P = {};

  A.ready.then(function () {
    draw();
    A.on("region", draw);
    A.on("sel", mark);
    A.on("year", function () { markYear(); yearChip(); });
    document.addEventListener("langchange", draw);
    var lw = box.clientWidth, rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (box.clientWidth !== lw) { lw = box.clientWidth; draw(); } }, 150); });
  });

  function draw() {
    var r = A.st.region, T = tt(), name = A.regionName();
    P.dots = !!r && r[0] === "c";
    head.textContent = (P.dots ? T.tDots : T.tBars).replace("{r}", name);
    how.textContent = (P.dots ? (A.hasNear ? T.hDots : T.hDotsLife) : T.hBars).replace("{r}", name);
    d3.select(box).selectAll("*").remove();
    var w = P.w = box.clientWidth, h = P.h = w < 600 ? 210 : 270;
    box.style.height = h + "px";
    P.svg = d3.select(box).append("svg").attr("viewBox", "0 0 " + w + " " + h).attr("width", w).attr("height", h).attr("class", "atl-svg");
    P.m = { t: 14, r: P.dots ? (P.w < 600 ? 52 : 92) : 10, b: P.dots ? 62 : 26, l: 34 };
    var y0 = A.IX.meta.seasons[0], y1 = A.IX.meta.seasons[1];
    P.x = d3.scaleLinear().domain([y0, y1 + 1]).range([P.m.l, w - P.m.r]);
    (P.dots ? dots : bars)();
    var ax = P.svg.append("g").attr("class", "atl-axis").attr("transform", "translate(0," + (h - P.m.b) + ")")
      .call(d3.axisBottom(P.x).tickValues(d3.range(1985, y1 + 1, w < 600 ? 10 : 5)).tickFormat(d3.format("d")).tickSize(4).tickSizeOuter(0));
    ax.select(".domain").attr("stroke", "#6b6f72");
    key();
    yearChip();
    mark();
  }

  // ------------------------------------------------------------------ country: dots on category bands
  function dots() {
    var r = +A.st.region.slice(2), T = tt(), m = P.m, w = P.w, h = P.h, yb = h - m.b;
    var ss = A.IX.storms.filter(function (s) { return A.inRegion(s); }).map(function (s) {
      var n = A.hasNear ? s.nmap[r] : null, v = n ? n.v : A.hasNear ? null : s.vmax_ms, t = n ? n.t : s.t;
      var d = new Date(t), fy = d.getUTCFullYear() + (t - Date.UTC(d.getUTCFullYear(), 0, 1)) / (365.25 * 864e5);
      return { s: s, v: v, fy: fy, c: v == null ? null : A.clsOf(v) };
    });
    // southern storms of the first season can form in late 1980: widen the axis to the dots
    var e = d3.extent(ss, function (d) { return d.fy; });
    if (ss.length) P.x.domain([Math.min(P.x.domain()[0], Math.floor(e[0])), Math.max(P.x.domain()[1], Math.ceil(e[1]))]);
    var top = Math.max(75, (d3.max(ss, function (d) { return d.v; }) || 0) + 4);
    var y = d3.scaleLinear().domain([0, top]).range([yb, m.t]);
    var cuts = A.LEV.concat([top]);
    var g = P.svg.append("g");
    A.CLS.forEach(function (c, i) {
      var a = y(cuts[i + 1]), b = y(cuts[i]);
      g.append("rect").attr("x", m.l).attr("width", w - m.r - m.l).attr("y", a).attr("height", b - a).attr("fill", A.CCOL[c]).attr("fill-opacity", 0.12);
      // band names in the right margin, outside the dots
      if (b - a >= 11) g.append("text").attr("class", "atl-band").attr("x", w - m.r + 6).attr("y", (a + b) / 2)
        .attr("dominant-baseline", "central").text(A.tx().clsShort[c] + (w < 600 ? "" : " · " + cuts[i] + "+ m/s"));
    });
    P.svg.append("g").attr("class", "atl-axis").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).tickValues([20, 40, 60]).tickSize(4).tickSizeOuter(0)).select(".domain").attr("stroke", "#6b6f72");
    P.svg.append("text").attr("class", "atl-unit").attr("x", 0).attr("y", 10).text(T.y);
    var ys = yb + 32; // strip of storms with no wind record nearby, under the year labels
    P.svg.append("circle").attr("class", "atl-dot is-nd").attr("r", 3).attr("cx", m.l + 4).attr("cy", h - 8);
    P.svg.append("text").attr("class", "atl-unit").attr("x", m.l + 12).attr("y", h - 4).text(T.nd);
    ss.forEach(function (d) { d.cx = P.x(d.fy); d.cy = d.v == null ? ys : y(d.v); });
    // small vertical jitter for dots that sit on top of each other
    var seen = {};
    ss.forEach(function (d) { var k = Math.round(d.cx / 4) + ":" + Math.round(d.cy / 4); var n = seen[k] = (seen[k] || 0) + 1; if (n > 1) d.cy += (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 3; });
    P.items = ss;
    P.sel = P.svg.append("g").selectAll("circle").data(ss).join("circle")
      .attr("class", function (d) { return "atl-dot" + (d.v == null ? " is-nd" : ""); })
      .attr("r", function (d) { return d.v == null ? 3 : P.w < 600 ? 3.2 : 4.5; })
      .attr("cx", function (d) { return d.cx; }).attr("cy", function (d) { return d.cy; })
      .attr("fill", function (d) { return d.c ? A.CCOL[d.c] : d.v == null ? null : "#ece6d8"; }); // below 17 m/s: pale, under the bands
    P.del = ss.length ? d3.Delaunay.from(ss, function (d) { return d.cx; }, function (d) { return d.cy; }) : null;
    hover(function (p) {
      if (!P.del) return null;
      var d = ss[P.del.find(p[0], p[1])];
      return d && Math.hypot(d.cx - p[0], d.cy - p[1]) < 16 ? d : null;
    }, function (d) { return A.card(d.s); }, function (d) { A.pick(d.s); });
    P.ring = P.svg.append("g");
  }

  // ------------------------------------------------------------------ basin or world: stacked bars per season
  function bars() {
    var m = P.m, w = P.w, h = P.h, yb = h - m.b, y0 = A.IX.meta.seasons[0], y1 = A.IX.meta.seasons[1];
    var by = d3.range(y0, y1 + 1).map(function (yr) { var o = { yr: yr, n: 0 }; A.CLS.forEach(function (c) { o[c] = 0; }); return o; });
    A.IX.storms.forEach(function (s) { if (A.inRegion(s) && by[s.season - y0]) { by[s.season - y0][s["class"]]++; by[s.season - y0].n++; } });
    var y = d3.scaleLinear().domain([0, d3.max(by, function (o) { return o.n; }) || 1]).nice().range([yb, m.t]);
    P.svg.append("g").attr("class", "atl-grid").selectAll("line").data(y.ticks(4).slice(1)).join("line")
      .attr("x1", m.l).attr("x2", w - m.r).attr("y1", function (v) { return y(v); }).attr("y2", function (v) { return y(v); });
    P.svg.append("g").attr("class", "atl-axis").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).ticks(4).tickSize(4).tickSizeOuter(0)).select(".domain").attr("stroke", "#6b6f72");
    P.svg.append("text").attr("class", "atl-unit").attr("x", 0).attr("y", 10).text(tt().yBars);
    var bw = Math.max(2, (P.x(y0 + 1) - P.x(y0)) - 2), g = P.svg.append("g");
    by.forEach(function (o) {
      var acc = 0, x0 = P.x(o.yr) + 1, gg = g.append("g").attr("class", "atl-bar").datum(o);
      A.CLS.forEach(function (c) {
        if (!o[c]) return;
        var a = y(acc + o[c]), b = y(acc);
        // 1 px surface gap between stacked segments
        gg.append("rect").attr("x", x0).attr("width", bw).attr("y", a).attr("height", Math.max(0.5, b - a - (acc ? 1 : 0))).attr("fill", A.CCOL[c])
          .attr("rx", acc + o[c] === o.n ? Math.min(2, bw / 3) : 0);
        acc += o[c];
      });
    });
    P.items = by;
    P.bars = g.selectAll(".atl-bar");
    hover(function (p) {
      var yr = Math.floor(P.x.invert(p[0]));
      return yr >= y0 && yr <= y1 && p[1] > m.t - 6 && p[1] < yb + 6 ? by[yr - y0] : null;
    }, function (o) {
      var T = tt(), f = document.createDocumentFragment(), loc = A.lang();
      f.appendChild(A.el("div", "at-tip-h", T.season.replace("{y}", o.yr)));
      var r = A.el("div", "at-tip-r");
      r.appendChild(A.el("strong", null, T.storms.replace("{n}", o.n)));
      f.appendChild(r);
      A.CLS.slice().reverse().forEach(function (c) {
        if (!o[c]) return;
        var q = A.el("div", "at-tip-r"), k = A.el("span", "at-key");
        k.style.background = A.CCOL[c];
        q.appendChild(k);
        q.appendChild(A.el("strong", null, String(o[c])));
        q.appendChild(document.createTextNode(" " + A.tx().cls[c]));
        f.appendChild(q);
      });
      return f;
    }, function (o) { A.setYear(A.st.year === o.yr ? null : o.yr); });
    markYear();
  }

  // ------------------------------------------------------------------ shared: hover layer, legend, marks
  function hover(find, content, click) {
    var hl = P.svg.append("rect").attr("class", "atl-hl").attr("pointer-events", "none").style("display", "none");
    P.svg.on("pointermove", function (ev) {
      var p = d3.pointer(ev), d = find(p);
      P.svg.style("cursor", d ? "pointer" : "default");
      if (!d) { A.tipHide(); hl.style("display", "none"); return; }
      if (d.yr) hl.style("display", null).attr("x", P.x(d.yr)).attr("width", P.x(d.yr + 1) - P.x(d.yr)).attr("y", P.m.t - 4).attr("height", P.h - P.m.b - P.m.t + 4);
      else hl.style("display", "none");
      if (ev.pointerType === "mouse") A.tipShow(ev.clientX, ev.clientY, content(d));
    }).on("pointerleave", function () { A.tipHide(); hl.style("display", "none"); }).on("click", function (ev) {
      var d = find(d3.pointer(ev));
      if (!d) return;
      if (ev.pointerType && ev.pointerType !== "mouse" && P.tap !== d) { P.tap = d; A.tipShow(ev.clientX, ev.clientY, content(d)); return; }
      P.tap = null; A.tipHide(); click(d);
    });
  }
  function key() {
    keyEl.textContent = "";
    A.CLS.forEach(function (c) {
      var s = A.el("span", "atl-k"), k = A.el("span", "at-key at-key-box");
      k.style.background = A.CCOL[c];
      s.appendChild(k);
      s.appendChild(document.createTextNode(A.tx().cls[c]));
      keyEl.appendChild(s);
    });
  }
  function mark() {
    if (!P.dots || !P.ring) return;
    P.ring.selectAll("*").remove();
    A.st.sel.forEach(function (s) {
      var d = P.items.filter(function (x) { return x.s === s; })[0];
      if (!d) return;
      P.ring.append("circle").attr("class", "atl-ring").attr("cx", d.cx).attr("cy", d.cy).attr("r", 8).attr("stroke", s.col || "#1f5f7a");
      P.ring.append("text").attr("class", "atl-name").attr("x", d.cx + (d.cx > P.w - 110 ? -11 : 11)).attr("y", d.cy - 9)
        .attr("text-anchor", d.cx > P.w - 110 ? "end" : "start").text(A.nm(s) + " " + s.season);
    });
  }
  function markYear() {
    if (P.bars) P.bars.classed("is-dim", function (o) { return A.st.year != null && o.yr !== A.st.year; });
  }
  function yearChip() {
    yrEl.textContent = "";
    if (A.st.year == null) return;
    yrEl.appendChild(A.el("strong", null, A.tx().year.replace("{y}", A.st.year)));
    var b = A.el("button", "se-link", A.tx().clearYear);
    b.type = "button";
    b.addEventListener("click", function () { A.setYear(null); });
    yrEl.appendChild(document.createTextNode(" "));
    yrEl.appendChild(b);
  }
})();
