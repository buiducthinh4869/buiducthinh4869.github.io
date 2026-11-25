/* Housing atlas, section 6: the valuation tool (figure data-hs="tool").
   Loads housing_engine.js (window.AVMEngine, a verbatim copy of the project's dashboard_engine.js), model_avm.json,
   model_stale.json, tool_data.json and meta.json from H.D, builds the form, and calls the engine exactly as the
   project's standalone dashboard does (inputs(), Engine.value, Engine.comparables). Uses the Housing core API only.
   Texts: TX table (en, vi); everything re-renders on langchange. All DOM text is set with textContent. */
(function () {
  "use strict";
  var H = window.Housing;
  if (!H) return;

  var ENGINE_SRC = "assets/housing_engine.js";
  var NS = "http://www.w3.org/2000/svg";
  var CITY_CODE = { "HN": "Hà Nội", "HCM": "TP. Hồ Chí Minh" };
  var LIGHTS = ["Low", "Medium", "High"];

  var TX = {
    en: {
      loading: "Loading the model…",
      city: "City", district: "Former district", ward: "Ward", anyWard: "Any ward (district median)",
      type: "Property type", area: "Area (m²)", legal: "Legal papers", beds: "Bedrooms", baths: "Bathrooms",
      floors: "Floors", front: "Frontage (m)", road: "Access road width (m)",
      ask: "Asking price (billion VND, optional)", askPh: "e.g. 9.5",
      hintDist: "Former districts, before July 2025, as written in the listings; the model was trained this way.",
      hintMiss: "Fields start at the typical value for the type. A cleared floors, frontage or road field uses that typical value and is flagged as missing, as in training.",
      hFv: "Fair value", hStale: "Risk of sitting unsold", hSim: "Similar listings",
      bn: "billion VND", ppm: "million VND/m²", perM2: "Per m²",
      axis: "Asking price, billion VND (log scale)",
      fvShort: "Fair value {v}", askShort: "Asking {v}",
      rangeTxt: "Range: {a} to {b} {u}", rangeH: "90% range", lo: "Low end", hi: "High end",
      rangeM: "Nine in ten similar listings ask between {a} and {b}.",
      fvH: "Fair value", fvM: "The model's value for a home like this; a reference to asking prices, not an appraisal.",
      askH: "Your asking price", gap: "Compared with fair value",
      above: "+{p} above the fair value", below: "{p} below the fair value", about: "about the fair value",
      askLine: "Asking price {v}: {g}.",
      locWard: "Location features come from the median of listed homes in this ward.",
      locDist: "Location features come from the median of listed homes in this district.",
      locDistFew: "Location features come from the median of listed homes in this district (fewer than 3 listings in this ward).",
      noAsk: "Enter an asking price to see where it sits and how likely such a listing is to sit unsold.",
      Low: "Low", Medium: "Medium", High: "High",
      sLow: "In the lower half of listings by risk of still being online after {d} days.",
      sMedium: "In the upper half, but not the top quarter, of listings by risk of still being online after {d} days.",
      sHigh: "In the top quarter of listings by risk of still being online after {d} days.",
      far: "This price is far outside the listings the model learned from; the risk light is not reliable here.",
      fix: "Fix the highlighted field to see the value.",
      take: "A home like this is valued at about {v} {u}; nine in ten similar listings ask between {a} and {b} {u}.",
      err: "Enter a value from {a} to {b}.", errMin: "Enter a number of {a} or more.", errNum: "Enter a number.",
      sNote: "A ranking among past listings, not a chance of sale. In this data, how slowly the district moves tells more than the price gap.",
      acc: "For {t}, about {k} in 10 model values fall within 20% of the asking price.",
      accPct: "For {t}, about {k} of model values fall within 20% of the asking price.",
      th: ["District", "Ward", "Type", "Area (m²)", "Price (billion VND)", "Posted"],
      thU: ["", "", "", " m²", " billion VND", ""],
      tType: "Type", tArea: "Area", tPrice: "Asking price", tPpm: "Per m²", tPosted: "Posted",
      tM: "A listing near this home in size, rooms and location.",
      src: "Model: gradient-boosted trees trained on the 5,268 listings; range calibrated on held-out listings.",
      note: "A guide to asking prices, not an appraisal.",
      sum: "Fair value {v} {u}, 90% range {a} to {b} {u}."
    },
    vi: {
      loading: "Đang tải mô hình…",
      city: "Thành phố", district: "Quận/huyện (cũ)", ward: "Phường/xã", anyWard: "Bất kỳ phường (trung vị quận)",
      type: "Loại nhà", area: "Diện tích (m²)", legal: "Giấy tờ pháp lý", beds: "Phòng ngủ", baths: "Phòng tắm",
      floors: "Số tầng", front: "Mặt tiền (m)", road: "Đường vào rộng (m)",
      ask: "Giá rao (tỷ đồng, không bắt buộc)", askPh: "vd. 9,5",
      hintDist: "Quận/huyện cũ, trước tháng 7/2025, theo cách tin rao ghi; mô hình được huấn luyện theo đơn vị này.",
      hintMiss: "Các ô bắt đầu ở giá trị điển hình của loại nhà. Ô số tầng, mặt tiền hoặc đường vào để trống sẽ lấy giá trị điển hình và được đánh dấu là thiếu, giống lúc huấn luyện.",
      hFv: "Giá trị hợp lý", hStale: "Nguy cơ nằm lâu không bán", hSim: "Tin tương tự",
      bn: "tỷ đồng", ppm: "triệu đồng/m²", perM2: "Mỗi m²",
      axis: "Giá rao, tỷ đồng (thang log)",
      fvShort: "Giá trị hợp lý {v}", askShort: "Giá rao {v}",
      rangeTxt: "Khoảng: {a} đến {b} {u}", rangeH: "Khoảng 90%", lo: "Đầu thấp", hi: "Đầu cao",
      rangeM: "Chín trên mười tin tương tự rao trong khoảng {a} đến {b}.",
      fvH: "Giá trị hợp lý", fvM: "Giá trị mô hình ước tính cho một căn như vậy; tham khảo về giá rao, không phải thẩm định.",
      askH: "Giá rao của bạn", gap: "So với giá trị hợp lý",
      above: "cao hơn giá trị hợp lý {p}", below: "thấp hơn giá trị hợp lý {p}", about: "xấp xỉ giá trị hợp lý",
      askLine: "Giá rao {v}: {g}.",
      locWard: "Đặc điểm vị trí lấy từ trung vị các căn đã rao trong phường này.",
      locDist: "Đặc điểm vị trí lấy từ trung vị các căn đã rao trong quận/huyện này.",
      locDistFew: "Đặc điểm vị trí lấy từ trung vị các căn đã rao trong quận/huyện này (phường này có dưới 3 tin).",
      noAsk: "Nhập giá rao để xem giá đó nằm ở đâu và khả năng tin như vậy nằm lâu không bán.",
      Low: "Thấp", Medium: "Trung bình", High: "Cao",
      sLow: "Thuộc nửa thấp của các tin về nguy cơ vẫn còn trên mạng sau {d} ngày.",
      sMedium: "Thuộc nửa cao, nhưng chưa vào một phần tư cao nhất, của các tin về nguy cơ vẫn còn trên mạng sau {d} ngày.",
      sHigh: "Thuộc một phần tư cao nhất của các tin về nguy cơ vẫn còn trên mạng sau {d} ngày.",
      far: "Giá này nằm xa ngoài dữ liệu mô hình đã học; đèn nguy cơ không đáng tin ở đây.",
      fix: "Sửa ô được đánh dấu để xem giá trị.",
      take: "Một căn như vậy có giá trị khoảng {v} {u}; chín trên mười tin tương tự rao trong khoảng {a} đến {b} {u}.",
      err: "Nhập giá trị từ {a} đến {b}.", errMin: "Nhập số từ {a} trở lên.", errNum: "Nhập một số.",
      sNote: "Đây là thứ hạng so với các tin đã đăng trước đó, không phải khả năng bán được. Trong dữ liệu này, tốc độ chậm của quận cho biết nhiều hơn mức chênh giá.",
      acc: "Với {t}, khoảng {k} trên 10 giá trị mô hình nằm trong khoảng ±20% so với giá rao.",
      accPct: "Với {t}, khoảng {k} giá trị mô hình nằm trong khoảng ±20% so với giá rao.",
      th: ["Quận/huyện", "Phường/xã", "Loại", "Diện tích (m²)", "Giá (tỷ đồng)", "Đăng"],
      thU: ["", "", "", " m²", " tỷ đồng", ""],
      tType: "Loại", tArea: "Diện tích", tPrice: "Giá rao", tPpm: "Mỗi m²", tPosted: "Đăng",
      tM: "Một tin gần với căn này về diện tích, số phòng và vị trí.",
      src: "Mô hình: cây tăng cường (gradient boosting) huấn luyện trên 5.268 tin; khoảng được hiệu chỉnh trên các tin giữ lại.",
      note: "Tham khảo về giá rao, không thay cho thẩm định.",
      sum: "Giá trị hợp lý {v} {u}, khoảng 90% từ {a} đến {b} {u}."
    }
  };
  // type phrase for the accuracy sentence (key = Vietnamese property type)
  var TYPE_PL = {
    en: { "Căn hộ chung cư": "apartments", "Nhà hẻm/ngõ": "alley houses", "Nhà mặt tiền/phố": "street-front houses",
          "Biệt thự/liền kề": "villas and terraced houses", "Đất": "land plots" },
    vi: { "Căn hộ chung cư": "căn hộ chung cư", "Nhà hẻm/ngõ": "nhà hẻm, ngõ", "Nhà mặt tiền/phố": "nhà mặt tiền",
          "Biệt thự/liền kề": "biệt thự, liền kề", "Đất": "đất" }
  };
  var LEGAL_VI = { "Khác/không rõ": "Khác, không rõ" };

  var LIM = { area: [10, 5000], beds: [0, 15], baths: [0, 15], floors: [0, 15], front: [0, 100], road: [0, 60], ask: [0, null] };
  var S = { p: null, scriptP: null, built: false, f: {}, err: {}, last: null, geom: null, w: 0 };

  function tx(k, v) {
    var s = TX[H.lang()][k];
    if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n]; });
    return s;
  }
  function $(tag, cls, text) { return H.el(tag, cls, text); }
  function sv(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function bi(parent, tag, en, vi) {   // bilingual static text: two data-l children
    var a = $(tag, "", en), b = $(tag, "", vi);
    a.setAttribute("data-l", "en"); b.setAttribute("data-l", "vi"); b.setAttribute("lang", "vi");
    parent.appendChild(a); parent.appendChild(b);
  }
  function pf(v) { return parseFloat(String(v).replace(/\s/g, "").replace(",", ".")); } // accepts "9,5" and "9.5"
  function num(id) { var v = S.f[id].value; return v === "" ? null : pf(v); }
  function bn(v) { return H.nf(v, 2); }

  /* ---------- loading ---------- */
  function loadEngine() {
    if (window.AVMEngine) return Promise.resolve();
    if (S.scriptP) return S.scriptP;
    S.scriptP = new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = ENGINE_SRC;
      s.onload = function () { window.AVMEngine ? ok() : bad(new Error("AVMEngine missing")); };
      s.onerror = function () { bad(new Error("housing_engine.js")); };
      document.head.appendChild(s);
    });
    return S.scriptP;
  }
  function loadAll() {
    if (S.p) return S.p;
    S.p = Promise.all([loadEngine(), H.load("model_avm"), H.load("model_stale"), H.load("tool_data"),
      H.load("meta").catch(function () { return null; })]).then(function (a) {
      var D = { avm: a[1], stale: a[2] };
      for (var k in a[3]) D[k] = a[3][k];
      S.D = D; S.T = D.listings; S.E = new window.AVMEngine.Engine(D); S.meta = a[4];
    });
    return S.p;
  }

  /* ---------- form ---------- */
  function field(id, key, control, cls) {
    var w = $("div", "ht-f" + (cls ? " " + cls : ""));
    var lab = $("label", "", ""); lab.htmlFor = "ht-" + id; lab.setAttribute("data-k", key);
    control.id = "ht-" + id; S.f[id] = control;
    w.appendChild(lab); w.appendChild(control);
    var er = $("p", "ht-err"); er.id = "ht-err-" + id; er.hidden = true; S.err[id] = er;
    control.setAttribute("aria-describedby", er.id);
    w.appendChild(er);
    return w;
  }
  function numIn(min, max, step) {
    var i = $("input"); i.type = "text"; i.min = min; i.max = max; i.step = step; i.inputMode = "decimal";
    return i;
  }
  function fillOpts(sel, list, labelFn) {
    var keep = sel.value;
    sel.textContent = "";
    list.forEach(function (v) { var o = $("option"); o.value = v; sel.appendChild(o); });
    if (list.indexOf(keep) >= 0) sel.value = keep;
    relabelSel(sel, labelFn);
  }
  function relabelSel(sel, labelFn) {
    for (var i = 0; i < sel.options.length; i++) sel.options[i].textContent = labelFn(sel.options[i].value);
  }
  var LABELS = {
    city: function (v) { return H.city(H.cityOf(v)); },
    type: function (v) { return H.type(v); },
    legal: function (v) { return H.lang() === "en" ? S.D.legalEN[v] : (LEGAL_VI[v] || v); },
    district: function (v) { return v; },
    ward: function (v) { return v === "" ? tx("anyWard") : v; }
  };
  function districtsOf(city) {
    var T = S.T, cnt = {};
    for (var i = 0; i < T.city.length; i++)
      if (T.cities[T.city[i]] === city) { var d = T.districts[T.district[i]]; cnt[d] = (cnt[d] || 0) + 1; }
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); });
  }
  function fillDistricts() { fillOpts(S.f.district, districtsOf(S.f.city.value), LABELS.district); fillWards(); }
  function fillWards() {
    var L = S.D.loc[S.f.city.value + "|" + S.f.district.value];
    fillOpts(S.f.ward, [""].concat(L ? L.wardList : []), LABELS.ward);
  }
  function typeDefaults() {
    var m = S.D.typeMed[S.f.type.value], f = S.f;
    f.area.value = m.area; f.beds.value = m.bedrooms; f.baths.value = m.bathrooms;
    f.floors.value = m.floors; f.front.value = m.frontage; f.road.value = m.road;
  }
  // the project's inputs(): a cleared floors / frontage / road field takes the type's typical value and is flagged missing
  function inputs() {
    var t = S.f.type.value, m = S.D.typeMed[t];
    var fl = num("floors"), fr = num("front"), rd = num("road"), be = num("beds"), ba = num("baths");
    return {
      city: S.f.city.value, district: S.f.district.value, ward: S.f.ward.value, type: t,
      area: Math.max(num("area") || m.area, 1), bedrooms: be === null ? m.bedrooms : be,
      bathrooms: ba === null ? m.bathrooms : ba,
      floors: fl === null ? m.floors : fl, floors_missing: fl === null ? 1 : 0,
      frontage: fr === null ? m.frontage : fr, frontage_missing: fr === null ? 1 : 0,
      road: rd === null ? m.road : rd, road_missing: rd === null ? 1 : 0,
      legal: S.f.legal.value, ask: num("ask") || 0
    };
  }

  // inline check of each number field against its limits; false while any value is out of range
  function validate() {
    var bad = 0;
    Object.keys(LIM).forEach(function (id) {
      var e = S.f[id], lim = LIM[id], msg = "", x = pf(e.value);
      if (e.validity && e.validity.badInput) msg = tx("errNum");
      else if (e.value !== "" && (!isFinite(x) || x < lim[0] || (lim[1] !== null && x > lim[1])))
        msg = lim[1] === null ? tx("errMin", { a: H.nf(lim[0], 0) }) : tx("err", { a: H.nf(lim[0], 0), b: H.nf(lim[1], 0) });
      S.err[id].textContent = msg; S.err[id].hidden = !msg;
      e.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) bad++;
    });
    return !bad;
  }

  function build(fig) {
    var root = $("div", "hs-tool");
    var form = $("form", "ht-form"); form.setAttribute("novalidate", ""); form.onsubmit = function () { return false; };
    var f = S.f, T = S.D;
    var cities = Object.keys(T.cbd).sort();
    var sel = function () { return $("select"); };
    form.appendChild(field("city", "city", sel(), "ht-wide"));
    var dw = field("district", "district", sel(), "ht-wide");
    dw.appendChild($("p", "ht-hint", "")).setAttribute("data-k", "hintDist");
    form.appendChild(dw);
    form.appendChild(field("ward", "ward", sel(), "ht-wide"));
    form.appendChild(field("type", "type", sel(), "ht-wide"));
    form.appendChild(field("legal", "legal", sel(), "ht-wide"));
    form.appendChild(field("area", "area", numIn(10, 5000, 1)));
    form.appendChild(field("beds", "beds", numIn(0, 15, 1)));
    form.appendChild(field("baths", "baths", numIn(0, 15, 1)));
    form.appendChild(field("floors", "floors", numIn(0, 15, 1)));
    form.appendChild(field("front", "front", numIn(0, 100, 0.5)));
    form.appendChild(field("road", "road", numIn(0, 60, 0.5)));
    var aw = field("ask", "ask", numIn(0, "", 0.1), "ht-wide");
    f.ask.min = "0"; f.ask.removeAttribute("max");
    form.appendChild(aw);
    form.appendChild($("p", "ht-hint ht-wide", "")).setAttribute("data-k", "hintMiss");
    root.appendChild(form);

    // result area
    var out = $("div", "ht-out");
    S.out = out; S.fig = fig;
    S.invEl = $("p", "ht-inv"); S.invEl.hidden = true; S.invEl.setAttribute("data-k", "fix"); out.appendChild(S.invEl);
    out.appendChild($("p", "ht-h", "")).setAttribute("data-k", "hFv");
    S.fvEl = $("p", "ht-fv"); S.fvEl.setAttribute("role", "status"); out.appendChild(S.fvEl);
    S.subEl = $("p", "ht-sub"); out.appendChild(S.subEl);
    S.barEl = $("div", "ht-bar"); out.appendChild(S.barEl);
    S.askEl = $("p", "ht-askline"); out.appendChild(S.askEl);
    S.locEl = $("p", "ht-m"); out.appendChild(S.locEl);
    S.accEl = $("p", "ht-acc"); out.appendChild(S.accEl);
    out.appendChild($("p", "ht-h", "")).setAttribute("data-k", "hStale");
    S.staleEl = $("div", "ht-stale"); out.appendChild(S.staleEl);
    out.appendChild($("p", "ht-h", "")).setAttribute("data-k", "hSim");
    var tw = $("div", "ht-tw"), tb = $("table", "ht-comp"), th = $("thead"), tr = $("tr");
    for (var i = 0; i < 6; i++) { var h = $("th", i === 3 || i === 4 ? "n" : ""); h.scope = "col"; tr.appendChild(h); }
    th.appendChild(tr); tb.appendChild(th); S.tbody = $("tbody"); tb.appendChild(S.tbody); tw.appendChild(tb);
    out.appendChild(tw);
    root.appendChild(out);

    var plot = fig.querySelector(".hs-plot");
    plot.textContent = ""; plot.appendChild(root);
    S.root = root; S.thead = tr;

    // options and defaults (as in the project's dashboard: Hanoi, alley house, first district)
    fillOpts(f.city, cities, LABELS.city);
    var c0 = CITY_CODE[(H.st.c || "hn").toUpperCase()];
    f.city.value = cities.indexOf(c0) >= 0 ? c0 : "Hà Nội";
    fillOpts(f.type, Object.keys(T.typeEN), LABELS.type);
    fillOpts(f.legal, T.legal, LABELS.legal);
    var t0 = H.st.d ? resolveKey(H.st.d) : null;   // a shared link: preselect its district, no scrolling
    if (t0) f.city.value = t0.city;
    fillDistricts();
    if (t0) { f.district.value = t0.district; fillWards(); }
    f.type.value = "Nhà hẻm/ngõ";
    typeDefaults();

    var timer = 0;
    function later() { clearTimeout(timer); timer = setTimeout(run, 60); }
    f.city.onchange = function () { fillDistricts(); setD(); run(); };
    f.district.onchange = function () { fillWards(); setD(); run(); };
    f.type.onchange = function () { typeDefaults(); run(); };
    f.ward.onchange = f.legal.onchange = run;
    ["area", "beds", "baths", "floors", "front", "road", "ask"].forEach(function (id) { f[id].oninput = later; });

    // tooltips: range bar parts and comparables rows
    S.barHover = H.hover(S.barEl, barFind);
    S.rowHover = H.hover(S.tbody, rowFind);

    S.built = true;
    relabel();
    run();
  }

  function keyOf(city, dist) { return (city === "Hà Nội" ? "HN" : "HCM") + " | " + dist; }   // as in the engine and districts.json
  function setD() { H.set({ d: keyOf(S.f.city.value, S.f.district.value) }); }

  function relabel() {
    if (!S.built) return;
    var k, nodes = S.root.querySelectorAll("[data-k]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = tx(nodes[i].getAttribute("data-k"));
    S.f.ask.placeholder = tx("askPh");
    validate();
    ["city", "type", "legal", "district", "ward"].forEach(function (id) { relabelSel(S.f[id], LABELS[id]); });
    var hs = S.thead.children, T = TX[H.lang()];
    for (k = 0; k < 6; k++) hs[k].textContent = T.th[k];
  }

  /* ---------- result ---------- */
  function run() {
    var ok = validate();   // out-of-range input: the message shows and the last result stays hidden
    S.out.classList.toggle("is-invalid", !ok);
    S.fig.classList.toggle("ht-invalid", !ok);   // lets the reserved height go while only the one-line note shows
    S.invEl.hidden = ok;
    if (!ok) return;
    var inp = inputs(), r;
    try { r = S.E.value(inp); } catch (e) { console.warn(e); return; }
    S.last = { inp: inp, res: r, comps: S.E.comparables(inp, r.loc, 5) };
    S.root.setAttribute("data-fv", String(r.fv));   // full precision, for the browser check
    S.root.setAttribute("data-p", r.p === undefined ? "" : String(r.p));
    draw();
  }
  function ppm(r, inp) { return H.nf(r.fv * 1000 / inp.area, 0) + " " + tx("ppm"); }
  function gapText(g) {
    var p = Math.round(Math.abs(g) * 100);
    if (p === 0) return tx("about");
    return tx(g > 0 ? "above" : "below", { p: H.nf(p, 0) + "%" });
  }
  function draw() {
    if (!S.last) return;
    var L = S.last, r = L.res, inp = L.inp, u = tx("bn");
    S.fvEl.textContent = bn(r.fv) + " " + u;
    var tk = S.fig.parentNode.querySelector(".hs-take");
    if (tk) tk.textContent = tx("take", { v: bn(r.fv), u: u, a: bn(r.lo), b: bn(r.hi) });
    S.subEl.textContent = ppm(r, inp) + " · " + tx("rangeTxt", { a: bn(r.lo), b: bn(r.hi), u: u });
    drawBar();
    S.askEl.textContent = inp.ask > 0 ? tx("askLine", { v: bn(inp.ask) + " " + u, g: gapText(r.gap) }) : "";
    S.askEl.hidden = !(inp.ask > 0);
    S.locEl.textContent = r.level === "ward" ? tx("locWard") : (inp.ward ? tx("locDistFew") : tx("locDist"));
    var a = accSentence(inp.type);
    S.accEl.textContent = a; S.accEl.hidden = !a;
    drawStale();
    drawComps();
    if (S.barHover) S.barHover.refresh();
    if (S.rowHover) S.rowHover.refresh();
  }
  function frac(v) {
    if (typeof v === "string") { var p = parseFloat(v); v = v.indexOf("%") >= 0 ? p / 100 : p; }
    return v > 1 ? v / 100 : v;
  }
  function accSentence(vn) {
    var list = S.meta && S.meta.accuracy;
    if (!list) return "";
    var en = S.D.typeEN[vn], hit = null;
    list.forEach(function (x) { if (x.type === vn || x.type_vi === vn || x.type === en) hit = x; });
    if (!hit || hit.ppe20 === undefined || hit.ppe20 === null) return "";
    var f = frac(hit.ppe20), k = Math.round(f * 10), t = TYPE_PL[H.lang()][vn] || H.type(vn);
    return k >= 1 && k <= 9 ? tx("acc", { t: t, k: H.nf(k, 0) }) : tx("accPct", { t: t, k: H.pct(f, 0) });
  }

  function drawStale() {
    var el = S.staleEl, L = S.last;
    el.textContent = "";
    if (!(L.inp.ask > 0) || !L.res.light) { el.appendChild($("p", "ht-m", tx("noAsk"))); return; }
    var lv = L.res.light, far = Math.abs(L.res.gap) > 0.5, lights = $("div", "ht-lights" + (far ? " is-off" : ""));
    lights.setAttribute("role", "img");
    lights.setAttribute("aria-label", tx("hStale") + ": " + tx(lv));
    LIGHTS.forEach(function (n) {
      var s = $("span", "ht-lv ht-lv-" + n.toLowerCase() + (n === lv ? " is-on" : ""), tx(n));
      lights.appendChild(s);
    });
    el.appendChild(lights);
    el.appendChild($("p", "ht-stale-t", far ? tx("far") : tx("s" + lv, { d: H.nf(S.D.staleDays, 0) })));
    el.appendChild($("p", "ht-m", tx("sNote")));
  }

  function monthOf(m) {
    var a = /^(\d{1,2})\/(\d{4})$/.exec(m || "");
    if (a) return H.month(a[2] + "-" + (a[1].length < 2 ? "0" : "") + a[1]);
    return /^\d{4}-\d{2}/.test(m || "") ? H.month(m.slice(0, 7)) : "–";
  }
  function rowData(i) {
    var T = S.T;
    return {
      d: T.districts[T.district[i]], w: T.wardsDict[T.ward[i]] || "–", t: H.type(T.types[T.type[i]]),
      a: T.area[i], p: T.price_bn[i], m2: T.price_bn[i] * 1000 / T.area[i], mo: monthOf(T.month[i])
    };
  }
  function drawComps() {
    var tb = S.tbody, U = TX[H.lang()].thU;
    tb.textContent = "";
    S.last.comps.forEach(function (i, n) {
      var d = rowData(i), tr = $("tr"); tr.setAttribute("data-r", n);
      var cells = [[d.d, "d"], [d.w, "w"], [d.t, "t"], [H.nf(d.a, 1), "a n"], [H.nf(d.p, 2), "p n"], [d.mo, "o"]];
      cells.forEach(function (c, j) {
        var td = $("td", c[1], c[0]);
        if (U[j]) td.appendChild($("span", "ht-u", U[j]));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }
  function rowFind(x, y, ev) {   // x, y are relative to the tbody; ev is the pointer event
    var t = ev && ev.target, tr = t && t.closest ? t.closest("tr") : null;
    if (!tr || !S.tbody.contains(tr) || !S.last) return null;
    var n = +tr.getAttribute("data-r"), i = S.last.comps[n];
    if (i === undefined) return null;
    var d = rowData(i);
    return { key: "r" + n, node: H.card({
      h: d.d + " · " + d.w,
      rows: [[tx("tType"), d.t], [tx("tArea"), H.nf(d.a, 1) + " m²"], [tx("tPrice"), H.nf(d.p, 2) + " " + tx("bn")],
             [tx("tPpm"), H.nf(d.m2, 0) + " " + tx("ppm")], [tx("tPosted"), d.mo]],
      m: [tx("tM")] }) };
  }

  /* ---------- range bar ---------- */
  var TICK_SETS = [[1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8], [1, 1.5, 2, 3, 5, 7], [1, 2, 3, 5], [1, 2, 5], [1, 3], [1]];
  function dps(v) { var s = String(+v.toPrecision(3)), i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; }
  function ticks(a, b, max) {   // a, b: natural-log domain, ticks on a 1-2-5 style log scale
    var lo = Math.exp(a), hi = Math.exp(b), e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi)), best = [];
    for (var s = 0; s < TICK_SETS.length; s++) {
      var t = [];
      for (var e = e0; e <= e1; e++) TICK_SETS[s].forEach(function (m) {
        var v = +(m * Math.pow(10, e)).toPrecision(6);
        if (v >= lo && v <= hi) t.push(v);
      });
      if (t.length >= 2 && t.length <= max) return t;
      if (!best.length && t.length) best = t;
    }
    return best;
  }
  // label lanes: each label is centred on its tick, pushed inside the box, and takes the first lane where it overlaps no other
  function lanes(items, ys, W, fs) {
    var placed = [];
    items.sort(function (p, q) { return q.pr - p.pr; }).forEach(function (it) {
      var w = H.textW(it.text, fs), x0 = Math.min(Math.max(it.x - w / 2, 2), W - w - 2);
      for (var k = 0; k < ys.length; k++) {
        var ok = true;
        placed.forEach(function (p) { if (p.k === k && x0 < p.x1 + 8 && x0 + w > p.x0 - 8) ok = false; });
        if (ok) { placed.push({ it: it, k: k, x0: x0, x1: x0 + w, y: ys[k] }); return; }
      }
    });
    return placed;
  }
  function drawBar() {
    var L = S.last, r = L.res, inp = L.inp, el = S.barEl;
    var W = Math.max(260, Math.floor(el.clientWidth || 320)), fs = window.innerWidth < 600 ? 11 : 12;
    S.w = el.clientWidth;
    var padL = 14, padR = 14, barY = 44, barH = 16, axisY = 112, H_ = 152;
    var vals = [r.lo, r.hi, r.fv]; if (inp.ask > 0) vals.push(inp.ask);
    var a = Math.log(Math.min.apply(0, vals)), b = Math.log(Math.max.apply(0, vals)), pad = Math.max((b - a) * 0.12, 0.08);
    a -= pad; b += pad;
    var X = function (v) { return padL + (Math.log(v) - a) / (b - a) * (W - padL - padR); };
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H_, width: "100%", height: H_, role: "img",
      "aria-label": tx("sum", { v: bn(r.fv), u: tx("bn"), a: bn(r.lo), b: bn(r.hi) }) });
    svg.appendChild(sv("line", { x1: padL, x2: W - padR, y1: axisY, y2: axisY, stroke: "#e4e1d8" }));
    ticks(a, b, W < 400 ? 5 : 8).forEach(function (v) {
      var x = X(v);
      svg.appendChild(sv("line", { x1: x, x2: x, y1: axisY, y2: axisY + 5, stroke: "#6b6f72" }));
      svg.appendChild(sv("text", { x: x, y: axisY + 19, "text-anchor": "middle", fill: "#6b6f72" }, H.nf(v, dps(v))));
    });
    svg.appendChild(sv("text", { x: W / 2, y: H_ - 4, "text-anchor": "middle", fill: "#6b6f72" }, tx("axis")));
    var xl = X(r.lo), xh = X(r.hi), xf = X(r.fv), xa = inp.ask > 0 ? X(inp.ask) : null;
    svg.appendChild(sv("rect", { x: xl, y: barY, width: Math.max(xh - xl, 1), height: barH, fill: H.RAMP[1], stroke: H.RAMP[3] }));
    svg.appendChild(sv("line", { x1: xf, x2: xf, y1: barY - 8, y2: barY + barH + 8, stroke: "#23272b", "stroke-width": 2.5 }));
    if (xa !== null) svg.appendChild(sv("line", { x1: xa, x2: xa, y1: barY - 8, y2: barY + barH + 8, stroke: "#1f5f7a", "stroke-width": 2.5, "stroke-dasharray": "4 2" }));
    var top = [{ x: xf, text: tx("fvShort", { v: bn(r.fv) }), pr: 3, c: "#23272b" }];
    if (xa !== null) top.push({ x: xa, text: tx("askShort", { v: bn(inp.ask) }), pr: 2, c: "#1f5f7a" });
    lanes(top, [barY - 14, barY - 30], W, fs).forEach(function (p) {
      svg.appendChild(sv("text", { x: p.x0, y: p.y, fill: p.it.c, "font-weight": p.it.pr === 3 ? 500 : 400 }, p.it.text));
    });
    lanes([{ x: xl, text: bn(r.lo), pr: 2 }, { x: xh, text: bn(r.hi), pr: 1 }], [barY + barH + 22, barY + barH + 38], W, fs)
      .forEach(function (p) { svg.appendChild(sv("text", { x: p.x0, y: p.y, fill: "#23272b" }, p.it.text)); });
    el.textContent = ""; el.appendChild(svg);
    S.geom = { top: barY - 10, bottom: barY + barH + 10, xl: xl, xh: xh, xf: xf, xa: xa };
  }
  function barFind(x, y) {
    var g = S.geom;   // x, y are relative to the bar container, which is the svg's box
    if (!g || !S.last) return null;
    var sx = x, sy = y, r = S.last.res, inp = S.last.inp, u = tx("bn");
    if (sy < g.top || sy > g.bottom) return null;
    var df = Math.abs(sx - g.xf), da = g.xa === null ? 1e9 : Math.abs(sx - g.xa);
    if (Math.min(df, da) <= 9) {
      if (df <= da) return { key: "fv", node: H.card({ h: tx("fvH"),
        rows: [[tx("hFv"), bn(r.fv) + " " + u], [tx("perM2"), ppm(r, inp)]], m: [tx("fvM")] }) };
      return { key: "ask", node: H.card({ h: tx("askH"),
        rows: [[tx("tPrice"), bn(inp.ask) + " " + u], [tx("gap"), gapText(r.gap)]] }) };
    }
    if (sx >= g.xl && sx <= g.xh)
      return { key: "range", node: H.card({ h: tx("rangeH"),
        rows: [[tx("lo"), bn(r.lo) + " " + u], [tx("hi"), bn(r.hi) + " " + u]],
        m: [tx("rangeM", { a: bn(r.lo), b: bn(r.hi) })] }) };
    return null;
  }

  /* ---------- pick-district from the map ---------- */
  function resolveKey(key) {
    var D = S.D, i = key.indexOf(" | "), city, dist;
    if (i > 0 && CITY_CODE[key.slice(0, i)]) { city = CITY_CODE[key.slice(0, i)]; dist = key.slice(i + 3); }
    else if (D.loc[key]) { var p = key.split("|"); city = p[0]; dist = p[1]; }
    else {
      var ks = Object.keys(D.loc);
      for (var j = 0; j < ks.length; j++) if (ks[j].split("|")[1] === key) { city = ks[j].split("|")[0]; dist = key; break; }
    }
    return city && D.loc[city + "|" + dist] ? { city: city, district: dist } : null;
  }
  function pick(fig, e) {
    var key = e && e.key;
    if (!key) return;
    ensure(fig).then(function () {
      var t = resolveKey(key);
      if (!t) return;
      S.f.city.value = t.city; fillDistricts();
      S.f.district.value = t.district; fillWards();
      run();
      fig.scrollIntoView({ behavior: H.reduced() ? "auto" : "smooth", block: "start" });
      S.f.area.focus({ preventScroll: true });
    }).catch(function () { /* the failure is already shown by ensure() */ });
  }

  /* ---------- mount ---------- */
  function ensure(fig) {
    return loadAll().then(function () { if (!S.built) build(fig); }).catch(function (err) {
      S.p = null; S.scriptP = null; H.fail(fig, err); throw err;
    });
  }
  function caption(fig) {
    var cap = fig.querySelector("figcaption");
    if (!cap) { cap = $("figcaption"); fig.appendChild(cap); }
    [["hs-src", "src"], ["hs-note", "note"]].forEach(function (c) {
      var p = cap.querySelector("." + c[0]);
      if (!p) { p = $("p", c[0]); cap.insertBefore(p, cap.querySelector(".hs-fail")); }
      p.textContent = "";
      bi(p, "span", TX.en[c[1]], TX.vi[c[1]]);
    });
  }
  function mount(fig) {
    if (fig.getAttribute("data-mounted")) return;
    fig.setAttribute("data-mounted", "1");
    var plot = fig.querySelector(".hs-plot");
    if (!plot) { plot = $("div", "hs-plot"); fig.insertBefore(plot, fig.firstChild); }
    caption(fig);
    var ld = $("p", "ht-loading", tx("loading")); plot.textContent = ""; plot.appendChild(ld);
    H.onLang(function () { if (S.built) { relabel(); draw(); } else ld.textContent = tx("loading"); });
    H.lazy(fig, function () { ensure(fig).catch(function () {}); }, "600px");
    H.on("pick-district", function (e) { pick(fig, e); });
    var timer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (S.built && S.barEl.clientWidth !== S.w) drawBar(); }, 150);
    });
  }
  function init() {
    var figs = document.querySelectorAll('[data-hs="tool"]');
    for (var i = 0; i < figs.length; i++) mount(figs[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
