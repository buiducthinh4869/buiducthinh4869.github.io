/* Housing atlas, sections 2 to 5: distance gradient, price "bill" (waterfall), stale panels, district bubbles.
   Needs housing_core.js (window.Housing) and D3 7.9.0. Each figure fails on its own (H.fail).
   Cross-sectional wording only: differences in asking prices, never causes. */
(function () {
  "use strict";
  var H = window.Housing, d3 = window.d3;
  if (!H || !d3) return;
  var INK = "#23272b", MUTED = "#6b6f72", RULE = "#e4e1d8", ACC = "#1f5f7a", GREY = "#c8c5bc", BROWN = "#8f5a32", BROWN2 = "#c49a62",
    BAR = "#ad7a45", PAPER = "#faf9f5";

  function tr(en, vi) { return H.lang() === "vi" ? vi : en; }
  function nf(x, d) { return H.nf(x, d || 0); }
  function times(x, d) { return "×" + nf(x, d == null ? 2 : d); }
  function ints(a, b) { return a + "–" + b; }
  function fs(S) { return S.w < 600 ? 11 : 12; }

  function make(fig, load, draw, note) {
    var S = { fig: fig, plot: fig.querySelector(".hs-plot"), d: null, hit: null, hv: null, w: 0, clear: null };
    if (!S.plot) { S.plot = H.el("div", "hs-plot"); fig.insertBefore(S.plot, fig.firstChild); }
    S.render = function () {
      if (!S.d) return;
      try { S.hit = null; S.clear = null; S.w = S.plot.clientWidth; draw(S); if (S.hv && S.hv.refresh) S.hv.refresh(); }
      catch (e) { H.fail(fig, e); }
    };
    var fc = function () { caption(fig, tr("mogi.vn listings, 15 Oct 2026; author's calculations.", "tin rao mogi.vn, 15/10/2026; tác giả tính toán."), tr(note[0], note[1])); };
    fc(); H.onLang(fc);
    S.plot.addEventListener("mouseleave", function () { if (S.clear) S.clear(); });
    H.lazy(fig, function () {
      Promise.resolve(load()).then(function (d) {
        S.d = d;
        S.hv = H.hover(S.plot, function (x, y) { return S.hit ? S.hit(x, y) : null; });
        S.render();
      }).catch(function (e) { H.fail(fig, e); });
    });
    H.onLang(S.render);
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (S.d && S.plot.clientWidth !== S.w) S.render(); }, 150);
    });
    return S;
  }

  function caption(fig, src, note) {
    var cap = fig.querySelector("figcaption") || fig.appendChild(H.el("figcaption"));
    [["hs-src", H.t("src") + " " + src], ["hs-note", H.t("note") + " " + note]].forEach(function (a) {
      var p = cap.querySelector("." + a[0]);
      if (!p) { p = H.el("p", a[0]); cap.insertBefore(p, cap.firstChild); }
      p.textContent = a[1];
    });
  }

  function take(fig, text) {
    var sec = fig.closest(".at-sec") || fig.parentNode, p = sec.querySelector(".hs-take");
    if (!p) {
      p = H.el("p", "hs-take");
      var head = sec.querySelector(".at-head");
      if (head && head.parentNode) head.parentNode.insertBefore(p, head.nextSibling); else sec.insertBefore(p, fig);
    }
    p.textContent = text || "";
    p.hidden = !text;
  }

  function ctl(fig) {
    var c = fig.querySelector(".hs-bar");
    if (!c) { c = H.el("div", "hs-bar"); fig.insertBefore(c, fig.querySelector(".hs-plot")); }
    return c;
  }

  function pills(box, items, cur, fn, label) {
    var sig = items.map(function (i) { return i[1]; }).join("|");
    if (box.getAttribute("data-sig") !== sig) {
      box.textContent = "";
      box.setAttribute("data-sig", sig);
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", label);
      items.forEach(function (it) {
        var b = H.el("button", "hs-pill", it[1]);
        b.type = "button";
        b.setAttribute("data-v", it[0]);
        b.addEventListener("click", function () { fn(it[0]); });
        box.appendChild(b);
      });
    }
    Array.prototype.forEach.call(box.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === cur)); });
  }

  function mk(S, w, h, label) {
    S.plot.textContent = "";
    S.plot.style.height = h + "px";
    S.plot.style.minHeight = "0";
    return d3.select(S.plot).append("svg").attr("class", "hs-svg").attr("width", w).attr("height", h)
      .attr("viewBox", "0 0 " + w + " " + h).attr("role", "img").attr("aria-label", label);
  }

  var V = H.svg, ln = V.ln, txt = V.txt, axX = V.axX, axY = V.axY, wrap = V.wrap, thin = V.thin, lab = V.lab, legend = V.legend;

  var LX = { n: ["Listings", "Số tin"], rng: ["95% range", "Khoảng 95%"], on: ["Still online after 180 days", "Còn trên mạng sau 180 ngày"], ask: ["Asking price", "Giá rao"], med: ["Median asking price", "Giá rao trung vị"] };
  function L(k) { return LX[k][H.lang() === "vi" ? 1 : 0]; }

  // 2. gradient
  var GRAD_TIP = {
    en: { ring: "{c} · {a}–{b} km from the centre", price: "Price vs the city average", mostly: "Mostly: ", avg: "city average", yt: "Asking price relative to the city average (log scale)", xt: "Distance from the city centre, km" },
    vi: { ring: "{c} · cách trung tâm {a}–{b} km", price: "Giá so với mức trung bình", mostly: "Chủ yếu: ", avg: "mức trung bình thành phố", yt: "Giá rao so với mức trung bình thành phố (thang log)", xt: "Khoảng cách đến trung tâm, km" }
  };

  function gradient(fig) {
    var S = make(fig, function () { return H.load("gradient"); }, drawGradient, ["Rings with fewer than 25 listings are left out. Listings placed at a ward centre count half.", "Bỏ các vòng có dưới 25 tin. Tin chỉ có tọa độ tâm phường được tính một nửa."]);
    H.on("state", function () { if (S.d && S.cur !== H.st.c) S.render(); });
  }

  function drawGradient(S) {
    var d = S.d, w = S.w, nar = w < 600, h = Math.round(w * (nar ? 1 : 0.5625)), cur = H.st.c, X = GRAD_TIP[H.lang()];
    S.cur = cur;
    var ser = ["hn", "hcm"].filter(function (c) { return d[c] && d[c].rings; }).map(function (c) {
      return {
        c: c, col: H.CITYC[c], pts: d[c].rings.filter(function (r) { return r.n >= 25 && r.km < 25; }).map(function (r) {
          return { c: c, km: r.km, x: r.km + 0.5, rel: r.rel, lo: r.lo, hi: r.hi, n: r.n, d: r.d || [] };
        })
      };
    }).filter(function (s) { return s.pts.length; });
    if (!ser.length) throw new Error("gradient: no rings");
    ser.sort(function (a, b) { return (a.c === cur) - (b.c === cur); });
    var all = [].concat.apply([], ser.map(function (s) { return s.pts; }));
    var m = nar ? { t: 10, r: 58, b: 46, l: 56 } : { t: 12, r: 104, b: 48, l: 56 };
    var xm = Math.max(10, Math.ceil(d3.max(all, function (p) { return p.x; }) / 5) * 5), x = d3.scaleLinear().domain([0, xm]).range([m.l, w - m.r]);
    var y0 = Math.min(1, d3.min(all, function (p) { return p.lo; })) / 1.12, y1 = Math.max(1, d3.max(all, function (p) { return p.hi; })) * 1.12;
    var y = d3.scaleLog().domain([y0, y1]).range([h - m.b, m.t]);
    var yt = [0.125, 0.25, 0.5, 1, 2, 4, 8].filter(function (t) { return t >= y0 && t <= y1; });
    var svg = mk(S, w, h, X.yt + " / " + X.xt), g = svg.append("g");
    axY(g, y, yt, m.l, w - m.r, function (t) { return times(t, t >= 1 ? 0 : t >= 0.5 ? 1 : t >= 0.25 ? 2 : 3); });
    ln(g, m.l, y(1), w - m.r, y(1), MUTED).attr("stroke-dasharray", "4 3");
    if (!nar) txt(g, w - m.r - 4, y(1) - 5, X.avg, "end", "hs-halo");
    axX(g, x, d3.range(0, xm + 1, 5), h - m.b, function (t) { return nf(t); });
    txt(g, (m.l + w - m.r) / 2, h - 6, X.xt, "middle");
    var yl = svg.append("text").attr("transform", "translate(11," + ((m.t + h - m.b) / 2) + ") rotate(-90)").attr("text-anchor", "middle").text(nar ? tr("Price vs average (×, log)", "Giá so với trung bình (lần, log)") : X.yt);
    var guide = g.append("line").attr("class", "hs-guide").attr("y1", m.t).attr("y2", h - m.b).attr("stroke", ACC).attr("stroke-width", 1).style("display", "none");
    var area = d3.area().x(function (p) { return x(p.x); }).y0(function (p) { return y(p.lo); }).y1(function (p) { return y(p.hi); }),
      line = d3.line().x(function (p) { return x(p.x); }).y(function (p) { return y(p.rel); });
    ser.forEach(function (s) {
      var on = s.c === cur, sg = g.append("g").attr("opacity", on ? 1 : 0.8);
      sg.append("path").attr("d", area(s.pts)).attr("fill", s.col).attr("fill-opacity", on ? 0.14 : 0.08);
      sg.append("path").attr("d", line(s.pts)).attr("fill", "none").attr("stroke", s.col).attr("stroke-width", on ? 2 : 1.5);
      sg.selectAll("circle").data(s.pts).enter().append("circle").attr("cx", function (p) { return x(p.x); }).attr("cy", function (p) { return y(p.rel); })
        .attr("r", nar ? 3 : 3.5).attr("fill", s.col).attr("stroke", PAPER).attr("stroke-width", 1);
    });
    var items = ser.map(function (s) {
      var last = s.pts[s.pts.length - 1], t = nar ? (s.c === "hcm" ? tr("HCMC", "TP.HCM") : H.city(s.c)) : H.city(s.c);
      return { x: x(last.x), y: y(last.rel), w: H.textW(t, fs(S)) + 2, h: 15, pr: s.c === cur ? 2 : 1, txt: t, col: s.col, c: s.c };
    });
    var placed = H.place(items, { w: w, h: h }) || [];
    items.forEach(function (it) {
      var p = placed.filter(function (q) { return q.c === it.c; })[0] || { lx: it.x + 6, ly: it.y - it.h / 2, h: it.h, txt: it.txt };
      p.txt = it.txt;
      lab(g, p, "k").attr("fill", it.col).attr("opacity", it.c === cur ? 1 : 0.7);
    });
    S.clear = function () { guide.style("display", "none"); };
    S.hit = function (px, py) {
      var best = null, bd = 34 * 34;
      all.forEach(function (p) {
        var dx = x(p.x) - px, dy = y(p.rel) - py, dd = (dx * dx + dy * dy) * (p.c === cur ? 0.8 : 1);
        if (dd < bd) { bd = dd; best = p; }
      });
      if (!best) { S.clear(); return null; }
      guide.attr("x1", x(best.x)).attr("x2", x(best.x)).style("display", null);
      var rows = [[X.price, times(best.rel)], [L("rng"), times(best.lo) + "–" + times(best.hi)], [L("n"), nf(best.n)]];
      var mostly = best.d.slice(0, 3).map(function (q) { return H.pn(q[0]) + " (" + nf(q[1]) + ")"; }).join(", ");
      var ms = [tr("The ring average, after allowing for type and plot size.", "Giá trung bình của vòng, đã tính đến loại nhà và diện tích lô.")];
      if (mostly) ms.push(X.mostly + mostly);
      return { key: best.c + best.km, node: H.card({ h: X.ring.replace("{c}", H.city(best.c)).replace("{a}", nf(best.km)).replace("{b}", nf(best.km + 1)), sw: H.CITYC[best.c], rows: rows, m: ms }) };
    };
    var ok = ["hn", "hcm"].filter(function (c) { return d[c] && d[c].slope && d[c].slope.gate === "PASS"; });
    if (!ok.length) take(S.fig, "");
    else {
      var pc = function (c) { return nf(Math.abs(d[c].slope.pct)); };
      var en = "Further from the centre, prices fall: about " + pc(ok[0]) + "% for each kilometre in " + H.city(ok[0]) + (ok[1] ? " and " + pc(ok[1]) + "% in " + H.city(ok[1]) : "") + " (asking prices of houses and land, after allowing for type and plot size).";
      var vi = "Càng xa trung tâm giá càng giảm: khoảng " + pc(ok[0]) + "% mỗi km ở " + H.city(ok[0]) + (ok[1] ? " và " + pc(ok[1]) + "% ở " + H.city(ok[1]) : "") + " (giá rao nhà và đất, đã tính đến loại nhà và diện tích lô).";
      take(S.fig, tr(en, vi));
    }
  }

  // 4. stale panels
  function stale(fig) {
    var S = make(fig, function () { return H.load("stale_bins"); }, drawStale, ["Price gap from the model's out-of-sample value. District speed is the median age of the other listings in that district.", "Chênh giá tính theo giá trị mô hình ước tính trên dữ liệu không dùng để huấn luyện. Tốc độ của quận là tuổi trung vị của các tin khác trong quận."]);
  }

  function drawStale(S) {
    var d = S.d, w = S.w, nar = w < 600, side = w >= 700, f = fs(S);
    var panels = [
      { k: "gap", bins: d.gap || [], ti: tr("Asking price vs the model's value", "Giá rao so với giá trị mô hình"), xt: tr("Asking price above (+) or below (−) model value, %", "Giá rao cao hơn (+) hay thấp hơn (−) giá trị mô hình, %") },
      { k: "liq", bins: d.liq || [], ti: tr("Speed of the district", "Tốc độ của quận"), xt: tr("Days listings in the district usually stay online", "Số ngày tin trong quận thường nằm trên mạng") }
    ];
    if (!panels[0].bins.length || !panels[1].bins.length) throw new Error("stale_bins: empty");
    var ov = d.overall * 100, gapW = 24, T0 = side ? 296 : 560; // fixed total height per layout (CSS min-height matches)
    var svg = mk(S, w, 100, tr("Share of listings still online after 180 days", "Tỷ lệ tin còn trên mạng sau 180 ngày")), top = 2;
    var lh = legend(svg, [{ kind: "box", col: BAR, txt: tr("Share still online after 180 days", "Tỷ lệ còn trên mạng sau 180 ngày") }, { kind: "whisker", col: INK, txt: L("rng") },
      { kind: "dash", col: MUTED, txt: tr("All listings, ", "Mọi tin, ") + H.pct(d.overall, 0) }], 4, top, w - 8);
    var y0 = top + lh + 6, ph = side ? T0 - y0 : (T0 - y0) / 2, h = T0;
    svg.attr("height", h).attr("viewBox", "0 0 " + w + " " + h);
    S.plot.style.height = h + "px";
    var pw = side ? (w - gapW) / 2 : w, boxes = [];
    panels.forEach(function (P, pi) {
      var ox = side ? pi * (pw + gapW) : 0, oy = side ? y0 : y0 + pi * ph, ml = 54, mr = 6, ty = oy + 14, pt = oy + 30, pb = oy + ph - (nar ? 74 : 58);
      var g = svg.append("g"), n = P.bins.length, bw = (pw - ml - mr) / n, x0 = ox + ml;
      var y = d3.scaleLinear().domain([0, 100]).range([pb, pt]);
      txt(g, ox + 4, ty, P.ti, "start", "k hs-pt");
      axY(g, y, [0, 20, 40, 60, 80, 100], x0, ox + pw - mr, function (t) { return nf(t); });
      g.append("text").attr("transform", "translate(" + (ox + 10) + "," + ((pt + pb) / 2) + ") rotate(-90)").attr("text-anchor", "middle").text(tr("% still online", "% còn trên mạng"));
      ln(g, x0, pb, ox + pw - mr, pb, MUTED);
      var bars = [];
      P.bins.forEach(function (b, i) {
        var bx = x0 + i * bw + bw * 0.1, bwid = bw * 0.8, r = b.rate * 100;
        var rect = g.append("rect").attr("x", bx).attr("y", y(r)).attr("width", bwid).attr("height", pb - y(r)).attr("fill", BAR);
        ln(g, bx + bwid / 2, y(b.wl * 100), bx + bwid / 2, y(b.wh * 100), INK);
        [b.wl, b.wh].forEach(function (v) { ln(g, bx + bwid / 2 - 4, y(v * 100), bx + bwid / 2 + 4, y(v * 100), INK); });
        bars.push(rect);
      });
        ln(g, x0, y(ov), ox + pw - mr, y(ov), MUTED).attr("stroke-width", 1.5).attr("stroke-dasharray", "5 3");
      var ot = tr("all listings ", "mọi tin ") + H.pct(d.overall, 0), ow = H.textW(ot, f), oy2 = y(ov) - 5, ox2 = null;
      for (var sx = ox + pw - mr - ow; sx >= x0; sx -= 6) {
        var clash = P.bins.some(function (b, i) { var bx = x0 + i * bw + bw * 0.1; return bx + bw * 0.8 > sx - 6 && bx < sx + ow + 6 && y(Math.max(b.rate, b.wh) * 100) < y(ov) + 6; });
        if (!clash) { ox2 = sx; break; }
      }
      if (ox2 != null) txt(g, ox2, oy2, ot, "start", "hs-halo k"); // the legend carries the value when the label has no room
      // x labels: the bins themselves when they fit; ten gap bins on a narrow screen are numbered; otherwise the bin edges
      var lab1 = P.bins.map(function (b) { return ints(nf(b.lo), nf(b.hi)); }), xt = P.xt;
      var fit = P.k === "liq" && d3.max(lab1, function (s) { return H.textW(s, f); }) + 4 <= bw;
      if (fit) P.bins.forEach(function (b, i) { txt(g, x0 + (i + 0.5) * bw, pb + 16, lab1[i], "middle"); });
      else if (P.k === "liq" || nar) {
        P.bins.forEach(function (b, i) { txt(g, x0 + (i + 0.5) * bw, pb + 16, P.k === "liq" ? nf(b.lo) + "+" : nf(i + 1), "middle"); });
        xt = P.k === "liq" ? P.xt + tr(" (start of each group)", " (đầu mỗi nhóm)") : tr("Ten equal groups, from the lowest (1) to the highest (" + n + ") asking price relative to the model's value", "Mười nhóm bằng nhau, từ giá rao thấp nhất (1) đến cao nhất (" + n + ") so với giá trị mô hình");
      } else {
        var ed = P.bins.map(function (b, i) { return i ? H.spct(b.lo / 100, 0) : null; }), mw = d3.max(ed, function (s) { return s ? H.textW(s, f) : 0; }) + 8, stp = Math.max(1, Math.ceil(mw / bw));
        ed.forEach(function (s, i) { if (s && i % stp === 0) { txt(g, x0 + i * bw, pb + 16, s, "middle"); ln(g, x0 + i * bw, pb, x0 + i * bw, pb + 4, MUTED); } });
      }
      wrap(g, x0 + (pw - ml - mr) / 2, pb + 40, xt, 2 * Math.min(ml + (pw - ml - mr) / 2, pw - ml - (pw - ml - mr) / 2) - 8, f);
      boxes.push({ P: P, x0: x0, bw: bw, pt: pt, pb: pb, ox: ox, pw: pw, oy: oy, bars: bars });
    });
    S.clear = function () { boxes.forEach(function (B) { B.bars.forEach(function (r) { r.attr("stroke", null); }); }); };
    S.hit = function (px, py) {
      S.clear();
      for (var k = 0; k < boxes.length; k++) {
        var B = boxes[k], n = B.P.bins.length, i = Math.floor((px - B.x0) / B.bw);
        if (px >= B.x0 && i < n && py >= B.pt - 10 && py <= B.pb + 4) {
          var b = B.P.bins[i];
          B.bars[i].attr("stroke", INK).attr("stroke-width", 1.5);
          var head = B.P.k === "liq" ? tr("District speed: " + nf(b.lo) + " to " + nf(b.hi) + " days", "Tốc độ của quận: " + nf(b.lo) + " đến " + nf(b.hi) + " ngày")
            : tr("Price gap: " + H.spct(b.lo / 100, 0) + " to " + H.spct(b.hi / 100, 0), "Chênh giá: " + H.spct(b.lo / 100, 0) + " đến " + H.spct(b.hi / 100, 0));
          var sub = B.P.k === "liq" ? tr("Median age of the other listings in the district.", "Tuổi trung vị của các tin khác trong quận.") : tr("Asking price compared with the model's out-of-sample value.", "Giá rao so với giá trị mô hình ước tính trên dữ liệu không dùng để huấn luyện.");
          return { key: B.P.k + i, node: H.card({ h: head, sw: BAR, rows: [[L("on"), H.pct(b.rate, 0)], [L("rng"), nf(b.wl * 100) + "–" + H.pct(b.wh, 0)], [L("n"), nf(b.n)]],
            m: [tr("Of these " + nf(b.n) + " listings, " + H.pct(b.rate, 0) + " were still online after 180 days.", "Trong " + nf(b.n) + " tin này, " + H.pct(b.rate, 0) + " vẫn còn trên mạng sau 180 ngày."), sub] }) };
        }
      }
      return null;
    };
    var rg = function (a) { return (d3.max(a, function (b) { return b.rate; }) - d3.min(a, function (b) { return b.rate; })) * 100; }, gr = rg(d.gap), lr = rg(d.liq);
    if (lr >= 2 * gr) take(S.fig, tr("Stale listings are not mainly the overpriced ones: the stale share changes less across price gaps (it is highest for listings priced below the model's value) than across districts, and listings in slow districts are much more likely to sit.",
      "Tin ế không chủ yếu là tin rao giá cao: tỷ lệ ế thay đổi theo mức chênh giá ít hơn so với theo quận (cao nhất ở các tin rao thấp hơn giá trị mô hình), còn tin ở các quận chậm thì dễ nằm lâu hơn nhiều."));
    else take(S.fig, tr("The stale share differs by " + nf(gr) + " percentage points across price gaps and by " + nf(lr) + " points across district speeds.",
      "Tỷ lệ ế chênh " + nf(gr) + " điểm phần trăm giữa các mức chênh giá và " + nf(lr) + " điểm giữa các tốc độ của quận."));
  }

  // 5. bubbles
  function shortName(n) { return H.pn(n, true); }

  function segLines(segs) {
    var out = {};
    if (!segs || !segs.length) return out;
    function word(v, a, k) {
      var o = segs.map(function (s) { return s[k]; }).filter(function (x) { return x !== v; });
      if (v >= 1.15 * Math.max.apply(null, o)) return a[0];
      if (v * 1.15 <= Math.min.apply(null, o)) return a[1];
      return a[2];
    }
    segs.forEach(function (s) {
      var p = word(s.ppm2_med, [tr("highest prices", "giá cao nhất"), tr("lowest prices", "giá thấp nhất"), tr("prices close to the other types", "giá gần với các nhóm khác")], "ppm2_med");
      var a = word(s.age_med, [tr("listings stay online longest", "tin nằm trên mạng lâu nhất"), tr("listings stay online the shortest time", "tin nằm trên mạng ngắn nhất"), tr("listing age close to the others", "tuổi tin gần với các nhóm khác")], "age_med");
      out[s.seg] = H.seg(s.seg).name + ": " + p + "; " + a + ". " + tr("Median of the type: ", "Trung vị của nhóm: ") + H.ppm2(s.ppm2_med) + ", " + H.days(Math.round(s.age_med)) + ".";
    });
    return out;
  }

  function bubbles(fig) {
    var S = make(fig, function () {
      return Promise.all([H.load("districts"), H.load("segments").catch(function () { return []; })]).then(function (r) { return { ds: r[0], segs: r[1] }; });
    }, drawBubbles, ["Grouping of 34 districts with at least 30 listings; the four types are loose groups, not sharp clusters.", "Gộp 34 quận có từ 30 tin trở lên; bốn kiểu là các nhóm lỏng, không phải cụm tách bạch."]);
    S.ctl = ctl(fig); S.both = false; S.hlKey = H.st.d || null; S.dim = null; S.last = null;
    H.on("state", function () { if (S.d && S.cur !== H.st.c) S.render(); });
    H.on("hover-district", function (e) { S.hlKey = e ? e.key : null; if (S.paint) S.paint(); });
  }

  function drawBubbles(S) {
    var w = S.w, nar = w < 600, T = Math.round(w * (nar ? 1.25 : 0.75)), h, cur = H.st.c, f = fs(S), self = S;
    var ds = S.d.ds.filter(function (q) { return q.seg != null; }).map(function (q) {
      var c = q.city === "hn" || q.city === "hcm" ? q.city : H.cityOf(q.city);
      return { q: q, c: c, x: q.age_med, y: q.ppm2_med };
    });
    if (!ds.length) throw new Error("districts: none");
    S.cur = cur;
    var lines = segLines(S.d.segs);
    pills(S.ctl, [["hn", H.city("hn")], ["hcm", H.city("hcm")], ["both", tr("Both", "Cả hai")]], S.both ? "both" : cur, function (v) {
      if (v === "both") { S.both = true; S.render(); } else { S.both = false; if (H.st.c === v) S.render(); else H.set({ c: v }); }
    }, tr("City", "Thành phố"));
    var m = nar ? { t: 8, r: 10, b: 50, l: 44 } : { t: 10, r: 14, b: 52, l: 58 };
    var rmax = nar ? 16 : 26, nmax = d3.max(ds, function (p) { return p.q.n; });
    ds.forEach(function (p) { p.r = Math.max(4, rmax * Math.sqrt(p.q.n / nmax)); });
    // legend block under the plot: four types, size key, city cue (Both); the plot gets what is left of the fixed height T
    var lg = H.SEG.map(function (s) {
      return { kind: "box", col: H.SEGC[s], txt: H.seg(s).name, on: !S.dim || S.dim === s, pressed: S.dim === s, tip: tr("Click to show only this type", "Bấm để chỉ hiện kiểu này"),
        fn: function () { self.dim = self.dim === s ? null : s; self.render(); } };
    }), nl = 1, xx = 0;
    lg.forEach(function (it) { var iw = 18 + H.textW(it.txt, 12) + 14; if (xx && xx + iw > w - 8) { nl++; xx = 0; } xx += iw; });
    var refs = [30, 100, 300].filter(function (n) { return n <= nmax * 1.1; }), rr = function (n) { return Math.max(4, rmax * Math.sqrt(n / nmax)); }, kh = 2 * rr(refs[refs.length - 1]) + 6;
    h = T - nl * 18 - kh - (S.both ? 22 : 8);
    if (!S.both) ds = ds.filter(function (p) { return p.c === cur; }); // one city at a time unless "Both"; axes fit the city shown
    var xe = d3.extent(ds, function (p) { return p.x; }), ye = d3.extent(ds, function (p) { return p.y; });
    var x = d3.scaleLog().domain([xe[0] / 1.12, xe[1] * 1.12]).range([m.l, w - m.r]), y = d3.scaleLog().domain([ye[0] / 1.15, ye[1] * 1.15]).range([h - m.b, m.t]);
    var svg = mk(S, w, T, tr("Districts by listing age and price per square metre", "Các quận theo tuổi tin và giá mỗi mét vuông")), g = svg.append("g");
    var yt = thin([20, 30, 50, 70, 100, 150, 200, 300, 500].filter(function (t) { return t >= y.domain()[0] && t <= y.domain()[1]; }), y, 26);
    var xt = thin([20, 30, 45, 60, 90, 120, 180, 240, 365, 500, 730, 1000].filter(function (t) { return t >= x.domain()[0] && t <= x.domain()[1]; }), x, 40);
    axY(g, y, yt, m.l, w - m.r, function (t) { return nf(t); });
    axX(g, x, xt, h - m.b, function (t) { return nf(t); });
    txt(g, (m.l + w - m.r) / 2, h - 8, tr("Median listing age, days (log scale)", "Tuổi trung vị của tin, ngày (thang log)"), "middle");
    svg.append("text").attr("transform", "translate(12," + ((m.t + h - m.b) / 2) + ") rotate(-90)").attr("text-anchor", "middle")
      .text(nar ? tr("Median price, million VND/m² (log)", "Giá trung vị, triệu đồng/m² (log)") : tr("Median asking price, million VND/m² (log scale)", "Giá rao trung vị, triệu đồng/m² (thang log)"));
    var front = function (p) { return S.both || p.c === cur ? 1 : 0; };
    ds.sort(function (a, b) { return front(a) - front(b) || b.r - a.r; });
    function op(p) { return (S.dim && S.dim !== p.q.seg) ? 0.1 : (S.both || p.c === cur ? 0.75 : 0.3); }
    var dots = g.selectAll("circle").data(ds).enter().append("circle").attr("cx", function (p) { return x(p.x); }).attr("cy", function (p) { return y(p.y); }).attr("r", function (p) { return p.r; })
      .attr("fill", function (p) { return H.SEGC[p.q.seg]; }).attr("fill-opacity", op);
    S.paint = function () { // outline: accent for the highlighted district (named), thin ink ring for Hanoi in the Both view
      var hi = function (p) { return p.q.key === S.hlKey; }, ring = function (p) { return S.both && p.c === "hn"; };
      dots.attr("stroke", function (p) { return hi(p) ? ACC : ring(p) ? INK : "#fff"; }).attr("stroke-width", function (p) { return hi(p) ? 2 : ring(p) ? 1.5 : 1; });
      g.selectAll(".hs-hl").remove();
      dots.filter(hi).raise().each(function (p) {
        var t = shortName(p.q.name), px = x(p.x) + p.r + 4, right = px + H.textW(t, f) < w - 4;
        txt(g, right ? px : x(p.x) - p.r - 4, y(p.y), t, right ? "start" : "end", "hs-halo k hs-hl").attr("dy", "0.34em");
      });
    };
    var ly = h + 6, ky = ly + legend(svg, lg, 4, ly, w - 8) + 2, kx = 4, kt = tr("Size: listings", "Cỡ: số tin");
    txt(svg, kx, ky + kh / 2, kt, "start").attr("dy", "0.34em");
    kx += H.textW(kt, 12) + 12;
    refs.forEach(function (n) {
      var r = rr(n);
      svg.append("circle").attr("cx", kx + r).attr("cy", ky + kh / 2).attr("r", r).attr("fill", "none").attr("stroke", MUTED);
      txt(svg, kx + 2 * r + 4, ky + kh / 2, nf(n), "start").attr("dy", "0.34em");
      kx += 2 * r + 4 + H.textW(nf(n), 12) + 14;
    });
    if (S.both) {
      var ct = tr("City (outline):", "Thành phố (viền):"), cy = ky + kh + 8, cx = 4 + H.textW(ct, 12) + 12;
      txt(svg, 4, cy, ct, "start").attr("dy", "0.34em");
      [["hn", INK, 1.5], ["hcm", "#fff", 1]].forEach(function (c) {
        svg.append("circle").attr("cx", cx + 6).attr("cy", cy).attr("r", 6).attr("fill", "#d9d6cc").attr("stroke", c[1]).attr("stroke-width", c[2]);
        txt(svg, cx + 16, cy, H.city(c[0]), "start").attr("dy", "0.34em");
        cx += 16 + H.textW(H.city(c[0]), 12) + 16;
      });
    }
    var lit = ds.filter(function (p) { return S.both || p.c === cur; }).sort(function (a, b) { return b.q.n - a.q.n; }).slice(0, nar ? 8 : 40).map(function (p) {
      var t = shortName(p.q.name);
      return { x: x(p.x), y: y(p.y), w: H.textW(t, f - 1) + 2, h: 14, pr: p.q.n + (p.q.seg === "Prime core" ? 1000 : 0), txt: t, r: p.r };
    });
    var blocks = ds.map(function (p) { return { x: x(p.x), y: y(p.y), w: 2 * p.r, h: 2 * p.r, block: true, pr: 0 }; });
    H.place(lit.concat(blocks), { w: w, h: h }).forEach(function (p) { lab(g, p, "k"); });
    S.paint();
    S.clear = function () { if (S.last) { S.last = null; H.emit("hover-district", null); } };
    S.pick = function (px, py) {
      var best = null, bd = 1e9;
      ds.forEach(function (p) { if (Math.hypot(x(p.x) - px, y(p.y) - py) <= p.r + 4 && p.r < bd) { bd = p.r; best = p; } });
      return best && best.q.key;
    };
    S.hit = function (px, py) {
      var k = S.pick(px, py), best = ds.filter(function (p) { return p.q.key === k; })[0];
      if (!best) { S.clear(); return null; }
      var q = best.q;
      if (S.last !== q.key) { S.last = q.key; H.emit("hover-district", { key: q.key }); }
      var sg = H.seg(q.seg), ms = [];
      if (lines[q.seg]) ms.push(lines[q.seg]);
      ms.push(tr("Click, or tap again, to value a home in this district.", "Bấm, hoặc chạm lần nữa, để định giá một căn trong quận này."));
      return { key: q.key, node: H.card({ h: H.pn(q.name) + " · " + H.city(best.c), sw: sg.color,
        rows: [[tr("Market type", "Kiểu thị trường"), sg.name], [L("ask"), H.ppm2(q.ppm2_med)], [tr("Median listing age", "Tuổi trung vị của tin"), H.days(Math.round(q.age_med))],
          [L("n"), nf(q.n)], [L("on"), q.stale_rate == null ? "–" : H.pct(q.stale_rate, 0)]], m: ms }) };
    };
    if (!S.bound) {
      S.bound = true;
      S.plot.addEventListener("click", function (ev) {
        var b = S.plot.getBoundingClientRect(), k = S.pick && S.pick(ev.clientX - b.left, ev.clientY - b.top);
        if (!k) { S.tap = null; return; }
        if (ev.pointerType === "touch" && S.tap !== k) { S.tap = k; return; }
        S.tap = null;
        H.set({ d: k });
        H.emit("pick-district", { key: k });
      });
    }
  }

  // mount
  function mount() {
    var jobs = { gradient: gradient, stale: stale, bubbles: bubbles, legalmap: function (f) { f.remove(); } };
    Object.keys(jobs).forEach(function (name) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-hs="' + name + '"]'), function (fig) {
        if (fig.hasAttribute("data-teaser")) return;
        try { jobs[name](fig); } catch (e) { H.fail(fig, e); }
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
