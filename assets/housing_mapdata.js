/* Housing atlas, section 1: data side of the map (loaded before housing_map.js).
   Decodes surface_<c>.json (run-length v, n1km for kept cells), builds the 2D image, the connected parts
   (the view fits the main one), the 3D blocks, ward outlines in local metres and the point-in-ward lookup.
   Exposes Housing.mapData = {cls, toM, columns, getCity, getShared, wardAt}. */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H || !window.d3) return;
  // ------------------------------------------------------------------ data (cached per city, shared by every map on the page)
  var cache = {}, shared = null;
  function decode(S) {
    var N = S.nx * S.ny, v = new Float32Array(N), n = new Int32Array(N), i = 0, k = 0;
    S.v.forEach(function (a) { if (a < 0) i -= a; else { v[i] = a / 1000; n[i] = S.n1km[k++] || 0; i++; } });
    return { v: v, n: n };
  }
  function cls(S, x) { var c = 0; for (var j = 0; j < S.breaks.length; j++) if (x >= S.breaks[j]) c = j + 1; return c; }
  function toM(S, lon, lat) { return [(lon - S.lon0) * S.kx, (lat - S.lat0) * S.ky]; }
  function prepCity(r) {
    var S = r[0], W = r[1], d = decode(S), vmax = 0;
    S.val = d.v; S.n1 = d.n; S.x0 = S.origin[0]; S.y0 = S.origin[1];
    S.x1 = S.x0 + S.nx * S.cell_m; S.y1 = S.y0 + S.ny * S.cell_m;
    for (var i = 0; i < S.val.length; i++) if (S.val[i] > vmax) vmax = S.val[i];
    S.vmax = vmax;
    // wards in local metres, with bounding boxes for the hover lookup
    S.wards = W.features.map(function (f) {
      var g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates, b = [1e12, 1e12, -1e12, -1e12];
      var rings = [];
      polys.forEach(function (p) {
        p.forEach(function (ring) {
          var a = new Float64Array(ring.length * 2);
          ring.forEach(function (q, j) { var m = toM(S, q[0], q[1]); a[2 * j] = m[0]; a[2 * j + 1] = m[1];
            if (m[0] < b[0]) b[0] = m[0]; if (m[1] < b[1]) b[1] = m[1]; if (m[0] > b[2]) b[2] = m[0]; if (m[1] > b[3]) b[3] = m[1]; });
          rings.push(a);
        });
      });
      var p = f.properties, c = p.c ? toM(S, p.c[0], p.c[1]) : [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      return { p: p, rings: rings, b: b, cx: c[0], cy: c[1] };
    });
    comps(S);
    S.img = image(S);
    S.cols = {};
    return S;
  }
  // 2D: one pixel per cell, row 0 of the data = south = bottom row of the image
  function image(S) {
    var cv = document.createElement("canvas"), ctx, im, rgb = H.RAMP.map(function (c) { var o = d3.rgb(c); return [o.r, o.g, o.b]; });
    cv.width = S.nx; cv.height = S.ny; ctx = cv.getContext("2d"); im = ctx.createImageData(S.nx, S.ny);
    for (var iy = 0; iy < S.ny; iy++) for (var ix = 0; ix < S.nx; ix++) {
      var x = S.val[iy * S.nx + ix]; if (!x || !S.keep[iy * S.nx + ix]) continue; // distant parts are not drawn
      var c = rgb[cls(S, x)], o = ((S.ny - 1 - iy) * S.nx + ix) * 4;
      im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = S.n1[iy * S.nx + ix] < 3 ? 110 : 255;
    }
    ctx.putImageData(im, 0, 0);
    return cv;
  }
  // 3D: blocks of g x g cells (mean of the kept cells), so the columns stay readable
  function columns(S, g) {
    if (S.cols[g]) return S.cols[g];
    var out = { x: [], y: [], v: [], n: [], c: [], half: g * S.cell_m / 2, g: g, bw: Math.ceil(S.nx / g), bv: new Float32Array(Math.ceil(S.nx / g) * Math.ceil(S.ny / g)) };
    for (var by = 0; by < S.ny; by += g) for (var bx = 0; bx < S.nx; bx += g) {
      var sv = 0, sn = 0, k = 0;
      for (var iy = by; iy < Math.min(by + g, S.ny); iy++) for (var ix = bx; ix < Math.min(bx + g, S.nx); ix++) {
        var j = iy * S.nx + ix; if (S.val[j] && S.keep[j]) { sv += S.val[j]; sn += S.n1[j]; k++; }
      }
      if (k * 2 < g * g && g > 1) continue; // keep a block only if at least half of it is surface
      if (!k) continue;
      out.x.push(S.x0 + (bx + g / 2) * S.cell_m); out.y.push(S.y0 + (by + g / 2) * S.cell_m);
      out.v.push(sv / k); out.n.push(Math.round(sn / k)); out.c.push(cls(S, sv / k)); out.bv[(by / g) * out.bw + bx / g] = sv / k;
    }
    return (S.cols[g] = out);
  }
  // connected parts of the surface (4-neighbours): the view fits the main part and the parts near it;
  // a distant part (e.g. Hoa Lac west of Hanoi) stays where it falls and is named by an arrow at the frame edge
  function comps(S) {
    var nx = S.nx, ny = S.ny, lab = new Int32Array(nx * ny), parts = [], q = [];
    for (var j0 = 0; j0 < nx * ny; j0++) {
      if (!S.val[j0] || lab[j0]) continue;
      var P = { id: parts.length + 1, n: 0, sx: 0, sy: 0, b: [1e9, 1e9, -1e9, -1e9] };
      lab[j0] = P.id; q.length = 0; q.push(j0);
      while (q.length) {
        var j = q.pop(), ix = j % nx, iy = (j - ix) / nx;
        P.n++; P.sx += ix; P.sy += iy;
        if (ix < P.b[0]) P.b[0] = ix; if (iy < P.b[1]) P.b[1] = iy; if (ix > P.b[2]) P.b[2] = ix; if (iy > P.b[3]) P.b[3] = iy;
        var nb = [ix > 0 ? j - 1 : -1, ix < nx - 1 ? j + 1 : -1, iy > 0 ? j - nx : -1, iy < ny - 1 ? j + nx : -1];
        for (var t = 0; t < 4; t++) { var k = nb[t]; if (k >= 0 && S.val[k] && !lab[k]) { lab[k] = P.id; q.push(k); } }
      }
      parts.push(P);
    }
    parts.sort(function (a, b) { return b.n - a.n; });
    var m = parts[0], gap = Math.round(3000 / S.cell_m), c = S.cell_m;
    var B = [m.b[0] - gap, m.b[1] - gap, m.b[2] + gap, m.b[3] + gap], F = m.b.slice();
    S.away = []; S.keep = new Uint8Array(nx * ny);
    var nearId = {};
    parts.forEach(function (P) {
      var near = !(P.b[2] < B[0] || P.b[0] > B[2] || P.b[3] < B[1] || P.b[1] > B[3]);
      if (near) { nearId[P.id] = 1; F[0] = Math.min(F[0], P.b[0]); F[1] = Math.min(F[1], P.b[1]); F[2] = Math.max(F[2], P.b[2]); F[3] = Math.max(F[3], P.b[3]); return; }
      if (P.n < 30) return;
      var x = S.x0 + (P.sx / P.n + 0.5) * c, y = S.y0 + (P.sy / P.n + 0.5) * c;
      // distant parts within 12 km of a larger one share its arrow
      if (S.away.some(function (A) { return Math.hypot(A.x - x, A.y - y) < 12000; })) return;
      S.away.push({ x: x, y: y });
    });
    for (var j1 = 0; j1 < nx * ny; j1++) if (nearId[lab[j1]]) S.keep[j1] = 1;
    S.fit = [S.x0 + F[0] * c, S.y0 + F[1] * c, S.x0 + (F[2] + 1) * c, S.y0 + (F[3] + 1) * c];
  }
  function getCity(c) {
    if (!cache[c]) cache[c] = Promise.all([H.load("surface_" + c), H.load("wards_" + c)]).then(prepCity);
    return cache[c];
  }
  function getShared() {
    if (!shared) shared = Promise.all([H.load("metro"), H.load("districts"), H.load("meta")]);
    return shared;
  }
  function inRing(a, x, y) {
    var ins = false;
    for (var i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
      var xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function wardAt(S, x, y) {
    for (var i = 0; i < S.wards.length; i++) {
      var w = S.wards[i], b = w.b, k = 0;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      w.rings.forEach(function (r) { if (inRing(r, x, y)) k++; });
      if (k % 2) return w;
    }
    return null;
  }

  H.mapData = { cls: cls, toM: toM, columns: columns, getCity: getCity, getShared: getShared, wardAt: wardAt };
})();
