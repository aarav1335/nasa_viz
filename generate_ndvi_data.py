"""
generate_ndvi_data.py
Generate NDVI trend data for "Where is the World Getting Greener — or Browner?"
Fetches MODIS NDVI imagery for July of each year (2001–2024), computes per-pixel
linear trends, and exports a compact JSON file for the D3 visualization.

Usage:  python generate_ndvi_data.py
Output: ndvi_trend_data.json
"""

import json
import sys
import numpy as np
from io import BytesIO
from PIL import Image
from owslib.wms import WebMapService

# ── Config ──────────────────────────────────────────────────────────────────
WMS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?"
LAYER = "MODIS_Terra_L3_NDVI_16Day"
GRID_RES = 2          # degrees per grid cell (2 = ~16k land points)
OUTPUT_FILE = "ndvi_trend_data.json"
MONTH_DAY = "-07-01"  # July (peak Northern Hemisphere growing season)
START_YEAR = 2001
END_YEAR = 2024

# ── NDVI Colormap (sampled from GIBS legend) ────────────────────────────────
_NDVI_COLORMAP = [
    (0.00, 239, 231, 232), (0.05, 233, 224, 219), (0.10, 227, 216, 206),
    (0.15, 220, 208, 192), (0.20, 212, 197, 177), (0.25, 201, 182, 158),
    (0.30, 186, 162, 137), (0.35, 176, 142, 116), (0.40, 165, 118,  89),
    (0.42, 160, 100,  76), (0.44, 158, 108,  65), (0.46, 160, 140,  50),
    (0.48, 162, 175,  46), (0.50, 164, 198,  61), (0.52, 155, 192,  51),
    (0.55, 143, 186,  38), (0.58, 129, 179,  24), (0.60, 118, 172,  12),
    (0.63, 108, 166,   2), (0.66,  95, 160,   0), (0.69,  80, 151,   0),
    (0.72,  68, 143,   0), (0.75,  56, 135,   0), (0.78,  45, 128,   1),
    (0.81,  34, 120,   1), (0.84,  24, 112,   1), (0.87,  16, 104,   1),
    (0.90,   8,  96,   1), (0.93,   3,  86,   1), (0.96,   0,  70,   1),
    (1.00,   0,  36,   1),
]
_cmap_rgb = np.array([[r, g, b] for _, r, g, b in _NDVI_COLORMAP], dtype=np.float32)
_cmap_ndvi = np.array([ndvi for ndvi, _, _, _ in _NDVI_COLORMAP], dtype=np.float32)


def rgb_to_ndvi_array(img_array):
    """Convert RGB NDVI image (H×W×3) to 2D NDVI array via nearest-color lookup."""
    h, w, _ = img_array.shape
    pixels = img_array.reshape(-1, 3).astype(np.float32)
    
    is_black = (pixels[:, 0] == 0) & (pixels[:, 1] == 0) & (pixels[:, 2] == 0)
    is_white = (pixels[:, 0] > 220) & (pixels[:, 1] > 220) & (pixels[:, 2] > 220)
    
    ndvi_flat = np.full(pixels.shape[0], np.nan, dtype=np.float32)
    mask = ~is_black & ~is_white
    
    if np.any(mask):
        rgb_vals = pixels[mask]
        dists = np.sqrt(np.sum(
            (rgb_vals[:, np.newaxis, :] - _cmap_rgb[np.newaxis, :, :]) ** 2, axis=2
        ))
        best_idx = np.argmin(dists, axis=1)
        ndvi_flat[mask] = _cmap_ndvi[best_idx]
    
    ndvi_flat[is_white] = -0.1
    return ndvi_flat.reshape(h, w)


