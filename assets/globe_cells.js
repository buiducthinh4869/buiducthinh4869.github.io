/* Storm atlas, section 3: the Cells (0.1°) view of the globe. Loaded before storm_globe.js, which sets C.env = { G, st, fields, vis }:
   the globe state, the wind fields of the selected storms (fields[SID] = {v, n2, m2, b, res, cur, ll}) and "does this point face the viewer".
   Each cell of a wind field at 17 m/s and up is drawn by category (draw); hovering shows the peak wind of the cell under the
   pointer (tip); a key explains the colours (key). Text in TX (en, vi). */
(function () {
  "use strict";
  var A = window.Atlas;
  if (!A) return;
  var C = A.cells = { env: null }, RAD = Math.PI / 180;
  var TX = {
    en: { cell: "Peak wind in this 0.1° cell", wkey: "Peak wind (m/s)" },
    vi: { cell: "Sức gió mạnh nhất tại ô 0,1° này", wkey: "Sức gió mạnh nhất (m/s)" }
  };
  // key for the Cells view, into the element k
  C.key = function (k) {
    var kb = A.el("span", "sg-ramp-bar"), kl = A.el("span", "sg-ramp-lh");
    k.textContent = "";
    k.appendChild(A.el("span", "sg-ramp-t", TX[A.lang()].wkey));
    A.CLS.forEach(function (c, i) { var s = A.el("span"); s.style.background = A.CCOL[c]; kb.appendChild(s); kl.appendChild(A.el("span", null, A.LEV[i])); });
    k.appendChild(kb); k.appendChild(kl);
  };
  // each 0.1-degree cell of 17 m/s and up, by category
  C.draw = function (cx, Rk) {
    var e = C.env, G = e.G, st = e.st, w = G.w, h = G.h, L0 = -st.rot[0] * RAD, p0 = -st.rot[1] * RAD, sp = Math.sin(p0), cq = Math.cos(p0), X = w / 2, Y = h / 2;
    cx.globalAlpha = 0.85;
    st.sel.forEach(function (s) {
      var f = e.fields[s.id], i, j, c;
      if (!f) return;
      var v = f.cur || f.v, sz = Math.max(0.8, Rk * f.res * RAD * 1.04), ll = f.ll;
      if (!ll) {
        ll = f.ll = new Float32Array(v.length * 3);
        for (j = 0; j < f.m2; j++) for (i = 0; i < f.n2; i++) {
          var la = (f.b[3] - (j - 0.5) * f.res) * RAD;
          c = 3 * (j * f.n2 + i); ll[c] = (f.b[0] + (i - 0.5) * f.res) * RAD; ll[c + 1] = Math.sin(la); ll[c + 2] = Math.cos(la);
        }
      }
      A.LEV.forEach(function (lo, k) {
        var hi = A.LEV[k + 1] || 999;
        cx.fillStyle = A.CCOL[A.CLS[k]];
        for (c = 0; c < v.length; c++) {
          if (v[c] < lo || v[c] >= hi) continue;
          var l = ll[3 * c] - L0, cl = Math.cos(l), sl = ll[3 * c + 1], co = ll[3 * c + 2], cosc = sp * sl + cq * co * cl;
          if (cosc <= 0.02) continue;
          var x = X + Rk * co * Math.sin(l), y = Y - Rk * (cq * sl - sp * co * cl);
          if (x < -sz || x > w + sz || y < -sz || y > h + sz) continue;
          cx.fillRect(x - sz / 2, y - sz / 2, sz * co + 0.3, sz * cosc + 0.3);
        }
      });
    });
    cx.globalAlpha = 1;
  };
  // hover: peak wind of the cell under the pointer, for each selected storm
  C.tip = function (ev) {
    var e = C.env, G = e.G, r = G.svg.node().getBoundingClientRect(), q = G.proj.invert([ev.clientX - r.left, ev.clientY - r.top]), out = A.el("div"), n = 0;
    if (!q || !e.vis(q)) return A.tipHide();
    e.st.sel.forEach(function (s) {
      var f = e.fields[s.id];
      if (!f) return;
      for (var k = -1; k <= 1; k++) {
        var i = Math.floor((q[0] + 360 * k - f.b[0]) / f.res), j = Math.floor((f.b[3] - q[1]) / f.res);
        if (i < 0 || j < 0 || i >= f.n2 - 2 || j >= f.m2 - 2) continue;
        var x = Math.floor((f.cur || f.v)[(j + 1) * f.n2 + i + 1]);
        if (x >= 10) { out.appendChild(A.el("p", null, A.nm(s) + " " + s.season + ": " + x + " m/s" + (x >= 17 ? ", " + A.tx().cls[A.clsOf(x)] : ""))); n++; }
        break;
      }
    });
    if (!n) return A.tipHide();
    out.insertBefore(A.el("p", "se-label", TX[A.lang()].cell), out.firstChild);
    A.tipShow(ev.clientX, ev.clientY, out);
  };
})();
