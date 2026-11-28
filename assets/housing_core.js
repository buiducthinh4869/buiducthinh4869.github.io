/* Housing atlas (housing.html), shared core: data loading, state and URL hash, events, tooltip, number and text
   formats, label placement, lazy mount, failure. Loaded before housing_map.js, housing_charts.js and housing_tool.js.
   Also loaded by research.html (teaser: no hash, only the map). Data contract: web_spec.md "Export".
   The core also fills p.hs-facts, p.hs-version and the lists in the "About the data" details from meta.json. */
(function () {
  "use strict";
  var H = window.Housing = window.Housing || {};
  H.D = "assets/data/housing/";

  var doc = document, root = doc.documentElement;
  H.lang = function () { return root.getAttribute("data-lang") === "vi" ? "vi" : "en"; };
  H.onLang = function (fn) { doc.addEventListener("langchange", fn); };
  H.reduced = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };

  // ------------------------------------------------------------------ text tables
  H.TXT = {
    en: {
      hn: "Hanoi", hcm: "Ho Chi Minh City", n_list: "{n} listings", src: "Source:", note: "Note:",
      fail: "The data for this figure could not be loaded.", nodiff: "no clear difference yet", few: "too few listings to compare",
      former: "former district", new_ward: "ward (new)", house: "Houses (street-front vs alley)"
    },
    vi: {
      hn: "Hà Nội", hcm: "TP.HCM", n_list: "{n} tin", src: "Nguồn:", note: "Ghi chú:",
      fail: "Không tải được dữ liệu cho hình này.", nodiff: "chưa thấy khác biệt rõ", few: "quá ít tin để so sánh",
      former: "quận cũ", new_ward: "phường (mới)", house: "Nhà riêng (mặt tiền so với hẻm)"
    }
  };
  // t(key, {n: 5}) -> string in the page language ({n} replaced); falls back to English, then to the key
  H.t = function (k, v) {
    var s = H.TXT[H.lang()][k];
    if (s == null) s = H.TXT.en[k];
    if (s == null) return k;
    if (v) for (var a in v) if (v.hasOwnProperty(a)) s = s.replace("{" + a + "}", v[a]);
    return s;
  };
  var TYPES = {
    "Căn hộ chung cư": ["Apartment", "Căn hộ chung cư"],
    "Nhà hẻm/ngõ": ["Alley house", "Nhà hẻm, ngõ"],
    "Nhà mặt tiền/phố": ["Street-front house", "Nhà mặt tiền"],
    "Biệt thự/liền kề": ["Villa or terraced house", "Biệt thự, liền kề"],
    "Đất": ["Land", "Đất"]
  };
  H.type = function (vn) {
    if (vn === "house") return H.t("house");
    var t = TYPES[vn];
    return t ? t[H.lang() === "vi" ? 1 : 0] : String(vn);
  };
  H.SEG = ["Prime core", "Apartment mid-market", "Townhouse mid-market", "Peripheral growth"];
  H.SEGC = { "Prime core": "#2a6fc0", "Apartment mid-market": "#d9632e", "Townhouse mid-market": "#179a6c", "Peripheral growth": "#5a4ac4" };
  var SEGN = {
    "Prime core": ["Prime core", "Lõi cao cấp"], "Apartment mid-market": ["Apartment mid-market", "Căn hộ tầm trung"],
    "Townhouse mid-market": ["Townhouse mid-market", "Nhà phố tầm trung"], "Peripheral growth": ["Peripheral growth", "Vùng ven đang lên"]
  };
  H.seg = function (name) { var s = SEGN[name]; return { name: s ? s[H.lang() === "vi" ? 1 : 0] : String(name), color: H.SEGC[name] || "#6b6f72" }; };
  H.RAMP = ["#efe6cf", "#d3bb8f", "#c49a62", "#ad7a45", "#8f5a32", "#6b3c26", "#45231c"];
  H.CITYC = { hn: "#23272b", hcm: "#d9632e" };

  // ------------------------------------------------------------------ number and unit formats (page language)
  var NF = {};
  function fmt(x, dp) {
    var vi = H.lang() === "vi", k = (vi ? "v" : "e") + dp;
    if (!NF[k]) NF[k] = new Intl.NumberFormat(vi ? "vi-VN" : "en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return NF[k].format(x).replace(/^-/, "−");
  }
  H.nf = function (x, dp) { return fmt(x, dp || 0); };
  H.pct = function (x, dp) { return fmt(x * 100, dp == null ? 0 : dp) + "%"; };
  H.spct = function (x, dp) {
    dp = dp == null ? 0 : dp;
    var r = Math.round(x * 100 * Math.pow(10, dp)) / Math.pow(10, dp);
    return (r > 0 ? "+" : r < 0 ? "−" : "") + fmt(Math.abs(x) * 100, dp) + "%";
  };
  H.ppm2 = function (m) { return fmt(m, m >= 100 ? 0 : 1) + (H.lang() === "vi" ? " triệu đồng/m²" : " million VND/m²"); };
  H.bn = function (b) { return fmt(b, 1) + (H.lang() === "vi" ? " tỷ đồng" : " billion VND"); };
  H.days = function (d) { return fmt(d, 0) + (H.lang() === "vi" ? " ngày" : " days"); };
  H.km = function (k, dp) { return fmt(k, dp == null ? 1 : dp) + " km"; };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  H.month = function (m) {
    var a = String(m).split("-"), y = a[0], i = +a[1];
    return H.lang() === "vi" ? "tháng " + i + "/" + y : MON[i - 1] + " " + y;
  };
  H.date = function (iso) { // "2026-10-15" -> EN "15 Oct 2026", VI "15/10/2026"
    var a = String(iso).split("-");
    return H.lang() === "vi" ? +a[2] + "/" + +a[1] + "/" + a[0] : +a[2] + " " + MON[a[1] - 1] + " " + a[0];
  };
  // place names: VI as written; EN with the unit translated and the name without diacritics ("Phường Ô Chợ Dừa" -> "O Cho Dua Ward")
  H.ascii = function (t) { return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D"); };
  var UNIT = [[/^Phường /, " Ward"], [/^Xã /, " Commune"], [/^Đặc khu /, " Special Zone"], [/^Thị trấn /, " Town"], [/^Thị xã /, " Town"],
    [/^Quận /, " District"], [/^Huyện /, " District"], [/^(Thành phố|TP\.) /, " City"]];
  var CITYN = { "Hà Nội": "Hanoi", "TP. Hồ Chí Minh": "Ho Chi Minh City", "Thành phố Hồ Chí Minh": "Ho Chi Minh City" };
  H.pn = function (name, short) { // short: without the unit word (map labels); "Quận 1" keeps its number either way
    if (name == null || name === "") return "";
    name = String(name);
    var par = "", m = /^(.*?) \((.+)\)$/.exec(name);
    if (m) { name = m[1]; par = m[2]; }
    var en = H.lang() === "en", out = null, d = /^Quận (\d+)$/.exec(name);
    if (d) out = en ? "District " + d[1] : (short ? "Q." + d[1] : name);
    else if (!en) out = short ? name.replace(/^(Phường|Xã|Đặc khu|Thị trấn|Quận|Huyện|Thị xã) /, "") : name;
    else if (CITYN[name]) out = CITYN[name];
    else {
      for (var i = 0; i < UNIT.length && out === null; i++) if (UNIT[i][0].test(name)) { var b = H.ascii(name.replace(UNIT[i][0], "")); out = short ? b : b + UNIT[i][1]; }
      if (out === null) out = H.ascii(name);
    }
    return par ? out + " (" + H.pn(par) + ")" : out;
  };
  H.line = function (name) { // metro line: "Đường sắt đô thị 2A Hà Nội (Phân đoạn Cát Linh - Hà Đông)" -> "Line 2A (Cat Linh - Ha Dong)"
    var m = /đô thị (?:số )?(\w+).*\((?:[Pp]hân đoạn )?(.+)\)/.exec(name || "");
    if (!m) return H.lang() === "en" ? H.ascii(name || "") : (name || "");
    return (H.lang() === "en" ? "Line " + m[1] + " (" + H.ascii(m[2]) + ")" : "Tuyến " + m[1] + " (" + m[2] + ")");
  };
  H.city = function (c) { return H.t(c === "hcm" ? "hcm" : "hn"); };
  H.cityOf = function (name) {
    var s = String(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
    if (/^(hn|ha noi)\b/.test(s) || s.indexOf("ha noi") >= 0) return "hn";
    if (/^hcm\b/.test(s) || s.indexOf("ho chi minh") >= 0 || s.indexOf("hcm") >= 0) return "hcm";
    return null;
  };

  // ------------------------------------------------------------------ events
  var ev = {};
  H.on = function (n, f) { (ev[n] = ev[n] || []).push(f); };
  H.emit = function (n, x) { (ev[n] || []).forEach(function (f) { try { f(x); } catch (e) { if (window.console) console.warn("housing atlas:", e); } }); };

  // ------------------------------------------------------------------ data
  var cache = {};
  H.load = function (name) {
    if (!cache[name]) {
      cache[name] = fetch(H.D + name + ".json").then(function (r) {
        if (!r.ok) throw new Error(H.D + name + ".json " + r.status);
        return r.json();
      });
      cache[name].catch(function () { delete cache[name]; }); // a failed file may be tried again
    }
    return cache[name];
  };

  // ------------------------------------------------------------------ state and URL hash: #c=hn&v=3d&l=price,wards,metro&t=house&d=<key>
  var DEF = { c: "hn", v: "2d", l: ["price", "metro", "cbd", "edu", "health", "shop", "park"], t: "", d: "" };
  // the teaser on research.html shows the map only: it neither reads nor writes the hash
  H.noHash = H.noHash || !!doc.querySelector('[data-hs="map"][data-teaser]');
  // bill groups: short ASCII keys in the hash, the data keys (Vietnamese) in H.st.t
  var GK = { apartment: "Căn hộ chung cư", alley: "Nhà hẻm/ngõ", street: "Nhà mặt tiền/phố", villa: "Biệt thự/liền kề", land: "Đất", house: "house" };
  function gkey(v) { for (var k in GK) if (GK[k] === v) return k; return v; }
  H.defT = ""; // default bill group = first group of premiums.json, known once that file has loaded
  H.st = { c: DEF.c, v: DEF.v, l: DEF.l.slice(), t: DEF.t, d: DEF.d };
  (function () {
    if (H.noHash) return;
    var h = {};
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) { try { h[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* bad escape: ignore the key */ } }
    });
    if (h.c === "hn" || h.c === "hcm") H.st.c = h.c;
    if (h.v === "2d" || h.v === "3d") H.st.v = h.v;
    if (h.l != null) H.st.l = h.l.split(",").filter(function (s) { return /^[a-z0-9_-]+$/.test(s); });
    if (h.t && /^[^&=#<>"]{1,40}$/.test(h.t)) H.st.t = GK[h.t] || h.t;
    if (h.d) H.st.d = h.d;
  })();
  function writeHash() {
    if (H.noHash || !window.history || !history.replaceState) return;
    var s = H.st, p = [];
    if (s.c !== DEF.c) p.push("c=" + s.c);
    if (s.v !== DEF.v) p.push("v=" + s.v);
    if (s.l.join(",") !== DEF.l.join(",")) p.push("l=" + s.l.join(","));
    if (s.t && s.t !== H.defT) p.push("t=" + encodeURIComponent(gkey(s.t)));
    if (s.d) p.push("d=" + encodeURIComponent(s.d));
    history.replaceState(null, "", location.pathname + location.search + (p.length ? "#" + p.join("&") : ""));
  }
  H.set = function (patch) {
    var ch = {}, any = false;
    Object.keys(patch).forEach(function (k) {
      if (!(k in H.st)) return;
      var a = H.st[k], b = patch[k];
      if ((Array.isArray(a) ? a.join(",") : a) === (Array.isArray(b) ? b.join(",") : b)) return;
      H.st[k] = Array.isArray(b) ? b.slice() : b;
      ch[k] = H.st[k];
      any = true;
    });
    if (!any) return;
    writeHash();
    H.emit("state", ch);
  };

  // ------------------------------------------------------------------ small helpers
  H.el = function (tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  var el = H.el;
  H.fail = function (fig, err) {
    if (window.console) console.warn("housing atlas:", err);
    if (fig && fig.classList) fig.classList.add("hs-failed");
  };
  H.lazy = function (e, fn, margin) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: margin || "400px" });
    io.observe(e);
  };

  // ------------------------------------------------------------------ tooltip (one div, class at-tip; content built with textContent)
  var tip = el("div", "at-tip");
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  if (doc.body) doc.body.appendChild(tip); else doc.addEventListener("DOMContentLoaded", function () { doc.body.appendChild(tip); });
  H.tip = {
    show: function (x, y, node) {
      tip.textContent = "";
      tip.appendChild(node);
      tip.hidden = false;
      var w = tip.offsetWidth, h = tip.offsetHeight, vw = root.clientWidth;
      var left = x + 14 + w > vw - 8 ? x - 14 - w : x + 14, top = y - h - 12 < 8 ? y + 16 : y - h - 12;
      tip.style.left = Math.max(8, left) + "px";
      tip.style.top = top + "px";
    },
    hide: function () { tip.hidden = true; }
  };
  window.addEventListener("scroll", H.tip.hide, { passive: true });

  // card({h, sw, rows: [[label, value]], m: [lines]}): header (optional colour swatch), rows "label value", muted lines
  H.card = function (o) {
    var f = doc.createDocumentFragment();
    if (o.h != null) {
      var h = el("div", "at-tip-h");
      if (o.sw) { var sw = el("span", "at-key at-key-box"); sw.style.background = o.sw; h.appendChild(sw); }
      h.appendChild(el("strong", null, o.h));
      f.appendChild(h);
    }
    (o.rows || []).forEach(function (r) {
      var d = el("div", "at-tip-r");
      if (r[0]) d.appendChild(doc.createTextNode(r[0] + " "));
      d.appendChild(el("strong", null, r[1]));
      f.appendChild(d);
    });
    (o.m || []).forEach(function (t) { f.appendChild(el("div", "at-tip-m", t)); });
    return f;
  };

  // hover(el, find): find(x, y, ev) -> {node, key?} | null, x and y in CSS px relative to el, ev the pointer event.
  // Mouse: the tooltip follows the pointer and hides when it finds nothing or leaves. Touch: a tap shows it, a tap on
  // empty space or outside el hides it; a drag (scroll) is not a tap. Returns {refresh(), hide()}.
  H.hover = function (e, find) {
    var shown = false, last = null, down = null;
    function hide() { if (shown) { shown = false; H.tip.hide(); } }
    function run(cx, cy, pev) {
      var b = e.getBoundingClientRect(), r = find(cx - b.left, cy - b.top, pev);
      if (r && r.node) { H.tip.show(cx, cy, r.node); shown = true; last = { x: cx, y: cy, ev: pev }; } else hide();
      return r;
    }
    e.addEventListener("pointermove", function (p) { if (p.pointerType !== "touch") run(p.clientX, p.clientY, p); });
    e.addEventListener("pointerleave", function (p) { if (p.pointerType !== "touch") hide(); });
    e.addEventListener("pointerdown", function (p) { down = p.pointerType === "touch" ? { x: p.clientX, y: p.clientY, t: Date.now() } : null; });
    e.addEventListener("pointercancel", function () { down = null; });
    e.addEventListener("pointerup", function (p) {
      var d = down; down = null;
      if (d && Math.abs(p.clientX - d.x) < 10 && Math.abs(p.clientY - d.y) < 10 && Date.now() - d.t < 700) run(p.clientX, p.clientY, p);
    });
    doc.addEventListener("pointerdown", function (p) { if (shown && !e.contains(p.target)) hide(); });
    return {
      refresh: function () { if (shown && last) run(last.x, last.y, last.ev); },
      hide: hide
    };
  };

  // ------------------------------------------------------------------ text width and label placement
  var tcv, tcache = {};
  H.textW = function (s, px) {
    var font = (px || 12) + 'px "Be Vietnam Pro", system-ui, sans-serif', k = font + "|" + s;
    if (tcache[k] != null) return tcache[k];
    var w;
    try {
      if (!tcv) tcv = doc.createElement("canvas").getContext("2d");
      tcv.font = font;
      w = tcv.measureText(s).width;
    } catch (e) { w = s.length * (px || 12) * 0.56; }
    if (!doc.fonts || !doc.fonts.check || doc.fonts.check(font)) tcache[k] = w; // do not cache widths of the fallback font
    return w;
  };
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { tcache = {}; H.emit("fonts"); });

  // place(items, box): items [{x, y, w, h, pr, r?, block?}]. Highest pr first; each label tries right, left, above, below
  // of its anchor (offset 6 px, plus r when the anchor is a circle of radius r) and is kept only if it stays inside
  // box {w, h} and overlaps no label placed before it and no item with block:true (blockers are rectangles w x h
  // centred on x, y and are never labelled themselves). Returns the kept items with lx, ly (top-left) and side.
  H.place = function (items, box) {
    var PAD = 2, blocks = [], placed = [], kept = [];
    items.forEach(function (it) { if (it.block) blocks.push({ x: it.x - it.w / 2, y: it.y - it.h / 2, w: it.w, h: it.h }); });
    function hit(a, b) { return a.x < b.x + b.w + PAD && b.x < a.x + a.w + PAD && a.y < b.y + b.h + PAD && b.y < a.y + a.h + PAD; }
    items.map(function (it, i) { return { it: it, i: i }; })
      .filter(function (o) { return !o.it.block; })
      .sort(function (a, b) { return (b.it.pr || 0) - (a.it.pr || 0) || a.i - b.i; })
      .forEach(function (o) {
        var it = o.it, d = 6 + (it.r || 0), w = it.w, h = it.h;
        var c = [
          ["right", it.x + d, it.y - h / 2], ["left", it.x - d - w, it.y - h / 2],
          ["above", it.x - w / 2, it.y - d - h], ["below", it.x - w / 2, it.y + d]
        ];
        delete it.side;
        for (var k = 0; k < c.length; k++) {
          var r = { x: c[k][1], y: c[k][2], w: w, h: h };
          if (r.x < 0 || r.y < 0 || r.x + w > box.w || r.y + h > box.h) continue;
          if (blocks.some(function (b) { return hit(r, b); }) || placed.some(function (b) { return hit(r, b); })) continue;
          it.lx = r.x; it.ly = r.y; it.side = c[k][0];
          placed.push(r);
          kept.push(it);
          return;
        }
      });
    return kept;
  };

  // ------------------------------------------------------------------ SVG helpers for the chart modules (d3 selections)
  var MU = "#6b6f72", RU = "#e4e1d8";
  var V = H.svg = {};
  V.ln = function (g, x1, y1, x2, y2, c) { return g.append("line").attr("x1", x1).attr("x2", x2).attr("y1", y1).attr("y2", y2).attr("stroke", c); };
  V.txt = function (g, x, y, s, anchor, cls) { return g.append("text").attr("x", x).attr("y", y).attr("text-anchor", anchor || "start").attr("class", cls || null).text(s); };
  V.axX = function (g, sc, ticks, y, fmt) {
    var r = sc.range();
    V.ln(g, r[0], y, r[1], y, MU);
    ticks.forEach(function (t) { V.ln(g, sc(t), y, sc(t), y + 4, MU); V.txt(g, sc(t), y + 17, fmt(t), "middle"); });
  };
  V.axY = function (g, sc, ticks, x1, x2, fmt) {
    ticks.forEach(function (t) { V.ln(g, x1, sc(t), x2, sc(t), RU); V.txt(g, x1 - 6, sc(t), fmt(t), "end").attr("dy", "0.34em"); });
  };
  V.thin = function (ticks, sc, gap) { // keep only ticks at least gap px apart
    var out = [], last = -1e9;
    ticks.forEach(function (t) { if (Math.abs(sc(t) - last) >= gap) { out.push(t); last = sc(t); } });
    return out;
  };
  V.wrap = function (g, x, y, s, mw, f) { // centred text on a few lines, each no wider than mw
    var ln = [""];
    s.split(" ").forEach(function (t) { var c = ln[ln.length - 1], u = c ? c + " " + t : t; if (c && H.textW(u, f) > mw) ln.push(t); else ln[ln.length - 1] = u; });
    ln.forEach(function (l, i) { V.txt(g, x, y + i * 14, l, "middle"); });
  };
  V.lab = function (g, p, cls) { return g.append("text").attr("x", p.lx).attr("y", p.ly + p.h - 3).attr("class", "hs-halo " + (cls || "")).text(p.txt); }; // p from H.place
  // legend items [{kind: box|dash|whisker, col, txt, on, pressed, fn, tip}], wrapped; returns the height used
  V.legend = function (svg, items, x0, y0, wmax, vertical) {
    var g = svg.append("g").attr("class", "hs-leg"), x = x0, y = y0, lh = 18;
    items.forEach(function (it) {
      var iw = 18 + H.textW(it.txt, 12) + 14;
      if (!vertical && x > x0 && x + iw > x0 + wmax) { x = x0; y += lh; }
      var e = g.append("g").attr("transform", "translate(" + x + "," + (y + lh / 2) + ")");
      if (it.kind === "box") e.append("rect").attr("x", 0).attr("y", -5).attr("width", 10).attr("height", 10).attr("fill", it.col);
      else if (it.kind === "whisker") { V.ln(e, 5, -6, 5, 6, it.col); V.ln(e, 1, -6, 9, -6, it.col); V.ln(e, 1, 6, 9, 6, it.col); }
      else V.ln(e, 0, 0, 12, 0, it.col).attr("stroke-width", 2).attr("stroke-dasharray", "4 3");
      V.txt(e, 18, 0, it.txt).attr("dy", "0.34em").attr("class", it.on === false ? "hs-off" : "k");
      if (it.fn) {
        e.attr("tabindex", 0).attr("role", "button").attr("aria-pressed", String(it.on !== false && it.pressed === true)).style("cursor", "pointer").on("click", it.fn)
          .on("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); it.fn(); } });
        e.append("title").text(it.tip || "");
      }
      if (vertical) y += lh; else x += iw;
    });
    return vertical ? y - y0 : y + lh - y0;
  };

  // ------------------------------------------------------------------ meta.json: facts line, version line, About lists
  var meta = null;
  function setText(sel, s) { doc.querySelectorAll(sel).forEach(function (n) { n.textContent = s; }); }
  function fill(sel, rows) {
    doc.querySelectorAll(sel).forEach(function (ul) {
      ul.textContent = "";
      rows.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    });
  }
  function renderMeta() {
    if (!meta) return;
    var vi = H.lang() === "vi", d = H.date(meta.data_date);
    var yr = meta.year_from ? meta.year_from + "–" + meta.year_to : ""; // version 2: listings of several years and sources
    setText("p.hs-facts", yr ? (vi
      ? H.nf(meta.n) + " tin rao " + yr + " · 2 thành phố · " + H.nf(meta.n_districts) + " quận/huyện cũ · " + H.nf(meta.n_wards) + " phường, xã mới"
      : H.nf(meta.n) + " listings " + yr + " · 2 cities · " + H.nf(meta.n_districts) + " former districts · " + H.nf(meta.n_wards) + " new wards and communes")
      : (vi ? H.nf(meta.n) + " tin · 2 thành phố · " + H.nf(meta.n_districts) + " quận/huyện cũ · cào " + d
      : H.nf(meta.n) + " listings · 2 cities · " + H.nf(meta.n_districts) + " former districts · scraped " + d));
    setText("p.hs-version", yr ? (vi ? "Phiên bản " + meta.version + " · dữ liệu đến " + d : "Version " + meta.version + " · data to " + d)
      : (vi ? "Phiên bản " + meta.version + " · dữ liệu " + d : "Version " + meta.version + " · data of " + d));
    fill("ul.hs-clean", (meta.cleaning || []).map(function (c) {
      return (vi ? c[1] : c[0].replace(/m2\b/g, "m²").replace(/VND ([\d.,]+) m\b/g, "VND $1 million").replace("city x type", "city \u00d7 type")) + ": " + H.nf(c[2]) + (vi ? " tin còn lại" : " listings left");
    }));
    fill("ul.hs-clean-v1", (meta.cleaning_v1 || []).map(function (c) {
      return (vi ? c[1] : c[0].replace(/m2\b/g, "m²").replace(/VND ([\d.,]+) m\b/g, "VND $1 million").replace("city x type", "city \u00d7 type")) + ": " + H.nf(c[2]) + (vi ? " tin còn lại" : " listings left");
    }));
    fill("ul.hs-acc", (meta.accuracy || []).map(function (a) {
      var p = a.ppe20 > 1 ? a.ppe20 / 100 : a.ppe20, t = vi ? (a.type_vi || a.type) : a.type;
      if (a.type === "All") t = vi ? "Mọi loại nhà" : "All types";
      return vi ? t + ": " + H.pct(p) + " giá trị mô hình nằm trong khoảng ±20% so với giá rao"
        : t + ": " + H.pct(p) + " of model values fall within 20% of the asking price";
    }));
    fill("ul.hs-chlog", (meta.changelog || []).map(function (c) {
      return (vi ? "Phiên bản " : "Version ") + c.version + " · " + H.date(c.date) + ": " + (vi ? c.vi : c.en);
    }));
    var nc = doc.getElementById("hs-nocate");
    var b4 = !!(meta.gates && meta.gates.B4 === "PASS"); // the legal-paper map exists only if B4 passed
    if (nc) nc.hidden = b4;
    doc.querySelectorAll('figure[data-hs="legalmap"]').forEach(function (f) { if (b4) f.hidden = false; else if (f.parentNode) f.parentNode.removeChild(f); });
  }
  H.meta = function () { return meta; };
  H.onLang(function () { renderMeta(); });
  // H.ready: meta.json and premiums.json have been tried (never rejects); H.st.t is the default group once it resolves
  H.ready = Promise.all([
    H.load("meta").then(function (m) { meta = m; renderMeta(); }).catch(function (e) { if (window.console) console.warn("housing atlas:", e); }),
    H.load("premiums").then(function (p) {
      var gs = (p.groups || []).slice(), g;
      if (!gs.length) return;
      // default group: most rows that pass the gate, then most listings
      var np = function (x) { return (p.rows || []).filter(function (r) { return r.group === x.group && r.gate === "PASS"; }).length; };
      gs.sort(function (a, b) { return np(b) - np(a) || b.n - a.n; });
      g = gs.map(function (x) { return x.group; });
      H.defT = g[0];
      if (!H.st.t || g.indexOf(H.st.t) < 0) H.set({ t: g[0] }); // unknown or missing group: the default one
    }).catch(function () { /* the bill figure reports its own failure */ })
  ]).then(function () { return H; });
})();
