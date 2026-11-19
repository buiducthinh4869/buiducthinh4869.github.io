# Personal website of Bui Duc Thinh

Static site served by GitHub Pages from the root of `buiducthinh4869/buiducthinh4869.github.io` (branch `main`). Plain HTML, CSS and JavaScript. No build step, no framework. `.nojekyll` must stay.

## Files

- `index.html`, `research.html`, `writing.html`, `cv.html`: the four pages in the nav bar.
- `writing/<slug>/index.html`: one folder per blog post.
- `blog/*.md`: post sources in Markdown, one file per language.
- `assets/style.css`: all styles. `assets/site.js`: EN/VI switch. `assets/post.js`: renders a post and mounts Giscus comments.
- `assets/portrait.jpg`: 480 x 600 crop of `assets/photo.png` (the original, not published).
- `assets/favicon.svg`, `assets/mark.svg`: the isobar mark (favicon, divider between sections of a post).

## Bilingual rule

Every visible text exists twice: `<span data-l="en">…</span><span data-l="vi" lang="vi">…</span>` (or `p`, `h1`, etc.). CSS hides the inactive language through `html[data-lang]`. When adding or editing text, always write both versions. Paper titles stay in English in both languages. Each page's `<html>` carries `data-title-en` and `data-title-vi`.

## Design rules

- Colors: paper `#faf9f5`, ink `#23272b`, muted `#6b6f72`, rule `#e4e1d8`, accent `#1f5f7a` (links and isobar only), accent-soft `#c9dbe2`.
- Fonts: Newsreader (reading text, headings), Be Vietnam Pro (nav, labels, meta lines). Both support Vietnamese.
- One decorative element only: the isobar drawing on the home page and its small mark. Do not add other ornaments, cards, shadows, gradients or all-caps labels.
- Reading width is 40rem. Must work at 375px wide without horizontal scroll.
- Layout, breakpoint 1000px. Below it every page is one stacked 40rem column. From 1000px the container (`.wrap`, header and footer included) is 72rem:
  - Home: two columns in `.home-grid`. `.profile` (photo, name, field, bio, links) on the left, sticky (static when the viewport is under 800px high); `.home-main` (Research, Writing) on the right at 40rem.
  - Research, Writing, CV: any `main > .wrap` that has `h2` children becomes a grid. Each `h2` sits in a 14rem left rail and the element after it in the 40rem right column; the page title, lede, `figure`, `.cv-actions` and `.cv-frame` span the full width. Keep `h2` and its list as direct children of `.wrap`.
  - Blog post: `<main class="post-page">` keeps the single 40rem column.

## Adding a blog post

1. Put `blog/<name>_en.md` and/or `blog/<name>_vi.md` in place (first line `# Title`; it is dropped on render because the page shows the title).
2. Copy `writing/how-i-found-my-way-into-research/index.html` to `writing/<new-slug>/index.html`; change titles (EN and VI, including `data-title-*`), date, and `data-src-en` / `data-src-vi`. Leave out a `data-src-*` if that language does not exist; the page then shows the other language with a note.
3. Add a row to the list in `writing.html` (newest first, grouped by year) and replace the row on the home page so it shows the newest post. Tags EN/VI show which languages exist.

## Content facts (do not change without Thinh's confirmation)

- Toan Phan: Senior Economist and Research Advisor, Federal Reserve Bank of Richmond (VI: Ngân hàng Dự trữ Liên bang Richmond), https://toanphan.org/. Hien Pham: Southwestern University of Finance and Economics, https://sites.google.com/view/hien-pham/home.
- Degree: Bachelor of Economics, International Business Economics (Kinh tế đối ngoại), Foreign Trade University, 2026, High Distinction.
- Work-in-progress titles and co-author lists on the Research page were confirmed by Thinh in November 2026 (titles stay in English in both languages). The VEAM 2026 paper "Heterogeneous Cyclone Damages: Theory and Evidence" is an earlier version of the ENSO project and is listed only as a note under that entry and has no section of its own.
- CV PDF lives on Google Drive (file id `1wXSslNwDubA9oQHsioAXGHGH6AoVvzGx`); the CV page embeds and links it, so updating the Drive file updates the site.

## Comments

Giscus on post pages, backed by GitHub Discussions of this repo (category General). Each post page carries the IDs in its `giscus-config` block: `data-repo-id="R_kgDOVC3GwA"`, `data-category-id="DIC_kwDOVC3GwM4DLP_6"` (both are public identifiers, read with `gh api graphql`). Copying the template post page keeps them.

## Storm explorer (Research page)

`research.html` opens with an interactive figure, `<figure class="storm-explorer">`, under the page lede. It shows one storm at a time: night-time light in 2025, the selected storm's wind field as isotachs (lines of equal peak wind at 17, 33, 43, 50 and 58 m/s, with a faint fill of at most 12%), its track with dots at the 6-hourly fixes, and an eye marker. No other tracks are drawn. The storms are those that came within 200 km of Vietnam with a lifetime maximum of at least 34 kt, seasons 1981 to 2024 (271 storms).

