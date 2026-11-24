"""Yearly night-light layers for the storm atlas (one 0.2-degree grey PNG per year).

Same pipeline as the published 2025 layer (assets/data/globe/lights.png), with the year as a parameter:

  1. Read the year's NPP-VIIRS-like Version 2 GeoTIFF (Chen et al., doi:10.7910/DVN/YGIVCD) straight from its zip
     (/vsizip/), strip by strip (2.4 degrees of latitude = 12 output rows), set nodata and non-finite values to NaN,
     negative values to 0, and average onto the 0.2-degree grid (rasterio reproject, Resampling.average) over
     the bounds -180, -60, 180, 75 (1800 x 675, row 0 = north).
     Strips are used instead of one big out_shape read so that only one 2.4-degree strip (about 170 MB) is in
     memory, and because the acceptance test is an exact reproduction of the 2025 lights.png, which was built
     with exactly these strips and this reprojection. The raster's own height and transform are used: older years
     have fewer rows than 2025 (check_grid accepts a gap of less than one output row at the edge of the output
     window and records the real grid in the stats); output cells without any source data stay NaN (drawn as 0).
  2. Mask: rasterize the geometries of the Natural Earth 10m admin-0 file at 0.2 degree, all_touched. Only the
     mask is used, the polygons are neither published nor kept; the output is a grey picture of light on land.
  3. Render with a FIXED scale: L = log1p(radiance on land), value = round(255 * clip(L / LMAX, 0, 1)).
     LMAX is not recomputed per year, so the years can be compared. The year's own 99.5th percentile is
     written to the stats for information.

Subcommands
  year          one year: zip -> lights_<Y>.png + stats_<Y>.json
  merge         lights_<Y>.png + stats_<Y>.json from a folder -> assets/ntl/ntl_<Y>.png + assets/ntl/index.json
  render-check  local test: cached 2025 aggregate + mask + LMAX against the published lights.png

Python 3.10+, numpy, pillow; the year and render-check commands also need rasterio and geopandas (pyogrio).
"""
import argparse
import json
import math
import re
import shutil
import sys
import time
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------------------------- constants
LB = (-180.0, -60.0, 180.0, 75.0)      # west, south, east, north of the output grid
LCELL = 0.2                            # output cell, degrees
NX, NY = 1800, 675                     # (E - W) / LCELL, (N - S) / LCELL
STRIP_DEG = 2.4                        # input strip height, degrees (12 output rows)
# 99.5th percentile of log1p(radiance) over the lit land cells of the 2025 layer (cached aggregate of the
# 2025 file x Natural Earth 10m land mask, all_touched). index.json of the globe shows it rounded: 2.9319.
LMAX = 2.931900061931104
INK_FROM = 0.483                       # 95th percentile of L / LMAX over the lit cells of 2025 (as in the globe index)
# Grid of the 2025 file. Reference values of check_grid: width, pixel size, x origin must match in every year;
# the height and the top (rows, latitude range) differ between years and are not asserted (GRID_H is information).
GRID_W, GRID_H = 80150, 38663
GRID_TRANSFORM = (0.00449157642059761, 0.0, -180.0, 0.0, -0.00449157642059761, 83.6578941180654)
GRID_EPSG = 4326
# Tolerances of check_grid. Older files store the pixel size rounded to 10 decimals (2005: 0.0044915764 against
# 0.00449157642059761, 2e-11 degree). PX_TOL = 1e-9 degree per pixel is 8e-5 degree (about 0.02 pixel) of
# cumulative drift over the full 80150-pixel width, irrelevant for a 0.2-degree average.
PX_TOL = 1e-9
# x origin and east edge (x origin + width * pixel) may be off the exact -180 / +180 by up to half a pixel
# (about 0.00225 degree): the 2005 file starts at -179.999925055 (0.017 pixel). A sub-pixel shift does not matter for
# an area-weighted mean on a 0.2-degree grid (44 pixels per cell); the check only has to catch another frame,
# such as longitudes 0..360 (x origin 0).
X_TOL = 0.5 * GRID_TRANSFORM[0]
ROT_TOL = 1e-12                        # rotation terms of the transform
PRODUCT = "NPP-VIIRS-like Version 2 (Chen et al.)"
DOI = "10.7910/DVN/YGIVCD"
YEAR_RE = re.compile(r"^lights_(\d{4})\.png$")


