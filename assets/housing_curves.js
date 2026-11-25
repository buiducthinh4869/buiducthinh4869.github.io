/* Housing atlas, section 3: what do buyers pay for?
   Small multiples of the valuation model's answer for one typical home: change one feature (plot size, access road,
   frontage, floors, legal papers), hold the rest at the typical home of the type, read the model's value.
   Data: curves.json (scripts/build_housing_curves.js runs the site's engine on the saved models), premiums.json
   (the one tested listing comparison that passed: street front vs alley). Needs housing_core.js and D3. */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H || !window.d3) return;
  var V = H.svg, ln = V.ln, txt = V.txt;
  var INK = "#23272b", MUTED = "#6b6f72", RULE = "#e4e1d8", LINE = "#8f5a32", FILLP = "rgba(173,122,69,0.16)", FILLN = "rgba(107,111,114,0.12)";
  var TYPES = ["Nhà hẻm/ngõ", "Nhà mặt tiền/phố", "Biệt thự/liền kề", "Đất", "Căn hộ chung cư"];

  var TX = {
    en: {
      city: "City", type: "Type of home",
      area: "Plot size", road: "Access road width", frontage: "Frontage", floors: "Floors", legal: "Legal papers",
      uArea: "m² (log scale)", uRoad: "m", uFront: "m", uFloors: "floors",
      yRel: "Model value vs the typical home", yPpm: "Price per m² vs the typical home",
      typical: "typical", base: "The typical {t} here: {a} m², {f} floors, {fr} m frontage, on a {r} m road, red or pink book, in {d}: valued at {v}.",
      baseApt: "The typical apartment here: {a} m², red or pink book, in {d}: valued at {v}.",
      baseLand: "The typical plot of land here: {a} m², {fr} m frontage, on a {r} m road, red or pink book, in {d}: valued at {v}.",
      tVal: "Model value", tPpm: "Price per m²", tRel: "vs the typical home", tHeld: "Everything else held at the typical home.",
      takeMost: "For a typical {t} in {d}, the model's value moves most with {f}: from {lo} to {hi} of the typical home's value across the range shown.",
      takeStreet: "Across all houses, street-front houses are usually asked about {p} more than similar alley houses in the same former district (roughly {a} to {b}).",
      legalN: { "Sổ đỏ/Sổ hồng": "Red or pink book", "Hợp đồng mua bán": "Sale contract", "Đang chờ sổ": "Certificate pending", "Khác/không rõ": "Other or unknown" },
      src: "Source: mogi.vn listings, 15 Oct 2026; the site's valuation model (gradient-boosted trees); author's calculations.",
      note: "These are the model's valuations, not measured effects: each panel changes one feature of the typical home and keeps the rest. Steps come from the tree model. Ranges stay inside what the listings cover. The street-front figure above is a separate comparison of listings that passed its checks.",
      fail: "The data for this figure could not be loaded."
    },
    vi: {
      city: "Thành phố", type: "Loại nhà",
      area: "Diện tích lô", road: "Độ rộng đường vào", frontage: "Mặt tiền", floors: "Số tầng", legal: "Giấy tờ",
      uArea: "m² (thang log)", uRoad: "m", uFront: "m", uFloors: "tầng",
      yRel: "Giá mô hình so với căn điển hình", yPpm: "Giá mỗi m² so với căn điển hình",
      typical: "điển hình", base: "Căn {t} điển hình ở đây: {a} m², {f} tầng, mặt tiền {fr} m, đường vào {r} m, sổ đỏ/sổ hồng, tại {d}: mô hình định giá {v}.",
      baseApt: "Căn hộ điển hình ở đây: {a} m², sổ đỏ/sổ hồng, tại {d}: mô hình định giá {v}.",
      baseLand: "Lô đất điển hình ở đây: {a} m², mặt tiền {fr} m, đường vào {r} m, sổ đỏ/sổ hồng, tại {d}: mô hình định giá {v}.",
      tVal: "Giá mô hình", tPpm: "Giá mỗi m²", tRel: "so với căn điển hình", tHeld: "Các đặc điểm khác giữ như căn điển hình.",
      takeMost: "Với một căn {t} điển hình ở {d}, giá mô hình thay đổi nhiều nhất theo {f}: từ {lo} đến {hi} giá của căn điển hình trong khoảng đang xét.",
      takeStreet: "Xét mọi nhà riêng, nhà mặt tiền thường được rao cao hơn nhà hẻm tương tự trong cùng quận cũ khoảng {p} (khoảng {a} đến {b}).",
      legalN: { "Sổ đỏ/Sổ hồng": "Sổ đỏ/sổ hồng", "Hợp đồng mua bán": "Hợp đồng mua bán", "Đang chờ sổ": "Đang chờ sổ", "Khác/không rõ": "Khác/không rõ" },
      src: "Nguồn: tin rao mogi.vn, 15/10/2026; mô hình định giá của trang (cây tăng cường gradient); tác giả tính toán.",
      note: "Đây là giá do mô hình đưa ra, không phải tác động đo được: mỗi ô đổi một đặc điểm của căn điển hình và giữ nguyên phần còn lại. Các bậc thang đến từ mô hình dạng cây. Khoảng giá trị nằm trong phạm vi tin rao có. Con số nhà mặt tiền ở trên là một phép so sánh tin rao riêng, đã qua các bước kiểm tra.",
      fail: "Không tải được dữ liệu cho hình này."
    }
  };
  function tx(k) { return TX[H.lang()][k]; }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }
  function pc(x) { return H.spct(x, Math.abs(x) < 0.1 ? 1 : 0); }
  function tname(t) { return H.type(t).toLowerCase(); }

  function mount(fig) {
    var st = { c: H.st.c === "hcm" ? "hcm" : "hn", t: "Nhà hẻm/ngõ" }, C = null, P = null;
    var bar = H.el("div", "hs-bar"), gC = H.el("span", "hs-group"), gT = H.el("span", "hs-group hc-types");
    bar.appendChild(gC); bar.appendChild(gT);
    var plot = fig.querySelector(".hs-plot"); fig.insertBefore(bar, plot);
    var baseP = H.el("p", "hc-base"); fig.insertBefore(baseP, plot);
    function pills(g, vals, cur, lab, fn) {
      g.textContent = ""; g.setAttribute("role", "group");
      vals.forEach(function (v) {
        var b = H.el("button", "hs-btn", lab(v)); b.type = "button"; b.setAttribute("aria-pressed", String(v === cur));
        b.addEventListener("click", function () { fn(v); }); g.appendChild(b);
      });
    }
    function controls() {
      gC.setAttribute("aria-label", tx("city")); gT.setAttribute("aria-label", tx("type"));
      pills(gC, ["hn", "hcm"], st.c, H.city, function (v) { st.c = v; render(); });
      pills(gT, TYPES, st.t, H.type, function (v) { st.t = v; render(); });
    }
    function caption() {
      var s = fig.querySelector(".hs-src"), n = fig.querySelector(".hs-note"), f = fig.querySelector(".hs-fail");
      if (s) s.textContent = tx("src"); if (n) n.textContent = tx("note"); if (f) f.textContent = tx("fail");
    }
    function take(o) {
      var sec = fig.closest(".at-sec"), p = sec && sec.querySelector(".hs-take");
      if (!p) return;
      var out = [], best = null;
      ["road", "frontage", "floors"].forEach(function (k) { // value panels only (plot size is per m²)
        var a = o.f[k]; if (!a) return;
        var lo = d3.min(a, function (q) { return q[1]; }), hi = d3.max(a, function (q) { return q[1]; });
        if (!best || hi - lo > best.hi - best.lo) best = { k: k, lo: lo, hi: hi };
      });
      if (best && best.hi - best.lo > 0.02) out.push(fill(tx("takeMost"), { t: tname(st.t), d: H.pn(o.district), f: tx(best.k).toLowerCase(), lo: H.pct(best.lo, 0), hi: H.pct(best.hi, 0) }));
      var r = P && P.rows ? P.rows.filter(function (x) { return x.attr === "street" && x.gate === "PASS" && x.prem != null; })[0] : null;
      if (r && st.t !== "Căn hộ chung cư" && st.t !== "Đất") out.push(fill(tx("takeStreet"), { p: H.pct(r.prem, 0), a: H.pct(r.lo, 0), b: H.pct(r.hi, 0) }));
      p.textContent = out.join(" "); p.hidden = !out.length;
    }
    function render() {
      controls(); caption();
      if (!C) return;
      var o = C.cities[st.c][st.t];
      take(o);
      var apt = st.t === "Căn hộ chung cư";
      baseP.textContent = fill(tx(apt ? "baseApt" : st.t === "Đất" ? "baseLand" : "base"), { t: tname(st.t), a: H.nf(o.base.area, 0), f: H.nf(o.base.floors, 0), fr: H.nf(o.base.frontage, 1),
        r: H.nf(o.base.road, 1), d: H.pn(o.district), v: H.bn(o.base.fv) });
      var keys = ["area", "road", "frontage", "floors", "legal"].filter(function (k) { return o.f[k]; });
      // one y domain for all panels of this home, so the panels compare
      var all = [];
      keys.forEach(function (k) { o.f[k].forEach(function (q) { all.push(q[1] - 1); }); });
      var lo = Math.min(-0.1, d3.min(all)), hi = Math.max(0.1, d3.max(all)), pad = (hi - lo) * 0.08;
      var y0 = lo - pad, y1 = hi + pad;
      plot.textContent = ""; plot.style.minHeight = "0";
      var grid = H.el("div", "hc-grid"); plot.appendChild(grid);
      keys.forEach(function (k) { panel(grid, o, k, [y0, y1]); });
    }
    function panel(grid, o, k, yd) {
      var box = H.el("div", "hc-p"), legal = k === "legal";
      box.appendChild(H.el("p", "hc-t", tx(k)));
      box.appendChild(H.el("p", "hc-s", k === "area" ? tx("yPpm") : tx("yRel")));
      grid.appendChild(box);
      var w = Math.max(240, box.clientWidth || 300), h = legal ? 150 : 176, m = { l: 46, r: 14, t: 10, b: legal ? 12 : 36 };
      var svg = d3.select(box).append("svg").attr("class", "hs-svg").attr("width", w).attr("height", h).attr("viewBox", "0 0 " + w + " " + h)
        .attr("role", "img").attr("aria-label", tx(k) + " · " + H.type(st.t) + " · " + H.city(st.c));
      var g = svg.append("g"), pts = o.f[k];
      var LW = 128, y = d3.scaleLinear().domain(yd).range(legal ? [LW + 8, w - m.r - 44] : [h - m.b, m.t]);
      var step = (yd[1] - yd[0]) > 0.8 ? 0.2 : (yd[1] - yd[0]) > 0.35 ? 0.1 : 0.05;
      var yt = d3.range(Math.ceil(yd[0] / step) * step, yd[1] + 1e-9, step).map(function (v) { return Math.round(v * 100) / 100; });
      var hit;
      if (legal) {
        var bw = 20, gap = 9, top = m.t;
        yt.forEach(function (t) { ln(g, y(t), top, y(t), h - m.b, t === 0 ? MUTED : RULE); });
        pts.forEach(function (q, i) {
          var yy = top + i * (bw + gap), v = q[1] - 1;
          txt(g, 0, yy + bw / 2, TX[H.lang()].legalN[q[0]] || q[0], "start").attr("dy", "0.34em").attr("class", "k");
          g.append("rect").attr("x", Math.min(y(0), y(v))).attr("y", yy).attr("width", Math.max(1.5, Math.abs(y(v) - y(0)))).attr("height", bw)
            .attr("fill", i === 0 ? MUTED : LINE).attr("data-i", i);
          txt(g, Math.max(y(0), y(v)) + 5, yy + bw / 2, i === 0 ? tx("typical") : pc(v), "start").attr("dy", "0.34em").attr("class", "hs-halo");
        });
        hit = function (px, py) {
          var i = Math.floor((py - top) / (bw + gap));
          if (i < 0 || i >= pts.length) return null;
          return { key: k + i, node: card(o, k, pts[i]) };
        };
      } else {
        var isA = k === "area", xs = pts.map(function (q) { return q[0]; });
        var x = (isA ? d3.scaleLog() : d3.scaleLinear()).domain(d3.extent(xs)).range([m.l, w - m.r]);
        V.axY(g, y, yt, m.l, w - m.r, function (t) { return t === 0 ? "0" : H.spct(t, 0); });
        ln(g, m.l, y(0), w - m.r, y(0), MUTED).attr("stroke-dasharray", "3 3");
        var xt = isA ? V.thin([10, 15, 20, 30, 40, 50, 70, 100, 150, 200, 300, 500, 700, 1000].filter(function (t) { return t >= x.domain()[0] && t <= x.domain()[1]; }), x, 30) : V.thin(x.ticks(6), x, 30);
        V.axX(g, x, xt, h - m.b, function (t) { return H.nf(t, 0); });
        txt(g, (m.l + w - m.r) / 2, h - 3, tx(k === "area" ? "uArea" : k === "road" ? "uRoad" : k === "frontage" ? "uFront" : "uFloors"), "middle");
        var area = d3.area().x(function (q) { return x(q[0]); }).y0(y(0)).y1(function (q) { return y(q[1] - 1); }).curve(d3.curveStepAfter);
        g.append("path").attr("d", area(pts)).attr("fill", FILLP);
        g.append("path").attr("d", d3.line().x(function (q) { return x(q[0]); }).y(function (q) { return y(q[1] - 1); }).curve(d3.curveStepAfter)(pts))
          .attr("fill", "none").attr("stroke", LINE).attr("stroke-width", 2);
        var bx = isA ? o.base.area : o.base[k];
        if (bx != null && bx >= x.domain()[0] && bx <= x.domain()[1]) {
          g.append("circle").attr("cx", x(bx)).attr("cy", y(0)).attr("r", 4.5).attr("fill", "#faf9f5").attr("stroke", INK).attr("stroke-width", 1.6);
          txt(g, x(bx), y(0) - 9, tx("typical"), "middle").attr("class", "hs-halo k");
        }
        var guide = ln(g, 0, m.t, 0, h - m.b, INK).style("display", "none").attr("stroke-dasharray", "2 2");
        var dot = g.append("circle").attr("r", 4).attr("fill", LINE).style("display", "none");
        hit = function (px) {
          if (px < m.l - 6 || px > w - m.r + 6) { guide.style("display", "none"); dot.style("display", "none"); return null; }
          var xv = x.invert(px), j = 0;
          for (var i = 0; i < pts.length; i++) if (pts[i][0] <= xv) j = i;
          var q = pts[j];
          guide.attr("x1", x(q[0])).attr("x2", x(q[0])).style("display", null);
          dot.attr("cx", x(q[0])).attr("cy", y(q[1] - 1)).style("display", null);
          return { key: k + j, node: card(o, k, q) };
        };
        box.addEventListener("pointerleave", function () { guide.style("display", "none"); dot.style("display", "none"); });
      }
      box._hit = hit;
    }
    function card(o, k, q) {
      var rows = [], v = q[1] - 1, isA = k === "area";
      if (k === "legal") rows.push([tx("legal"), TX[H.lang()].legalN[q[0]] || q[0]]);
      else rows.push([tx(k), H.nf(q[0], k === "area" || k === "floors" ? 0 : 1) + " " + (k === "floors" ? tx("uFloors") : "m" + (isA ? "²" : ""))]);
      if (isA) rows.push([tx("tPpm"), H.ppm2(o.base.ppm2 * q[1])]);
      else rows.push([tx("tVal"), H.bn(o.base.fv * q[1])]);
      rows.push([tx("tRel"), Math.abs(v) < 0.005 ? "±0%" : pc(v)]);
      return H.card({ h: H.type(st.t) + " · " + H.city(st.c), rows: rows, m: [tx("tHeld")] });
    }
    H.hover(plot, function (px, py, ev) {
      var t = ev && ev.target, box = t && t.closest ? t.closest(".hc-p") : null;
      if (!box || !box._hit) return null;
      var sv = box.querySelector("svg").getBoundingClientRect(), pb = plot.getBoundingClientRect();
      return box._hit(px - (sv.left - pb.left), py - (sv.top - pb.top));
    });
    var rt = 0, lastW = 0;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (C && plot.clientWidth !== lastW) { lastW = plot.clientWidth; render(); } }, 150); });
    H.onLang(render);
    H.on("state", function () { if (H.st.c && H.st.c !== st.c) { st.c = H.st.c; render(); } });
    controls(); caption();
    H.lazy(fig, function () {
      Promise.all([H.load("curves"), H.load("premiums").catch(function () { return null; })]).then(function (r) {
        C = r[0]; P = r[1]; lastW = plot.clientWidth; render();
      }).catch(function (e) { H.fail(fig, e); });
    });
  }

  function start() { document.querySelectorAll('figure[data-hs="curves"]').forEach(mount); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
