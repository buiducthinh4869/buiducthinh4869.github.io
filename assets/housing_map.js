/* Housing atlas, section 1: Housing.map(fig, opts). MapLibre GL over OpenFreeMap vector tiles (recoloured, no country
   borders); new wards coloured by price under roads, water and names; facilities, metro, names; 3D columns.
   opts.teaser: city switch and hover only. Data: wards_<c>, metro, districts, meta. See CLAUDE.md, "Housing atlas". */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H || !H.mapBase) return;

  var ML = "4.7.1", CDN = ["https://cdn.jsdelivr.net/npm/maplibre-gl@" + ML + "/dist/", "https://unpkg.com/maplibre-gl@" + ML + "/dist/"];
  var STYLE = "https://tiles.openfreemap.org/styles/positron";
  var INK = "#23272b", PAPER = "#faf9f5", MUTED = "#6b6f72";
  var MIN_N = 5, K = 8, SHRINK = 0.45, H3D = 1500; // a ward needs 5 listings; pull toward the former district with weight 8
  var BRK = { idx: [0.7, 0.85, 1, 1.15, 1.35, 1.7], ppm: [60, 100, 150, 200, 300, 450] };
  function sub(list) { return ["in", ["get", "subclass"], ["literal", list]]; }
  var POI = { // what a buyer looks for nearby; from the base tiles' poi layer (OpenStreetMap tags)
    edu: { col: "#2a6fc0", z: 12.5, f: ["any", ["in", ["get", "class"], ["literal", ["school", "college"]]], sub(["kindergarten", "school", "university", "college"])] },
    health: { col: "#c95f8c", z: 12.5, f: ["any", ["==", ["get", "class"], "hospital"], sub(["hospital", "clinic", "doctors", "pharmacy"])] },
    shop: { col: "#5a4ac4", z: 12.5, f: ["any", ["==", ["get", "class"], "grocery"], sub(["mall", "department_store", "supermarket", "marketplace"])] },
    park: { col: "#179a6c", z: 13, f: sub(["park", "garden", "playground", "sports_centre", "pitch"]) },
    bus: { col: "#6b6f72", z: 14.5, f: sub(["bus_stop", "bus_station"]) }
  };
  var LAYERS = ["price", "wards", "metro", "edu", "health", "shop", "park", "bus", "cbd"];

  var TX = {
    en: {
      price: "Ward prices", wards: "Ward borders", metro: "Metro", edu: "Schools", health: "Hospitals and clinics", shop: "Markets and shopping", park: "Parks", bus: "Bus stops", cbd: "City centre",
      view: "View", angle: "Turn", layers: "Layers", metric: "Show",
      idx: "Price index", ppm: "Price per m²",
      lgIdx: "Asking price per m² of houses and land in the ward, relative to the city average (×1 = average)",
      lgPpm: "Median asking price per m², all homes in the ward (million VND)",
      lgIdxS: "Price vs city average, houses and land", lgPpmS: "Median price per m², million VND",
      few: "Fewer than 5 listings", h3d: "In 3D, the height of each column is the same figure.", poiLg: "Zoom in to see schools, hospitals, markets, parks and bus stops.",
      newWard: " (new)", oldBy: "Former {d}, as the listings name it", oldGadm: "Former {d}, by the old boundary",
      rIdx: "Price vs city average", rPpm: "Median asking price, all homes", rN: "Listings in this ward", rSeg: "Market type",
      above: "Houses and land here are asked about {p} above the city average for a similar home.",
      below: "Houses and land here are asked about {p} below the city average for a similar home.",
      near: "Houses and land here are asked close to the city average.",
      thin: "Only {n} listings: read this ward with care.", none: "Too few listings for a price here.",
      st: "Metro station", line: "Line", centre: "City centre", centreM: "Distances in section 2 are measured from here.",
      poiK: { edu: "School, kindergarten or university", health: "Hospital, clinic or pharmacy", shop: "Market, supermarket or shopping centre", park: "Park or sports ground", bus: "Bus stop" },
      clickT: "Click to open the housing atlas.", clickF: "Click to value a home in this former district.",
      tapT: "Tap again to open the housing atlas.", tapF: "Tap again to value a home in this former district.",
      load: "Loading the map…", nogl: "This map needs WebGL, which this browser does not offer.",
      gWin: "Use Ctrl + scroll to zoom the map", gMac: "Use ⌘ + scroll to zoom the map", gMob: "Use two fingers to move the map"
    },
    vi: {
      price: "Giá theo phường", wards: "Ranh giới phường", metro: "Metro", edu: "Trường học", health: "Bệnh viện, phòng khám", shop: "Chợ và mua sắm", park: "Công viên", bus: "Điểm dừng xe buýt", cbd: "Trung tâm",
      view: "Kiểu xem", angle: "Xoay", layers: "Lớp", metric: "Hiển thị",
      idx: "Chỉ số giá", ppm: "Giá mỗi m²",
      lgIdx: "Giá rao mỗi m² của nhà và đất trong phường, so với trung bình thành phố (×1 = trung bình)",
      lgPpm: "Giá rao trung vị mỗi m², mọi loại nhà trong phường (triệu đồng)",
      lgIdxS: "Giá so với trung bình TP, nhà và đất", lgPpmS: "Giá trung vị mỗi m², triệu đồng",
      few: "Dưới 5 tin", h3d: "Ở bản 3D, chiều cao mỗi cột cũng là con số này.", poiLg: "Phóng to để thấy trường học, bệnh viện, chợ, công viên và điểm dừng xe buýt.",
      newWard: " (phường mới)", oldBy: "{d} cũ, theo tin rao", oldGadm: "{d} cũ, theo ranh giới cũ",
      rIdx: "Giá so với trung bình thành phố", rPpm: "Giá rao trung vị, mọi loại nhà", rN: "Số tin trong phường", rSeg: "Kiểu thị trường",
      above: "Nhà và đất ở đây được rao cao hơn trung bình thành phố khoảng {p}, với nhà tương tự.",
      below: "Nhà và đất ở đây được rao thấp hơn trung bình thành phố khoảng {p}, với nhà tương tự.",
      near: "Nhà và đất ở đây được rao gần mức trung bình thành phố.",
      thin: "Chỉ có {n} tin: nên đọc phường này thận trọng.", none: "Quá ít tin để tính giá ở đây.",
      st: "Ga metro", line: "Tuyến", centre: "Trung tâm thành phố", centreM: "Khoảng cách ở mục 2 tính từ điểm này.",
      poiK: { edu: "Trường học, mầm non hoặc đại học", health: "Bệnh viện, phòng khám hoặc nhà thuốc", shop: "Chợ, siêu thị hoặc trung tâm thương mại", park: "Công viên hoặc sân thể thao", bus: "Điểm dừng xe buýt" },
      clickT: "Bấm để mở bản đồ nhà đất.", clickF: "Bấm để định giá một căn trong quận cũ này.",
      tapT: "Chạm lần nữa để mở bản đồ nhà đất.", tapF: "Chạm lần nữa để định giá một căn trong quận cũ này.",
      load: "Đang tải bản đồ…", nogl: "Bản đồ này cần WebGL, trình duyệt này chưa hỗ trợ.",
      gWin: "Giữ Ctrl và cuộn để phóng to bản đồ", gMac: "Giữ ⌘ và cuộn để phóng to bản đồ", gMob: "Dùng hai ngón tay để di chuyển bản đồ"
    }
  };
  function tx(k) { return TX[H.lang()][k]; }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }

  // ------------------------------------------------------------------ MapLibre, loaded once on demand
  var mlP = null;
  function addTag(tag, attrs) {
    return new Promise(function (ok, bad) {
      var e = document.createElement(tag);
      Object.keys(attrs).forEach(function (k) { e[k] = attrs[k]; });
      e.onload = ok; e.onerror = function () { e.remove(); bad(new Error(attrs.src || attrs.href)); };
      document.head.appendChild(e);
    });
  }
  function loadML() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (mlP) return mlP;
    function from(i) {
      if (i >= CDN.length) return Promise.reject(new Error("maplibre-gl"));
      return Promise.all([addTag("script", { src: CDN[i] + "maplibre-gl.js" }), addTag("link", { rel: "stylesheet", href: CDN[i] + "maplibre-gl.css" })])
        .then(function () { return window.maplibregl; }, function () { return from(i + 1); });
    }
    mlP = from(0);
    mlP.catch(function () { mlP = null; });
    return mlP;
  }
  function glOK() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ ward figures (computed here from the exported fields)
  var cityData = {};
  function prepCity(c) {
    if (cityData[c]) return cityData[c];
    cityData[c] = H.load("wards_" + c).then(function (g) {
      var F = g.features, byD = {};
      F.forEach(function (f) {
        var p = f.properties;
        if (p.n >= MIN_N && p.v_med > 0) { var d = byD[p.d_old] = byD[p.d_old] || [0, 0]; d[0] += p.n * Math.log(p.v_med); d[1] += p.n; }
      });
      var towers = [], minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      F.forEach(function (f, i) {
        var p = f.properties, ok = p.n >= MIN_N && p.v_med > 0, d = byD[p.d_old];
        var tgt = d && d[1] > p.n ? (d[0] - p.n * Math.log(p.v_med || 1)) / (d[1] - p.n) : 0; // other wards of the same former district
        p.vi = ok ? Math.exp((p.n * Math.log(p.v_med) + K * tgt) / (p.n + K)) : null;
        p.pm = ok && p.ppm2_med != null ? p.ppm2_med : null;
        p.k = i;
        f.id = i;
        if (p.vi != null && near(p.c, c)) eachXY(f.geometry, function (x, y) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); });
        if (p.vi != null) towers.push({ type: "Feature", id: i, properties: p, geometry: shrink(f.geometry, p.c, SHRINK) });
      });
      return { wards: g, towers: { type: "FeatureCollection", features: towers }, box: [[minx, miny], [maxx, maxy]] };
    });
    cityData[c].catch(function () { delete cityData[c]; });
    return cityData[c];
  }
  var CB = { hn: [105.8522, 21.0285], hcm: [106.698, 10.7725] }, FIT_KM = 16; // the first view frames priced wards within 16 km of the centre
  function near(q, c) { var o = CB[c], dx = (q[0] - o[0]) * 111.32 * Math.cos(o[1] * Math.PI / 180), dy = (q[1] - o[1]) * 110.57; return Math.sqrt(dx * dx + dy * dy) <= FIT_KM; }
  function eachXY(geom, fn) {
    (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates).forEach(function (poly) {
      poly.forEach(function (ring) { ring.forEach(function (q) { fn(q[0], q[1]); }); });
    });
  }
  function shrink(geom, c, s) {
    var f = function (ring) { return ring.map(function (q) { return [c[0] + (q[0] - c[0]) * s, c[1] + (q[1] - c[1]) * s]; }); };
    var polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    var big = polys.reduce(function (a, b) { return b[0].length > a[0].length ? b : a; }); // the main part only
    return { type: "Polygon", coordinates: big.map(f) };
  }
  function cls(v, b) { if (v == null) return -1; var i = 0; while (i < b.length && v >= b[i]) i++; return i; }
  function colorExpr(prop, b) {
    var e = ["step", ["coalesce", ["get", prop], -1], "rgba(0,0,0,0)", 0, H.RAMP[0]];
    b.forEach(function (t, i) { e.push(t, H.RAMP[i + 1]); });
    return e;
  }

  var MB = H.mapBase, tune = MB.tune, baseNames = MB.baseNames, firstOf = MB.firstOf, firstSymbol = MB.firstSymbol, hatch = MB.hatch;

  // ------------------------------------------------------------------ the map
  H.map = function (fig, opts) {
    opts = opts || {};
    var teaser = !!opts.teaser, plot = fig.querySelector(".hs-plot");
    if (!plot) { plot = H.el("div", "hs-plot"); fig.insertBefore(plot, fig.firstChild); }
    var st = {
      c: H.st.c || "hn", v: teaser ? "2d" : (H.st.v || "2d"), m: "idx",
      l: teaser ? ["price"] : (H.st.l && H.st.l.length ? H.st.l : ["price", "wards", "metro", "cbd"]).filter(function (k) { return LAYERS.indexOf(k) >= 0; }),
      th: -20
    };
    var map = null, cur = null, D = null, M = null, CBD = null, hovId = null, hlKey = "", tapKey = null, lastEmit = "", self = false;
    var box = H.el("div", "hs-mapbox"); plot.appendChild(box);
    var legend = H.el("div", "hs-mlegend"); plot.appendChild(legend);
    var status = H.el("p", "hs-status"); plot.appendChild(status);

    // controls
    var bar = H.el("div", "hs-bar"); fig.insertBefore(bar, plot);
    function btnGroup(key, vals) {
      var g = H.el("span", "hs-group"); g.setAttribute("role", "group");
      vals.forEach(function (v) {
        var b = H.el("button", "hs-btn"); b.type = "button"; b.dataset[key] = v;
        b.addEventListener("click", function () { choose(key, v); });
        g.appendChild(b);
      });
      bar.appendChild(g); return g;
    }
    var gCity = btnGroup("c", ["hn", "hcm"]), gView = null, gMet = null, angle = null, rng = null, gLay = null;
    if (!teaser) {
      gMet = btnGroup("m", ["idx", "ppm"]);
      gView = btnGroup("v", ["2d", "3d"]);
      angle = H.el("label", "hs-angle"); angle.appendChild(H.el("span"));
      rng = document.createElement("input"); rng.type = "range"; rng.min = -180; rng.max = 180; rng.step = 5; rng.value = st.th;
      rng.addEventListener("input", function () { st.th = +rng.value; if (map) map.setBearing(st.th); });
      angle.appendChild(rng); bar.appendChild(angle);
      gLay = H.el("span", "hs-layers");
      LAYERS.forEach(function (k) {
        var lb = H.el("label", "hs-chk"), cb = document.createElement("input");
        cb.type = "checkbox"; cb.dataset.layer = k;
        cb.addEventListener("change", function () {
          var l = st.l.filter(function (x) { return x !== k; }); if (cb.checked) l.push(k);
          st.l = LAYERS.filter(function (x) { return l.indexOf(x) >= 0; });
          H.set({ l: st.l }); vis(); paint();
        });
        lb.appendChild(cb);
        if (POI[k]) { var dot = H.el("span", "hs-poidot"); dot.style.background = POI[k].col; lb.appendChild(dot); }
        lb.appendChild(H.el("span", "hs-chk-t")); gLay.appendChild(lb);
      });
      bar.appendChild(gLay);
    }
    function on(k) { return st.l.indexOf(k) >= 0; }
    function paint() {
      gCity.setAttribute("aria-label", H.lang() === "vi" ? "Thành phố" : "City");
      gCity.querySelectorAll("button").forEach(function (b) { b.textContent = H.city(b.dataset.c); b.setAttribute("aria-pressed", String(b.dataset.c === st.c)); });
      if (gView) {
        gMet.setAttribute("aria-label", tx("metric"));
        gMet.querySelectorAll("button").forEach(function (b) { b.textContent = tx(b.dataset.m); b.setAttribute("aria-pressed", String(b.dataset.m === st.m)); });
        gView.setAttribute("aria-label", tx("view"));
        gView.querySelectorAll("button").forEach(function (b) { b.textContent = b.dataset.v.toUpperCase(); b.setAttribute("aria-pressed", String(b.dataset.v === st.v)); });
        angle.firstChild.textContent = tx("angle"); angle.hidden = st.v !== "3d";
        gLay.setAttribute("aria-label", tx("layers"));
        gLay.querySelectorAll("label").forEach(function (lb) {
          var cb = lb.firstChild; cb.checked = on(cb.dataset.layer); lb.lastChild.textContent = tx(cb.dataset.layer);
        });
      }
      box.setAttribute("aria-label", (st.m === "idx" ? tx("lgIdx") : tx("lgPpm")) + " · " + H.city(st.c));
      drawLegend();
    }
    function drawLegend() {
      legend.textContent = "";
      var b = BRK[st.m], idx = st.m === "idx", nar = plot.clientWidth < 600;
      legend.appendChild(H.el("div", "hs-lg-t", nar ? tx(idx ? "lgIdxS" : "lgPpmS") : tx(idx ? "lgIdx" : "lgPpm")));
      var row = H.el("div", "hs-lg-ramp");
      H.RAMP.forEach(function (c) { var s = H.el("span", "hs-lg-sw"); s.style.background = c; row.appendChild(s); });
      legend.appendChild(row);
      var ticks = H.el("div", "hs-lg-ticks");
      b.forEach(function (t, i) {
        if (nar && i % 2) return; // every other boundary on a narrow screen
        var s = H.el("span", null, idx ? "×" + H.nf(t, 2) : H.nf(t, 0));
        s.style.left = ((i + 1) / H.RAMP.length * 100) + "%"; ticks.appendChild(s);
      });
      legend.appendChild(ticks);
      var fw = H.el("div", "hs-lg-few"); fw.appendChild(H.el("span", "hs-lg-hatch")); fw.appendChild(H.el("span", null, tx("few"))); legend.appendChild(fw);
      if (!teaser && st.v === "3d") legend.appendChild(H.el("div", "hs-lg-n", tx("h3d")));
      if (!teaser && !nar && (on("edu") || on("health") || on("shop") || on("park") || on("bus")) && map && map.getZoom() < 12.5) legend.appendChild(H.el("div", "hs-lg-n", tx("poiLg")));
    }

    function choose(key, v) {
      if (st[key] === v) return;
      st[key] = v;
      if (key === "c") { if (!teaser) H.set({ c: v }); setCity(); }
      if (key === "v") { if (!teaser) H.set({ v: v }); view(true); vis(); }
      if (key === "m") recolor();
      paint();
    }

    // -------------------------------------------------------------- layers
    function addLayers() {
      var below = firstOf(map, ["water"]) , roads = firstOf(map, ["tunnel_motorway_casing", "highway_path", "highway_minor"]), top = firstSymbol(map);
      map.addSource("hs-wards", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("hs-towers", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("hs-metro", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("hs-cbd", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("hs-wlbl", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("hs-dlbl", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      hatch(map);
      map.addLayer({ id: "hs-few", type: "fill", source: "hs-wards", filter: ["<", ["get", "n"], MIN_N], paint: { "fill-pattern": "hs-hatch", "fill-opacity": 0.9, "fill-opacity-transition": { duration: 300 } } }, below);
      map.addLayer({ id: "hs-hit", type: "fill", source: "hs-wards", paint: { "fill-color": "#000", "fill-opacity": 0 } }, below);
      map.addLayer({ id: "hs-fill", type: "fill", source: "hs-wards", filter: [">=", ["get", "n"], MIN_N],
        paint: { "fill-color": colorExpr("vi", BRK.idx), "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.88, 13, 0.72, 15.5, 0.5] } }, below);
      map.addLayer({ id: "hs-line", type: "line", source: "hs-wards",
        paint: { "line-color": "#ffffff", "line-opacity": 0.85, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.6] } }, roads);
      map.addLayer({ id: "hs-line2", type: "line", source: "hs-wards", layout: { visibility: "none" },
        paint: { "line-color": INK, "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1.2] } }, top);
      map.addLayer({ id: "hs-3d", type: "fill-extrusion", source: "hs-towers", layout: { visibility: "none" },
        paint: { "fill-extrusion-color": colorExpr("vi", BRK.idx), "fill-extrusion-height": 0,
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0.92, 15.5, 0.12],
          "fill-extrusion-vertical-gradient": true } }, top);
      if (map.getSource("openmaptiles")) map.addLayer({ id: "hs-bld", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14, layout: { visibility: "none" },
        paint: { "fill-extrusion-color": "#e6e1d6", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 9], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.85] } }, top);
      map.setLight({ anchor: "viewport", position: [1.4, 200, 35], color: "#ffffff", intensity: 0.38 });
      map.addLayer({ id: "hs-metro-case", type: "line", source: "hs-metro", filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": PAPER, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 8] } }, top);
      map.addLayer({ id: "hs-metro-line", type: "line", source: "hs-metro", filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": INK, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 15, 4] } }, top);
      map.addLayer({ id: "hs-metro-st", type: "circle", source: "hs-metro", filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-color": PAPER, "circle-stroke-color": INK, "circle-stroke-width": 1.6, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.6, 15, 5] } });
      map.addLayer({ id: "hs-metro-lbl", type: "symbol", source: "hs-metro", minzoom: 12.5, filter: ["==", ["geometry-type"], "Point"],
        layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.4 } });
      Object.keys(POI).forEach(function (k) {
        if (!map.getSource("openmaptiles")) return;
        map.addLayer({ id: "hs-poi-" + k, type: "circle", source: "openmaptiles", "source-layer": "poi", minzoom: POI[k].z, filter: POI[k].f, layout: { visibility: "none" },
          paint: { "circle-color": POI[k].col, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2, "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.5, k === "bus" ? 2 : 3, 16, k === "bus" ? 4 : 6] } });
        map.addLayer({ id: "hs-poil-" + k, type: "symbol", source: "openmaptiles", "source-layer": "poi", minzoom: k === "bus" ? 16.5 : 15.6, filter: POI[k].f, layout: { visibility: "none",
          "text-field": ["coalesce", ["get", "name"], ""], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
          paint: { "text-color": POI[k].col, "text-halo-color": "#ffffff", "text-halo-width": 1.3 } });
      });
      map.addLayer({ id: "hs-wlbl", type: "symbol", source: "hs-wlbl", minzoom: 10.6,
        layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 10.6, 9.5, 12, 11, 15, 13.5],
          "symbol-sort-key": ["-", 0, ["get", "n"]], "text-padding": 3, "text-max-width": 7 },
        paint: { "text-color": "#2b2f33", "text-halo-color": "rgba(250,249,245,0.92)", "text-halo-width": 1.5 } });
      map.addLayer({ id: "hs-dlbl", type: "symbol", source: "hs-dlbl", maxzoom: 11.8,
        layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 11.5, 12.5],
          "text-transform": "none", "text-letter-spacing": 0.02, "symbol-sort-key": ["-", 0, ["get", "n"]], "text-padding": 4, "text-max-width": 7 },
        paint: { "text-color": "#3b3f43", "text-halo-color": "rgba(250,249,245,0.92)", "text-halo-width": 1.6 } });
      map.addLayer({ id: "hs-cbd-pt", type: "circle", source: "hs-cbd", paint: { "circle-color": PAPER, "circle-radius": 6, "circle-stroke-color": INK, "circle-stroke-width": 2 } });
      map.addLayer({ id: "hs-cbd-in", type: "circle", source: "hs-cbd", paint: { "circle-color": INK, "circle-radius": 1.8 } });
      map.addLayer({ id: "hs-cbd-lbl", type: "symbol", source: "hs-cbd", layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-anchor": "left", "text-offset": [0.9, 0] },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.6 } });
      map.addLayer({ id: "hs-hl", type: "line", source: "hs-wards",
        paint: { "line-color": ["case", ["boolean", ["feature-state", "hov"], false], INK, "#1f5f7a"], "line-width": 2.2,
          "line-opacity": ["case", ["boolean", ["feature-state", "hov"], false], 1, ["boolean", ["feature-state", "hl"], false], 0.95, 0] } });
    }
    function recolor() {
      if (!map || !map.getLayer("hs-fill")) return;
      var p = st.m === "idx" ? "vi" : "pm", b = BRK[st.m];
      map.setPaintProperty("hs-fill", "fill-color", colorExpr(p, b));
      map.setPaintProperty("hs-3d", "fill-extrusion-color", colorExpr(p, b));
      if (st.v === "3d") map.setPaintProperty("hs-3d", "fill-extrusion-height", hExpr());
    }
    function hExpr() { return st.m === "idx" ? ["*", ["get", "vi"], H3D] : ["*", ["coalesce", ["get", "pm"], 0], H3D / 160]; }
    var grown = false;
    function grow() { // columns rise from the ground each time 3D is switched on
      if (!map.getLayer("hs-3d")) return;
      if (st.v !== "3d") { grown = false; map.setPaintProperty("hs-3d", "fill-extrusion-height", 0); return; }
      if (grown) return; grown = true;
      if (H.reduced()) { map.setPaintProperty("hs-3d", "fill-extrusion-height", hExpr()); return; }
      var t0 = 0;
      (function step(ts) {
        t0 = t0 || ts; var k = Math.min(1, (ts - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        if (st.v !== "3d") return;
        map.setPaintProperty("hs-3d", "fill-extrusion-height", ["*", hExpr(), e]);
        if (k < 1) requestAnimationFrame(step);
      })(0);
    }
    function vis() {
      if (!map || !map.getLayer("hs-fill")) return;
      var d3v = st.v === "3d";
      function set(id, v) { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none"); }
      set("hs-fill", on("price")); set("hs-few", on("price"));
      map.setPaintProperty("hs-fill", "fill-opacity", d3v ? 0.45 : ["interpolate", ["linear"], ["zoom"], 10, 0.88, 13, 0.72, 15.5, 0.5]);
      set("hs-3d", d3v && on("price")); set("hs-bld", d3v); grow();
      map.setPaintProperty("hs-few", "fill-opacity", d3v ? 0.35 : 0.9);
      set("hs-line", on("price") || teaser); set("hs-line2", on("wards") && !teaser);
      ["hs-metro-case", "hs-metro-line", "hs-metro-st", "hs-metro-lbl"].forEach(function (id) { set(id, on("metro")); });
      Object.keys(POI).forEach(function (k) { set("hs-poi-" + k, on(k)); set("hs-poil-" + k, on(k)); });
      ["hs-cbd-pt", "hs-cbd-in", "hs-cbd-lbl"].forEach(function (id) { set(id, on("cbd")); });
    }
    function view(anim) {
      if (!map) return;
      var o = st.v === "3d" ? { pitch: 55, bearing: st.th } : { pitch: 0, bearing: 0 };
      if (anim && !H.reduced()) map.easeTo(Object.assign({ duration: 700 }, o)); else map.jumpTo(o);
    }
    function setCity() {
      if (!map) return;
      var my = st.c;
      status.textContent = tx("load"); status.hidden = false;
      prepCity(my).then(function (C) {
        if (my !== st.c) return;
        setHov(null); map.removeFeatureState({ source: "hs-wards" });
        cur = C;
        map.getSource("hs-wards").setData(C.wards);
        map.getSource("hs-towers").setData(C.towers);
        var mt = M && M[my] ? M[my] : { lines: [], stations: [] }, fs = [];
        mt.lines.forEach(function (l) { fs.push({ type: "Feature", properties: { name: l.name }, geometry: { type: "LineString", coordinates: l.coords } }); });
        mt.stations.forEach(function (s) { fs.push({ type: "Feature", properties: { name: s.name, line: nearLine(mt, s) }, geometry: { type: "Point", coordinates: [s.lon, s.lat] } }); });
        metroFC = { type: "FeatureCollection", features: fs };
        labels();
        var pad = teaser ? 8 : 24;
        map.setMaxBounds(null); map.setMinZoom(0);
        map.fitBounds(C.box, { padding: pad, duration: 0, pitch: st.v === "3d" ? 55 : 0, bearing: st.v === "3d" ? st.th : 0 });
        var b = C.box, dx = (b[1][0] - b[0][0]) * 0.6, dy = (b[1][1] - b[0][1]) * 0.6;
        map.setMaxBounds([[b[0][0] - dx, b[0][1] - dy], [b[1][0] + dx, b[1][1] + dy]]);
        map.setMinZoom(Math.max(8, map.getZoom() - 1));
        status.hidden = true; setHl(teaser ? "" : (H.st.d || ""));
      }).catch(function (e) { status.hidden = true; H.fail(fig, e); });
    }
    var metroFC = { type: "FeatureCollection", features: [] };
    function nearLine(mt, st0) { // the line whose vertices pass closest to the station
      var best = "", bd = 1e9;
      mt.lines.forEach(function (l) { l.coords.forEach(function (q) { var d = Math.abs(q[0] - st0.lon) + Math.abs(q[1] - st0.lat); if (d < bd) { bd = d; best = l.name; } }); });
      return best;
    }
    function labels() { // every name on the map, in the reader's language
      if (!map || !cur) return;
      cbdData();
      map.getSource("hs-metro").setData({ type: "FeatureCollection", features: metroFC.features.map(function (f) {
        if (f.geometry.type !== "Point") return f;
        return { type: "Feature", properties: { name: f.properties.name, line: f.properties.line, t: H.pn(f.properties.name) }, geometry: f.geometry };
      }) });
      map.getSource("hs-wlbl").setData({ type: "FeatureCollection", features: cur.wards.features.map(function (f) {
        return { type: "Feature", properties: { t: H.pn(f.properties.name, true), n: f.properties.n || 0 }, geometry: { type: "Point", coordinates: f.properties.c } };
      }) });
      map.getSource("hs-dlbl").setData({ type: "FeatureCollection", features: (D || []).filter(function (d) { return d.city === st.c; }).map(function (d) {
        return { type: "Feature", properties: { t: H.pn(d.name, true), n: d.n || 0 }, geometry: { type: "Point", coordinates: [d.lon, d.lat] } };
      }) });
    }
    function cbdData() {
      if (!map || !map.getSource("hs-cbd")) return;
      var p = CBD && CBD[st.c];
      map.getSource("hs-cbd").setData({ type: "FeatureCollection", features: p ? [{ type: "Feature", properties: { t: tx("centre") }, geometry: { type: "Point", coordinates: p } }] : [] });
    }
    function setHl(k) {
      if (!map || !cur) return;
      hlKey = k;
      cur.wards.features.forEach(function (f) { map.setFeatureState({ source: "hs-wards", id: f.id }, { hl: !!k && dk(f.properties.d_old) === k }); });
    }

    // -------------------------------------------------------------- hover and click
    function dk(name) {
      if (!D || !name) return "";
      var k = (st.c === "hn" ? "HN" : "HCM") + " | " + name;
      return D.some(function (d) { return d.key === k; }) ? k : "";
    }
    function seg(name) {
      var k = dk(name), d = k && D.filter(function (x) { return x.key === k; })[0];
      return d && d.seg ? d.seg : null;
    }
    function pick(pt) {
      if (!map || !map.getLayer("hs-fill")) return null;
      var ids = ["hs-metro-st", "hs-cbd-pt"].concat(Object.keys(POI).map(function (k) { return "hs-poi-" + k; }))
        .filter(function (id) { return map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none"; });
      var r = 6, P = [pt.x, pt.y], q = ids.length ? map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers: ids }) : [];
      if (q.length) return { f: q[0], kind: q[0].layer.id };
      var wl = ["hs-3d", "hs-fill", "hs-few"].filter(function (id) { return map.getLayoutProperty(id, "visibility") !== "none"; });
      if (!wl.length) wl = ["hs-hit"];
      q = map.queryRenderedFeatures(P, { layers: wl });
      if (!q.length && st.v === "2d") return null;
      return q.length ? { f: q[0], kind: "ward", id: q[0].id } : null;
    }
    function card(h) {
      var o = { rows: [], m: [] }, p = h.f.properties;
      if (h.kind === "hs-metro-st") { o.h = H.pn(p.name); o.rows.push([tx("st"), H.city(st.c)]); if (p.line) o.m.push(H.line(p.line)); return H.card(o); }
      if (h.kind === "hs-cbd-pt") { o.h = tx("centre"); o.m.push(tx("centreM")); return H.card(o); }
      if (h.kind.indexOf("hs-poi-") === 0) { var k = h.kind.slice(7); o.h = p.name ? (H.lang() === "en" ? H.ascii(p["name:en"] || p["name:latin"] || p.name) : p.name) : TX[H.lang()].poiK[k]; o.sw = POI[k].col; o.m.push(TX[H.lang()].poiK[k]); return H.card(o); }
      var w = cur.wards.features[h.id].properties;
      o.h = H.pn(w.name) + tx("newWard");
      if (w.d_old) o.m.push(fill(tx(w.d_old_src === "gadm" ? "oldGadm" : "oldBy"), { d: H.pn(w.d_old) }));
      if (w.vi != null) {
        o.rows.push([tx("rIdx"), "×" + H.nf(w.vi, 2)]);
        if (w.pm != null) o.rows.push([tx("rPpm"), H.ppm2(w.pm)]);
      }
      o.rows.push([tx("rN"), H.nf(w.n || 0, 0)]);
      var sg = seg(w.d_old);
      if (sg) { o.rows.push([tx("rSeg"), H.seg(sg).name]); o.sw = H.SEGC[sg]; }
      if (w.vi != null) {
        var d = w.vi - 1;
        o.m.push(Math.abs(d) < 0.05 ? tx("near") : fill(tx(d > 0 ? "above" : "below"), { p: H.pct(Math.abs(d), 0) }));
        if (w.n < 10) o.m.push(fill(tx("thin"), { n: H.nf(w.n, 0) }));
      } else o.m.push(tx("none"));
      if (teaser) o.m.push(tx(H.touch ? "tapT" : "clickT"));
      else if (dk(w.d_old)) o.m.push(tx(H.touch ? "tapF" : "clickF"));
      return H.card(o);
    }
    function setHov(id) {
      if (hovId === id) return;
      if (hovId != null) map.setFeatureState({ source: "hs-wards", id: hovId }, { hov: false });
      hovId = id;
      if (id != null) map.setFeatureState({ source: "hs-wards", id: id }, { hov: true });
    }
    function show(h, ev) {
      if (!h) { setHov(null); H.tip.hide(); emitHover(""); box.style.cursor = ""; return; }
      setHov(h.kind === "ward" ? h.id : null);
      box.style.cursor = h.kind === "ward" || teaser ? "pointer" : "default";
      H.tip.show(ev.clientX, ev.clientY, card(h));
      emitHover(h.kind === "ward" ? dk(cur.wards.features[h.id].properties.d_old) : "");
    }
    function emitHover(k) { if (teaser || k === lastEmit) return; lastEmit = k; self = true; H.emit("hover-district", k ? { key: k } : null); self = false; }
    function act(h) {
      if (teaser) { location.href = (opts.href || "housing.html") + "#c=" + st.c; return; }
      if (h.kind !== "ward") return;
      var k = dk(cur.wards.features[h.id].properties.d_old);
      if (k) { H.tip.hide(); H.set({ d: k }); H.emit("pick-district", { key: k }); }
    }
    function wire() {
      var cv = map.getCanvasContainer();
      cv.addEventListener("pointermove", function (ev) {
        if (ev.pointerType !== "mouse" || ev.buttons) return;
        var r = cv.getBoundingClientRect(); show(pick({ x: ev.clientX - r.left, y: ev.clientY - r.top }), ev);
      });
      cv.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") show(null, ev); });
      cv.addEventListener("pointerdown", function (ev) { H.touchLast = ev.pointerType !== "mouse"; H.touch = H.touchLast; });
      map.on("click", function (e) {
        var ev = e.originalEvent, h = pick(e.point), touch = H.touch;
        if (!h) { tapKey = null; show(null, ev); return; }
        var key = h.kind + (h.id != null ? h.id : h.f.properties.name);
        if (touch && tapKey !== key) { tapKey = key; show(h, ev); return; } // first tap shows the card, the second acts
        tapKey = null; act(h);
      });
      map.on("movestart", function () { if (H.touch) return; H.tip.hide(); });
      map.on("zoomend", drawLegend);
      map.on("rotate", function () { if (rng && st.v === "3d") { st.th = Math.round(map.getBearing()); rng.value = st.th; } });
    }

    // -------------------------------------------------------------- lifecycle
    function start() {
      if (!glOK()) { status.textContent = tx("nogl"); status.hidden = false; fig.classList.add("hs-nogl"); return; }
      status.textContent = tx("load"); status.hidden = false;
      var shared = teaser ? Promise.resolve([null, null]) : Promise.all([H.load("metro"), H.load("districts")]);
      Promise.all([loadML(), shared, H.load("meta").catch(function () { return null; })]).then(function (r) {
        var ml = r[0]; M = r[1][0]; D = r[1][1]; CBD = r[2] && r[2].cbd || null;
        map = new ml.Map({
          container: box, style: STYLE, attributionControl: { compact: true }, dragRotate: !teaser, pitchWithRotate: !teaser,
          interactive: true, cooperativeGestures: !teaser, maxPitch: 65, fadeDuration: 0,
          locale: { "CooperativeGesturesHandler.WindowsHelpText": tx("gWin"), "CooperativeGesturesHandler.MacHelpText": tx("gMac"), "CooperativeGesturesHandler.MobileHelpText": tx("gMob") }
        });
        fig.hsMap = map;
        if (teaser) { map.scrollZoom.disable(); map.dragPan.disable(); map.touchZoomRotate.disable(); map.doubleClickZoom.disable(); map.keyboard.disable(); }
        else map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
        map.on("load", function () {
          try { tune(map); baseNames(map); } catch (e) { if (window.console) console.warn("housing atlas: base style", e); }
          addLayers(); recolor(); vis(); view(false); wire(); setCity(); paint();
        });
        map.on("error", function (e) { if (window.console) console.warn("housing atlas map:", e && e.error ? e.error.message : e); });
      }).catch(function (e) { status.hidden = true; H.fail(fig, e); });
    }
    H.on("hover-district", function (e) { if (self || teaser) return; setHl(e && e.key ? e.key : ""); });
    H.on("state", function (ch) {
      if (teaser || !ch) return;
      if (H.st.c !== st.c) { st.c = H.st.c; paint(); setCity(); }
      else if ((H.st.d || "") !== hlKey && hovId == null) setHl(H.st.d || "");
    });
    H.onLang(function () {
      paint(); labels(); H.tip.hide();
      if (map) { baseNames(map); if (map._locale) { map._locale["CooperativeGesturesHandler.WindowsHelpText"] = tx("gWin"); map._locale["CooperativeGesturesHandler.MacHelpText"] = tx("gMac"); map._locale["CooperativeGesturesHandler.MobileHelpText"] = tx("gMob"); } }
    });
    var lw = 0;
    if (window.ResizeObserver) new ResizeObserver(function () { var w = plot.clientWidth; if ((w < 600) !== (lw < 600)) { lw = w; drawLegend(); } lw = w; }).observe(plot);
    paint();
    H.lazy(fig, start, "600px");
    return { city: function (c) { choose("c", c); }, redraw: function () { if (map) map.resize(); } };
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
