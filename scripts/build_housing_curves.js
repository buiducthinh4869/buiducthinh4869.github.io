// Housing atlas, section 3: "how the valuation model prices one feature".
// Runs the site's own engine (assets/housing_engine.js) with the saved models on a typical home of each type in each
// city (median features of the type; the former district with most listings of that type; district-median location),
// and changes one feature at a time over a range that the listings cover. Writes assets/data/housing/curves.json.
// Usage, from the repository root:  node scripts/build_housing_curves.js
"use strict";
const fs = require("fs"), path = require("path");
const D0 = path.join(__dirname, "..", "assets", "data", "housing");
const E = require(path.join(__dirname, "..", "assets", "housing_engine.js"));
const rd = (f) => JSON.parse(fs.readFileSync(path.join(D0, f + ".json"), "utf8"));
const D = Object.assign({ avm: rd("model_avm"), stale: rd("model_stale") }, rd("tool_data"));
const eng = new E.Engine(D), T = D.listings;

const CITIES = ["Hà Nội", "TP. Hồ Chí Minh"], CODE = { "Hà Nội": "hn", "TP. Hồ Chí Minh": "hcm" };
const TYPES = Object.keys(D.typeMed);
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.max(0, Math.round(p * (b.length - 1))))]; };
const r3 = (x) => Math.round(x * 1000) / 1000;

function base(city, type) {
  const m = D.typeMed[type], cnt = {}, areas = [];
  for (let i = 0; i < T.city.length; i++) {
    if (T.cities[T.city[i]] !== city || T.types[T.type[i]] !== type) continue;
    const d = T.districts[T.district[i]]; cnt[d] = (cnt[d] || 0) + 1; areas.push(T.area[i]);
  }
  const district = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  const house = type !== "Căn hộ chung cư";
  return {
    inp: { city, district, ward: "", type, area: m.area, bedrooms: m.bedrooms, bathrooms: m.bathrooms,
      floors: m.floors, floors_missing: 0, frontage: m.frontage, frontage_missing: house ? 0 : 1,
      road: m.road, road_missing: house ? 0 : 1, legal: "Sổ đỏ/Sổ hồng", ask: 0 },
    n: areas.length, district, areaQ: [q(areas, 0.05), q(areas, 0.95)]
  };
}
function val(inp) { return eng.value(inp).fv; }

const out = { note: "Model values of a typical home, one feature changed at a time; rel = value / value of the typical home. For area, rel is per m².", cities: {} };
for (const city of CITIES) {
  const C = out.cities[CODE[city]] = {};
  for (const type of TYPES) {
    const b = base(city, type), v0 = val(b.inp), house = type !== "Căn hộ chung cư", land = type === "Đất";
    const o = C[type] = { n: b.n, district: b.district, base: { area: b.inp.area, floors: b.inp.floors, frontage: b.inp.frontage, road: b.inp.road, fv: r3(v0), ppm2: r3(v0 * 1000 / b.inp.area) }, f: {} };
    // area: price per m2 relative to the typical home's price per m2
    const [a0, a1] = b.areaQ, pts = [];
    for (let k = 0; k <= 24; k++) {
      const a = Math.round(a0 * Math.pow(a1 / a0, k / 24));
      const v = val(Object.assign({}, b.inp, { area: a }));
      pts.push([a, r3((v * 1000 / a) / (v0 * 1000 / b.inp.area))]);
    }
    o.f.area = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0]);
    function sweep(key, xs) { o.f[key] = xs.map((x) => [x, r3(val(Object.assign({}, b.inp, { [key]: x })) / v0)]); }
    if (house) {
      sweep("road", [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 15]);
      sweep("frontage", [2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10]);
      if (!land) sweep("floors", [1, 2, 3, 4, 5, 6, 7]);
    }
    o.f.legal = D.legal.map((g) => [g, r3(val(Object.assign({}, b.inp, { legal: g })) / v0)]);
  }
}
fs.writeFileSync(path.join(D0, "curves.json"), JSON.stringify(out));
console.log("curves.json written:", Object.keys(out.cities).map((c) => c + " " + Object.keys(out.cities[c]).length + " types").join(", "));
