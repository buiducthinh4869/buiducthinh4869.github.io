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
- Map behaviour: on selection the field fades in, the track draws in and the view eases to the storm's wind box (no easing on touch screens, where a zoomed map would trap page scrolling; no motion at all under reduced motion). Play steps the eye through the storm's public IBTrACS fixes inside the window (one fix about every 250 ms) with the time in UTC+7 and the IBTrACS wind; under reduced motion each press steps one 6-hourly fix. From 1000px the finder, info line and filter sit left of the map and the timeline spans the container.
- Code: `assets/storm_map.js` (D3 7.9.0 from cdnjs, loaded on this page only; keep it under 35 KB unminified) and the "Storm explorer" block in `assets/style.css`. Static labels use `data-l`; script-generated text comes from the `TXT` table and re-renders on `langchange`.
- Data in `assets/data`: `storms_vn.json`, `land_outline.json`, `lights_vn.png`, `lights_vn.json`, `wind/<id>.png` (one per storm, loaded on selection). The track of each storm is in `storms_vn.json` (`runs`: IBTrACS fixes inside the window with their wind, plus interpolated window-edge crossings). Fallback picture `assets/storm_map_static.png` (Damrey 2017; shown in `<noscript>` and when D3 or the data fail).
- Rebuild, in this order: `python -E -P _materials/storm_map/build_storm_map.py` (IBTrACS selection, lights, land; about 1 minute), then `python -E -P _materials/storm_map/build_wind_fields.py` (wind fields, static picture; about 1 minute). Each asserts its checks and ends with DONE. `_materials/` is not published.
- Selection and winds in the info line and timeline (public IBTrACS v04r01, main tracks): at least one fix within 200 km (haversine) of Natural Earth's Vietnam polygon. Wind is `USA_WIND` (1-minute) if the storm has any, else `WMO_WIND` (3 storms, JMA 10-minute), in m/s as knots x 0.5144; classes from knots (TS 34-63, cat 1 64-82, cat 2 83-95, cat 3 96-112, cat 4 113-136, cat 5 137+). The timeline bands are drawn at these knot limits, so a dot's band always equals its class; the toggle tooltips give the rounded m/s ranges.
- Wind fields come from the research project Cyclone-economic-growth, **with Toan Phan's approval of 2026-11-16, which covers wind-field images of individual storms only**. Method: the project's hourly points (`data/master/tracks_d1_hourly.csv`, `vmax_hybrid`), the main Rmax version c2r (`result/enso/d1/rmax_smoothing/series/rmax_c2r.parquet`, linear in time between synoptic fixes; seasons 2023-24 use its fallback formula, which is `rmax_km` of the hourly file), Holland (1980) with B = 1.5 and a 500 km cutoff (`pipeline.holland_wind`, imported), per-cell peak over the storm's life on the 0.1 degree grid, cropped to 100-118 E, 6-25 N. PNG value = m/s rounded down (so value >= 17 is exactly wind >= 17), 0 below 10 m/s, row 0 = north; `wind_bbox` = [west, south, east, north]. The build reproduces the project's Damrey 2017 figure numbers (43.95 m/s at the landfall cell, 798 / 204 / 0 Vietnam cells at 17 / 33 / 50 m/s) before using c2r (781 / 200 / 0).
- **Nothing else from that project may be published without co-author approval**: no project track points or `vmax_hybrid` winds (tracks, fixes and every wind number shown are public IBTrACS), no exposure numbers (wind x light, wind x land or area, light share), no ENSO results, no panels or estimates. The project folder and its cold store are read only; the build writes nothing there (bytecode writing is off when it imports the project's functions).
- No published file may carry a country name, code or border: land is one dissolved, unlabelled shape, and the Vietnam polygon and raster exist only inside the build scripts.
