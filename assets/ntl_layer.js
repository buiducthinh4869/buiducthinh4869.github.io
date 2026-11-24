/* Storm atlas: night-light images by year (assets/ntl/), for the globe (storm_globe.js) and any other consumer (the flat map).
   Loaded before its consumers. Two parts:
   Atlas.ntl (shared, no consumer state): dir, years, dflt (index.json default year), FADE (300 ms),
     yearFor(y, ys): newest year not after y; the earliest for earlier y; the latest for later y (ys defaults to the index years),
     load(): the one shared promise of index.json (null on failure; retry() makes the next load() fetch again),
     decode(url): Promise of {w, h, data} (8-bit grey, row 0 = north, from the PNG's red channel),
     pixels(year): Promise of the same for the image of that year, cached (4 years kept), requests de-duplicated,
     keyText(year, pre, lang): "Night lights: 2005" (EN, VI), with the "(no earlier satellite image)" note when pre,
     fadeU(now, t0, reduce): crossfade progress 0..1 over FADE ms (1 when reduce),
     colors(n, t95): the n ink colours of the night-light ramp (d3 needed), as storm_globe.js draws them; bin = min(n - 1, floor(grey / 256 * n)), t95 = index meta.lights.scale.ink_from.
   Atlas.ntlLayer(env) -> controller with its own state (several can live on one page). env hooks:
     lead() the first shown storm {season} or the year source (a season or calendar year in .season), null for the default year,
     build(pixels, year) -> the layer object (opaque here; may be a Promise), draw(cx, layer, keep, arg) paints a layer (keep = true
     for the layer on screen, so twinkle points come from it only), redraw() asks for another frame, reduce() no crossfade,
     optional changed() (new layer or note: key text and redraw; default redraw), optional defaultLayer() -> {layer, year} or null
     (not ready yet: sync waits); without it the default is the index's default year, built like any other.
   Controller: sync() picks the layer for the state on screen (call after every change of it), reset(hold) back to the default
   (not when hold; a failed index is tried again), paint(cx, now, arg), and the read-only cur (layer), year (its year), pre (earlier
   than the earliest image), from (layer fading out), def. A failed index or image leaves the current layer and raises no error. */