- Finding a storm: search box (suggestions by name and season, diacritics ignored), six suggested storms, and a timeline index below the map (x = date of the closest approach to Vietnam, y = peak wind within 200 km of Vietnam, category bands, storms without a near-Vietnam wind in a strip below the axis). Seven category toggles filter the timeline and the search suggestions. The selected storm is in the URL hash (`#storm=2017-damrey`; duplicate names add the IBTrACS SID). Default: Damrey 2017.
- Map behaviour: on selection the field fades in, the track draws in and the view eases to the storm's wind box (no easing on touch screens, where a zoomed map would trap page scrolling; no motion at all under reduced motion). Play moves the eye smoothly through the storm's public IBTrACS fixes inside the window (linear between fixes, 150 ms of screen time per storm hour) with the time in UTC+7 and the IBTrACS wind of the last fix passed. During Play the isotachs grow in: each wind cell reaches its published peak at the time the track passes closest to it and ramps up over the 9 hours before (a display device built from the published peak field and the public track only). Rings and two spiral bands around the eye scale with the IBTrACS wind, and a soft disc dims the lights near the eye (labelled in the caption as an illustration, not measured outages). Play runs even under reduced motion, because the reader starts it and can pause it; the automatic easing on selection still respects reduced motion. From 1000px the finder, info line and filter sit left of the map and the timeline spans the container.
- Code: `assets/storm_map.js` (D3 7.9.0 from cdnjs, loaded on this page only; keep it under 40 KB unminified) and the "Storm explorer" block in `assets/style.css`. Static labels use `data-l`; script-generated text comes from the `TXT` table and re-renders on `langchange`.
- Data in `assets/data`: `storms_vn.json`, `land_outline.json`, `lights_vn.png`, `lights_vn.json`, `wind/<id>.png` (one per storm, loaded on selection). The track of each storm is in `storms_vn.json` (`runs`: IBTrACS fixes inside the window with their wind, plus interpolated window-edge crossings). Fallback picture `assets/storm_map_static.png` (Damrey 2017; shown in `<noscript>` and when D3 or the data fail).
- Rebuild, in this order: `python -E -P _materials/storm_map/build_storm_map.py` (IBTrACS selection, lights, land; about 1 minute), then `python -E -P _materials/storm_map/build_wind_fields.py` (wind fields, static picture; about 1 minute). Each asserts its checks and ends with DONE. `_materials/` is not published.
- Selection and winds in the info line and timeline (public IBTrACS v04r01, main tracks): at least one fix within 200 km (haversine) of Natural Earth's Vietnam polygon. Wind is `USA_WIND` (1-minute) if the storm has any, else `WMO_WIND` (3 storms, JMA 10-minute), in m/s as knots x 0.5144; classes from knots (TS 34-63, cat 1 64-82, cat 2 83-95, cat 3 96-112, cat 4 113-136, cat 5 137+). The timeline bands are drawn at these knot limits, so a dot's band always equals its class; the toggle tooltips give the rounded m/s ranges.
- Wind fields come from the research project Cyclone-economic-growth, **with Toan Phan's approval of 2026-11-16, which covers wind-field images of individual storms only**. Method: the project's hourly points (`data/master/tracks_d1_hourly.csv`, `vmax_hybrid`), the main Rmax version c2r (`result/enso/d1/rmax_smoothing/series/rmax_c2r.parquet`, linear in time between synoptic fixes; seasons 2023-24 use its fallback formula, which is `rmax_km` of the hourly file), Holland (1980) with B = 1.5 and a 500 km cutoff (`pipeline.holland_wind`, imported), per-cell peak over the storm's life on the 0.1 degree grid, cropped to 100-118 E, 6-25 N. PNG value = m/s rounded down (so value >= 17 is exactly wind >= 17), 0 below 10 m/s, row 0 = north; `wind_bbox` = [west, south, east, north]. The build reproduces the project's Damrey 2017 figure numbers (43.95 m/s at the landfall cell, 798 / 204 / 0 Vietnam cells at 17 / 33 / 50 m/s) before using c2r (781 / 200 / 0).
- **Nothing else from that project may be published without co-author approval**: no project track points or `vmax_hybrid` winds (tracks, fixes and every wind number shown are public IBTrACS), no exposure numbers (wind x light, wind x land or area, light share), no ENSO results, no panels or estimates. The project folder and its cold store are read only; the build writes nothing there (bytecode writing is off when it imports the project's functions).
- No published file may carry a country border or country polygon: land is one dissolved, unlabelled shape, and country polygons and rasters exist only inside the build scripts. Since 2026-11-19 (Thinh's decision) country names may appear in one place only: the country list of the storm globe (`assets/data/globe/index.json`, field `countries`), used to filter storms and turn the globe. The Vietnam explorer stays without country names in its data files.

## Storm globe and overview (Research page)

Two figures under the Vietnam explorer. `<figure class="storm-globe">`: an orthographic globe (drag to turn, wheel after the reader engages, + and − buttons) with night-time light, a region select (ocean basins, then countries by name), a search box, a list sorted newest or strongest (60 rows at most), and up to four selected storms drawn in the colours `#1f5f7a`, `#b08a5a`, `#7a4f6e`, `#4f6e3a` (track, 6-hourly dots, isotachs as lines, no fill). Play runs the selected storms together from each storm's first fix (60 ms of screen time per storm hour), the globe follows the first one, with the same growing isotachs, eye rings, spiral bands (clockwise south of the equator) and dimming lights as the Vietnam explorer; the clock is in UTC. `<figure class="storm-overview">`: every track on an Equal Earth map (centred on 150 E), coloured by genesis basin, with a legend of basins and storm counts; a basin button highlights it and sets the globe's region. Basin colours: WP `#1f5f7a`, NA `#b08a5a`, EP `#8a9a5b`, NI `#a65e4e`, SI `#7a5c8a`, SP `#6b6f72`, SA `#9a8f80`.

- Code: `assets/storm_globe.js` (same D3; keep it under 40 KB unminified) and the "Storm globe and overview" block in `assets/style.css`. Text in `TXT` (en, vi) and `data-l` spans.
- Wind fields worldwide: Thinh reported on 2026-11-19 that Toan Phan agrees to visualizing the project's wind fields on the site. Exposure numbers (StormActivity, LandExposure, wind x light, shares by basin), ENSO results and estimates still stay unpublished.
- Data contract, `assets/data/globe/` (built on Thinh's laptop by `_materials/storm_globe/build_globe.py`, not published):
  - `land.json`: Natural Earth 110m land, dissolved, GeoJSON MultiPolygon, coordinates rounded to 0.01 degree (built from the `world-atlas` npm package, land-110m).
  - `index.json`: `{"meta": {...}, "countries": [[name_en, name_vi, lon, lat, radius_deg], ...], "storms": [...]}`. `meta`: `source` (text), `seasons` [1981, 2024], `wind_res` (degrees per wind cell), `lights` {`bounds` [west, south, east, north], `cell_deg`, `width`, `height`, `product`, `year`, `scale` {`transform` "log1p", `max`, `ink_from`}}. `countries`: only countries with at least one storm; lon, lat = a point inside the country for turning the globe; radius_deg = half the larger side of its bounding box (main landmass). `name_vi` from Natural Earth `NAME_VI`, else `NAME_EN`. Storm objects, sorted by SID: `id` (SID), `name` (IBTrACS NAME, title case; "Unnamed" for UNNAMED/NOT_NAMED), `season`, `basin` (IBTrACS BASIN of the first fix; MM folded into the basin of the next fix), `vmax_ms` (lifetime max of the wind defined below, integer m/s), `class` (TS, C1 to C5 from knots as in the Vietnam explorer), `t0` (ISO time of the first fix, `YYYY-MM-DDTHH:MMZ`), `near` (sorted indices into `countries` whose land lies within 200 km, haversine, of any fix), and when a wind field exists `wind_bbox` [west, south, east, north] (cell edges) and `wind_max_ms`.
  - Selection: IBTrACS v04r01 main tracks (`TRACK_TYPE` main), seasons 1981 to 2024, all basins, lifetime max wind at least 34 kt. Wind as in the Vietnam explorer: `USA_WIND` if the storm has any, else `WMO_WIND`, knots x 0.5144.
  - `tracks/<season>.json`: `{SID: [[hours since t0, lon, lat, wind m/s integer or null, (1 if the fix follows a gap of more than 6 hours)], ...]}`, every main-track fix in time order. Longitude is unwrapped along the track (continuous, may pass beyond 180 or -180), so lines across the date line stay straight.
  - `lite.json`: `{"q": 10, "tracks": [[x0, y0, dx1, dy1, ...], ...]}` in the order of `index.storms`, longitudes and latitudes in tenths of a degree (integers, unwrapped longitude), Douglas-Peucker simplified at 0.25 degree, deltas after the first point.
  - `wind/<SID>.png`: 8-bit grey, value = peak wind in m/s rounded down, 0 below 10 m/s, row 0 = north, cell size `wind_res` (0.2 degree), per-cell peak over the storm's life with the same method as the Vietnam explorer (project hourly points, Rmax c2r, Holland B = 1.5, 500 km cutoff), not cropped; `wind_bbox` in the same unwrapped longitude as the track. Storms the project does not cover get no `wind_bbox`.
  - `lights.png`: global night-time light, grey 8-bit, equirectangular, `cell_deg` 0.2, bounds [-180, -60, 180, 75], row 0 = north, value = round(255 x log1p(radiance) / max), 0 for sea and dark land; `ink_from` as in `lights_vn.json`. The script leaves out values below 24 when drawing.