# ---------------------------------------------------------------------------------------------- helpers
def find_inner(zip_path):
    """The single *.tif inside the zip (error if none or several)."""
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
    tifs = [n for n in names if not n.endswith("/") and n.lower().endswith(".tif")]
    if len(tifs) != 1:
        sys.exit(f"error: expected exactly one .tif in {zip_path}, found {len(tifs)}: {tifs}; all entries: {names}")
    return tifs[0]


def vsi_path(zip_path, inner):
    return "/vsizip/" + str(Path(zip_path).resolve()).replace("\\", "/") + "/" + inner


def peak_rss_mb():
    """Peak resident memory of this process in MB (Linux only, else None)."""
    if not sys.platform.startswith("linux"):
        return None
    import resource
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0, 1)


def check_grid(s):
    """Check the raster has what the pipeline needs; return the ACTUAL grid for the stats.

    Required: width of the 2025 file or one column less, one float32 band, EPSG:4326, the pixel size of the 2025
    file, no rotation, x origin -180 (within half a pixel) and east edge +180 (within half a pixel, or one pixel short). Not required: the height or the latitude range of the 2025 file (older years have fewer rows).
    The output window LB must be covered except for less than one output row (LCELL); a smaller gap is accepted
    with a WARNING, and output rows without any source data stay NaN (drawn as 0).
    Every violation is collected and reported in one error; one INFO line shows the grid of every year.
    Tolerances: pixel size PX_TOL, x origin X_TOL, rotation ROT_TOL."""
    tr = tuple(s.transform)[:6]
    ta, tb, tc, td, te, tf = (float(v) for v in tr)
    px = GRID_TRANSFORM[0]
    epsg = s.crs.to_epsg() if s.crs else None
    top = tf
    bottom = top - s.height * ta
    print(f"INFO grid: width {s.width}, height {s.height}, pixel {ta!r} x {-te!r}, x origin {tc!r}, "
          f"top {top!r}, bottom {bottom!r}, nodata {s.nodata!r}", flush=True)
    bad = []
    # 20 of the 34 files (1992-2000, 2012-2022) are one column narrower (80149) and end at 179.99543: the last
    # 0.2-degree column then averages 44 of its 45 source columns. Accepted with a WARNING; nothing narrower.
    if s.width not in (GRID_W, GRID_W - 1):
        bad.append(f"width {s.width}, expected {GRID_W} or {GRID_W - 1}")
    if not (s.count == 1 and s.dtypes[0] == "float32"):
        bad.append(f"bands {s.count}, dtype {s.dtypes}, expected 1 band float32")
    if epsg != GRID_EPSG:
        bad.append(f"crs {s.crs}, expected EPSG:{GRID_EPSG}")
    if not (abs(ta - px) <= PX_TOL and abs(-te - px) <= PX_TOL):
        bad.append(f"pixel size {ta} x {-te}, expected {px} (tolerance {PX_TOL})")
    if not (abs(tb) <= ROT_TOL and abs(td) <= ROT_TOL):
        bad.append(f"rotation terms {tb}, {td}, expected 0 (tolerance {ROT_TOL})")
    if not abs(tc - LB[0]) <= X_TOL:
        bad.append(f"x origin {tc}, expected {LB[0]} (tolerance {X_TOL})")
    east = tc + s.width * ta
    if not (LB[2] - ta - X_TOL <= east <= LB[2] + X_TOL):
        bad.append(f"east edge {east}, expected {LB[2]} (at most one pixel short, tolerance {X_TOL})")
    elif east < LB[2] - X_TOL:
        print(f"WARNING: raster ends at longitude {east!r}, {LB[2] - east:.6f} deg (one pixel) short of {LB[2]}; "
              f"the easternmost output column averages the source pixels it has", flush=True)
    if not (top >= LB[3] - LCELL and bottom <= LB[1] + LCELL):
        bad.append(f"rows {s.height}, top {top}, bottom {bottom}: the output window {LB[1]}..{LB[3]} is missing "
                   f"more than one output row ({LCELL} degree)")
    if bad:
        raise AssertionError(f"grid check failed, {len(bad)} problem(s): " + "; ".join(bad))
    if top < LB[3] or bottom > LB[1]:
        print(f"WARNING: raster covers latitude {bottom:.6f}..{top:.6f}, output window {LB[1]}..{LB[3]}: "
              f"north gap {max(0.0, LB[3] - top):.6f} deg, south gap {max(0.0, bottom - LB[1]):.6f} deg "
              f"(cells without any source data stay NaN)", flush=True)
    shift = round(((GRID_TRANSFORM[5] - top) / ta) % 1.0, 4) % 1.0
    return {"width": s.width, "height": s.height, "transform": [float(v) for v in tr], "epsg": epsg,
            "dtype": s.dtypes[0], "nodata": None if s.nodata is None else float(s.nodata),
            "top": top, "bottom": bottom,
            "uncovered_north_deg": round(max(0.0, LB[3] - top), 9),
            "uncovered_south_deg": round(max(0.0, bottom - LB[1]), 9),
            "y_shift_px": shift, "x_shift_px": round((tc - LB[0]) / ta, 4)}


