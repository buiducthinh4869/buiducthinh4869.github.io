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
- Content column max 40rem. Must work at 375px wide without horizontal scroll.

## Adding a blog post

1. Put `blog/<name>_en.md` and/or `blog/<name>_vi.md` in place (first line `# Title`; it is dropped on render because the page shows the title).
2. Copy `writing/how-i-found-my-way-into-research/index.html` to `writing/<new-slug>/index.html`; change titles (EN and VI, including `data-title-*`), date, and `data-src-en` / `data-src-vi`. Leave out a `data-src-*` if that language does not exist; the page then shows the other language with a note.
3. Add a row to the list in `writing.html` (newest first, grouped by year) and replace the row on the home page so it shows the newest post. Tags EN/VI show which languages exist.

## Content facts (do not change without Thinh's confirmation)

- Toan Phan: Federal Reserve Board, https://toanphan.org/. Hien Pham: Southwestern University of Finance and Economics, https://sites.google.com/view/hien-pham/home.
- Degree: Bachelor of Economics, International Business Economics (Kinh tế đối ngoại), Foreign Trade University, 2026, High Distinction.
- Work-in-progress projects with Toan Phan have no settled titles; list them only by the descriptive topic already on the Research page.
- CV PDF lives on Google Drive (file id `1wXSslNwDubA9oQHsioAXGHGH6AoVvzGx`); the CV page embeds and links it, so updating the Drive file updates the site.

## Comments

Giscus on post pages. `REPO_ID_PLACEHOLDER` and `CATEGORY_ID_PLACEHOLDER` in each post page must be replaced with values from https://giscus.app after GitHub Discussions is enabled. Until then the page shows a "comments soon" note.
