/* Housing atlas, sections 7 to 9 (version 2.0; the period map of section 7 was removed 2026-11-28, section 1 plays by year): how prices changed, prices near a place, where prices rose fastest.
   Needs housing_core.js (window.Housing) and D3 7.9.0. Data: index.json, change.json, places.json, wards_<c>.json
   (written by PROJ\code\v2\web\export_web_v2.py). Each figure fails on its own (H.fail).
   Section 9 filters 7 and 8: a click on a former district emits "pick-change" {c, d}. */
(function () {
  "use strict";
  var H = window.Housing, d3 = window.d3;
  if (!H || !d3) return;
  var INK = "#23272b", MUTED = "#6b6f72", RULE = "#e4e1d8", ACC = "#1f5f7a", PAPER = "#faf9f5";
  var TX = {
    en: {
      city: "City", group: "Type of home", all: "All homes", house: "Houses (with villas)", apartment: "Apartments", land: "Land",
      idx: "Price index", rng: "90% range", n: "Listings", per: "Period", first: "first period = 100",
      takeIdx: "From {a} to {b}, asking prices per m² for {g} in {c} rose about {p} (90% range {lo} to {hi}).",
      takeFall: "From {a} to {b}, asking prices per m² for {g} in {c} changed about {p} (90% range {lo} to {hi}).",
      srcIdx: "Source: listings on mogi.vn (live and archived pages) and alonhadat.com.vn (archived pages), 2019 to 2026; author's calculations.",
      noteIdx: "Asking prices per m², nominal (not adjusted for inflation). Each period is two years; Hanoi starts in 2020. Listings are compared with others in the same ward, of the same type, size class and source. The band holds the true index with 90% probability.",
      noLive: "Hanoi: the line leaves out the listings collected live from mogi.vn in November 2026; with them, the last two periods moved outside the band.",
      dLine: "{d} (former district)", clear: "Show the city only",
      play: "Play", pause: "Pause", from: "From", to: "to", frame: "Period",
      lgMap: "Asking price per m² vs the city in the same period", lgFew: "Fewer than 10 listings",
      srcMap: "Source: as above; ward boundaries after July 2025 (vietnamese-provinces-database, MIT).",
      noteMap: "Each ward takes the figure of its former district; a ward with at least 10 listings in the period shows its own figure. Adjusted for type, size class and source; 1 = the city in that period. Hatched: fewer than 10 listings.",
      tWard: "Ward figure", tDist: "Former district figure", tNone: "Fewer than 10 listings in this period",
      place: "Ward, commune or street (new or old name)", hint: "Type at least two letters, then pick a place from the list.",
      kWard: "ward or commune (new)", kDistrict: "former district", kStreet: "street", kAlias: "former ward, now in {w}",
      kCity: "city", ppm: "About {v}", ppmNote: "2024 to 2026, {n} listings; for a home of the city's usual mix of type and size.",
      few: "Not enough data yet: {n} listings in 2024 to 2026 (at least {m} needed).", vsD: "{x} times the former district ({v})", vsC: "{x} times the city ({v})",
      trend: "Price per m² by period (million VND)", fewP: "fewer than 10 listings",
      srcPlace: "Source: as in section 7; asking prices, nominal; streets as written in the listings.",
      notePlace: "A place shows a figure only with at least 10 listings; each period of the trend needs 10 listings of its own.",
      rise: "Change from {a} to 2025–26", noRise: "Not enough former districts with 30 listings in both periods yet.",
      takeRise: "In {c}, asking prices per m² rose most in {top} (about {p}) and least in {bot} ({q}).",
      srcRise: "Source: as in section 7.", noteRise: "Change in the price index of section 7 within each former district with at least 30 listings in the first and the last period; bars show the 90% range. Click a district to see it in sections 7 and 8.",
      clickD: "Click to see this district in sections 7 and 8.", tapD: "Tap again to see this district in sections 7 and 8.",
      nFirst: "Listings, first period", nLast: "Listings, 2025–26", nums: "Numbers behind the chart", fail: "The data for this figure could not be loaded."
    },
    vi: {
      city: "Thành phố", group: "Loại nhà", all: "Mọi loại nhà", house: "Nhà ở (gồm biệt thự)", apartment: "Căn hộ", land: "Đất",
      idx: "Chỉ số giá", rng: "Khoảng 90%", n: "Số tin", per: "Kỳ", first: "kỳ đầu = 100",
      takeIdx: "Từ {a} đến {b}, giá rao mỗi m² của {g} ở {c} tăng khoảng {p} (khoảng 90% từ {lo} đến {hi}).",
      takeFall: "Từ {a} đến {b}, giá rao mỗi m² của {g} ở {c} thay đổi khoảng {p} (khoảng 90% từ {lo} đến {hi}).",
      srcIdx: "Nguồn: tin rao trên mogi.vn (trang trực tiếp và trang lưu trữ) và alonhadat.com.vn (trang lưu trữ), 2019 đến 2026; tác giả tính toán.",
      noteIdx: "Giá rao mỗi m², danh nghĩa (chưa trừ lạm phát). Mỗi kỳ là hai năm; Hà Nội bắt đầu từ 2020. Mỗi tin được so với các tin khác cùng phường, cùng loại nhà, cùng nhóm diện tích và cùng nguồn. Dải mờ chứa chỉ số thật với xác suất 90%.",
      noLive: "Hà Nội: đường này không gồm các tin thu trực tiếp từ mogi.vn vào tháng 11/2026; nếu gộp vào, hai kỳ cuối lệch ra ngoài dải mờ.",
      dLine: "{d} (quận cũ)", clear: "Chỉ xem cả thành phố",
      play: "Chạy", pause: "Dừng", from: "Từ", to: "đến", frame: "Kỳ",
      lgMap: "Giá rao mỗi m² so với cả thành phố cùng kỳ", lgFew: "Dưới 10 tin",
      srcMap: "Nguồn: như trên; ranh giới phường sau tháng 7/2025 (vietnamese-provinces-database, giấy phép MIT).",
      noteMap: "Mỗi phường lấy số của quận cũ chứa nó; phường có từ 10 tin trở lên trong kỳ dùng số của chính phường. Đã điều chỉnh theo loại nhà, nhóm diện tích và nguồn; 1 = cả thành phố trong kỳ đó. Gạch chéo: dưới 10 tin.",
      tWard: "Số của phường", tDist: "Số của quận cũ", tNone: "Dưới 10 tin trong kỳ này",
      place: "Phường, xã hoặc đường (tên mới hay tên cũ)", hint: "Gõ ít nhất hai chữ cái rồi chọn một nơi trong danh sách.",
      kWard: "phường, xã (mới)", kDistrict: "quận/huyện cũ", kStreet: "đường", kAlias: "phường cũ, nay thuộc {w}",
      kCity: "thành phố", ppm: "Khoảng {v}", ppmNote: "2024 đến 2026, {n} tin; quy về cơ cấu loại nhà và diện tích thông thường của thành phố.",
      few: "Chưa đủ dữ liệu: {n} tin trong 2024 đến 2026 (cần ít nhất {m}).", vsD: "gấp {x} quận cũ ({v})", vsC: "gấp {x} cả thành phố ({v})",
      trend: "Giá mỗi m² theo kỳ (triệu đồng)", fewP: "dưới 10 tin",
      srcPlace: "Nguồn: như mục 7; giá rao, danh nghĩa; tên đường theo tin rao.",
      notePlace: "Một nơi chỉ hiện số khi có từ 10 tin trở lên; mỗi kỳ của đường xu hướng cũng cần 10 tin.",
      rise: "Thay đổi từ {a} đến 2025–26", noRise: "Chưa đủ quận cũ có 30 tin ở cả hai kỳ.",
      takeRise: "Ở {c}, giá rao mỗi m² tăng mạnh nhất ở {top} (khoảng {p}) và ít nhất ở {bot} ({q}).",
      srcRise: "Nguồn: như mục 7.", noteRise: "Thay đổi của chỉ số giá ở mục 7 trong từng quận cũ có từ 30 tin ở kỳ đầu và kỳ cuối; vạch ngang là khoảng 90%. Bấm vào một quận để xem quận đó ở mục 7 và 8.",
      clickD: "Bấm để xem quận này ở mục 7 và 8.", tapD: "Chạm lần nữa để xem quận này ở mục 7 và 8.",
      nFirst: "Số tin, kỳ đầu", nLast: "Số tin, 2025–26", nums: "Số liệu của biểu đồ", fail: "Không tải được dữ liệu cho hình này."
    }
  };
  function tx(k) { return TX[H.lang()][k]; }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ""; }); }
  function nf(x, d) { return H.nf(x, d || 0); }
  function times(x) { return "×" + H.nf(x, 2); }
  var IX = null, CH = null, PL = null, sel = { c: "hn", d: null }; // section 9 pick, shared by 7 and 8
  function perLab(c, p) { if (p === "P1" && c === "hn") return "2020"; var q = (IX.periods || []).filter(function (x) { return x.p === p; })[0]; return q ? q.label : p; }
  function pills(g, vals, cur, lab, fn) {
    g.textContent = ""; g.setAttribute("role", "group");
    vals.forEach(function (v) {
      var b = H.el("button", "hs-btn", lab(v)); b.type = "button"; b.setAttribute("aria-pressed", String(v === cur));
      b.addEventListener("click", function () { fn(v); }); g.appendChild(b);
    });
  }
  function caption(fig, src, note) {
    var cap = fig.querySelector("figcaption") || fig.appendChild(H.el("figcaption"));
    [["hs-src", src], ["hs-note", note], ["hs-fail", tx("fail")]].forEach(function (a) {
      var p = cap.querySelector("." + a[0]); if (!p) { p = H.el("p", a[0]); cap.appendChild(p); }
      p.textContent = a[1];
    });
  }
  function take(fig, s) { var sec = fig.closest(".at-sec"), p = sec && sec.querySelector(".hs-take"); if (p) p.textContent = s || ""; }
  function svgEl(plot, w, h) {
    plot.textContent = "";
    return d3.select(plot).append("svg").attr("width", w).attr("height", h).attr("viewBox", "0 0 " + w + " " + h)
      .attr("font-family", '"Be Vietnam Pro", system-ui, sans-serif').attr("font-size", w < 600 ? 11 : 12);
  }
  function cityTxt(c) { return H.city(c); }

  // ------------------------------------------------------------------ section 7: index lines
  function indexFig(fig) {
    var bar = H.el("div", "hs-bar"), gC = H.el("div", "se-seg"), gG = H.el("div", "se-seg"), chip = H.el("button", "hs-pill");
    chip.type = "button"; chip.hidden = true;
    bar.appendChild(gC); bar.appendChild(gG); bar.appendChild(chip);
    var plot = fig.querySelector(".hs-plot"); fig.insertBefore(bar, plot);
    var nums = H.el("details", "hs-nums"), sum = H.el("summary"), tbl = H.el("table", "hs-ntab");
    nums.appendChild(sum); nums.appendChild(tbl); plot.parentNode.insertBefore(nums, plot.nextSibling);
    var st = { g: "all" }, hit = null, w = 0;
    chip.addEventListener("click", function () { sel.d = null; H.emit("pick-change", { c: sel.c, d: null }); });
    function groups() { var g = IX.cities[sel.c].groups; return ["all", "house", "apartment", "land"].filter(function (k) { return g[k]; }); }
    function series(rows, c) { return rows.map(function (r, i) { return { p: r.p, i: i, idx: r.idx, lo: r.lo, hi: r.hi, n: r.n, lab: perLab(c, r.p) }; }); }
    function distSeries() {
      if (!sel.d || !CH || !CH[sel.c]) return null;
      var r = CH[sel.c].rows.filter(function (x) { return x.d === sel.d; })[0]; if (!r) return null;
      var out = [{ p: "P1", i: 0, idx: 100, lo: 100, hi: 100, n: r.n1, lab: perLab(sel.c, "P1") }];
      ["P2", "P3", "P4"].forEach(function (p, k) { var a = r.idx[p]; if (a) out.push({ p: p, i: k + 1, idx: a[0], lo: a[1], hi: a[2], n: a[3], lab: perLab(sel.c, p) }); });
      return { name: r.name, pts: out };
    }
    function render() {
      if (!IX) return;
      var gs = groups(); if (gs.indexOf(st.g) < 0) st.g = gs[0];
      pills(gC, ["hn", "hcm"], sel.c, cityTxt, function (v) { sel.c = v; sel.d = null; H.emit("pick-change", { c: v, d: null }); });
      pills(gG, gs, st.g, tx, function (v) { st.g = v; render(); });
      gC.setAttribute("aria-label", tx("city")); gG.setAttribute("aria-label", tx("group"));
      var G = IX.cities[sel.c].groups[st.g], pts = series(G.rows, sel.c), ds = st.g === "all" ? distSeries() : null;
      chip.hidden = !ds; if (ds) chip.textContent = "× " + fill(tx("dLine"), { d: H.pn(ds.name) });
      w = plot.clientWidth || 600;
      var nar = w < 600, h = nar ? 250 : 300, m = { l: nar ? 40 : 48, r: nar ? 14 : 24, t: 30, b: 30 };
      var all = pts.concat(ds ? ds.pts : []);
      var y = d3.scaleLinear().domain([Math.min(90, d3.min(all, function (p) { return p.lo; }) * 0.95), d3.max(all, function (p) { return p.hi; }) * 1.06]).nice().range([h - m.b, m.t]);
      var x = d3.scalePoint().domain(pts.map(function (p) { return p.i; })).range([m.l + 20, w - m.r - 20]);
      var svg = svgEl(plot, w, h), col = H.CITYC[sel.c];
      svg.append("g").selectAll("line").data(y.ticks(5)).join("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y).attr("y2", y).attr("stroke", RULE);
      svg.append("g").selectAll("text").data(y.ticks(5)).join("text").attr("x", m.l - 6).attr("y", function (v) { return y(v) + 4; }).attr("text-anchor", "end").attr("fill", MUTED).text(function (v) { return nf(v); });
      svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(100)).attr("y2", y(100)).attr("stroke", MUTED).attr("stroke-dasharray", "3 3");
      svg.append("g").selectAll("text").data(pts).join("text").attr("x", function (p) { return x(p.i); }).attr("y", h - m.b + 18).attr("text-anchor", "middle").attr("fill", MUTED).text(function (p) { return p.lab; });
      svg.append("text").attr("x", m.l).attr("y", 11).attr("fill", MUTED).text(tx("idx") + " (" + tx("first") + ")");
      function draw(ps, c, dash) {
        var ar = d3.area().x(function (p) { return x(p.i); }).y0(function (p) { return y(p.lo); }).y1(function (p) { return y(p.hi); });
        svg.append("path").attr("d", ar(ps)).attr("fill", c).attr("opacity", 0.14);
        svg.append("path").attr("d", d3.line().x(function (p) { return x(p.i); }).y(function (p) { return y(p.idx); })(ps)).attr("fill", "none").attr("stroke", c).attr("stroke-width", 2).attr("stroke-dasharray", dash || null);
        svg.append("g").selectAll("circle").data(ps).join("circle").attr("cx", function (p) { return x(p.i); }).attr("cy", function (p) { return y(p.idx); }).attr("r", 4).attr("fill", c);
        svg.append("g").selectAll("text").data(ps.slice(1)).join("text").attr("x", function (p) { return x(p.i); }).attr("y", function (p) { return y(p.idx) - 9; }).attr("text-anchor", "middle").attr("fill", c).text(function (p) { return nf(p.idx); });
      }
      draw(pts, col);
      if (ds) draw(ds.pts, ACC, "5 3");
      hit = function (px) {
        var best = null; pts.forEach(function (p) { var dx = Math.abs(x(p.i) - px); if (!best || dx < best.dx) best = { dx: dx, p: p }; });
        if (!best || best.dx > 40) return null;
        var p = best.p, rows = [[tx("idx"), nf(p.idx, 1)], [tx("rng"), nf(p.lo, 1) + "–" + nf(p.hi, 1)], [tx("n"), nf(p.n)]];
        if (ds && ds.pts[p.i]) rows.push([fill(tx("dLine"), { d: H.pn(ds.name) }), nf(ds.pts[p.i].idx, 1)]);
        return { node: H.card({ h: cityTxt(sel.c) + " · " + tx(st.g) + " · " + p.lab, sw: col, rows: rows }) };
      };
      var a = pts[0], b = pts[pts.length - 1], ch = b.idx / 100 - 1;
      take(fig, fill(tx(ch >= 0 ? "takeIdx" : "takeFall"), { a: a.lab, b: b.lab, g: tx(st.g).toLowerCase(), c: cityTxt(sel.c), p: H.spct(ch, 0), lo: H.spct(b.lo / 100 - 1, 0), hi: H.spct(b.hi / 100 - 1, 0) }));
      caption(fig, tx("srcIdx"), tx("noteIdx") + (IX.cities.hn.groups.all && IX.cities.hn.groups.all.version === "without_mogi_live" && sel.c === "hn" ? " " + tx("noLive") : ""));
      sum.textContent = tx("nums");
      tbl.textContent = "";
      var hd = tbl.appendChild(H.el("tr"));
      [tx("city"), tx("group"), tx("per"), tx("idx"), tx("rng"), tx("n")].forEach(function (t) { hd.appendChild(H.el("th", null, t)); });
      ["hn", "hcm"].forEach(function (c) {
        Object.keys(IX.cities[c].groups).forEach(function (g) {
          IX.cities[c].groups[g].rows.forEach(function (r) {
            var tr = tbl.appendChild(H.el("tr")); tr.setAttribute("data-k", c + "|" + g + "|" + r.p);
            [cityTxt(c), tx(g), perLab(c, r.p), nf(r.idx, 1), nf(r.lo, 1) + "–" + nf(r.hi, 1), nf(r.n)].forEach(function (t) { tr.appendChild(H.el("td", null, t)); });
          });
        });
      });
    }
    H.hover(plot, function (px) { return hit ? hit(px) : null; });
    H.onLang(render); H.on("pick-change", render);
    window.addEventListener("resize", function () { if (IX && plot.clientWidth !== w) render(); });
    return render;
  }

  // ------------------------------------------------------------------ section 8: prices near a place
  function fold(s) { return H.ascii(String(s || "")).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  var UNITW = /^(phuong|xa|quan|huyen|thi xa|thi tran|duong|pho|ngo|hem) /;
  function placeFig(fig) {
    var box = fig.querySelector(".hs-plot"), wrap = H.el("div", "hs-search"), inp = H.el("input"), ul = H.el("ul", "hs-sugg"), out = H.el("div", "hs-place-out");
    inp.type = "search"; inp.autocomplete = "off"; inp.setAttribute("aria-autocomplete", "list");
    wrap.appendChild(inp); wrap.appendChild(ul); box.textContent = ""; box.appendChild(wrap); box.appendChild(out);
    var IDX = [], byKey = {}, cur = null, act = -1, items = [];
    function build() {
      IDX = []; byKey = {};
      PL.places.forEach(function (e) { byKey[e.c + "|" + e.k + "|" + e.id] = e; });
      PL.places.forEach(function (e) {
        if (e.k === "city") return;
        var t = fold(e.l); IDX.push({ e: e, s: t + " " + t.replace(UNITW, ""), r: { ward: 0, district: 1, street: 3 }[e.k] });
      });
      PL.alias.forEach(function (a) {
        var e = byKey[a.c + "|ward|" + a.w]; if (!e) return;
        var t = fold(a.o); IDX.push({ e: e, al: a, s: t + " " + t.replace(UNITW, ""), r: 2 });
      });
    }
    function find(q) {
      var qs = fold(q).split(" ").filter(Boolean); if (!qs.length || fold(q).length < 2) return [];
      var hits = IDX.filter(function (x) { var ws = x.s.split(" "); return qs.every(function (t) { return ws.some(function (w2) { return w2.indexOf(t) === 0; }); }); });
      hits.sort(function (a, b) { return a.r - b.r || b.e.na - a.e.na; });
      var seen = {}, outl = [];
      hits.forEach(function (x) { var k = x.e.c + x.e.k + x.e.id + (x.al ? x.al.o + x.al.od : ""); if (!seen[k] && outl.length < 8) { seen[k] = 1; outl.push(x); } });
      return outl;
    }
    function dname(e) { var d = e.d && byKey[e.c + "|district|" + e.d]; return d ? d.l : ""; }
    function label(x) {
      var e = x.e, sub;
      if (x.al) sub = fill(tx("kAlias"), { w: H.pn(e.l) }) + ", " + H.pn(x.al.od);
      else if (e.k === "ward") sub = tx("kWard") + (dname(e) ? ", " + H.pn(dname(e)) : "");
      else if (e.k === "district") sub = tx("kDistrict");
      else sub = tx("kStreet") + ", " + H.pn(dname(e));
      return { t: x.al ? (H.lang() === "vi" ? x.al.o : H.ascii(x.al.o)) : e.k === "street" && H.lang() === "en" ? H.ascii(e.l) : H.pn(e.l), s: sub + " · " + cityTxt(e.c) };
    }
    function sugg() {
      items = find(inp.value); act = -1; ul.textContent = "";
      items.forEach(function (x, i) {
        var L = label(x), li = H.el("li"); li.setAttribute("role", "option"); li.tabIndex = -1;
        li.appendChild(H.el("span", "hs-sg-t", L.t)); li.appendChild(H.el("span", "hs-sg-s", L.s));
        li.addEventListener("mousedown", function (ev) { ev.preventDefault(); pick(x); });
        li.addEventListener("click", function () { pick(x); });
        ul.appendChild(li);
      });
      ul.hidden = !items.length;
    }
    function pick(x) { cur = x; ul.hidden = true; inp.value = label(x).t; show(); }
    inp.addEventListener("input", sugg);
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault(); if (!items.length) return; act = (act + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        Array.prototype.forEach.call(ul.children, function (li, i) { li.setAttribute("aria-selected", String(i === act)); });
      } else if (ev.key === "Enter") { if (items.length) pick(items[act < 0 ? 0 : act]); } else if (ev.key === "Escape") ul.hidden = true;
    });
    inp.addEventListener("blur", function () { setTimeout(function () { ul.hidden = true; }, 150); });
    function trend(e, dd, cc) {
      var w = Math.min(out.clientWidth || 360, 560), h = 150, m = { l: 40, r: 12, t: 16, b: 26 };
      var holder = H.el("div", "hs-trend"); out.appendChild(holder);
      holder.appendChild(H.el("p", "hs-trend-h", tx("trend")));
      var plot = H.el("div"); holder.appendChild(plot);
      var ser = [[e, ACC, 2.2], [dd, MUTED, 1.2], [cc === e ? null : cc, INK, 1.2]].filter(function (s) { return s[0]; });
      var vals = []; ser.forEach(function (s) { s[0].t.forEach(function (v) { if (v != null) vals.push(v); }); });
      if (!vals.length) { plot.appendChild(H.el("p", "hs-src", tx("fewP"))); return; }
      var svg = svgEl(plot, w, h), x = d3.scalePoint().domain([0, 1, 2, 3]).range([m.l + 14, w - m.r - 14]);
      var y = d3.scaleLinear().domain([d3.min(vals) * 0.9, d3.max(vals) * 1.1]).nice(4).range([h - m.b, m.t]);
      svg.append("g").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y).attr("y2", y).attr("stroke", RULE);
      svg.append("g").selectAll("text").data(y.ticks(4)).join("text").attr("x", m.l - 5).attr("y", function (v) { return y(v) + 4; }).attr("text-anchor", "end").attr("fill", MUTED).text(function (v) { return nf(v); });
      svg.append("g").selectAll("text").data(PL.periods).join("text").attr("x", function (p, i) { return x(i); }).attr("y", h - 6).attr("text-anchor", "middle").attr("fill", MUTED).text(function (p) { return perLab(e.c, p); });
      ser.slice().reverse().forEach(function (s) {
        var pts = s[0].t.map(function (v, i) { return v == null ? null : [x(i), y(v)]; });
        svg.append("path").attr("d", d3.line().defined(function (q) { return q; })(pts)).attr("fill", "none").attr("stroke", s[1]).attr("stroke-width", s[2]);
        svg.append("g").selectAll("circle").data(pts.filter(Boolean)).join("circle").attr("cx", function (q) { return q[0]; }).attr("cy", function (q) { return q[1]; }).attr("r", s[0] === e ? 3.5 : 2).attr("fill", s[1]);
      });
      var s2 = e.t.map(function (v, i) { return v == null ? null : { x: x(i), y: y(v), v: v }; }).filter(Boolean);
      svg.append("g").selectAll("text").data(s2).join("text").attr("x", function (q) { return q.x; }).attr("y", function (q) { return q.y - 8; }).attr("text-anchor", "middle").attr("fill", ACC).text(function (q) { return nf(q.v); });
      var key = H.el("p", "hs-legend");
      [[e, ACC, label({ e: e }).t], [dd, MUTED, dd ? H.pn(dd.l) : ""], [cc === e ? null : cc, INK, cityTxt(e.c)]].forEach(function (s) {
        if (!s[0]) return; var sp = H.el("span", "hs-lgi"), sw = H.el("span", "hs-sw"); sw.style.background = s[1]; sp.appendChild(sw); sp.appendChild(document.createTextNode(s[2])); key.appendChild(sp);
      });
      holder.appendChild(key);
    }
    function show() {
      out.textContent = "";
      if (!cur) { out.appendChild(H.el("p", "hs-hint", tx("hint"))); return; }
      var e = cur.e, L = label(cur), dd = e.d ? byKey[e.c + "|district|" + e.d] : null, cc = byKey[e.c + "|city|" + e.c];
      out.setAttribute("data-k", e.c + "|" + e.k + "|" + e.id);
      out.appendChild(H.el("h3", "hs-place-h", L.t));
      out.appendChild(H.el("p", "hs-place-s", L.s));
      if (e.v != null) {
        var big = H.el("p", "hs-place-v", fill(tx("ppm"), { v: H.ppm2(e.v) })); big.setAttribute("data-v", e.v); out.appendChild(big);
        out.appendChild(H.el("p", "hs-place-n", fill(tx("ppmNote"), { n: nf(e.n) })));
        var cmp = [];
        if (dd && dd !== e && dd.v) cmp.push(fill(tx("vsD"), { x: H.nf(e.v / dd.v, 2), v: H.ppm2(dd.v) }));
        if (cc && cc.v) cmp.push(fill(tx("vsC"), { x: H.nf(e.v / cc.v, 2), v: H.ppm2(cc.v) }));
        if (cmp.length) out.appendChild(H.el("p", "hs-place-c", cmp.join(" · ")));
      } else out.appendChild(H.el("p", "hs-place-v hs-place-few", fill(tx("few"), { n: nf(e.n), m: nf(PL.min_n) })));
      trend(e, dd && dd !== e ? dd : null, cc);
    }
    function render() {
      inp.placeholder = tx("place"); inp.setAttribute("aria-label", tx("place"));
      caption(fig, tx("srcPlace"), tx("notePlace"));
      if (cur) { inp.value = label(cur).t; } show();
    }
    H.on("pick-change", function (o) {
      if (!o || !o.d) return;
      var e = byKey[o.c + "|district|" + o.d]; if (e) { cur = { e: e }; render(); }
    });
    H.onLang(render);
    return function () { build(); render(); };
  }

  // ------------------------------------------------------------------ section 9: change by former district
  function riseFig(fig) {
    var bar = H.el("div", "hs-bar"), gC = H.el("div", "se-seg"); bar.appendChild(gC);
    var plot = fig.querySelector(".hs-plot"); fig.insertBefore(bar, plot);
    var rowsY = [], w = 0, tap = null;
    function render() {
      if (!CH) return;
      pills(gC, ["hn", "hcm"], sel.c, cityTxt, function (v) { sel.c = v; sel.d = null; H.emit("pick-change", { c: v, d: null }); });
      gC.setAttribute("aria-label", tx("city"));
      var C = CH[sel.c];
      caption(fig, tx("srcRise"), tx("noteRise"));
      if (!C || C.gate !== "PASS" || !C.rows.length) { plot.textContent = tx("noRise"); take(fig, ""); return; }
      var R = C.rows, nar = (plot.clientWidth || 600) < 600; w = plot.clientWidth || 600;
      var rh = nar ? 26 : 24, m = { l: nar ? 112 : 170, r: nar ? 52 : 64, t: 24, b: 24 }, h = m.t + m.b + R.length * rh;
      var lo = Math.min(0, d3.min(R, function (r) { return r.lo; })), hi = d3.max(R, function (r) { return r.hi; });
      var x = d3.scaleLinear().domain([lo, hi]).nice().range([m.l, w - m.r]);
      var svg = svgEl(plot, w, h);
      svg.append("g").selectAll("line").data(x.ticks(nar ? 4 : 6)).join("line").attr("x1", x).attr("x2", x).attr("y1", m.t - 6).attr("y2", h - m.b).attr("stroke", RULE);
      svg.append("g").selectAll("text").data(x.ticks(nar ? 4 : 6)).join("text").attr("x", x).attr("y", h - 6).attr("text-anchor", "middle").attr("fill", MUTED).text(function (v) { return H.spct(v, 0); });
      svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t - 6).attr("y2", h - m.b).attr("stroke", MUTED);
      svg.append("text").attr("x", m.l).attr("y", 12).attr("fill", MUTED).text(fill(tx("rise"), { a: perLab(sel.c, "P1") }));
      rowsY = R.map(function (r, i) { return { r: r, y: m.t + i * rh + rh / 2 }; });
      var g = svg.append("g").selectAll("g").data(rowsY).join("g").attr("data-d", function (q) { return q.r.d; }).attr("data-ch", function (q) { return q.r.ch; }).attr("class", "hs-rise-row").style("cursor", "pointer");
      g.append("rect").attr("x", 0).attr("width", w).attr("y", function (q) { return q.y - rh / 2; }).attr("height", rh).attr("fill", function (q) { return q.r.d === sel.d ? "#c9dbe2" : "transparent"; }).attr("opacity", 0.6);
      g.append("text").attr("x", m.l - 8).attr("y", function (q) { return q.y + 4; }).attr("text-anchor", "end").attr("fill", function (q) { return q.r.d === sel.d ? ACC : INK; }).text(function (q) { return H.pn(q.r.name); });
      g.append("line").attr("x1", function (q) { return x(q.r.lo); }).attr("x2", function (q) { return x(q.r.hi); }).attr("y1", function (q) { return q.y; }).attr("y2", function (q) { return q.y; }).attr("stroke", H.CITYC[sel.c]).attr("stroke-width", 2).attr("opacity", 0.45);
      g.append("circle").attr("cx", function (q) { return x(q.r.ch); }).attr("cy", function (q) { return q.y; }).attr("r", 4.5).attr("fill", function (q) { return q.r.d === sel.d ? ACC : H.CITYC[sel.c]; });
      g.append("text").attr("x", w - m.r + 6).attr("y", function (q) { return q.y + 4; }).attr("fill", MUTED).text(function (q) { return H.spct(q.r.ch, 0); });
      var top = R[0], bot = R[R.length - 1];
      take(fig, fill(tx("takeRise"), { c: cityTxt(sel.c), top: H.pn(top.name), p: H.spct(top.ch, 0), bot: H.pn(bot.name), q: H.spct(bot.ch, 0) }));
    }
    function at(py) { var q = rowsY.filter(function (q) { return Math.abs(q.y - py) < 13; })[0]; return q ? q.r : null; }
    H.hover(plot, function (px, py, ev) {
      var r = at(py); if (!r) return null;
      var touch = ev && ev.pointerType === "touch";
      return { node: H.card({ h: H.pn(r.name), sw: H.CITYC[sel.c], rows: [[fill(tx("rise"), { a: perLab(sel.c, "P1") }), H.spct(r.ch, 0)], [tx("rng"), H.spct(r.lo, 0) + (H.lang() === "vi" ? " đến " : " to ") + H.spct(r.hi, 0)],
        [tx("nFirst"), nf(r.n1)], [tx("nLast"), nf(r.n4)]], m: [touch ? tx("tapD") : tx("clickD")] }) };
    });
    plot.addEventListener("click", function (ev) {
      var b = plot.getBoundingClientRect(), r = at(ev.clientY - b.top); if (!r) return;
      if (ev.pointerType === "touch" && tap !== r.d) { tap = r.d; return; }
      tap = null; sel.d = sel.d === r.d ? null : r.d; H.emit("pick-change", { c: sel.c, d: sel.d });
    });
    H.onLang(render); H.on("pick-change", render);
    window.addEventListener("resize", function () { if (CH && plot.clientWidth !== w) render(); });
    return render;
  }

  // ------------------------------------------------------------------ mount: each figure loads its data when it comes near
  function mount() {
    var jobs = { index: [indexFig, ["index", "change"]], place: [placeFig, ["places"]], rise: [riseFig, ["change", "index"]] };
    if (H.st && H.st.c) sel.c = H.st.c;
    Object.keys(jobs).forEach(function (name) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-hs="' + name + '"]'), function (fig) {
        var go;
        try { go = jobs[name][0](fig); } catch (e) { H.fail(fig, e); return; }
        H.lazy(fig, function () {
          Promise.all(jobs[name][1].map(function (f) { return H.load(f); })).then(function (r) {
            jobs[name][1].forEach(function (f, i) { if (f === "index") IX = r[i]; if (f === "change") CH = r[i]; if (f === "places") PL = r[i]; });
            go();
          }).catch(function (e) { H.fail(fig, e); });
        });
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
