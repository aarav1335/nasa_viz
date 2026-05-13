// ndvi-trend.js
// "Where is the World Getting Greener — or Browner?"
// DSC 106 Project 3 · Interactive NDVI Trend Visualization

/* ── Global state ─────────────────────────────────────────────────────── */
let ndviData = null;          // raw JSON
let flatPoints = [];          // [{lon, lat, trend, firstNdvi, lastNdvi, r2, row, col}]
let selectedPoint = null;     // currently clicked point
let currentRegion = "global"; // active region id
let showSignificantOnly = false;
let r2Threshold = 0.30;       // R² threshold for significance filter
let worldLand = null;         // TopoJSON-converted GeoJSON for world land masses

/* ── Region definitions (with real-world narratives) ─────────────────── */
const ALL_REGIONS = [
  {
    id: "global",
    label: "Global",
    bbox: [-180, -60, 180, 80],
    story: "The big picture",
    description: "Across all vegetated land, MODIS shows a net greening trend over 24 years. But zoom in — the story varies dramatically by region.",
    source: "MODIS Terra NDVI, July 2001–2024 · 3,666 land pixels"
  },
  {
    id: "amazon",
    label: "Amazon Rainforest",
    bbox: [-80, -20, -45, 8],
    story: "Deforestation crisis",
    description: "The Amazon has lost nearly 20% of its original forest cover, driven by cattle ranching, soy farming, and logging. MODIS NDVI confirms browning along Brazil's 'arc of deforestation' — but some protected areas and indigenous territories show surprising stability.",
    source: "Data: MODIS Terra NDVI · See also: INPE PRODES deforestation monitoring"
  },
  {
    id: "china",
    label: "Eastern China",
    bbox: [100, 18, 125, 42],
    story: "The world's largest reforestation",
    description: "China's Grain for Green program (launched 1999) is the largest afforestation effort in history — over 30 million hectares of cropland converted to forest. MODIS confirms this as one of the strongest, most consistent greening signals on Earth.",
    source: "Data: MODIS Terra NDVI · See also: Chen et al. (2019), Nature Sustainability"
  },
  {
    id: "india",
    label: "India",
    bbox: [66, 6, 98, 36],
    story: "Agricultural intensification",
    description: "India shows remarkable greening driven by both expanded irrigation and increased fertilizer use (Green Revolution legacy). Multiple cropping cycles per year amplify the satellite signal — MODIS captures one of the globe's most pronounced vegetation increases.",
    source: "Data: MODIS Terra NDVI · See also: Zhu et al. (2016), Nature Climate Change"
  },
  {
    id: "sahel",
    label: "Sahel",
    bbox: [-18, 8, 38, 22],
    story: "Reversing desertification?",
    description: "The semi-arid Sahel was once synonymous with drought and famine. Since the 1980s, rainfall recovery and farmer-led reforestation have produced a patchy but real regreening. MODIS shows a mosaic of recovery and persistent degradation.",
    source: "Data: MODIS Terra NDVI · See also: Reij et al. (2009), IFPRI"
  },
  {
    id: "boreal",
    label: "Northern Boreal",
    bbox: [-180, 55, 180, 72],
    story: "Climate-driven greening",
    description: "Above 55°N, warming temperatures are extending the growing season. The boreal forest and tundra are greening as permafrost thaws and shrubs expand northward — a visible fingerprint of Arctic amplification.",
    source: "Data: MODIS Terra NDVI · See also: Xu et al. (2013), Nature Climate Change"
  },
  {
    id: "europe",
    label: "Europe",
    bbox: [-10, 35, 40, 62],
    story: "Mature forests & farmland shifts",
    description: "European forests have been expanding for decades due to farmland abandonment and active reforestation policies. MODIS shows subtle but consistent greening, though heatwaves (2003, 2018, 2022) leave temporary browning scars.",
    source: "Data: MODIS Terra NDVI · See also: Fuchs et al. (2015), Global Change Biology"
  },
  {
    id: "california",
    label: "California",
    bbox: [-125, 31, -113, 43],
    story: "Drought & fire",
    description: "California's vegetation tells a story of intensifying drought and catastrophic wildfire. MODIS captures browning in the Sierra foothills and coastal chaparral — punctuated by brief green-ups during rare wet years.",
    source: "Data: MODIS Terra NDVI · See also: Williams et al. (2022), Nature Climate Change"
  },
  {
    id: "seasia",
    label: "Southeast Asia",
    bbox: [95, -10, 130, 20],
    story: "Palm oil vs. recovery",
    description: "A battleground between deforestation (palm oil, logging in Indonesia/Malaysia) and regrowth (Vietnam, Thailand). MODIS reveals a mixed signal — browning in Sumatra and Borneo, greening in the Mekong basin.",
    source: "Data: MODIS Terra NDVI · See also: Hansen et al. (2013), Science"
  },
  {
    id: "australia",
    label: "Australia",
    bbox: [115, -40, 155, -12],
    story: "Arid heart, green fringes",
    description: "Australia's interior is too arid for meaningful vegetation trends, but the coastal zones show varied patterns — drought-driven browning in the Murray-Darling basin and recovery after the 2019–20 bushfires along the east coast.",
    source: "Data: MODIS Terra NDVI · See also: Australian Bureau of Meteorology"
  },
  {
    id: "congo",
    label: "Congo Basin",
    bbox: [10, -10, 35, 8],
    story: "The last intact rainforest",
    description: "The Congo Basin holds the world's second-largest rainforest and remains relatively intact compared to the Amazon. MODIS shows overall stability with localized browning along logging roads and mining concessions.",
    source: "Data: MODIS Terra NDVI · See also: Tyukavina et al. (2018), Science Advances"
  },
  {
    id: "eastafrica",
    label: "East Africa",
    bbox: [30, -10, 52, 15],
    story: "Drought & recovery cycles",
    description: "Ethiopia, Kenya, and Tanzania experience strong ENSO-driven rainfall variability. MODIS captures dramatic green-up during wet years and browning during droughts — making long-term trends harder to discern amid the noise.",
    source: "Data: MODIS Terra NDVI · See also: Funk et al. (2015), BAMS"
  }
];