(function () {
  "use strict";
  var A = window.Atlas;
  if (!A) return;
  var N = A.ntl = { dir: "assets/ntl/", FADE: 300, years: [], dflt: null };
  var ix = null, bad = false, file = "ntl_{year}.png", px = {}, pord = [];
  var KT = {
    en: ["Night lights: {y}", "(no earlier satellite image)"],
    vi: ["Ánh sáng ban đêm: {y}", "(không có ảnh vệ tinh sớm hơn)"]
  };

  N.yearFor = function (y, ys) {
    var best = null, min = null;
    (ys || N.years).forEach(function (v) { if (v <= y && (best == null || v > best)) best = v; if (min == null || v < min) min = v; });
    return best == null ? min : best;
  };
  N.keyText = function (y, pre, lang) { var t = KT[lang] || KT.en; return t[0].replace("{y}", y) + (pre ? " " + t[1] : ""); };
  N.fadeU = function (now, t0, reduce) { return reduce ? 1 : Math.min(1, Math.max(0, (now - t0) / N.FADE)); };
  N.colors = function (n, t95) {
    var lo = d3.interpolateRgb("#faf9f5", "#1f5f7a"), hi = d3.interpolateRgb("#1f5f7a", "#23272b"), out = [];
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, a = Math.min(1, t / t95);
      out.push(d3.interpolateRgb("#e6e2d8", d3.rgb(t <= t95 ? lo(t / t95) : hi((t - t95) / (1 - t95))))(a));
    }
    return out;
  };
  N.load = function () {
    if (!ix) ix = A.getJSON(N.dir + "index.json").then(function (d) {
      N.years = (d.years || []).map(Number).sort(function (a, b) { return a - b; });
      N.dflt = d["default"] != null ? +d["default"] : N.years[N.years.length - 1];
      file = d.file || file;
      bad = !N.years.length;
      return bad ? null : d;
    }).catch(function (e) { bad = true; if (window.console) console.warn(e); return null; });
    return ix;
  };
  N.retry = function () { if (bad) { ix = null; bad = false; } };
  N.decode = function (url) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, c = document.createElement("canvas");
        c.width = w; c.height = h;
        var cx = c.getContext("2d", { willReadFrequently: true });
        cx.drawImage(im, 0, 0);
        var rgba = cx.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
        for (var i = 0; i < g.length; i++) g[i] = rgba[4 * i];
        ok({ w: w, h: h, data: g });
      };
      im.onerror = function () { no(new Error(url + " missing")); };
      im.src = url;
    });
  };
  N.pixels = function (y) {
    var i = pord.indexOf(y);
    if (i >= 0) { pord.splice(i, 1); pord.push(y); } // most recently used last
    if (px[y]) return px[y];
    return px[y] = N.load().then(function (d) {
      if (!d) throw new Error("ntl index missing");
      return N.decode(N.dir + file.replace("{year}", y));
    }).then(function (p) {
      pord.push(y);
      while (pord.length > 4) delete px[pord.shift()];
      return p;
    }, function (e) { delete px[y]; throw e; });
  };

  A.ntlLayer = function (env) {
    var K = { cur: null, year: null, pre: false, from: null, def: null, t0: 0 }, lay = {}, ord = [], want = null, fromYear = null, defYear = null, waiting = false;
    var reduce = function () { return !!(env.reduce && env.reduce()); };
    function changed() { (env.changed || env.redraw)(); }
    function defLayer() {
      if (!K.def && env.defaultLayer) { var d = env.defaultLayer(); if (d) { K.def = d.layer; defYear = d.year; } }
      return K.def;
    }
    function load(y) { // the layer of a year: built once from the shared pixels; a few kept, the oldest not in use dropped
      if (lay[y]) return lay[y];
      return lay[y] = N.pixels(y).then(function (p) { return env.build(p, y); }).then(function (L) {
        ord.push(y);
        for (var i = 0; ord.length > 4 && i < ord.length;) {
          var v = ord[i];
          if (v === K.year || v === fromYear || v === want || v === y) i++;
          else { ord.splice(i, 1); delete lay[v]; }
        }
        return L;
      }).catch(function (e) { delete lay[y]; throw e; });
    }
    function swap(L, y, pre) {
      K.from = reduce() ? null : K.cur; fromYear = K.year; // no crossfade under reduced motion
      K.cur = L; K.year = y; K.pre = pre; K.t0 = performance.now();
      changed();
    }
    K.sync = function () {
      var d = defLayer(), lead = env.lead(), w, pre = false;
      if (env.defaultLayer && !d) return; // the default layer is not ready yet
      if (!K.cur && d) swap(d, defYear, false);
      if (lead || !d) {
        if (!N.years.length) { // the index first, then again
          if (!waiting) { waiting = true; N.load().then(function (x) { waiting = false; if (x) K.sync(); }); }
          return;
        }
      }
      if (lead) { w = N.yearFor(lead.season); pre = lead.season < N.years[0]; } else w = d ? defYear : N.dflt;
      if (K.year === w) { want = w; if (K.pre !== pre) { K.pre = pre; changed(); } return; }
      if (want === w) return; // asked for already (loading, or failed: the current layer stays)
      want = w;
      if (d && w === defYear) return swap(d, w, pre);
      load(w).then(function (L) {
        if (want !== w || K.cur === L) return; // the state moved on, or an earlier request for this year already put it on screen
        swap(L, w, pre);
        N.years.filter(function (v) { return v > w && v !== defYear; }).slice(0, 2).forEach(function (v, i) { // prefetch the next two
          setTimeout(function () { load(v).catch(function () {}); }, 400 * (i + 1));
        });
      }).catch(function (e) { if (window.console) console.warn(e); });
    };
    K.reset = function (hold) {
      want = null;
      N.retry();
      if (!hold) K.sync();
    };
    // paint the layers into cx; during a change the old one fades out while the new one comes in over it (no dip in the middle)
    K.paint = function (cx, now, arg) {
      if (!K.cur) return;
      cx.globalAlpha = 1;
      if (K.from) {
        var u = N.fadeU(now, K.t0, reduce());
        if (u < 1) { cx.globalAlpha = 1 - u; env.draw(cx, K.from, false, arg); cx.globalAlpha = Math.min(1, 2 * u); env.redraw(); } else K.from = null;
      }
      env.draw(cx, K.cur, true, arg);
      cx.globalAlpha = 1;
    };
    return K;
  };
})();
