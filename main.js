const regions = [
  {
    id: "india",
    label: "India",
    bbox: [66, 5, 98, 36],
    note: "strong pre-monsoon heat and seasonal cooling during monsoon months"
  },
  {
    id: "california",
    label: "California",
    bbox: [-125, 31, -113, 43],
    note: "coastal-to-inland temperature contrast and dry summer heat"
  },
  {
    id: "australia",
    label: "Australia",
    bbox: [112, -44, 154, -10],
    note: "large dryland region with strong seasonal surface heating"
  },
  {
    id: "amazon",
    label: "Amazon Basin",
    bbox: [-80, -20, -45, 8],
    note: "dense tropical forest where surface temperature patterns are more humid and cloud affected"
  },
  {
    id: "sahel",
    label: "Sahel",
    bbox: [-18, 8, 38, 22],
    note: "semi-arid region with high heat and strong seasonal rainfall effects"
  },
  {
    id: "global",
    label: "Global land view",
    bbox: [-180, -60, 180, 80],
    note: "broad overview of global land surface temperature patterns"
  }
];

const LAYER     = "MODIS_Terra_L3_Land_Surface_Temp_Monthly_CMG_DAY_TES";
const VEG_LAYER = "MODIS_Terra_L3_EVI_Monthly";
const WMS_BASE  = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasD3() {
  if (!window.d3) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="error-banner"><strong>D3 did not load.</strong> Check the CDN script in index.html or add a local d3.v7.min.js file.</div>`
    );
    return false;
  }
  return true;
}

function selectedRegion() {
  const selectedId = d3.select("#region-select").property("value");
  return regions.find((d) => d.id === selectedId) || regions[0];
}

function wmsUrl({ layer, region, date, width = 1000, height = 620 }) {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    FORMAT: "image/png",
    TRANSPARENT: "TRUE",
    LAYERS: layer,
    SRS: "EPSG:4326",
    STYLES: "",
    WIDTH: Math.round(width),
    HEIGHT: Math.round(height),
    BBOX: region.bbox.join(","),
    TIME: date
  });
  return `${WMS_BASE}?${params.toString()}`;
}

function svgSize(selector) {
  const node = document.querySelector(selector);
  return {
    width:  Math.max(680, node.clientWidth  || 820),
    height: Math.max(480, node.clientHeight || 520)
  };
}

function showTooltip(event, html) {
  d3.select("#tooltip")
    .attr("aria-hidden", "false")
    .style("opacity", 1)
    .style("left", `${event.clientX + 14}px`)
    .style("top",  `${event.clientY + 14}px`)
    .html(html);
}

function hideTooltip() {
  d3.select("#tooltip")
    .attr("aria-hidden", "true")
    .style("opacity", 0);
}

function selectedDate() {
  const year  = d3.select("#year-select").property("value");
  const month = d3.select("#season-select").property("value");
  return `${year}-${month}-01`;
}


// ── Temperature map ───────────────────────────────────────────────────────────

function drawTemperatureMap() {
  const region = selectedRegion();
  const date = selectedDate();

  const { width, height } = svgSize("#temp-main");

  const svg = d3.select("#temp-main")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.selectAll("*").remove();

  const margin = { top: 20, right: 20, bottom: 76, left: 20 };
  const mapW = width  - margin.left - margin.right;
  const mapH = height - margin.top  - margin.bottom;

  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", mapW).attr("height", mapH)
    .attr("rx", 20).attr("fill", "#edf1ee");

  svg.append("image")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", mapW).attr("height", mapH)
    .attr("preserveAspectRatio", "none")
    .attr("href", wmsUrl({ layer: LAYER, region, date, width: mapW, height: mapH }));

  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", mapW).attr("height", mapH)
    .attr("rx", 20)
    .attr("fill", "transparent")
    .attr("stroke", "#d7ded8")
    .attr("stroke-width", 1.2)
    .on("mousemove", (event) => {
      showTooltip(
        event,
        `<strong>MODIS land surface temperature</strong><br>
         Region: ${region.label}<br>
         Date: ${date}<br>
         Layer: ${LAYER}<br>
         BBOX: ${region.bbox.join(", ")}`
      );
    })
    .on("mouseleave", hideTooltip);

  svg.append("text")
    .attr("x", margin.left).attr("y", height - 44)
    .attr("class", "svg-label")
    .text(`${region.label}: ${region.note}`);

  svg.append("text")
    .attr("x", margin.left).attr("y", height - 20)
    .attr("class", "svg-source")
    .text(`NASA GIBS WMS · layer=${LAYER} · time=${date}`);

  d3.select("#temp-caption").html(
    `Selected view: <strong>${region.label}</strong> on <strong>${date}</strong>. This map shows relative land surface temperature patterns from NASA MODIS imagery.`
  );
}

// ── Vegetation map ────────────────────────────────────────────────────────────

function drawVegetationMap() {
  const region = selectedRegion();
  // EVI is a monthly layer — format date as YYYY-MM-01
  const date = selectedDate();
  const { width, height } = svgSize("#veg-main");

  const svg = d3.select("#veg-main")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.selectAll("*").remove();

  const margin = { top: 20, right: 20, bottom: 76, left: 20 };
  const mapW = width  - margin.left - margin.right;
  const mapH = height - margin.top  - margin.bottom;

  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", mapW).attr("height", mapH)
    .attr("rx", 20).attr("fill", "#edf1ee");

  svg.append("image")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", mapW).attr("height", mapH)
    .attr("preserveAspectRatio", "none")
    .attr("href", wmsUrl({ layer: VEG_LAYER, region, date, width: mapW, height: mapH }));

  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", mapW).attr("height", mapH)
    .attr("rx", 20)
    .attr("fill", "transparent")
    .attr("stroke", "#d7ded8")
    .attr("stroke-width", 1.2)
    .on("mousemove", (event) => {
      showTooltip(
        event,
        `<strong>MODIS Enhanced Vegetation Index</strong><br>
         Region: ${region.label}<br>
         Date: ${date}<br>
         Layer: ${VEG_LAYER}<br>
         BBOX: ${region.bbox.join(", ")}`
      );
    })
    .on("mouseleave", hideTooltip);

  svg.append("text")
    .attr("x", margin.left).attr("y", height - 44)
    .attr("class", "svg-label")
    .text(`${region.label}: vegetation density`);

  svg.append("text")
    .attr("x", margin.left).attr("y", height - 20)
    .attr("class", "svg-source")
    .text(`NASA GIBS WMS · layer=${VEG_LAYER} · time=${date}`);

  d3.select("#veg-caption").html(
    `Vegetation index for <strong>${region.label}</strong> — ${date}. Green areas indicate denser, healthier vegetation.`
  );
}

// ── Seasonal snapshots ────────────────────────────────────────────────────────

function makeSnapshot({ label, date, region }) {
  const card = document.createElement("article");
  card.className = "snapshot-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "snapshot-image-wrap";

  const image = document.createElement("img");
  image.src = wmsUrl({ layer: LAYER, region, date, width: 520, height: 310 });
  image.alt = `${label} MODIS land surface temperature for ${region.label}`;
  image.loading = "lazy";
  image.onerror = () => {
    imageWrap.innerHTML = `<div class="img-fallback">NASA image did not load for this date. Try a nearby date.</div>`;
  };

  imageWrap.appendChild(image);

  const text = document.createElement("p");
  text.innerHTML = `<strong>${label}</strong><br>${date}`;

  card.appendChild(imageWrap);
  card.appendChild(text);
  return card;
}

function drawSeasonalSnapshots() {
  const region = selectedRegion();
  const dates = [
    { label: "Winter", date: "2024-01-15" },
    { label: "Spring", date: "2024-04-15" },
    { label: "Summer", date: "2024-07-15" },
    { label: "Fall",   date: "2024-10-15" }
  ];
  const cards = dates.map((d) => makeSnapshot({ ...d, region }));
  document.querySelector("#temp-seasons").replaceChildren(...cards);
}

// ── Render + controls ─────────────────────────────────────────────────────────

function render() {
  drawTemperatureMap();
  drawVegetationMap();
  drawSeasonalSnapshots();
}

function setupControls() {
  // Populate regions
  d3.select("#region-select")
    .selectAll("option")
    .data(regions)
    .join("option")
    .attr("value", (d) => d.id)
    .text((d) => d.label);

  // Populate years (2002–2024)
  const years = d3.range(2024, 2001, -1); // [2024, 2023, ..., 2002]
  d3.select("#year-select")
    .selectAll("option")
    .data(years)
    .join("option")
    .attr("value", (d) => d)
    .text((d) => d);

  // Set defaults
  d3.select("#region-select").property("value", "india");
  d3.select("#year-select").property("value", "2023");
  d3.select("#season-select").property("value", "06");

  // Listeners
  d3.select("#region-select").on("change", render);
  d3.select("#year-select").on("change", render);
  d3.select("#season-select").on("change", render);
}

if (hasD3()) {
  setupControls();
  render();
  window.addEventListener("resize", () => {
    drawTemperatureMap();
    drawVegetationMap();
  });
}