def compute_trend(years, values):
    """Simple linear regression slope. Returns (slope_per_year, r_squared)."""
    mask = ~np.isnan(values)
    if np.sum(mask) < 5:
        return np.nan, np.nan
    
    x = years[mask].astype(np.float64)
    y = values[mask].astype(np.float64)
    
    # Center years to reduce numerical issues
    x_centered = x - np.mean(x)
    y_mean = np.mean(y)
    
    slope = np.sum(x_centered * (y - y_mean)) / np.sum(x_centered ** 2)
    
    # R-squared
    y_pred = y_mean + slope * x_centered
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - y_mean) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    
    return float(slope), float(r2)


def main():
    print("=" * 60)
    print("  NDVI Trend Data Generator")
    print("  'Where is the World Getting Greener — or Browner?'")
    print("=" * 60)
    
    # ── Connect to GIBS ──
    print("\n[1/4] Connecting to NASA GIBS WMS...")
    try:
        wms = WebMapService(WMS_URL, version="1.3.0")
        print(f"  Connected: {wms.identification.title}")
    except Exception as e:
        print(f"  ERROR connecting to GIBS: {e}")
        print("  Falling back to version 1.1.1...")
        wms = WebMapService(WMS_URL, version="1.1.1")
    
    years = np.arange(START_YEAR, END_YEAR + 1)
    n_years = len(years)
    
    # Image size: width = 360/GRID_RES, height = 180/GRID_RES
    img_w = 360 // GRID_RES   # e.g., 180 for 2° res
    img_h = 180 // GRID_RES   # e.g., 90 for 2° res
    
    print(f"\n[2/4] Fetching {n_years} global NDVI images "
          f"({START_YEAR}–{END_YEAR}, July, {img_w}×{img_h})...")
    
    ndvi_cube = []  # list of 2D arrays, one per year
    successful_years = []
    
    for i, year in enumerate(years):
        date_str = f"{year}{MONTH_DAY}"
        try:
            img = wms.getmap(
                layers=[LAYER],
                srs="epsg:4326",
                bbox=(-180, -90, 180, 90),
                size=(img_w, img_h),
                time=date_str,
                format="image/png",
                transparent=True,
            )
            pil_img = Image.open(BytesIO(img.read())).convert("RGB")
            arr = np.array(pil_img)
            ndvi_arr = rgb_to_ndvi_array(arr)
            ndvi_cube.append(ndvi_arr)
            successful_years.append(year)
            
            pct_land = np.mean(~np.isnan(ndvi_arr)) * 100
            mean_ndvi = np.nanmean(ndvi_arr)
            print(f"  [{i+1:2d}/{n_years}] {year}: "
                  f"land={pct_land:.1f}%  mean NDVI={mean_ndvi:.3f}")
        except Exception as e:
            print(f"  [{i+1:2d}/{n_years}] {year}: FAILED — {e}")
            ndvi_cube.append(None)
    
    # Only use years that succeeded
    valid_indices = [i for i, arr in enumerate(ndvi_cube) if arr is not None]
    valid_years = years[valid_indices].astype(float)
    
    if len(valid_years) < 5:
        print("\n  ERROR: Not enough valid years for trend analysis. Exiting.")
        sys.exit(1)
    
    print(f"\n  {len(valid_years)}/{n_years} years fetched successfully")
    
    # ── Build grid coordinates ──
    print(f"\n[3/4] Computing per-pixel NDVI trends ({img_w}×{img_h} grid)...")
    
    # Longitude centers: -180 + GRID_RES/2, -180 + 3*GRID_RES/2, ...
    lons = np.linspace(-180 + GRID_RES/2, 180 - GRID_RES/2, img_w)
    lats = np.linspace(90 - GRID_RES/2, -90 + GRID_RES/2, img_h)
    
    # Stack all years into a 3D array
    cube = np.stack([ndvi_cube[i] for i in valid_indices], axis=0)  # [year, lat, lon]
    
    # Compute trend for each pixel
    trends = np.full((img_h, img_w), np.nan, dtype=np.float32)
    first_ndvi = np.full((img_h, img_w), np.nan, dtype=np.float32)
    last_ndvi = np.full((img_h, img_w), np.nan, dtype=np.float32)
    r2_vals = np.full((img_h, img_w), np.nan, dtype=np.float32)
    
    n_land = 0
    for row in range(img_h):
        for col in range(img_w):
            ts = cube[:, row, col]  # time series for this pixel
            if np.all(np.isnan(ts)):
                continue
            slope, r2 = compute_trend(valid_years, ts)
            if not np.isnan(slope):
                n_land += 1
                trends[row, col] = slope
                first_ndvi[row, col] = ts[0]
                last_ndvi[row, col] = ts[-1]
                r2_vals[row, col] = r2
    
    print(f"  {n_land} land pixels with valid trends")
    
    # ── Region definitions ──
    regions = [
        {"id": "global",  "label": "Global",       "bbox": [-180, -60, 180, 80],  "note": "broad overview of global NDVI trends"},
        {"id": "india",   "label": "India",         "bbox": [66, 5, 98, 36],       "note": "significant greening from agriculture & afforestation"},
        {"id": "amazon",  "label": "Amazon Basin",  "bbox": [-80, -20, -45, 8],    "note": "deforestation and drought impacts on rainforest"},
        {"id": "sahel",   "label": "Sahel",         "bbox": [-18, 8, 38, 22],      "note": "semi-arid region with mixed recovery & degradation"},
        {"id": "china",   "label": "Eastern China", "bbox": [100, 18, 125, 45],    "note": "massive afforestation programs and agricultural expansion"},
        {"id": "california", "label": "California", "bbox": [-125, 31, -113, 43],  "note": "drought impacts and wildfire recovery patterns"},
        {"id": "europe",  "label": "Europe",        "bbox": [-10, 35, 40, 62],     "note": "mature forests with subtle long-term changes"},
    ]
    
    # ── Export ──
    print(f"\n[4/4] Exporting to {OUTPUT_FILE}...")
    
    output = {
        "metadata": {
            "title": "MODIS NDVI Trend Analysis",
            "month": 7,
            "monthName": "July",
            "years": [int(y) for y in valid_years],
            "resolutionDeg": GRID_RES,
            "layer": LAYER,
            "nLandPixels": n_land,
            "generatedAt": str(np.datetime64('now')),
        },
        "grid": {
            "lons": [round(float(x), 2) for x in lons],
            "lats": [round(float(x), 2) for x in lats],
            "trends": [[float(t) if not np.isnan(t) else None for t in row] for row in trends],
            "firstYearNdvi": [[float(v) if not np.isnan(v) else None for v in row] for row in first_ndvi],
            "lastYearNdvi": [[float(v) if not np.isnan(v) else None for v in row] for row in last_ndvi],
            "rSquared": [[float(r) if not np.isnan(r) else None for r in row] for row in r2_vals],
        },
        "regions": regions,
    }
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)
    
    # ── Summary stats ──
    flat_trends = trends[~np.isnan(trends)]
    greening = np.sum(flat_trends > 0.001)
    browning = np.sum(flat_trends < -0.001)
    stable = n_land - greening - browning
    
    print(f"\n{'='*60}")
    print(f"  Done! {OUTPUT_FILE} written ({n_land} land pixels)")
    print(f"  Greening (trend > +0.001/yr):  {greening:5d} pixels ({greening/n_land*100:.1f}%)")
    print(f"  Browning (trend < -0.001/yr):  {browning:5d} pixels ({browning/n_land*100:.1f}%)")
    print(f"  Stable:                         {stable:5d} pixels ({stable/n_land*100:.1f}%)")
    print(f"  Mean trend: {np.mean(flat_trends):+.4f} NDVI/year")
    print(f"  Median trend: {np.median(flat_trends):+.4f} NDVI/year")
    print(f"  Max greening: {np.max(flat_trends):+.4f} NDVI/year")
    print(f"  Max browning: {np.min(flat_trends):+.4f} NDVI/year")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