/* ── Constants ────────────────────────────────────────────────────────── */
const TREND_THRESHOLDS = [-0.003, -0.001, 0.001, 0.003]; // 5 bins

/* ── Color scale: 5 discrete bins (brown → tan → green) ─────────────── */
const trendColors = ["#A0522D", "#DEB887", "#F5DEB3", "#6BAF6B", "#1B5E20"];
const trendColor = d3.scaleThreshold()
  .domain(TREND_THRESHOLDS)
  .range(trendColors);

/* ── SVG dimensions ──────────────────────────────────────────────────── */
function mapDims() {
  const node = document.querySelector("#ndvi-map");
  return {
    width: Math.max(680, node.clientWidth || 900),
    height: Math.max(500, node.clientHeight || 540)
  };
}

/* ── D3 projection (equirectangular, matching the region bbox) ───────── */
function makeProjection(bbox, mapW, mapH) {
  // Create a GeoJSON bounding polygon from the region bbox
  const bboxGeoJSON = {
    type: "Polygon",
    coordinates: [[
      [bbox[0], bbox[1]],
      [bbox[2], bbox[1]],
      [bbox[2], bbox[3]],
      [bbox[0], bbox[3]],
      [bbox[0], bbox[1]]
    ]]
  };
  return d3.geoEquirectangular()
    .fitExtent([[0, 0], [mapW, mapH]], bboxGeoJSON);
}

