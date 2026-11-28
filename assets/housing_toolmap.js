/* Housing atlas, section 6: the small map of the valuation tool. Housing.toolMap(el) -> {show(o), hl(i)}.
   o = {lon, lat, zoom, home: label, pts: [{lon, lat, n (1-5 for the similar listings, 0 for other listings nearby), card}]}.
   The map flies to the chosen place (the median location of listed homes in the ward or district); the similar
   listings are numbered as in the table, other listings of the same type nearby are small dots; hover or tap for a card.
   Listing coordinates are rounded to 0.01 degree, so points that share one are spread on a small spiral.
   Needs housing_core.js and housing_mapbase.js (MapLibre loader and base style). */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H || !H.mapBase) return;
  var MB = H.mapBase, INK = "#23272b", PAPER = "#faf9f5", DOT = "#8f5a32";
  var TX = {
    en: { home: "The home you described", homeM: "Placed at the median location of listed homes in the chosen ward or district.", zin: "Zoom in", zout: "Zoom out",
      note: "Numbers 1 to 5: the similar listings in the table. Small dots: other listings of the same type nearby. Locations are approximate (about 1 km).", gMob: "Use two fingers to move the map" },
    vi: { home: "Căn nhà bạn mô tả", homeM: "Đặt ở vị trí trung vị của các căn đã rao trong phường hoặc quận đã chọn.", zin: "Phóng to", zout: "Thu nhỏ",
      note: "Số 1 đến 5: các căn tương tự trong bảng. Chấm nhỏ: các tin cùng loại khác ở gần. Vị trí là gần đúng (khoảng 1 km).", gMob: "Dùng hai ngón tay để di chuyển bản đồ" }
  };
  function tx(k) { return TX[H.lang()][k]; }

  function spread(pts) { // points on one rounded coordinate go round a spiral of about 120 m steps
    var seen = {};
    pts.forEach(function (p) {
      var k = p.lon.toFixed(3) + "," + p.lat.toFixed(3), j = seen[k] = (seen[k] || 0) + 1;
      if (j > 1) { var a = j * 2.4, r = 0.0011 * Math.sqrt(j - 1); p.x = p.lon + r * Math.cos(a) / Math.cos(p.lat * Math.PI / 180); p.y = p.lat + r * Math.sin(a); }
      else { p.x = p.lon; p.y = p.lat; }
    });
    return pts;
  }

  H.toolMap = function (el) {
    var box = H.el("div", "hs-mapbox"); el.appendChild(box);
    var bar = H.el("div", "hs-zbar"), zc = MB.zctl(el), zin = zc.zin, zout = zc.zout, note = H.el("span", "hs-zhint");
    bar.appendChild(note);
    el.parentNode.insertBefore(bar, el.nextSibling);
    var map = null, ready = null, last = null, pts = [], hov = null;
    zin.addEventListener("click", function () { if (map) map.zoomIn(); });
    zout.addEventListener("click", function () { if (map) map.zoomOut(); });
    function paint() { zin.setAttribute("aria-label", tx("zin")); zout.setAttribute("aria-label", tx("zout")); note.textContent = tx("note"); }
    function start() {
      if (ready) return ready;
      if (!MB.glOK()) { el.parentNode.removeChild(el); bar.remove(); ready = Promise.reject(new Error("webgl")); ready.catch(function () {}); return ready; }
      ready = MB.loadML().then(function (ml) {
        return new Promise(function (ok) {
          map = new ml.Map({ container: box, style: MB.STYLE, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, fadeDuration: 0,
            cooperativeGestures: false, locale: { "CooperativeGesturesHandler.MobileHelpText": tx("gMob") }, center: [105.85, 21.03], zoom: 12 });
          if (!MB.coarse) map.scrollZoom.disable();
          if (MB.coarse) map.dragPan.disable(); // no cooperative overlay: one finger scrolls the page, two fingers zoom and move
          map.touchZoomRotate.disableRotation();
          map.on("load", function () {
            try { MB.tune(map); MB.baseNames(map); } catch (e) { if (window.console) console.warn("housing atlas: base style", e); }
            map.addSource("tm", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({ id: "tm-near", type: "circle", source: "tm", filter: ["==", ["get", "n"], 0],
              paint: { "circle-color": DOT, "circle-opacity": 0.75, "circle-radius": ["case", ["boolean", ["feature-state", "hov"], false], 7, 4.5], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
            map.addLayer({ id: "tm-comp", type: "circle", source: "tm", filter: [">", ["get", "n"], 0],
              paint: { "circle-color": INK, "circle-radius": ["case", ["boolean", ["feature-state", "hov"], false], 12, 9.5], "circle-stroke-color": "#fff", "circle-stroke-width": 1.6 } });
            map.addLayer({ id: "tm-num", type: "symbol", source: "tm", filter: [">", ["get", "n"], 0],
              layout: { "text-field": ["to-string", ["get", "n"]], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true, "text-ignore-placement": true },
              paint: { "text-color": PAPER } });
            map.addSource("tm-home", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({ id: "tm-home", type: "circle", source: "tm-home",
              paint: { "circle-color": "rgba(31,95,122,0.12)", "circle-radius": 16, "circle-stroke-color": "#1f5f7a", "circle-stroke-width": 2.2 } });
            map.addLayer({ id: "tm-home-c", type: "circle", source: "tm-home", paint: { "circle-color": "#1f5f7a", "circle-radius": 3.5 } });
            wire(); ok();
          });
        });
      });
      ready.catch(function (e) { if (window.console) console.warn("housing atlas tool map:", e); });
      return ready;
    }
    function find(pt) {
      var r = 8, q = map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers: ["tm-comp", "tm-near", "tm-home"] });
      if (!q.length) return null;
      q.sort(function (a, b) { return (b.layer.id === "tm-comp") - (a.layer.id === "tm-comp"); });
      return q[0];
    }
    function card(f) {
      if (f.layer.id === "tm-home") return H.card({ h: tx("home"), m: [last && last.home ? last.home : "", tx("homeM")].filter(Boolean) });
      return pts[f.properties.i].card();
    }
    function setHov(id) {
      if (hov === id) return;
      if (hov != null) map.setFeatureState({ source: "tm", id: hov }, { hov: false });
      hov = id; if (id != null) map.setFeatureState({ source: "tm", id: id }, { hov: true });
    }
    function wire() {
      var cv = map.getCanvasContainer();
      cv.addEventListener("pointermove", function (ev) {
        if (ev.pointerType !== "mouse" || ev.buttons) return;
        var r = cv.getBoundingClientRect(), f = find({ x: ev.clientX - r.left, y: ev.clientY - r.top });
        if (!f) { setHov(null); H.tip.hide(); return; }
        setHov(f.layer.id === "tm-home" ? null : f.id); H.tip.show(ev.clientX, ev.clientY, card(f));
      });
      cv.addEventListener("pointerleave", function () { setHov(null); H.tip.hide(); });
      map.on("click", function (e) {
        var f = find(e.point), ev = e.originalEvent;
        if (!f) { setHov(null); H.tip.hide(); return; }
        setHov(f.layer.id === "tm-home" ? null : f.id); H.tip.show(ev.clientX, ev.clientY, card(f));
      });
      map.on("movestart", function () { if (!H.touch) H.tip.hide(); });
    }
    function draw() {
      if (!map || !last) return;
      pts = spread(last.pts.slice());
      map.getSource("tm").setData({ type: "FeatureCollection", features: pts.map(function (p, i) {
        return { type: "Feature", id: i, properties: { n: p.n || 0, i: i }, geometry: { type: "Point", coordinates: [p.x, p.y] } };
      }) });
      map.getSource("tm-home").setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [last.lon, last.lat] } }] });
      var key = last.lon.toFixed(4) + last.lat.toFixed(4) + last.zoom;
      if (key !== draw.key) { draw.key = key; map.flyTo({ center: [last.lon, last.lat], zoom: last.zoom, duration: H.reduced() ? 0 : 900, essential: true }); }
    }
    H.onLang(function () { paint(); if (map) { MB.baseNames(map); if (map._locale) map._locale["CooperativeGesturesHandler.MobileHelpText"] = tx("gMob"); } });
    paint();
    return {
      show: function (o) { last = o; start().then(draw, function () {}); },
      hl: function (i) { if (map && map.getSource("tm")) setHov(i == null ? null : i); }
    };
  };
})();
