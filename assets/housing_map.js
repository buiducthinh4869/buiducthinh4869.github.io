/* Housing atlas, section 1: where is land expensive?
   Housing.map(fig, opts) mounts a price map in <figure data-hs="map"> (needs housing_core.js and D3).
   2D: one canvas image of the price surface (cells coloured by class), overlays drawn on a second canvas.
   3D: the same surface as columns in an oblique view (painter's order, far to near), heights = price index.
   opts.teaser: city switch and hover only (no layers, no 3D); a click opens opts.href#c=<city>.
   Data: surface_<c>.json (run-length v, n1km), wards_<c>.json, metro.json, districts.json (web_spec.md, Export). */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H || !window.d3 || !H.mapData) return;

  var TX = {
    en: {
      price: "Price surface", wards: "New wards", metro: "Metro", cbd: "City centre", seg: "Market type", dots: "Listings by ward",
      view: "View", angle: "Turn", layers: "Layers", only2d: "2D only",
      lg: "Asking price per m², relative to the city average", lgs: "Market type of the former district",
      x: "×", avg: "the city average", newWard: " (new)", oldBy: "former {d}, as the listings name it", oldGadm: "former {d}, by the old boundary",
      rIdx: "Price vs city average", rMed: "Median asking price in this ward", rN: "Listings within 1 km", rNw: "Listings in this ward",
      allTypes: "all types, {n}", one: "1 listing", many: "{n} listings", few: "Few listings nearby: this value is extrapolated.", fewLg: "Faded: fewer than 3 listings within 1 km", h3d: "In 3D, height also shows the price.", dotsLg: "Listings in the ward", off: "{w} (off the map)", above: "Asking prices here are about {p} above the city average for a similar home.",
      below: "Asking prices here are about {p} below the city average for a similar home.", near: "Asking prices here are close to the city average.",
      st: "Metro station", line: "Metro line", centre: "City centre", centreM: "Distances in section 2 are measured from here.",
      seg0: "Market type", clickT: "Click to open the housing atlas.", clickF: "Click to value a home in this district.", tapT: "Tap again to open the housing atlas.", tapF: "Tap again to value a home in this district.",
      N: "N", load: "Loading the map…",
      src: "Source: mogi.vn listings, 15 Oct 2026; OpenStreetMap (metro, © OpenStreetMap contributors); ward boundaries after July 2025 (vietnamese-provinces-database, MIT); author's calculations.",
      note: "Houses and land only, adjusted for type and plot size, smoothed over the 20 nearest listings (at least 380 m); listings placed at a ward centre count half. About 71% of listings give only a ward-centre location, so detail finer than about 1 km means little."
    },
    vi: {
      price: "Bề mặt giá", wards: "Phường mới", metro: "Metro", cbd: "Trung tâm", seg: "Kiểu thị trường", dots: "Số tin theo phường",
      view: "Kiểu xem", angle: "Xoay", layers: "Lớp", only2d: "chỉ ở 2D",
      lg: "Giá rao mỗi m², so với mức trung bình thành phố", lgs: "Kiểu thị trường của quận cũ",
      x: "×", avg: "mức trung bình thành phố", newWard: " (mới)", oldBy: "{d} cũ, theo tin rao", oldGadm: "{d} cũ, theo ranh giới cũ",
      rIdx: "Giá so với trung bình thành phố", rMed: "Giá rao trung vị trong phường", rN: "Số tin trong bán kính 1 km", rNw: "Số tin trong phường",
      allTypes: "mọi loại nhà, {n}", one: "1 tin", many: "{n} tin", few: "Ít tin quanh đây: giá trị này là ngoại suy.", fewLg: "Màu nhạt: dưới 3 tin trong bán kính 1 km", h3d: "Ở bản 3D, độ cao cũng thể hiện giá.", dotsLg: "Số tin trong phường", off: "{w} (ngoài khung)", above: "Giá rao ở đây cao hơn mức trung bình thành phố khoảng {p}, với nhà tương tự.",
      below: "Giá rao ở đây thấp hơn mức trung bình thành phố khoảng {p}, với nhà tương tự.", near: "Giá rao ở đây gần mức trung bình thành phố.",
      st: "Ga metro", line: "Tuyến metro", centre: "Trung tâm thành phố", centreM: "Khoảng cách ở mục 2 tính từ điểm này.",
      seg0: "Kiểu thị trường", clickT: "Bấm để mở bản đồ nhà đất.", clickF: "Bấm để định giá một căn trong quận này.", tapT: "Chạm lần nữa để mở bản đồ nhà đất.", tapF: "Chạm lần nữa để định giá một căn trong quận này.",
      N: "B", load: "Đang tải bản đồ…",
      src: "Nguồn: tin rao mogi.vn, 15/10/2026; OpenStreetMap (metro, © những người đóng góp OpenStreetMap); ranh giới phường sau tháng 7/2025 (vietnamese-provinces-database, giấy phép MIT); tác giả tính toán.",
      note: "Chỉ gồm nhà và đất, đã điều chỉnh theo loại nhà và diện tích lô, làm trơn theo 20 tin gần nhất (tối thiểu 380 m); tin chỉ có tọa độ tâm phường được tính một nửa. Khoảng 71% tin chỉ có vị trí tâm phường, nên chi tiết nhỏ hơn khoảng 1 km không có nhiều ý nghĩa."
    }
  };
  function tx(k) { return TX[H.lang()][k]; }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }
  var LAYERS = ["price", "wards", "metro", "cbd", "seg", "dots"];
  var TILT = 0.55, DUR = 600, SANS = '"Be Vietnam Pro", system-ui, sans-serif';
  var INK = "#23272b", MUTED = "#6b6f72", PAPER = "#faf9f5", ACC = "#1f5f7a";

  var MD = H.mapData, cls = MD.cls, toM = MD.toM, columns = MD.columns, getCity = MD.getCity, getShared = MD.getShared, wardAt = MD.wardAt;

  // ------------------------------------------------------------------ the map
  H.map = function (fig, opts) {
    opts = opts || {};
    var teaser = !!opts.teaser, plot = fig.querySelector(".hs-plot");
    if (!plot) { plot = H.el("div", "hs-plot"); fig.insertBefore(plot, fig.firstChild); }
    var st = { c: H.st.c || "hn", v: teaser ? "2d" : (H.st.v || "2d"), l: teaser ? ["price"] : (H.st.l || ["price", "metro", "cbd"]).slice(), th: -25 };
    var S = null, M = null, D = null, CBD = null, hl = "", hov = null, a = st.v === "3d" ? 1 : 0, anim = 0, order = null, boxes = null, T = null, tapKey = null;
    var reduced = H.reduced();

    var base = document.createElement("canvas"), over = document.createElement("canvas");
    base.className = "hs-cv"; over.className = "hs-cv hs-cv-over";
    over.setAttribute("role", "img");
    plot.appendChild(base); plot.appendChild(over);
    var legend = H.el("div", "hs-mlegend"); plot.appendChild(legend);
    var status = H.el("p", "hs-status"); plot.appendChild(status);

    // controls
    var bar = H.el("div", "hs-bar"); fig.insertBefore(bar, plot);
    function btnGroup(key, vals, label) {
      var g = H.el("span", "hs-group"); g.setAttribute("role", "group");
      vals.forEach(function (v) {
        var b = H.el("button", "hs-btn"); b.type = "button"; b.dataset[key] = v;
        b.addEventListener("click", function () { choose(key, v); });
        g.appendChild(b);
      });
      g.dataset.label = label; bar.appendChild(g); return g;
    }
    var gCity = btnGroup("c", ["hn", "hcm"], "city"), gView = null, angle = null, gLay = null;
    if (!teaser) {
      gView = btnGroup("v", ["2d", "3d"], "view");
      angle = H.el("label", "hs-angle"); angle.appendChild(H.el("span"));
      var rng = document.createElement("input"); rng.type = "range"; rng.min = -180; rng.max = 180; rng.step = 5; rng.value = st.th;
      rng.addEventListener("input", function () { st.th = +rng.value; draw(); });
      angle.appendChild(rng); bar.appendChild(angle);
      gLay = H.el("span", "hs-layers");
      LAYERS.forEach(function (k) {
        var lb = H.el("label", "hs-chk"), cb = document.createElement("input");
        cb.type = "checkbox"; cb.dataset.layer = k;
        cb.addEventListener("change", function () {
          var l = st.l.filter(function (x) { return x !== k; }); if (cb.checked) l.push(k);
          st.l = LAYERS.filter(function (x) { return l.indexOf(x) >= 0; });
          H.set({ l: st.l }); paint(); draw();
        });
        lb.appendChild(cb); lb.appendChild(H.el("span")); gLay.appendChild(lb);
      });
      bar.appendChild(gLay);
    }
    function on(k) { return st.l.indexOf(k) >= 0; }
    function paint() {
      gCity.querySelectorAll("button").forEach(function (b) { b.textContent = H.city(b.dataset.c); b.setAttribute("aria-pressed", String(b.dataset.c === st.c)); });
      gCity.setAttribute("aria-label", H.lang() === "vi" ? "Thành phố" : "City");
      if (gView) {
        gView.setAttribute("aria-label", tx("view"));
        gView.querySelectorAll("button").forEach(function (b) { b.textContent = b.dataset.v.toUpperCase(); b.setAttribute("aria-pressed", String(b.dataset.v === st.v)); });
        angle.firstChild.textContent = tx("angle"); angle.hidden = st.v !== "3d";
        gLay.setAttribute("aria-label", tx("layers"));
        gLay.querySelectorAll("label").forEach(function (lb) {
          var cb = lb.firstChild, k = cb.dataset.layer, two = k === "seg" || k === "dots" || k === "wards";
          cb.checked = on(k); cb.disabled = two && st.v === "3d";
          lb.lastChild.textContent = tx(k) + (cb.disabled ? " (" + tx("only2d") + ")" : "");
          lb.classList.toggle("is-off", cb.disabled);
        });
      }
      over.setAttribute("aria-label", tx("lg") + " · " + H.city(st.c) + " · " + st.v.toUpperCase());
      cap();
      drawLegend();
    }
    function cap() {
      var s = fig.querySelector(".hs-src"), n = fig.querySelector(".hs-note");
      if (s && !teaser) s.textContent = tx("src");
      if (n && !teaser) n.textContent = tx("note");
    }
    function choose(key, v) {
      if (key === "c") { if (v === st.c) return; st.c = v; if (!teaser) H.set({ c: v }); load(); }
      if (key === "v") {
        if (v === st.v) return; st.v = v; H.set({ v: v });
        animate(v === "3d" ? 1 : 0);
      }
      paint();
    }

    // legend inside the plot: classes with thresholds, plus market types when that layer is on
    function drawLegend() {
      legend.textContent = "";
      var narrow = (plot.clientWidth || fig.clientWidth) < 600;
      if (narrow && legend.parentNode !== fig) fig.insertBefore(legend, plot);
      if (!narrow && legend.parentNode !== plot) plot.appendChild(legend);
      legend.classList.toggle("is-out", narrow);
      if (!S || !on("price")) { legend.hidden = !(S && on("seg") && st.v === "2d"); }
      else legend.hidden = false;
      if (!S) return;
      if (on("price")) {
        legend.appendChild(H.el("p", "hs-mlg-t", tx("lg")));
        var row = H.el("div", "hs-mlg-row"), lab = H.el("div", "hs-mlg-lab");
        H.RAMP.forEach(function (c, i) {
          var sw = H.el("span", "hs-mlg-sw"); sw.style.background = c;
          sw.title = (i === 0 ? "< " + H.nf(S.breaks[0], 2) : i === H.RAMP.length - 1 ? "≥ " + H.nf(S.breaks[i - 1], 2) : H.nf(S.breaks[i - 1], 2) + "–" + H.nf(S.breaks[i], 2));
          row.appendChild(sw);
        });
        S.breaks.forEach(function (b, i) { lab.appendChild(H.el("span", null, narrow && i % 2 ? "" : "×" + H.nf(b, 2))); });
        legend.appendChild(row); legend.appendChild(lab);
        if (st.v === "2d" || teaser) {
          var fr = H.el("div", "hs-mlg-seg"), fs = H.el("span", "hs-mlg-box hs-mlg-faded"); fs.style.background = H.RAMP[4];
          fr.appendChild(fs); fr.appendChild(H.el("span", null, tx("fewLg"))); legend.appendChild(fr);
        } else legend.appendChild(H.el("p", "hs-mlg-n", tx("h3d")));
      }
      if (on("dots") && st.v === "2d" && !teaser) {
        legend.appendChild(H.el("p", "hs-mlg-t", tx("dotsLg")));
        var dr = H.el("div", "hs-mlg-dots");
        [10, 50, 150].forEach(function (n) {
          var d = H.el("span", "hs-mlg-dot"), r = dotR(n);
          d.style.width = d.style.height = 2 * r + "px";
          var it = H.el("span", "hs-mlg-di"); it.appendChild(d); it.appendChild(H.el("span", null, H.nf(n, 0))); dr.appendChild(it);
        });
        legend.appendChild(dr);
      }
      if (on("seg") && st.v === "2d" && !teaser) {
        legend.appendChild(H.el("p", "hs-mlg-t", tx("lgs")));
        H.SEG.forEach(function (k) {
          var r = H.el("div", "hs-mlg-seg"), sw = H.el("span", "hs-mlg-box"); sw.style.background = H.SEGC[k];
          r.appendChild(sw); r.appendChild(H.el("span", null, H.seg(k).name)); legend.appendChild(r);
        });
      }
    }

    // ---------------------------------------------------------------- geometry
    var W = 0, Hh = 0, dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = plot.clientWidth; Hh = plot.clientHeight || Math.round(W * 0.75);
      [base, over].forEach(function (cv) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); cv.style.width = W + "px"; cv.style.height = Hh + "px"; });
    }
    // transform for blend a (0 = flat top view, 1 = oblique 3D): rotation, tilt and column height grow with a
    function fit(t) {
      var th = (st.th * Math.PI / 180) * t, c = 1 - (1 - TILT) * t, cos = Math.cos(th), sin = Math.sin(th);
      var F = S.fit, mx = (F[0] + F[2]) / 2, my = (F[1] + F[3]) / 2, hx = (F[2] - F[0]) / 2, hy = (F[3] - F[1]) / 2;
      var rx = [], ry = [];
      [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].forEach(function (p) { rx.push(p[0] * cos - p[1] * sin); ry.push(p[0] * sin + p[1] * cos); });
      var x0 = Math.min.apply(null, rx), x1 = Math.max.apply(null, rx), y0 = Math.min.apply(null, ry), y1 = Math.max.apply(null, ry);
      var pad = W < 600 ? 6 : 12, top = legend.hidden || legend.parentNode !== plot ? pad : legend.offsetTop + legend.offsetHeight + 6, hmax = 0.3 * Hh * t;
      // when the width limits the scale, let the columns use the spare height (up to 45% of the box)
      var sw = (W - 2 * pad) / (x1 - x0), spare = Hh - top - pad - sw * (y1 - y0) * c;
      if (t > 0 && spare > hmax) hmax = Math.min(0.45 * Hh, spare) * t;
      var s = Math.min(sw, (Hh - top - pad - hmax) / ((y1 - y0) * c));
      var used = (y1 - y0) * s * c + hmax;
      var ox = W / 2 - s * (x0 + x1) / 2, oy = top + hmax + (Hh - top - pad - used) / 2 + y1 * s * c;
      var R = { s: s, ox: ox, oy: oy, mx: mx, my: my, cos: cos, sin: sin, c: c, hk: hmax / S.vmax, t: t };
      if (t > 0) { // measure the real top of the columns with this transform, then centre the content in the free height
        var C = columns(S, W < 600 ? 3 : 2), ytop = Infinity, ybot = -Infinity;
        for (var i = 0; i < C.x.length; i++) {
          var dx = C.x[i] - mx, dy = C.y[i] - my, Y = oy - (dx * sin + dy * cos) * s * c;
          if (Y - C.v[i] * R.hk < ytop) ytop = Y - C.v[i] * R.hk; if (Y > ybot) ybot = Y;
        }
        if (isFinite(ytop)) R.oy += (top + (Hh - pad - top - (ybot - ytop)) / 2) - ytop;
      }
      return R;
    }
    function zAt(x, y) { // column height (px) of the surface at a point, 0 off the surface or in 2D
      if (!a || !on("price")) return 0;
      var ix = Math.floor((x - S.x0) / S.cell_m), iy = Math.floor((y - S.y0) / S.cell_m);
      if (ix < 0 || iy < 0 || ix >= S.nx || iy >= S.ny) return 0;
      var C = columns(S, W < 600 ? 3 : 2);
      return (C.bv[Math.floor(iy / C.g) * C.bw + Math.floor(ix / C.g)] || 0) * T.hk;
    }
    function Pz(x, y) { var p = P(x, y); p[1] -= zAt(x, y); return p; }
    function P(x, y) { var dx = x - T.mx, dy = y - T.my; return [T.ox + (dx * T.cos - dy * T.sin) * T.s, T.oy - (dx * T.sin + dy * T.cos) * T.s * T.c]; }
    function inv(X, Y) { // screen to metres (ground)
      var u = (X - T.ox) / T.s, w = -(Y - T.oy) / (T.s * T.c);
      return [T.mx + u * T.cos + w * T.sin, T.my - u * T.sin + w * T.cos];
    }

    // ---------------------------------------------------------------- drawing
    function ringsPath(ctx, rings, lift) {
      var f = lift ? Pz : P;
      rings.forEach(function (a) {
        for (var i = 0; i < a.length; i += 2) { var p = f(a[i], a[i + 1]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
        ctx.closePath();
      });
    }
    function draw() {
      if (!S) return;
      metroFor(); T = fit(a);
      var ctx = base.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
      if (on("seg") && a === 0 && !teaser) {
        if (!on("price")) S.wards.forEach(function (w) { if (!w.p.seg) return; ctx.beginPath(); ringsPath(ctx, w.rings); ctx.fillStyle = H.SEGC[w.p.seg]; ctx.globalAlpha = 0.55; ctx.fill(); });
        ctx.globalAlpha = 1;
      }
      if (a === 0) {
        if (on("price")) { ctx.imageSmoothingEnabled = false; var p0 = P(S.x0, S.y1), p1 = P(S.x1, S.y0); ctx.drawImage(S.img, p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]); edge(ctx); }
        order = null;
      } else if (on("price")) cols3d(ctx);
      if (on("seg") && on("price") && a === 0 && !teaser) {
        S.wards.forEach(function (w) { if (!w.p.seg) return; ctx.beginPath(); ringsPath(ctx, w.rings); ctx.strokeStyle = H.SEGC[w.p.seg]; ctx.lineWidth = 2.2; ctx.stroke(); });
      }
      if (a === 0) ground(ctx);
      drawOver();
    }
    // outline of the area with a surface, so the lightest class stays visible against the paper
    function edge(ctx) {
      if (!S.edge) {
        var e = [], nx = S.nx, ny = S.ny, v = new Uint8Array(nx * ny), c = S.cell_m;
        for (var q = 0; q < nx * ny; q++) v[q] = S.val[q] && S.keep[q] ? 1 : 0;
        for (var iy = 0; iy < ny; iy++) for (var ix = 0; ix < nx; ix++) {
          if (!v[iy * nx + ix]) continue;
          var x = S.x0 + ix * c, y = S.y0 + iy * c;
          if (ix === 0 || !v[iy * nx + ix - 1]) e.push(x, y, x, y + c);
          if (ix === nx - 1 || !v[iy * nx + ix + 1]) e.push(x + c, y, x + c, y + c);
          if (iy === 0 || !v[(iy - 1) * nx + ix]) e.push(x, y, x + c, y);
          if (iy === ny - 1 || !v[(iy + 1) * nx + ix]) e.push(x, y + c, x + c, y + c);
        }
        S.edge = e;
      }
      ctx.beginPath();
      for (var i = 0; i < S.edge.length; i += 4) { var a0 = P(S.edge[i], S.edge[i + 1]), a1 = P(S.edge[i + 2], S.edge[i + 3]); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); }
      ctx.strokeStyle = "#b9b5aa"; ctx.lineWidth = 0.7; ctx.stroke();
    }
    function ground(ctx) { // ward lines and metro lines; in 3D drawn on the overlay, draped over the columns
      var lift = a > 0;
      if (on("wards") && !teaser) {
        ctx.beginPath(); S.wards.forEach(function (w) { ringsPath(ctx, w.rings, lift); });
        ctx.strokeStyle = on("price") ? "rgba(250,249,245,0.75)" : "#b9b5aa"; ctx.lineWidth = 0.6; ctx.stroke();
      }
      if (on("metro") && M && !teaser) {
        (M[st.c] || { lines: [] }).lines.forEach(function (ln) {
          ctx.beginPath();
          var pen = false, z = ln.m.map(function (q) { return lift ? zAt(q[0], q[1]) : 0; }), zs = z;
          if (lift) { // ride the block tops: running max then running mean over +-3 points, so the line does not saw up and down
            var mxz = z.map(function (v, i) { var m = 0; for (var j = Math.max(0, i - 3); j <= Math.min(z.length - 1, i + 3); j++) m = Math.max(m, z[j]); return v ? m : 0; });
            zs = mxz.map(function (v, i) { if (!v) return 0; var t = 0, k = 0; for (var j = Math.max(0, i - 3); j <= Math.min(z.length - 1, i + 3); j++) if (mxz[j]) { t += mxz[j]; k++; } return t / k; });
          }
          ln.m.forEach(function (q, j) {
            if (lift && !zs[j]) { pen = false; return; } // leaves the surface: lift the pen
            var p = P(q[0], q[1]), i = pen; p[1] -= zs[j]; pen = true; if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
          ctx.strokeStyle = PAPER; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        });
      }
    }
    function cols3d(ctx) {
      var C = columns(S, W < 600 ? 3 : 2), n = C.x.length, h = C.half, ry = new Float64Array(n), i;
      for (i = 0; i < n; i++) { var dx = C.x[i] - T.mx, dy = C.y[i] - T.my; ry[i] = dx * T.sin + dy * T.cos; }
      if (!order || order.length !== n || order.th !== st.th) { order = Array.from({ length: n }, function (_, k) { return k; }); order.sort(function (p, q) { return ry[q] - ry[p]; }); order.th = st.th; }
      // corner offsets of one column in screen units (same for every column)
      var cx = [-h, h, h, -h], cy = [-h, -h, h, h], dX = [], dY = [];
      for (i = 0; i < 4; i++) { dX.push((cx[i] * T.cos - cy[i] * T.sin) * T.s); dY.push(-(cx[i] * T.sin + cy[i] * T.cos) * T.s * T.c); }
      var faces = [];
      for (i = 0; i < 4; i++) { // a side faces the viewer when its outward normal points down the screen
        var j = (i + 1) % 4, nx = cy[j] - cy[i], ny = -(cx[j] - cx[i]), nry = nx * T.sin + ny * T.cos, nrx = nx * T.cos - ny * T.sin;
        if (nry < 0) faces.push([i, j, nrx < 0 ? 1 : 2]);
      }
      var shade = H.RAMP.map(function (c) { var o = d3.color(c); return [c, o.darker(0.45).toString(), o.darker(0.9).toString()]; });
      boxes = new Float32Array(n * 4);
      var mnX = Math.min.apply(null, dX), mxX = Math.max.apply(null, dX), mnY = Math.min.apply(null, dY), mxY = Math.max.apply(null, dY);
      ctx.lineJoin = "round";
      for (var k = 0; k < n; k++) {
        i = order[k];
        var p = P(C.x[i], C.y[i]), X = p[0], Y = p[1], z = C.v[i] * T.hk, col = shade[C.c[i]];
        faces.forEach(function (f) {
          ctx.beginPath(); ctx.moveTo(X + dX[f[0]], Y + dY[f[0]]); ctx.lineTo(X + dX[f[1]], Y + dY[f[1]]);
          ctx.lineTo(X + dX[f[1]], Y + dY[f[1]] - z); ctx.lineTo(X + dX[f[0]], Y + dY[f[0]] - z); ctx.closePath();
          ctx.fillStyle = col[f[2]]; ctx.fill();
        });
        ctx.beginPath(); ctx.moveTo(X + dX[0], Y + dY[0] - z);
        for (var q = 1; q < 4; q++) ctx.lineTo(X + dX[q], Y + dY[q] - z);
        ctx.closePath(); ctx.fillStyle = col[0]; ctx.fill();
        boxes[k * 4] = X + mnX; boxes[k * 4 + 1] = Y + mnY - z; boxes[k * 4 + 2] = X + mxX; boxes[k * 4 + 3] = Y + mxY;
      }
    }
    function label(ctx, s, x, y, align, weight) {
      ctx.font = (weight || 400) + " " + (W < 600 ? 11 : 12) + "px " + SANS; ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(250,249,245,0.9)"; ctx.strokeText(s, x, y); ctx.fillStyle = INK; ctx.fillText(s, x, y);
    }
    function drawOver() {
      var ctx = over.getContext("2d"), cbd = CBD && CBD[st.c];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
      if (on("dots") && a === 0 && !teaser) S.wards.forEach(function (w) {
        if (!w.p.n) return; var p = P(w.cx, w.cy);
        ctx.beginPath(); ctx.arc(p[0], p[1], dotR(w.p.n), 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(35,39,43,0.35)"; ctx.fill(); ctx.strokeStyle = PAPER; ctx.lineWidth = 0.8; ctx.stroke();
      });
      if (a > 0) ground(ctx);
      if (on("metro") && M && !teaser) (M[st.c] || { stations: [] }).stations.forEach(function (s) {
        var p = Pz(s.m[0], s.m[1]); ctx.beginPath(); ctx.arc(p[0], p[1], W < 600 ? 2.5 : 3.2, 0, 2 * Math.PI);
        ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
      });
      // highlighted former district (from the bubbles or a hover here): its new wards outlined in the accent
      if (hl) {
        var ws = S.wards.filter(function (w) { return w.p.d_old && key(w.p.d_old) === hl; });
        if (ws.length) {
          ctx.beginPath(); ws.forEach(function (w) { ringsPath(ctx, w.rings, a > 0); });
          ctx.strokeStyle = ACC; ctx.lineWidth = 2; ctx.stroke();
          var sx = 0, sy = 0; ws.forEach(function (w) { var p = Pz(w.cx, w.cy); sx += p[0]; sy += p[1]; });
          label(ctx, ws[0].p.d_old, sx / ws.length, sy / ws.length, "center", 500);
        }
      }
      if (hov && hov.ring) { ctx.beginPath(); ctx.arc(hov.ring[0], hov.ring[1], hov.ring[2], 0, 2 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (on("cbd") && cbd && !teaser) {
        var m = toM(S, cbd[0], cbd[1]), p = Pz(m[0], m[1]), z = a ? 18 * a : 0;
        if (z) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - z); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(p[0], p[1] - z, 4.5, 0, 2 * Math.PI); ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1] - z, 1.6, 0, 2 * Math.PI); ctx.fillStyle = INK; ctx.fill();
        var cw = H.textW(tx("centre"), W < 600 ? 11 : 12), right = p[0] + 8 + cw < W - 4;
        label(ctx, tx("centre"), right ? p[0] + 8 : p[0] - 8, p[1] - z, right ? "left" : "right", 500);
      }
      offMap(ctx); north(ctx); if (a === 0) scale(ctx);
    }
    function offMap(ctx) { // arrow at the frame edge toward a distant part of the surface, with its ward name
      (S.away || []).forEach(function (A) {
        if (A.name == null) { var w = wardAt(S, A.x, A.y); A.name = w ? w.p.name : ""; }
        var p = Pz(A.x, A.y), cx = W / 2, cy = Hh / 2;
        var dx = p[0] - cx, dy = p[1] - cy, k = Math.min((W / 2 - 16) / Math.abs(dx || 1e-9), (Hh / 2 - 16) / Math.abs(dy || 1e-9));
        var ex = cx + dx * k, ey = cy + dy * k, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
        ctx.beginPath(); ctx.moveTo(ex - ux * 14, ey - uy * 14); ctx.lineTo(ex, ey); ctx.strokeStyle = MUTED; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + ux * 2, ey + uy * 2); ctx.lineTo(ex - ux * 5 - uy * 4, ey - uy * 5 + ux * 4); ctx.lineTo(ex - ux * 5 + uy * 4, ey - uy * 5 - ux * 4); ctx.closePath(); ctx.fillStyle = MUTED; ctx.fill();
        if (A.name) {
          var s2 = fill(tx("off"), { w: A.name }), al = ux > 0.5 ? "right" : ux < -0.5 ? "left" : "center";
          var lx = ex - ux * 20, ly = ey - uy * 20 + (Math.abs(uy) < 0.5 ? 14 : 0);
          label(ctx, s2, lx, ly, al);
        }
      });
    }
    function dotR(n) { return Math.max(1.5, Math.sqrt(n) * (W < 600 ? 0.8 : 1.1)); }
    function north(ctx) { // arrow pointing to map north (rotates with the 3D view)
      var x = W - 22, y = 30, ux = -T.sin, uy = -T.cos * T.c, l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
      ctx.beginPath(); ctx.moveTo(x - ux * 11, y - uy * 11); ctx.lineTo(x + ux * 11, y + uy * 11); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + ux * 13, y + uy * 13); ctx.lineTo(x + ux * 5 - uy * 4, y + uy * 5 + ux * 4); ctx.lineTo(x + ux * 5 + uy * 4, y + uy * 5 - ux * 4); ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
      label(ctx, tx("N"), x - ux * 20, y - uy * 20, "center", 500);
    }
    function scale(ctx) {
      var L = [1, 2, 5, 10, 20].filter(function (k) { return k * 1000 * T.s <= (W < 600 ? 90 : 130); }).pop() || 1, px = L * 1000 * T.s, x = W - 14 - px, y = Hh - 14;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4);
      ctx.strokeStyle = PAPER; ctx.lineWidth = 3.5; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      label(ctx, H.nf(L, 0) + " km", x + px / 2, y - 11, "center");
    }
    function key(name) { return (st.c === "hn" ? "HN" : "HCM") + " | " + name; }

    // ---------------------------------------------------------------- 2D <-> 3D
    function animate(to) {
      cancelAnimationFrame(anim);
      if (reduced) { a = to; order = null; paint(); draw(); return; }
      var from = a, t0 = performance.now();
      (function step(now) {
        var u = Math.min(1, (now - t0) / DUR), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        a = from + (to - from) * e; draw();
        if (u < 1) anim = requestAnimationFrame(step); else { a = to; draw(); }
      })(t0);
    }

    // ---------------------------------------------------------------- hover and click
    function find(X, Y) {
      if (!S || !T) return null;
      var hit = null, i, m;
      if (!teaser && on("metro") && M) (M[st.c] || { stations: [] }).stations.forEach(function (s) {
        var p = Pz(s.m[0], s.m[1]); if (!hit && Math.hypot(p[0] - X, p[1] - Y) < 7) hit = { kind: "st", s: s, ring: [p[0], p[1], 6], k: "st:" + s.name };
      });
      if (hit) return hit;
      if (!teaser && on("cbd") && CBD && CBD[st.c]) {
        m = toM(S, CBD[st.c][0], CBD[st.c][1]); var pc = Pz(m[0], m[1]), z = a ? 18 * a : 0;
        if (Math.hypot(pc[0] - X, pc[1] - z - Y) < 8) return { kind: "cbd", k: "cbd", ring: [pc[0], pc[1] - z, 7] };
      }
      if (!teaser && on("dots") && a === 0) for (i = 0; i < S.wards.length; i++) {
        var w = S.wards[i]; if (!w.p.n) continue; var pw = P(w.cx, w.cy), r = dotR(w.p.n);
        if (Math.hypot(pw[0] - X, pw[1] - Y) <= r + 1) return { kind: "ward", w: w, k: "w:" + w.p.code, ring: [pw[0], pw[1], r + 2] };
      }
      if (a === 0) {
        m = inv(X, Y);
        var ix = Math.floor((m[0] - S.x0) / S.cell_m), iy = Math.floor((m[1] - S.y0) / S.cell_m);
        if (ix < 0 || iy < 0 || ix >= S.nx || iy >= S.ny) return null;
        var j = iy * S.nx + ix, vv = S.keep[j] ? S.val[j] : 0;
        if (!vv && !on("seg") && !on("wards")) return null;
        var cx = S.x0 + (ix + 0.5) * S.cell_m, cy = S.y0 + (iy + 0.5) * S.cell_m;
        return cell(vv, S.n1[j], cx, cy, "c:" + j);
      }
      if (!boxes || !on("price")) return null;
      var C = columns(S, W < 600 ? 3 : 2);
      for (var k = order.length - 1; k >= 0; k--) {
        var b = k * 4; if (X < boxes[b] || X > boxes[b + 2] || Y < boxes[b + 1] || Y > boxes[b + 3]) continue;
        i = order[k]; return cell(C.v[i], C.n[i], C.x[i], C.y[i], "b:" + i, [ (boxes[b] + boxes[b + 2]) / 2, boxes[b + 1] ]);
      }
      return null;
    }
    function cell(v, n, x, y, k, top) {
      var w = wardAt(S, x, y), p = P(x, y);
      if (!v && !w) return null;
      return { kind: "cell", v: v, n: n, w: w, k: k, ring: top ? [top[0], top[1], 4] : [p[0], p[1], Math.max(3, S.cell_m * T.s)] };
    }
    function card(h) {
      var o = { rows: [], m: [] };
      if (h.kind === "st") {
        o.h = h.s.name; o.rows.push([tx("st"), H.city(st.c)]);
        if (h.s.lines && h.s.lines.length) o.m.push(tx("line") + ": " + h.s.lines.join(", "));
        return H.card(o);
      }
      if (h.kind === "cbd") { o.h = tx("centre"); o.m.push(tx("centreM")); return H.card(o); }
      var w = h.w, wp = w && w.p;
      o.h = wp ? wp.name + tx("newWard") : H.city(st.c);
      if (wp && wp.d_old) o.m.push(fill(tx(wp.d_old_src === "gadm" ? "oldGadm" : "oldBy"), { d: wp.d_old }));
      if (h.kind === "cell" && h.v) {
        o.rows.push([tx("rIdx"), tx("x") + H.nf(h.v, 2)]);
        o.rows.push([tx("rN"), H.nf(h.n, 0)]);
      }
      if (wp && wp.ppm2_med != null && wp.n) o.rows.push([tx("rMed"), H.ppm2(wp.ppm2_med) + " (" + fill(tx("allTypes"), { n: wp.n === 1 ? tx("one") : fill(tx("many"), { n: H.nf(wp.n, 0) }) }) + ")"]);
      else if (wp && h.kind === "ward") o.rows.push([tx("rNw"), H.nf(wp.n || 0, 0)]);
      if (on("seg") && wp && wp.seg && !teaser) { o.sw = H.SEGC[wp.seg]; o.rows.push([tx("seg0"), H.seg(wp.seg).name]); }
      if (h.kind === "cell" && h.v) {
        var d = h.v - 1;
        o.m.push(Math.abs(d) < 0.05 ? tx("near") : fill(tx(d > 0 ? "above" : "below"), { p: H.pct(Math.abs(d), 0) }));
        if (h.n < 3) o.m.push(tx("few"));
      }
      if (teaser) o.m.push(tx(H.touch ? "tapT" : "clickT"));
      else if (wp && wp.d_old && dk(wp.d_old)) o.m.push(tx(H.touch ? "tapF" : "clickF"));
      return H.card(o);
    }
    function dk(name) { // key of a former district known to the tool, else ""
      if (!D) return "";
      var k = key(name);
      return D.some(function (d) { return d.key === k; }) ? k : "";
    }
    function show(h, ev) {
      hov = h; drawOver();
      if (!h) { H.tip.hide(); emitHover(""); return; }
      if (H.touch && W < 600) { var r = plot.getBoundingClientRect(); H.tip.show(r.left + 4, r.top - 6, card(h)); }
      else H.tip.show(ev.clientX, ev.clientY, card(h));
      emitHover(h.w && h.w.p.d_old ? dk(h.w.p.d_old) : "");
    }
    var lastEmit = "", self = false;
    function emitHover(k) { if (teaser || k === lastEmit) return; lastEmit = k; self = true; H.emit("hover-district", k ? { key: k } : null); self = false; }
    function xy(ev) { var r = over.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    over.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var q = xy(ev); show(find(q[0], q[1]), ev);
    });
    over.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") show(null, ev); });
    over.addEventListener("click", function (ev) {
      var q = xy(ev), h = find(q[0], q[1]), touch = H.touch = ev.pointerType ? ev.pointerType !== "mouse" : !!H.touchLast;
      if (!h) { tapKey = null; show(null, ev); return; }
      if (touch && tapKey !== h.k) { tapKey = h.k; show(h, ev); return; } // first tap shows the card, the second acts
      tapKey = null; act(h);
    });
    over.addEventListener("pointerdown", function (ev) { H.touchLast = ev.pointerType !== "mouse"; H.touch = H.touchLast; });
    document.addEventListener("pointerdown", function (ev) { if (ev.target !== over && hov) { tapKey = null; show(null, ev); } });
    function act(h) {
      if (teaser) { location.href = (opts.href || "housing.html") + "#c=" + st.c; return; }
      var k = h.w && h.w.p.d_old ? dk(h.w.p.d_old) : "";
      if (k) { H.tip.hide(); H.set({ d: k }); H.emit("pick-district", { key: k }); }
    }

    // ---------------------------------------------------------------- lifecycle
    var token = 0;
    function load() {
      var my = ++token; status.textContent = tx("load"); status.hidden = false;
      var jobs = [getCity(st.c)];
      if (!teaser) jobs.push(getShared());
      Promise.all(jobs).then(function (r) {
        if (my !== token) return;
        S = r[0];
        if (r[1]) {
          var mt = r[1][0]; D = r[1][1]; CBD = (r[1][2] || {}).cbd || null;
          M = M || prepMetro(mt);
        }
        status.hidden = true; order = null; hl = teaser ? "" : (H.st.d || ""); size(); paint(); draw();
      }).catch(function (e) { status.hidden = true; H.fail(fig, e); });
    }
    function prepMetro(mt) {
      var out = {};
      ["hn", "hcm"].forEach(function (c) {
        var g = mt[c]; if (!g) return;
        // metres need the city's own projection constants: taken from the surface once it is loaded
        out[c] = { raw: g, lines: [], stations: [] };
      });
      return out;
    }
    function metroFor() { // project the raw lon/lat of the current city with its surface constants (lazily)
      if (!M || !M[st.c] || M[st.c].ready) return;
      var g = M[st.c].raw, o = M[st.c];
      o.lines = (g.lines || []).map(function (l) {
        var m = [];
        l.coords.forEach(function (q, i) {
          var b = toM(S, q[0], q[1]);
          if (i) { var a0 = m[m.length - 1], k = Math.ceil(Math.hypot(b[0] - a0[0], b[1] - a0[1]) / (S.cell_m / 2)); for (var j = 1; j < k; j++) m.push([a0[0] + (b[0] - a0[0]) * j / k, a0[1] + (b[1] - a0[1]) * j / k]); }
          m.push(b);
        });
        return { name: l.name, m: m };
      });
      o.stations = (g.stations || []).map(function (s) { return { name: s.name, lines: s.lines, m: toM(S, s.lon, s.lat) }; });
      o.ready = true;
    }

    H.on("hover-district", function (e) { if (self || teaser) return; hl = e && e.key ? e.key : ""; if (S) drawOver(); });
    H.on("state", function (ch) {
      if (teaser || !ch) return;
      if (H.st.c !== st.c) { st.c = H.st.c; load(); paint(); }
      else if (S && (H.st.d || "") !== hl && !hov) { hl = H.st.d || ""; drawOver(); }
    });
    H.onLang(function () { paint(); if (S) draw(); if (hov) H.tip.hide(); });
    var lastW = 0;
    var ro = window.ResizeObserver ? new ResizeObserver(function () { if (!S || plot.clientWidth === lastW) return; lastW = plot.clientWidth; size(); order = null; draw(); }) : null;
    if (ro) ro.observe(plot); else window.addEventListener("resize", function () { if (S) { size(); draw(); } });
    paint(); load();
    return { city: function (c) { choose("c", c); }, redraw: function () { if (S) { size(); draw(); } } };
  };

  function mountAll() {
    document.querySelectorAll('[data-hs="map"]').forEach(function (f) {
      if (f.hasAttribute("data-teaser") || f.dataset.mounted) return;
      f.dataset.mounted = "1";
      H.map(f, {});
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll); else mountAll();
})();