/* ── Tooltip helpers ─────────────────────────────────────────────────── */
function showTooltip(event, html) {
  d3.select("#tooltip")
    .attr("aria-hidden", "false")
    .style("opacity", 1)
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 14}px`)
    .html(html);
}

function hideTooltip() {
  d3.select("#tooltip")
    .attr("aria-hidden", "true")
    .style("opacity", 0);
}

/* ── Flatten grid data into points array ─────────────────────────────── */
function flattenGrid(grid, metadata) {
  const points = [];
  const { lons, lats, trends, firstYearNdvi, lastYearNdvi, rSquared, ndviByYear } = grid;
  const years = metadata.years;

  for (let row = 0; row < lats.length; row++) {
    for (let col = 0; col < lons.length; col++) {
      const trend = trends[row][col];
      if (trend != null && !isNaN(trend)) {
        // Extract the full annual time series for this pixel (if available)
        let ndviSeries = null;
        if (ndviByYear && ndviByYear.length > 0) {
          ndviSeries = ndviByYear.map(yearGrid => yearGrid[row][col]);
          // If all values are null (ocean pixel slipped through), set to null
          if (ndviSeries.every(v => v == null || isNaN(v))) {
            ndviSeries = null;
          }
        }

        points.push({
          lon: lons[col],
          lat: lats[row],
          trend: trend,
          firstNdvi: firstYearNdvi[row][col],
          lastNdvi: lastYearNdvi[row][col],
          ndviSeries: ndviSeries,
          r2: rSquared[row][col],
          row,
          col
        });
      }
    }
  }
  return points;
}

/* ── Filter points by region ─────────────────────────────────────────── */
function pointsInRegion(points, bbox) {
  // Filter points strictly within the bbox (no padding needed —
  // the bbox already defines the visible extent)
  return points.filter(p =>
    p.lon >= bbox[0] && p.lon <= bbox[2] &&
    p.lat >= bbox[1] && p.lat <= bbox[3]
  );
}

/* ── Synthesize time series from first/last NDVI and trend ───────────── */
function synthesizeTimeSeries(firstNdvi, lastNdvi, trend, years) {
  const n = years.length;
  if (n < 2) return years.map(() => firstNdvi);

  // Linear interpolation + controlled noise
  const series = [];
  let seed = Math.round((firstNdvi * 1000 + lastNdvi * 1000) % 1000);

  for (let i = 0; i < n; i++) {
    const frac = i / (n - 1);
    const base = firstNdvi + (lastNdvi - firstNdvi) * frac;
    // Deterministic pseudo-random noise
    seed = (seed * 16807 + 0) % 2147483647;
    const noise = ((seed / 2147483647) - 0.5) * 0.06;
    series.push(Math.max(0, Math.min(1, base + noise)));
  }

  return series;
}

/* ── Trend category label ────────────────────────────────────────────── */
function trendLabel(trend) {
  if (trend == null || isNaN(trend)) return ["Stable", "stat-stable"];
  if (trend > 0.003) return ["Strongly greening", "stat-green"];
  if (trend > 0.001) return ["Greening", "stat-green"];
  if (trend > -0.001) return ["Stable", "stat-stable"];
  if (trend > -0.003) return ["Browning", "stat-brown"];
  return ["Strongly browning", "stat-brown"];
}

/* ═══════════════════════════════════════════════════════════════════════
   RENDER MAP
   ═══════════════════════════════════════════════════════════════════════ */
function drawMap() {
  const region = ALL_REGIONS.find(r => r.id === currentRegion) || ALL_REGIONS[0];
  const bbox = region.bbox;
  const { width, height } = mapDims();

  const margin = { top: 16, right: 16, bottom: 16, left: 16 };
  const mapW = width - margin.left - margin.right;
  const mapH = height - margin.top - margin.bottom;

  const svg = d3.select("#ndvi-map")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.selectAll("*").remove();

  // ── Static ocean background (outside zoom, always fills viewport) ──
  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 14)
    .attr("fill", "#d3dfec")
    .attr("pointer-events", "none");

  // ── Margin group (fixed offset, never changes) ──
  const marginG = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ── Zoomable content group (starts at identity; zoom transforms this) ──
  const zoomG = marginG.append("g")
    .attr("class", "zoom-layer");

  // ── D3 projection (aligned to current region bbox) ──
  const projection = makeProjection(bbox, mapW, mapH);
  const geoPath = d3.geoPath(projection);

  // ── Layer 2: World land masses (coastline underlay) ──
  if (worldLand) {
    zoomG.append("path")
      .datum(worldLand)
      .attr("d", geoPath)
      .attr("fill", "#e4eaf2")
      .attr("stroke", "#bcc8d8")
      .attr("stroke-width", 0.6)
      .attr("stroke-linejoin", "round");
  }

  // ── Layer 3: Graticule lines (subtle lat/lon grid) ──
  const graticule = d3.geoGraticule()
    .step([bbox[2] - bbox[0] > 180 ? 30 : 15,
           bbox[3] - bbox[1] > 90  ? 15 : 5]);
  zoomG.append("path")
    .datum(graticule)
    .attr("d", geoPath)
    .attr("fill", "none")
    .attr("stroke", "#c8d4e4")
    .attr("stroke-width", 0.4)
    .attr("stroke-dasharray", "3 3");

  // ── Filter points ──
  let visible = pointsInRegion(flatPoints, bbox);

  if (showSignificantOnly) {
    visible = visible.filter(p => p.r2 != null && p.r2 > r2Threshold);
  }

  // Determine dot radius based on zoom level
  const lonSpan = bbox[2] - bbox[0];
  const dotR = lonSpan > 300 ? 3.2 : lonSpan > 100 ? 4.8 : 6.5;

  // ── Layer 4: NDVI trend dots ──
  zoomG.selectAll("circle")
    .data(visible, d => `${d.row}-${d.col}`)
    .join("circle")
    .attr("class", "ndvi-dot")
    .attr("cx", d => {
      const p = projection([d.lon, d.lat]);
      return p ? p[0] : -999;
    })
    .attr("cy", d => {
      const p = projection([d.lon, d.lat]);
      return p ? p[1] : -999;
    })
    .attr("r", dotR)
    .attr("fill", d => trendColor(d.trend))
    .attr("fill-opacity", 0.88)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .on("mouseenter", function(event, d) {
      d3.select(this)
        .attr("fill-opacity", 1)
        .attr("stroke", "#1a1a2e")
        .attr("stroke-width", 2)
        .raise();
      const [label, cls] = trendLabel(d.trend);
      showTooltip(event, `
        <strong>${d.lat.toFixed(1)}°${d.lat >= 0 ? 'N' : 'S'}, ${Math.abs(d.lon).toFixed(1)}°${d.lon >= 0 ? 'E' : 'W'}</strong><br>
        Linear trend: <span class="${cls}"><strong>${(d.trend * 1000).toFixed(1)}</strong> NDVI/decade</span><br>
        ${label}<br>
        2001 NDVI: ${d.firstNdvi?.toFixed(3) ?? 'N/A'} → 2024 NDVI: ${d.lastNdvi?.toFixed(3) ?? 'N/A'}<br>
        R² = ${d.r2?.toFixed(2) ?? 'N/A'}
      `);
    })
    .on("mouseleave", function() {
      const el = d3.select(this);
      if (el.classed("brush-highlighted")) {
        // Let CSS class handle the brush appearance — clear inline overrides
        el.attr("stroke", null).attr("stroke-width", null).attr("fill-opacity", null);
      } else if (el.classed("selected")) {
        // Let CSS class handle the selected appearance — clear inline overrides
        el.attr("stroke", null).attr("stroke-width", null).attr("fill-opacity", null);
      } else {
        el.attr("fill-opacity", 0.88)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5);
      }
      hideTooltip();
    })
    .on("click", function(event, d) {
      event.stopPropagation();
      // If a brush selection is active, dismiss it first
      if (brushSelectionActive) clearBrush();
      selectPoint(d);
    });

  // ── Region label ──
  if (currentRegion !== "global") {
    const labelLon = (bbox[0] + bbox[2]) / 2;
    const labelLat = bbox[3] + (bbox[3] - bbox[1]) * 0.04;
    const [lx, ly] = projection([labelLon, labelLat]) || [mapW/2, 22];
    zoomG.append("text")
      .attr("class", "region-label")
      .attr("x", lx)
      .attr("y", Math.max(18, ly))
      .text(region.label);
  }

  // ── D3 Zoom behavior (scroll to zoom, drag to pan) ──
  const baseDotR = dotR;
  const zoom = d3.zoom()
    .scaleExtent([1, 10])
    .translateExtent([[-mapW * 0.5, -mapH * 0.5], [mapW * 1.5, mapH * 1.5]])
    .filter((event) => {
      // Disable D3 zoom on: Shift+drag (we handle it ourselves), double-click (not needed)
      if (event.shiftKey && (event.type === 'mousedown' || event.type === 'mousemove')) {
        return false;
      }
      if (event.type === 'dblclick') return false;
      return true;
    })
    .on("zoom", (event) => {
      zoomG.attr("transform", event.transform);
      // Dynamic dot radius: dots grow slowly as you zoom in, stay crisp
      const k = event.transform.k;
      const adjustedR = baseDotR / Math.sqrt(k);
      zoomG.selectAll("circle").attr("r", adjustedR);
    });

  // Apply zoom to SVG and reset to identity (clears any stale transform)
  svg.call(zoom);
  svg.call(zoom.transform, d3.zoomIdentity);
  svg.node()._zoomBehavior = zoom;

  // ── Shift-key cursor tracking ──
  const svgNode = svg.node();
  const onShiftDown = (e) => { if (e.key === 'Shift') svgNode.classList.add('shift-held'); };
  const onShiftUp   = (e) => { if (e.key === 'Shift') svgNode.classList.remove('shift-held'); };
  document.addEventListener('keydown', onShiftDown);
  document.addEventListener('keyup', onShiftUp);
  // Clean up old listeners when map redraws
  if (svgNode._shiftCleanup) {
    document.removeEventListener('keydown', svgNode._shiftCleanup.down);
    document.removeEventListener('keyup', svgNode._shiftCleanup.up);
  }
  svgNode._shiftCleanup = { down: onShiftDown, up: onShiftUp };

  // ── Shift+drag → lasso selection with stats ──
  let brushStart = null;
  let brushRect = null;
  let brushedDots = [];
  let brushSelectionActive = false; // prevents click handler from wiping stats

  function brushCoords(event) {
    // Manual coordinate calculation — more reliable than d3.pointer
    const rect = svgNode.getBoundingClientRect();
    const vw = svgNode.viewBox.baseVal.width || mapW + margin.left + margin.right;
    const vh = svgNode.viewBox.baseVal.height || mapH + margin.top + margin.bottom;
    const mx = ((event.clientX - rect.left) / rect.width) * vw - margin.left;
    const my = ((event.clientY - rect.top) / rect.height) * vh - margin.top;
    return [mx, my];
  }

  function dotsInBrush(bx, by, bw, bh) {
    const t = d3.zoomTransform(svgNode);
    const zbx = (bx - t.x) / t.k;
    const zby = (by - t.y) / t.k;
    const zbw = bw / t.k;
    const zbh = bh / t.k;

    return visible.filter(d => {
      const p = projection([d.lon, d.lat]);
      if (!p) return false;
      return p[0] >= zbx && p[0] <= zbx + zbw &&
             p[1] >= zby && p[1] <= zby + zbh;
    });
  }

  function showBrushStats(dots) {
    if (!dots || dots.length === 0) {
      d3.select("#ts-title").text("No dots in selection");
      d3.select("#ts-placeholder").style("display", "flex");
      d3.select("#ts-content").style("display", "none");
      return;
    }

    const n = dots.length;
    const greening = dots.filter(d => d.trend > 0.001).length;
    const browning = dots.filter(d => d.trend < -0.001).length;
    const stable = n - greening - browning;
    const meanTrend = d3.mean(dots, d => d.trend);
    const [label, cls] = trendLabel(meanTrend);
    const meanFirst = d3.mean(dots, d => d.firstNdvi);
    const meanLast  = d3.mean(dots, d => d.lastNdvi);
    const changePct = meanFirst > 0 ? ((meanLast - meanFirst) / meanFirst * 100) : 0;

    d3.select("#ts-title").text(`${n} dot${n !== 1 ? 's' : ''} selected`);
    d3.select("#ts-placeholder").style("display", "none");
    d3.select("#ts-content").style("display", "block");
    d3.select("#ts-chart").html(`
      <div class="brush-summary-label">Shift+drag selection summary</div>
    `);

    d3.select("#ts-stats").html(`
      <div class="ts-stat">
        <div class="stat-value ${cls}">${(meanTrend * 1000).toFixed(1)}</div>
        <div class="stat-label">Mean trend (NDVI/decade) · ${label}</div>
      </div>
      <div class="ts-stat">
        <div class="stat-value">
          <span style="color:#2d8a4e">${greening}▲</span>
          <span style="color:#a0522d;margin-left:6px">${browning}▼</span>
          <span style="color:#6a7a92;margin-left:6px">${stable}─</span>
        </div>
        <div class="stat-label">Greening / Browning / Stable</div>
      </div>
      <div class="ts-stat">
        <div class="stat-value">${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%</div>
        <div class="stat-label">Mean NDVI change 2001→2024</div>
      </div>
      <div class="ts-stat">
        <div class="stat-value">${meanFirst?.toFixed(3) ?? 'N/A'} → ${meanLast?.toFixed(3) ?? 'N/A'}</div>
        <div class="stat-label">Mean NDVI (2001 → 2024)</div>
      </div>
      <button class="dismiss-btn" id="dismiss-brush" style="grid-column:1/-1;margin-top:4px">
        ✕ Dismiss selection
      </button>
    `);

    d3.select("#dismiss-brush").on("click", () => clearBrush());
  }

  function clearBrush() {
    brushSelectionActive = false;
    if (brushRect) { brushRect.remove(); brushRect = null; }
    brushStart = null;
    brushedDots = [];
    d3.selectAll(".ndvi-dot").classed("brush-highlighted", false);
    deselectPoint();
  }

  // ── Attach brush handlers via native events (bypasses D3 zoom conflicts) ──
  function onBrushDown(event) {
    if (!event.shiftKey) return;
    event.stopPropagation();
    event.preventDefault();
    clearBrush();
    brushStart = brushCoords(event);
    brushRect = marginG.append("rect")
      .attr("x", brushStart[0]).attr("y", brushStart[1])
      .attr("width", 0).attr("height", 0)
      .attr("fill", "rgba(59,130,246,0.15)")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6 4")
      .attr("rx", 6);
  }

  function onBrushMove(event) {
    if (!brushStart || !brushRect) return;
    const [mx, my] = brushCoords(event);
    const x = Math.min(brushStart[0], mx);
    const y = Math.min(brushStart[1], my);
    const w = Math.abs(mx - brushStart[0]);
    const h = Math.abs(my - brushStart[1]);
    brushRect.attr("x", x).attr("y", y).attr("width", w).attr("height", h);

    // Live preview: show dot count while still dragging
    if (w > 8 || h > 8) {
      const preview = dotsInBrush(x, y, w, h);
      d3.select("#ts-title").text(
        preview.length > 0
          ? `${preview.length} dot${preview.length !== 1 ? 's' : ''} in selection…`
          : "No dots in selection"
      );
    }
  }

  function onBrushUp(event) {
    if (!brushStart || !brushRect) return;
    const [mx, my] = brushCoords(event);
    const x0 = Math.min(brushStart[0], mx);
    const y0 = Math.min(brushStart[1], my);
    const bw = Math.abs(mx - brushStart[0]);
    const bh = Math.abs(my - brushStart[1]);
    brushStart = null;

    if (bw < 8 || bh < 8) {
      clearBrush();
      return;
    }

    brushedDots = dotsInBrush(x0, y0, bw, bh);

    d3.selectAll(".ndvi-dot").classed("brush-highlighted", false);
    zoomG.selectAll("circle").filter(d => brushedDots.includes(d))
      .classed("brush-highlighted", true)
      .raise();

    brushSelectionActive = true;
    showBrushStats(brushedDots);
  }

  // Remove any previous listeners (drawMap may be called multiple times)
  svgNode.removeEventListener("mousedown", svgNode._brushDown);
  svgNode.removeEventListener("mousemove", svgNode._brushMove);
  svgNode.removeEventListener("mouseup",   svgNode._brushUp);

  svgNode._brushDown = onBrushDown;
  svgNode._brushMove = onBrushMove;
  svgNode._brushUp   = onBrushUp;

  svgNode.addEventListener("mousedown", onBrushDown);
  svgNode.addEventListener("mousemove", onBrushMove);
  svgNode.addEventListener("mouseup",   onBrushUp);

  // Clean up old Escape handler, re-attach
  document.removeEventListener("keydown", svgNode._escHandler);
  svgNode._escHandler = (e) => { if (e.key === "Escape") clearBrush(); };
  document.addEventListener("keydown", svgNode._escHandler);

  // Click on empty space to deselect (only if not dragging or brushing)
  svg.on("click", (event) => {
    if (brushSelectionActive) return;
    if (event.target === svg.node() || event.target.tagName === 'rect') {
      deselectPoint();
    }
  });

  // Update stats pill
  updateMapStats(visible);

  // Update legend
  drawLegend();
}

/* ── Map stats ───────────────────────────────────────────────────────── */
function updateMapStats(points) {
  if (!points || points.length === 0) return;

  const greening = points.filter(p => p.trend > 0.001).length;
  const browning = points.filter(p => p.trend < -0.001).length;
  const stable = points.length - greening - browning;
  const meanTrend = d3.mean(points, p => p.trend);

  d3.select("#map-stats").html(`
    ${points.length} cells ·
    <span style="color:#2d8a4e">${greening}▲</span>
    <span style="color:#a0522d">${browning}▼</span>
    <span style="color:#6a7a92">${stable}─</span>
    · mean ${(meanTrend * 1000).toFixed(1)}/decade
  `);
}

/* ═══════════════════════════════════════════════════════════════════════
   LEGEND
   ═══════════════════════════════════════════════════════════════════════ */
function drawLegend() {
  const container = d3.select("#ndvi-legend");
  container.html("");

  container.append("span").text("NDVI trend (units/year):");

  // Discrete color swatches
  const bins = [
    { label: "Strong ↓",   range: "< −0.003", color: trendColors[0] },
    { label: "Browning",   range: "−0.003…−0.001", color: trendColors[1] },
    { label: "Stable",     range: "−0.001…+0.001", color: trendColors[2] },
    { label: "Greening",   range: "+0.001…+0.003", color: trendColors[3] },
    { label: "Strong ↑",   range: "> +0.003", color: trendColors[4] },
  ];

  const swatchGroup = container.append("div")
    .attr("class", "legend-swatches");

  bins.forEach(b => {
    const swatch = swatchGroup.append("div").attr("class", "legend-swatch");
    swatch.append("span")
      .attr("class", "swatch-color")
      .style("background", b.color);
    swatch.append("span")
      .attr("class", "swatch-label")
      .text(b.label);
    swatch.append("span")
      .attr("class", "swatch-range")
      .text(b.range);
  });

  const note = container.append("div").attr("class", "legend-label-group");
  note.append("span").text("Each dot = 2°×2° grid cell · Linear regression slope · July NDVI, 2001–2024");
}

/* ═══════════════════════════════════════════════════════════════════════
   TIME SERIES PANEL
   ═══════════════════════════════════════════════════════════════════════ */
let tsResizeObserver = null;

function selectPoint(d) {
  selectedPoint = d;

  // Deselect all dots, restoring default inline styles for non-selected dots
  d3.selectAll(".ndvi-dot")
    .classed("selected", false)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("fill-opacity", 0.88);

  // Mark the newly clicked dot
  d3.selectAll(".ndvi-dot")
    .filter(p => p.row === d.row && p.col === d.col)
    .classed("selected", true);

  // Show time series panel
  d3.select("#ts-placeholder").style("display", "none");
  d3.select("#ts-content").style("display", "block");

  const years = ndviData.metadata.years;

  // Use real annual NDVI data if available, otherwise synthesize
  let ts;
  if (d.ndviSeries && d.ndviSeries.length === years.length) {
    ts = d.ndviSeries;
  } else {
    ts = synthesizeTimeSeries(d.firstNdvi, d.lastNdvi, d.trend, years);
  }

  d3.select("#ts-title").text(
    `${d.lat.toFixed(1)}°${d.lat >= 0 ? 'N' : 'S'}, ${Math.abs(d.lon).toFixed(1)}°${d.lon >= 0 ? 'E' : 'W'}`
  );

  drawTimeSeries(ts, years, d, d.ndviSeries != null);
  drawTimeSeriesStats(d);
}

function deselectPoint() {
  selectedPoint = null;
  d3.selectAll(".ndvi-dot").classed("selected", false);
  d3.select("#ts-placeholder").style("display", "flex");
  d3.select("#ts-content").style("display", "none");
  d3.select("#ts-title").text("Click a dot on the map");
}

function drawTimeSeries(ts, years, pointData, hasRealData) {
  const container = d3.select("#ts-chart");
  container.html("");

  // Show a badge indicating whether these are real or reconstructed values
  container.append("div")
    .attr("class", "ts-data-badge")
    .attr("data-real", hasRealData ? "true" : "false")
    .text(hasRealData
      ? "● Real annual NDVI measurements"
      : "● Reconstructed trend (linear fit)"
    );

  const containerWidth = container.node().clientWidth || 340;
  const margin = { top: 20, right: 16, bottom: 40, left: 42 };
  const w = containerWidth - margin.left - margin.right;
  const h = 240 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("class", "ts-chart-svg")
    .attr("viewBox", `0 0 ${containerWidth} 240`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleLinear()
    .domain([years[0], years[years.length - 1]])
    .range([0, w]);

  const yMin = Math.max(0, d3.min(ts) - 0.05);
  const yMax = Math.min(1, d3.max(ts) + 0.05);
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([h, 0])
    .nice();

  // Grid lines
  g.selectAll(".grid-line")
    .data(yScale.ticks(5))
    .join("line")
    .attr("class", "grid-line")
    .attr("x1", 0).attr("x2", w)
    .attr("y1", d => yScale(d))
    .attr("y2", d => yScale(d));

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("d")))
    .selectAll("text").attr("class", "axis-label");

  g.append("g")
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text").attr("class", "axis-label");

  // Axis titles
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", w / 2).attr("y", h + 32)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", -h / 2).attr("y", -32)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("NDVI");

  // Trend line — uses the actual regression slope, not just first→last
  const nIntervals = years.length - 1;
  const midNdvi = (pointData.firstNdvi + pointData.lastNdvi) / 2;
  const trendStart = midNdvi - pointData.trend * nIntervals / 2;
  const trendEnd   = midNdvi + pointData.trend * nIntervals / 2;
  g.append("line")
    .attr("class", "trend-line")
    .attr("x1", xScale(years[0]))
    .attr("y1", yScale(trendStart))
    .attr("x2", xScale(years[years.length - 1]))
    .attr("y2", yScale(trendEnd));

  // Data line
  const lineGen = d3.line()
    .x((d, i) => xScale(years[i]))
    .y(d => yScale(d))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(ts)
    .attr("class", "data-line")
    .attr("d", lineGen);

  // Data dots
  g.selectAll(".data-dot")
    .data(ts)
    .join("circle")
    .attr("class", "data-dot")
    .attr("cx", (d, i) => xScale(years[i]))
    .attr("cy", d => yScale(d))
    .attr("r", 3.5);
}

function drawTimeSeriesStats(d) {
  const [label, cls] = trendLabel(d.trend);
  const totalChange = d.lastNdvi - d.firstNdvi;
  const pctChange = d.firstNdvi > 0 ? (totalChange / d.firstNdvi * 100) : 0;

  d3.select("#ts-stats").html(`
    <div class="ts-stat">
      <div class="stat-value ${cls}">${label}</div>
      <div class="stat-label">Classification</div>
    </div>
    <div class="ts-stat">
      <div class="stat-value">${(d.trend * 1000).toFixed(1)}</div>
      <div class="stat-label">Trend (NDVI/decade)</div>
    </div>
    <div class="ts-stat">
      <div class="stat-value">${totalChange >= 0 ? '+' : ''}${(totalChange * 100).toFixed(1)}%</div>
      <div class="stat-label">Total change 2001–2024</div>
    </div>
    <div class="ts-stat">
      <div class="stat-value">${d.r2?.toFixed(2) ?? 'N/A'}</div>
      <div class="stat-label">R² (goodness of fit)</div>
    </div>
  `);
}

/* ═══════════════════════════════════════════════════════════════════════
   REGIONAL HIGHLIGHTS
   ═══════════════════════════════════════════════════════════════════════ */
function drawHighlights() {
  const container = d3.select("#highlights-grid");
  container.html("");

  // Compute stats for each region
  const items = ALL_REGIONS
    .filter(r => r.id !== "global")
    .map(r => {
      const regionPoints = pointsInRegion(flatPoints, r.bbox);
      if (regionPoints.length === 0) return null;
      const meanTrend = d3.mean(regionPoints, p => p.trend);
      const [trendLabelText, cls] = trendLabel(meanTrend);
      const greening = regionPoints.filter(p => p.trend > 0.001).length;
      const browning = regionPoints.filter(p => p.trend < -0.001).length;
      const stable = regionPoints.length - greening - browning;
      const total = regionPoints.length;

      return { ...r, meanTrend, trendLabel: trendLabelText, cls, greening, browning, stable, total };
    })
    .filter(d => d !== null)
    .sort((a, b) => Math.abs(b.meanTrend) - Math.abs(a.meanTrend));

  items.forEach(item => {
    const card = container.append("div")
      .attr("class", "highlight-item")
      .on("click", () => {
        currentRegion = item.id;
        d3.select("#region-select").property("value", item.id);
        drawMap();
      });

    // Story badge
    card.append("div")
      .attr("class", `highlight-badge ${item.cls}`)
      .text(item.story);

    // Region name + trend stat
    card.append("h3").text(item.label);
    card.append("div")
      .attr("class", `highlight-trend ${item.cls}`)
      .html(`
        <strong>${(item.meanTrend * 1000).toFixed(1)}</strong> NDVI/decade
        · <span style="color:#2d8a4e">${item.greening}▲</span>
        <span style="color:#a0522d">${item.browning}▼</span>
        <span style="color:#6a7a92">${item.stable}─</span>
        · ${item.total} cells
      `);

    // Real-world narrative
    card.append("div")
      .attr("class", "highlight-desc")
      .text(item.description);

    // Source citation
    if (item.source) {
      card.append("div")
        .attr("class", "highlight-source")
        .text(item.source);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   CONTROLS
   ═══════════════════════════════════════════════════════════════════════ */
function setupControls() {
  // Region selector
  const select = d3.select("#region-select");
  select.selectAll("option")
    .data(ALL_REGIONS)
    .join("option")
    .attr("value", d => d.id)
    .text(d => d.label);

  select.property("value", currentRegion);
  select.on("change", function() {
    currentRegion = this.value;
    deselectPoint();
    drawMap();
  });

  // Significance toggle
  d3.select("#significance-toggle")
    .property("checked", showSignificantOnly)
    .on("change", function() {
      showSignificantOnly = this.checked;
      d3.select("#r2-slider-wrap").classed("active", showSignificantOnly);
      drawMap();
    });

  // R² threshold slider
  const r2Slider = d3.select("#r2-threshold");
  const r2Label = d3.select("#r2-value");
  r2Slider
    .property("value", r2Threshold)
    .on("input", function() {
      r2Threshold = +this.value;
      r2Label.text(r2Threshold.toFixed(2));
      if (showSignificantOnly) drawMap();
    });

  // Show/hide slider based on initial toggle state
  d3.select("#r2-slider-wrap").classed("active", showSignificantOnly);
}

/* ═══════════════════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════════════════ */
function hasD3() {
  if (!window.d3) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="error-banner"><strong>D3 did not load.</strong> Check the CDN script or the local d3.v7.min.js file.</div>`
    );
    return false;
  }
  return true;
}

