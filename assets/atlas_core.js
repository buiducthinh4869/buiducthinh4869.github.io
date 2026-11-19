/* Storm atlas (storms.html), shared core: data, region and selection state, URL hash, the one search box,
   the tooltip and the storm card. Loaded before atlas_overview.js, atlas_timeline.js and storm_globe.js.
   Data contract: CLAUDE.md, "Storm atlas". Needs D3 v7. */
(function () {
  "use strict";
  var A = window.Atlas = { D: "assets/data/globe/", KT: 0.5144 };
  // basins: validated categorical order (adjacent CVD and normal-vision checks pass); names are also written on the map
  A.BAS = { WP: "#2a6fc0", NA: "#d9632e", EP: "#179a6c", NI: "#c98a00", SI: "#c95f8c", SP: "#5a4ac4", SA: "#6b6f72" };
  A.BORDER = ["WP", "NA", "EP", "NI", "SI", "SP", "SA"];
  A.BAT = { WP: [140, 18], NA: [-62, 26], EP: [-115, 15], NI: [82, 14], SI: [68, -16], SP: [165, -18], SA: [-35, -25] };
  // category: one warm hue, light to dark (sequential)
  A.CLS = ["TS", "C1", "C2", "C3", "C4", "C5"];
  A.CCOL = { TS: "#d3bb8f", C1: "#c49a62", C2: "#ad7a45", C3: "#8f5a32", C4: "#6b3c26", C5: "#45231c" };
  A.CUT = [34, 64, 83, 96, 113, 137]; // knots, lower edge of each class
  A.LEV = [17, 33, 43, 50, 58, 70]; // the same edges in whole m/s, as on the wind lines and in the category key

  A.TXT = {
    en: {
      basin: { WP: "Western Pacific", NA: "North Atlantic", EP: "Eastern Pacific", NI: "North Indian", SI: "South Indian", SP: "South Pacific", SA: "South Atlantic" },
      cls: { TS: "Tropical storm", C1: "Category 1", C2: "Category 2", C3: "Category 3", C4: "Category 4", C5: "Category 5" },
      clsShort: { TS: "TS", C1: "Cat 1", C2: "Cat 2", C3: "Cat 3", C4: "Cat 4", C5: "Cat 5" },
      mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      unnamed: "Unnamed", all: "the whole world", country: "Country or territory", basinT: "Ocean basin", storm: "Storm",
      peak: "Peak wind", formed: "Formed", near: "Closest to {c}", within: "Passed within 200 km of", more: "and {n} more",
      showing: "Showing", clear: "Show the whole world", year: "Season {y}", clearYear: "All seasons",
      none: "No country or territory found. Storms by name are in section 3.", search: "e.g. Vietnam, Philippines, Hawaii", allB: "All ocean basins"
    },
    vi: {
      basin: { WP: "Tây Thái Bình Dương", NA: "Bắc Đại Tây Dương", EP: "Đông Thái Bình Dương", NI: "Bắc Ấn Độ Dương", SI: "Nam Ấn Độ Dương", SP: "Nam Thái Bình Dương", SA: "Nam Đại Tây Dương" },
      cls: { TS: "Bão nhiệt đới", C1: "Cấp 1", C2: "Cấp 2", C3: "Cấp 3", C4: "Cấp 4", C5: "Cấp 5" },
      clsShort: { TS: "BNĐ", C1: "C1", C2: "C2", C3: "C3", C4: "C4", C5: "C5" },
      unnamed: "Không tên", all: "toàn thế giới", country: "Quốc gia hoặc vùng lãnh thổ", basinT: "Vùng biển", storm: "Cơn bão",
      peak: "Sức gió mạnh nhất", formed: "Hình thành", near: "Gần {c} nhất", within: "Đi qua trong phạm vi 200 km quanh", more: "và {n} nơi khác",
      showing: "Đang xem", clear: "Xem toàn thế giới", year: "Mùa bão {y}", clearYear: "Mọi mùa bão",
      none: "Không tìm thấy quốc gia hay vùng lãnh thổ nào. Tìm bão theo tên ở mục 3.", search: "ví dụ: Việt Nam, Philippines", allB: "Mọi vùng biển"
    }
  };
  A.lang = function () { return document.documentElement.getAttribute("data-lang") === "vi" ? "vi" : "en"; };
  A.tx = function () { return A.TXT[A.lang()]; };
  A.nm = function (s) { return /^(unnamed|not_named)$/i.test(s.name) ? A.tx().unnamed : s.name; };
  A.norm = function (v) { return String(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim(); };
  A.cname = function (i) { var c = A.IX.countries[i]; return A.lang() === "vi" ? c[1] : c[0]; };
  A.kmh = function (ms) { return Math.round(ms * 3.6); };
  A.date = function (t, noYear) {
    var d = new Date(t), y = noYear ? "" : " " + d.getUTCFullYear();
    return A.lang() === "vi" ? d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + (noYear ? "" : "/" + d.getUTCFullYear())
      : d.getUTCDate() + " " + A.TXT.en.mon[d.getUTCMonth()] + y;
  };
  A.fyToMs = function (fy) { var y = Math.floor(fy), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return a + (fy - y) * (b - a); };
  // class of a whole-m/s wind, by the same edges the timeline bands use, so a dot always sits in the band of its colour
  A.clsOf = function (ms) { var c = null; A.LEV.forEach(function (v, i) { if (ms >= v) c = A.CLS[i]; }); return c; };

  // ------------------------------------------------------------------ events
  var ev = {};
  A.on = function (n, f) { (ev[n] = ev[n] || []).push(f); };
  A.emit = function (n, x) { (ev[n] || []).forEach(function (f) { f(x); }); };

  // ------------------------------------------------------------------ data
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  A.getJSON = getJSON;
  A.fail = function (e) {
    if (window.console) console.warn("storm atlas:", e);
    document.documentElement.classList.add("atlas-failed");
  };
  A.ready = (window.d3 && window.fetch && window.Promise) ? Promise.all([getJSON(A.D + "index.json"), getJSON(A.D + "land.json")]).then(function (r) {
    A.IX = r[0]; A.land = r[1];
    A.byId = {};
    A.IX.storms.forEach(function (s, i) {
      s.i = i;
      s.t = Date.parse(s.t0);
      s.label = s.name + " " + s.season;
      s.key = A.norm(s.label);
      A.byId[s.id] = s;
      // per-country closest approach: nr = [[country, peak m/s within 200 km or null, fractional year], ...]
      s.nmap = {};
      (s.nr || []).forEach(function (r) { s.nmap[r[0]] = { v: r[1], t: A.fyToMs(r[2]) }; });
    });
    A.hasNear = A.IX.storms.some(function (s) { return s.nr; });
    A.IX.countries.forEach(function (c, i) { c.slug = A.norm(c[0]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); c.i = i; });
    return A;
  }) : Promise.reject(new Error("D3 or fetch unavailable"));
  A.ready.catch(A.fail);

  // ------------------------------------------------------------------ state: region ("", "b:WP", "c:12"), season filter, selection
  A.st = { region: "", year: null, sel: [] };
  A.inRegion = function (s, r) {
    r = r == null ? A.st.region : r;
    if (!r) return true;
    if (r[0] === "b") return s.basin === r.slice(2);
    return s.near.indexOf(+r.slice(2)) >= 0;
  };
  A.regionName = function (r) {
    r = r == null ? A.st.region : r;
    if (!r) return A.tx().all;
    return r[0] === "b" ? A.tx().basin[r.slice(2)] : A.cname(+r.slice(2));
  };
  A.setRegion = function (r, quiet) {
    A.st.region = r || "";
    A.st.year = null;
    hash();
    if (!quiet) A.emit("region", A.st.region);
  };
  A.setYear = function (y) { A.st.year = y; hash(); A.emit("year", y); };
  A.pick = function (s) { A.emit("pick", s); };
  A.selChanged = function () { hash(); A.emit("sel", A.st.sel); };

  // URL hash: #r=vietnam (or r=b-wp) & s=SID,SID
  function hash() {
    if (!A.IX || !window.history || !history.replaceState) return;
    var r = A.st.region, p = [];
    if (r) p.push("r=" + (r[0] === "b" ? "b-" + r.slice(2).toLowerCase() : A.IX.countries[+r.slice(2)].slug));
    else p.push("r=world");
    if (A.st.year != null) p.push("y=" + A.st.year);
    if (A.st.sel.length) p.push("s=" + A.st.sel.map(function (s) { return s.id; }).join(","));
    history.replaceState(null, "", "#" + p.join("&"));
  }
  A.fromHash = function () {
    var h = {}, out = { region: null, sel: [], year: null };
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) { var a = kv.split("="); if (a[1]) h[a[0]] = decodeURIComponent(a[1]); });
    if (h.r === "world") out.region = "";
    else if (h.r && /^b-/.test(h.r)) { var b = h.r.slice(2).toUpperCase(); if (A.BAS[b]) out.region = "b:" + b; }
    else if (h.r) A.IX.countries.forEach(function (c) { if (c.slug === h.r) out.region = "c:" + c.i; });
    if (h.y && +h.y >= A.IX.meta.seasons[0] && +h.y <= A.IX.meta.seasons[1]) out.year = +h.y;
    if (h.s) h.s.split(",").forEach(function (id) { if (A.byId[id]) out.sel.push(A.byId[id]); });
    return out;
  };

  // ------------------------------------------------------------------ tooltip (one, follows the pointer; content built with textContent)
  var tip = document.createElement("div");
  tip.className = "at-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(tip); });
  if (document.body) document.body.appendChild(tip);
  A.tipShow = function (x, y, node) {
    tip.textContent = "";
    tip.appendChild(node);
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth;
    var left = x + 14 + w > vw - 8 ? x - 14 - w : x + 14, top = y - h - 12 < 8 ? y + 16 : y - h - 12;
    tip.style.left = Math.max(8, left) + "px";
    tip.style.top = top + "px";
  };
  A.tipHide = function () { tip.hidden = true; };
  window.addEventListener("scroll", A.tipHide, { passive: true });

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  A.el = el;
  // a storm card: value first, labels after (used by the tooltip and the selected list)
  A.card = function (s, opt) {
    opt = opt || {};
    var T = A.tx(), f = document.createDocumentFragment(), r = A.st.region;
    var h = el("div", "at-tip-h");
    var sw = el("span", "at-key"); sw.style.background = A.CCOL[s["class"]] || "#999";
    h.appendChild(sw);
    h.appendChild(el("strong", null, A.nm(s) + " " + s.season));
    f.appendChild(h);
    f.appendChild(el("div", "at-tip-m", T.cls[s["class"]] + " · " + T.basin[s.basin]));
    var p = el("div", "at-tip-r");
    p.appendChild(el("strong", null, s.vmax_ms + " m/s"));
    p.appendChild(document.createTextNode(" (" + A.kmh(s.vmax_ms) + " km/h) " + T.peak.toLowerCase()));
    f.appendChild(p);
    f.appendChild(el("div", "at-tip-r", T.formed + " " + A.date(s.t)));
    if (r && r[0] === "c" && s.nmap[+r.slice(2)]) {
      var n = s.nmap[+r.slice(2)], q = el("div", "at-tip-r");
      q.appendChild(document.createTextNode(T.near.replace("{c}", A.cname(+r.slice(2))) + ": "));
      q.appendChild(el("strong", null, n.v == null ? "—" : n.v + " m/s"));
      q.appendChild(document.createTextNode(", " + A.date(n.t)));
      f.appendChild(q);
    }
    if (!opt.short && s.near.length) {
      var rc = r && r[0] === "c" ? +r.slice(2) : -1, nr = s.near.filter(function (c) { return c === rc; }).concat(s.near.filter(function (c) { return c !== rc; }));
      var k = nr.map(A.cname), ks = k.length > 5 ? k.slice(0, 4).join(", ") + " " + T.more.replace("{n}", k.length - 4) : k.join(", ");
      f.appendChild(el("div", "at-tip-m", T.within + " " + ks + "."));
    }
    return f;
  };

  // ------------------------------------------------------------------ the one search box: countries, basins and storms
  var ALIAS = [["Hawaii", "Hawaii", "United States of America"], ["Guam", "Guam", "Guam"], ["Okinawa", "Okinawa", "Japan"], ["Hainan", "Hải Nam", "China"], ["Hong Kong", "Hồng Kông", "Hong Kong"], ["Taiwan", "Đài Loan", "Taiwan"]].filter(function (a) { return a[0] !== a[2]; });
  A.ready.then(function () {
    var q = document.getElementById("at-q"), ul = document.getElementById("at-sugg"), chip = document.getElementById("at-region");
    if (!q) return;
    var m = [], mi = 0;
    function find() {
      var v = A.norm(q.value), T = A.tx(), out = [];
      if (!v) return out;
      // 2: the name starts with the text; 1: a later word of the name starts with it; 0: no match
      var hit = function (name) { var n = A.norm(name); return n.indexOf(v) === 0 ? 2 : (" " + n).indexOf(" " + v) >= 0 ? 1 : 0; };
      var vi = A.lang() === "vi";
      // the shown language matches on any word; the other language only from the start, so a hidden name never surprises
      var both = function (en, vn) { var a = hit(vi ? vn : en), b = hit(vi ? en : vn); return Math.max(a, b === 2 ? 2 : 0); };
      var cs = [];
      A.IX.countries.forEach(function (c, i) { var h = both(c[0], c[1]); if (h) cs.push([h, "c:" + i, A.cname(i), T.country]); });
      // places that Natural Earth keeps inside a country: the search offers that country and says so
      ALIAS.forEach(function (a) {
        if (!(hit(a[0]) || hit(a[1]))) return;
        A.IX.countries.forEach(function (c, i) { if (c[0] === a[2]) cs.push([2, "c:" + i, A.cname(i) + " (" + (vi ? a[1] : a[0]) + ")", T.country]); });
      });
      cs.sort(function (a, b) { return b[0] - a[0] || a[2].localeCompare(b[2]); });
      return cs.slice(0, 8);
    }
    function show() {
      m = find(); mi = 0;
      ul.textContent = "";
      m.forEach(function (o, i) {
        var li = el("li");
        li.id = "at-opt-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(i === 0));
        li.appendChild(el("span", null, o[2]));
        li.appendChild(el("span", "at-sugg-k", o[3]));
        li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(o); });
        ul.appendChild(li);
      });
      if (q.value && !m.length) { var li = el("li", "at-sugg-none", A.tx().none); ul.appendChild(li); }
      ul.hidden = !q.value;
      q.setAttribute("aria-expanded", String(!ul.hidden));
      if (m.length) q.setAttribute("aria-activedescendant", "at-opt-0"); else q.removeAttribute("aria-activedescendant");
    }
    function hide() { ul.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); }
    function choose(o) {
      hide();
      q.value = "";
      if (typeof o[1] === "string") A.setRegion(o[1]);
      else A.pick(o[1]);
    }
    q.addEventListener("input", show);
    q.addEventListener("focus", function () { if (q.value) show(); });
    q.addEventListener("blur", hide);
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); if (m.length) choose(m[mi]); }
      else if (e.key === "Escape") { hide(); }
      else if (!ul.hidden && m.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        mi = (mi + (e.key === "ArrowDown" ? 1 : -1) + m.length) % m.length;
        Array.prototype.forEach.call(ul.children, function (li, i) { li.setAttribute("aria-selected", String(i === mi)); });
        q.setAttribute("aria-activedescendant", "at-opt-" + mi);
      }
    });
    var bs = document.getElementById("at-basin");
    function basins() {
      var T = A.tx(), r = A.st.region;
      bs.textContent = "";
      [""].concat(A.BORDER.filter(function (b) { return A.IX.storms.some(function (s) { return s.basin === b; }); })).forEach(function (b) {
        var o = el("option", null, b ? T.basin[b] : T.allB); o.value = b; bs.appendChild(o);
      });
      bs.value = r && r[0] === "b" ? r.slice(2) : "";
    }
    // the basin list and the country box are two ways into one region: choosing in one clears the other
    bs.addEventListener("change", function () { q.value = ""; A.setRegion(bs.value ? "b:" + bs.value : ""); });
    A.on("region", basins);
    document.addEventListener("langchange", basins);
    basins();
    function chipText() {
      var T = A.tx();
      q.placeholder = T.search;
      chip.textContent = "";
      chip.appendChild(el("span", "se-label", T.showing + " "));
      chip.appendChild(el("strong", null, A.regionName()));
      var n = A.IX.storms.filter(function (s) { return A.inRegion(s); }).length;
      chip.appendChild(document.createTextNode(" · " + n.toLocaleString(A.lang()) + " " + (A.lang() === "vi" ? "cơn bão" : "storms")));
      if (A.st.region) {
        var b = el("button", "se-link", T.clear);
        b.type = "button";
        b.addEventListener("click", function () { A.setRegion(""); });
        chip.appendChild(document.createTextNode(" "));
        chip.appendChild(b);
      }
    }
    A.on("region", chipText);
    document.addEventListener("langchange", chipText);
    chipText();
  });
})();
