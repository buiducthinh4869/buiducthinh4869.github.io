/* Housing atlas, map base (loaded before housing_map.js): the OpenFreeMap "positron" style recoloured to the site,
   with country and state borders and names hidden (by layer id and by data), base names in the reader's language,
   helpers to find insertion points, and the hatch pattern for wards with few listings. Exposes Housing.mapBase. */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H) return;
  var M = H.mapBase = {};
  // ------------------------------------------------------------------ base style: the site's colours, no country borders
  M.tune = function tune(map) {
    var st = map.getStyle();
    st.layers.forEach(function (l) {
      var id = l.id, sl = l["source-layer"];
      var fs = JSON.stringify(l.filter || "");
      if (l.source === "ne2_shaded" || sl === "boundary" || sl === "building" || /^label_country|^label_state|^label_other$|^label_village$|^label_town$/.test(id) ||
        (sl === "place" && /"(country|state|province|continent)"/.test(fs))) { map.setLayoutProperty(id, "visibility", "none"); return; }
      if (/^highway_(minor|path)$/.test(id)) map.setPaintProperty(id, "line-opacity", ["interpolate", ["linear"], ["zoom"], 10, 0.25, 12.5, 0.55, 14.5, 1]);
      if (l.type === "background") map.setPaintProperty(id, "background-color", "#f4f2ec");
      else if (sl === "water" && l.type === "fill") map.setPaintProperty(id, "fill-color", "#bcd3dc");
      else if (sl === "waterway" && l.type === "line") map.setPaintProperty(id, "line-color", "#bcd3dc");
      else if (sl === "park" || (sl === "landcover" && l.type === "fill")) map.setPaintProperty(id, "fill-color", "#e3e6d9");
      else if (sl === "landuse" && l.type === "fill") map.setPaintProperty(id, "fill-color", "#efede6");
      else if (l.type === "symbol" && l.paint && l.paint["text-color"] !== undefined) {
        map.setPaintProperty(id, "text-color", sl === "water_name" ? "#4c7486" : "#4a4f53");
        map.setPaintProperty(id, "text-halo-color", "rgba(250,249,245,0.9)");
      }
    });
  }
  M.baseNames = function baseNames(map) { // base-map names in the reader's language where OpenStreetMap has them
    var f = H.lang() === "vi" ? ["coalesce", ["get", "name:vi"], ["get", "name"]] : ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
    map.getStyle().layers.forEach(function (l) {
      if (l.type === "symbol" && l.source === "openmaptiles" && l.layout && l.layout["text-field"] && !/shield/.test(l.id)) map.setLayoutProperty(l.id, "text-field", f);
    });
  }
  M.firstOf = function firstOf(map, ids) { for (var i = 0; i < ids.length; i++) if (map.getLayer(ids[i])) return ids[i]; return undefined; }
  M.firstSymbol = function firstSymbol(map) { var l = map.getStyle().layers; for (var i = 0; i < l.length; i++) if (l[i].type === "symbol") return l[i].id; return undefined; }
  M.hatch = function hatch(map) {
    var n = 8, c = document.createElement("canvas"); c.width = c.height = n;
    var g = c.getContext("2d"); g.strokeStyle = "rgba(107,111,114,0.38)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, n); g.lineTo(n, 0); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(n - 1, n + 1); g.lineTo(n + 1, n - 1); g.stroke();
    map.addImage("hs-hatch", g.getImageData(0, 0, n, n));
  }

})();