def aggregate(s, max_strips=None):
    """Mean radiance per 0.2-degree cell over LB, strip by strip (as global_lights() of the 2025 build).

    Returns (array float32 ny x nx, rows done). Rows not reached with max_strips stay NaN."""
    import numpy as np
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject
    from rasterio.windows import Window, from_bounds
    W, S, E, N = LB
    cell = LCELL
    nx, ny = round((E - W) / cell), round((N - S) / cell)
    assert (nx, ny) == (NX, NY)
    out = np.full((ny, nx), np.nan, dtype="float32")
    step = round(STRIP_DEG / cell)
    done = 0
    for k, r0 in enumerate(range(0, ny, step)):
        if max_strips is not None and k >= max_strips:
            break
        t0 = time.time()
        r1 = min(ny, r0 + step)
        top, bot = N - r0 * cell, N - r1 * cell
        fb_ = from_bounds(W, bot - 0.02, E, top + 0.02, s.transform)
        ra, rb = max(0, math.floor(fb_.row_off)), min(s.height, math.ceil(fb_.row_off + fb_.height))
        if rb <= ra:   # strip entirely outside the raster: its output rows stay NaN
            done = r1
            print(f"  strip {k + 1}: rows {r0}-{r1} of {ny}, not covered by the raster, left NaN", flush=True)
            continue
        w = Window(0, ra, s.width, rb - ra)
        a = s.read(1, window=w, boundless=False)
        a[(a < -1e30) | ~np.isfinite(a)] = np.nan
        a[a < 0] = 0.0
        dst = np.full((r1 - r0, nx), np.nan, dtype="float32")
        reproject(a, dst, src_transform=s.window_transform(w), src_crs="EPSG:4326",
                  dst_transform=from_origin(W, top, cell, cell), dst_crs="EPSG:4326",
                  resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
        out[r0:r1] = dst
        done = r1
        print(f"  strip {k + 1}: rows {r0}-{r1} of {ny}, {time.time() - t0:.1f} s", flush=True)
    return out, done


def land_mask(ne_path):
    """Boolean ny x nx mask: every geometry of the Natural Earth 10m admin-0 file, rasterized all_touched."""
    import geopandas as gpd
    from rasterio import features
    from rasterio.transform import from_origin
    W, S, E, N = LB
    world = gpd.read_file(str(ne_path), engine="pyogrio", columns=[])
    assert len(world) > 200, len(world)
    geoms = [g for g in world.geometry if g is not None and not g.is_empty]
    mask = features.rasterize(((g, 1) for g in geoms), out_shape=(NY, NX),
                              transform=from_origin(W, N, LCELL, LCELL), all_touched=True, dtype="uint8")
    return mask.astype(bool)


def render(agg, mask, lmax=LMAX):
    """Fixed-scale 8-bit picture. Returns (li8 uint8, L float64)."""
    import numpy as np
    agg = agg.astype("float64")
    assert agg.shape == mask.shape == (NY, NX)
    L = np.log1p(np.where(np.isfinite(agg) & mask, agg, 0.0))
    tt = np.clip(L / lmax, 0, 1)
    return np.rint(255 * tt).astype(np.uint8), L


def own_p995(L):
    import numpy as np
    pos = L > 0
    return float(np.percentile(L[pos], 99.5)) if pos.any() else None


# ---------------------------------------------------------------------------------------------- year
def cmd_year(a):
    import numpy as np
    import rasterio
    from PIL import Image
    t_start = time.time()
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    partial = a.max_strips is not None
    if not partial and not a.ne_zip:
        sys.exit("error: --ne-zip is required unless --max-strips is given")
    inner = find_inner(a.zip)
    src = vsi_path(a.zip, inner)
    print(f"year {a.year}: {src}", flush=True)
    with rasterio.open(src) as s:
        grid = check_grid(s)
        t_agg = time.time()
        agg, done = aggregate(s, a.max_strips)
    seconds_aggregate = round(time.time() - t_agg, 1)
    if a.dump_npy:
        np.save(a.dump_npy, agg[:done])
    stats = {"year": a.year, "zip": Path(a.zip).name, "inner": inner, "grid": grid, "lmax_used": LMAX,
             "partial": partial}
    if partial:
        stats["strips"] = a.max_strips
        stats["rows_done"] = done
        print(f"partial run, {done} rows aggregated; no png")
    else:
        mask = land_mask(a.ne_zip)
        li8, L = render(agg, mask)
        png = out_dir / f"lights_{a.year}.png"
        Image.fromarray(li8).save(png, optimize=True)
        chk = Image.open(png)
        assert chk.size == (NX, NY) and chk.mode == "L", (chk.size, chk.mode)
        stats.update({"n_lit_cells": int((li8 > 0).sum()), "n_cells_ge24": int((li8 >= 24).sum()),
                      "sum_li8": int(li8.sum(dtype=np.int64)), "own_p995": own_p995(L),
                      "png_bytes": png.stat().st_size})
    stats["peak_rss_mb"] = peak_rss_mb()
    stats["seconds_aggregate"] = seconds_aggregate
    stats["seconds_total"] = round(time.time() - t_start, 1)
    with open(out_dir / f"stats_{a.year}.json", "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(stats, indent=1) + "\n")
    print(json.dumps(stats, indent=1))


# ---------------------------------------------------------------------------------------------- merge
def dumps_index(idx):
    """One key per line, each value on one line."""
    return "{\n" + ",\n".join(f"  {json.dumps(k)}: {json.dumps(v)}" for k, v in idx.items()) + "\n}\n"


def cmd_merge(a):
    from PIL import Image
    src, dst = Path(a.input), Path(a.assets)
    dst.mkdir(parents=True, exist_ok=True)
    idx_path = dst / "index.json"
    old = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {}
    if old:
        om = old.get("scale", {}).get("max")
        assert om is not None and abs(om - LMAX) < 1e-12, f"existing index.json has scale max {om}, script has {LMAX}"
    years = set(old.get("years", []))
    source = dict(old.get("source", {}))
    new = []
    for p in sorted(src.glob("lights_*.png")):
        m = YEAR_RE.match(p.name)
        if not m:
            sys.exit(f"error: unexpected file name {p.name}")
        y = int(m.group(1))
        sp = src / f"stats_{y}.json"
        if not sp.exists():
            sys.exit(f"error: {sp.name} missing next to {p.name}")
        st = json.loads(sp.read_text(encoding="utf-8"))
        assert st["year"] == y and st["partial"] is False, (p.name, st.get("partial"))
        assert abs(st["lmax_used"] - LMAX) < 1e-12, (p.name, st["lmax_used"])
        im = Image.open(p)
        assert im.size == (NX, NY) and im.mode == "L", (p.name, im.size, im.mode)
        shutil.copyfile(p, dst / f"ntl_{y}.png")
        years.add(y)
        source[str(y)] = st["zip"]
        new.append(y)
    if not new:
        sys.exit(f"error: no lights_<year>.png in {src}")
    ys = sorted(years)
    for y in ys:
        assert (dst / f"ntl_{y}.png").exists(), f"index lists {y} but ntl_{y}.png is missing"
    default = a.default_year if a.default_year in ys else ys[-1]
    if default != a.default_year:
        print(f"note: default year {a.default_year} is not among the years, using {default}")
    idx = {"years": ys, "earliest": ys[0], "latest": ys[-1], "default": default, "file": "ntl_{year}.png",
           "bounds": [int(v) for v in LB], "cell_deg": LCELL, "width": NX, "height": NY, "product": PRODUCT, "doi": DOI,
           "scale": {"transform": "log1p", "max": LMAX, "ink_from": INK_FROM},
           "source": {k: source[k] for k in sorted(source)}}
    with open(idx_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(dumps_index(idx))
    total = sum(p.stat().st_size for p in dst.iterdir() if p.is_file())
    print(f"merged {sorted(new)}; index years {ys[0]}..{ys[-1]} ({len(ys)}); {total:,} bytes in {dst}")


# ---------------------------------------------------------------------------------------------- render-check
def cmd_render_check(a):
    import numpy as np
    from PIL import Image
    agg = np.load(a.npy)
    assert agg.shape == (NY, NX) and agg.dtype == np.float32, (agg.shape, agg.dtype)
    li8, L = render(agg, land_mask(a.ne_zip))
    ref = np.asarray(Image.open(a.ref))
    assert ref.shape == li8.shape and ref.dtype == np.uint8, (ref.shape, ref.dtype)
    diff = np.abs(li8.astype(np.int16) - ref.astype(np.int16))
    print(f"own 99.5th percentile {own_p995(L)!r}, LMAX {LMAX!r}")
    print(f"max abs diff {int(diff.max())}, differing cells {int((diff > 0).sum())} of {diff.size}")
    print(f"lit cells new {int((li8 > 0).sum())}, ref {int((ref > 0).sum())}")


# ---------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    y = sub.add_parser("year", help="one year: zip -> lights_<Y>.png + stats_<Y>.json")
    y.add_argument("--year", type=int, required=True)
    y.add_argument("--zip", required=True)
    y.add_argument("--out", required=True)
    y.add_argument("--ne-zip", help="Natural Earth 10m admin_0_countries zip (or .shp); not downloaded here")
    y.add_argument("--max-strips", type=int, help="only the first N strips (quick test; partial stats, no png)")
    y.add_argument("--dump-npy", help=argparse.SUPPRESS)
    y.set_defaults(fn=cmd_year)
    m = sub.add_parser("merge", help="lights_<Y>.png + stats_<Y>.json -> assets/ntl")
    m.add_argument("--in", dest="input", required=True)
    m.add_argument("--assets", required=True)
    m.add_argument("--default-year", type=int, default=2025)
    m.set_defaults(fn=cmd_merge)
    r = sub.add_parser("render-check", help="cached 2025 aggregate + mask + LMAX vs the published lights.png")
    r.add_argument("--npy", required=True)
    r.add_argument("--ne-zip", required=True)
    r.add_argument("--ref", required=True)
    r.set_defaults(fn=cmd_render_check)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
