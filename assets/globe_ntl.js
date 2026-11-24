/* Storm atlas, section 3: which night-light image the globe shows (assets/ntl/). Loaded before storm_globe.js, which draws it.
   Not playing: lights.png (2025) with the 0.05 degree tiles, as before. While a play-time state is on screen (Play, Pause, a step
   or the scrubber), the season of the first selected storm picks the image: the newest year not after the season, the earliest
   year for earlier seasons. Tiles exist for 2025 only, so storm_globe.js draws them only with the default layer. The index and
   the images load lazily; a failed index or image leaves the current layer in place and raises no error.
   Twinkle (in storm_globe.js) takes its points from the image being shown: they are collected while the cells are drawn.
   storm_globe.js sets N.env = { load(url) -> Promise of a layer {bins, tiles}, lead() -> the first selected storm while a
   play-time state is on screen (else null), changed() (key text and redraw), reduce (no crossfade) } and N.def (the 2025 layer). */
(function () {
  "use strict";
  var A = window.Atlas;
  if (!A) return;
  var N = A.ntl = { dir: "assets/ntl/", fade: 300, years: [], def: null, cur: null, from: null, t0: 0, pre: false, env: null };
  var lay = {}, ord = [], want = null, ix = null, file = "ntl_{year}.png";

  // the image year for a storm season; ys = sorted years (default: those of index.json)
  N.yearFor = function (y, ys) {
    var best = null, min = null;
    (ys || N.years).forEach(function (v) { if (v <= y && (best == null || v > best)) best = v; if (min == null || v < min) min = v; });
    return best == null ? min : best;
  };
  function index() {
    if (!ix) ix = A.getJSON(N.dir + "index.json").then(function (d) {
      N.years = (d.years || []).map(Number).sort(function (a, b) { return a - b; });
      file = d.file || file;
      if (!N.years.length) return null;
      N.sync();
      return d;
    }).catch(function (e) { if (window.console) console.warn(e); return null; });
    return ix;
  }
  function load(y) {
    if (lay[y]) return lay[y];
    return lay[y] = N.env.load(N.dir + file.replace("{year}", y)).then(function (L) {
      L.year = y;
      ord.push(y);
      for (var i = 0; ord.length > 4 && i < ord.length;) { // keep a few layers; drop the oldest not in use
        var v = ord[i];
        if ((N.cur && v === N.cur.year) || (N.from && v === N.from.year) || v === want || v === y) i++;
        else { ord.splice(i, 1); delete lay[v]; }
      }
      return L;
    }).catch(function (e) { delete lay[y]; throw e; });
  }
  function swap(L, pre) {
    N.from = N.env.reduce ? null : N.cur; // no crossfade under reduced motion
    N.cur = L; N.pre = pre; N.t0 = performance.now();
    N.env.changed();
  }
  // the image that goes with the state on screen; called after every change of that state
  N.sync = function () {
    if (!N.def || !N.env) return;
    var lead = N.env.lead(), w = N.def.year, pre = false;
    if (lead) {
      if (!N.years.length) { index(); return; }
      w = N.yearFor(lead.season);
      pre = lead.season < N.years[0];
    }
    if (N.cur.year === w) { want = w; if (N.pre !== pre) { N.pre = pre; N.env.changed(); } return; }
    if (want === w) return; // asked for already (loading, or failed: the current layer stays)
    want = w;
    if (w === N.def.year) return swap(N.def, pre);
    load(w).then(function (L) {
      if (want !== w) return;
      swap(L, pre);
      N.years.filter(function (v) { return v > w && v !== N.def.year; }).slice(0, 2).forEach(function (v, i) { // prefetch the next two
        setTimeout(function () { load(v).catch(function () {}); }, 400 * (i + 1));
      });
    }).catch(function (e) { if (window.console) console.warn(e); });
  };
  // Stop or reset: back to the default layer (not when hold: Play is about to pick the year); a failed index or image is tried again
  N.reset = function (hold) {
    want = null;
    if (ix && !N.years.length) ix = null;
    if (!hold) N.sync();
  };
})();