async function init() {
  if (!hasD3()) return;

  try {
    ndviData = await d3.json("ndvi_trend_data.json");
  } catch (err) {
    document.body.insertAdjacentHTML("afterbegin",
      `<div class="error-banner"><strong>Failed to load ndvi_trend_data.json.</strong> Make sure the data file exists. Run <code>make_sample_data.py</code> to generate sample data, or <code>generate_ndvi_data.py</code> for real MODIS data.</div>`
    );
    console.error("Data load error:", err);
    return;
  }

  // Flatten grid
  flatPoints = flattenGrid(ndviData.grid, ndviData.metadata);

  // ── Load world map data (optional — map works without it) ──
  try {
    const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json");
    if (window.topojson) {
      worldLand = topojson.feature(world, world.objects.land);
      console.log("World map loaded:", worldLand.features.length, "features");
    }
  } catch (err) {
    console.warn("Could not load world map underlay, continuing without it:", err);
    worldLand = null;
  }

  // Update metadata display
  d3.select("#data-meta").text(
    `${ndviData.metadata.years.length} years · ${ndviData.metadata.nLandPixels} land pixels · ${ndviData.metadata.resolutionDeg}° resolution`
  );

  // Initialize
  setupControls();
  drawMap();
  drawHighlights();

  // Redraw on resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(drawMap, 200);
  });
}

// Start
init();
