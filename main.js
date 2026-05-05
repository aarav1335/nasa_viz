const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const regions = [
  {
    id: "global",
    label: "Global",
    bbox: [-90, -180, 90, 180],
    note: "Full global extent"
  },
  {
    id: "amazon",
    label: "Amazon Basin",
    bbox: [-20, -80, 8, -45],
    note: "Tropical vegetation and forest edge change"
  },
  {
    id: "california",
    label: "California",
    bbox: [31, -125, 43, -113],
    note: "Fire-prone western U.S. landscape"
  },
  {
    id: "india",
    label: "India",
    bbox: [5, 66, 36, 98],
    note: "Monsoon-linked vegetation and heat patterns"
  },
  {
    id: "australia",
    label: "Australia",
    bbox: [-44, 112, -10, 154],
    note: "Drylands, heat, and seasonal vegetation"
  },
  {
    id: "arctic",
    label: "Arctic",
    bbox: [55, -170, 85, 170],
    note: "High-latitude land and ice patterns"
  }
];

const layers = {
  trueColor: "MODIS_Terra_CorrectedReflectance_TrueColor",
  ndvi: "MODIS_Terra_NDVI_8Day",
  fires: "MODIS_Fires_All",
  lst: "MODIS_Terra_Land_Surface_Temp_Day"
};

const layerDescriptions = {
  [layers.trueColor]: "MODIS Terra corrected reflectance true color",
  [layers.ndvi]: "MODIS Terra NDVI 8-day vegetation index",
  [layers.fires]: "MODIS active fire detections",
  [layers.lst]: "MODIS Terra daytime land surface temperature"
};

const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

function showTip(event, html) {
  tooltip
    .style("opacity", 1)
    .html(html)
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 14}px`);
}

function hideTip() {
  tooltip.style("opacity", 0);
}

function svgSize(selector) {
  const node = document.querySelector(selector);
  const width = Math.max(340, node.clientWidth || 700);
  const height = Math.max(340, node.clientHeight || 420);
  return { width, height };
}

function clear(selector) {
  d3.select(selector).selectAll("*").remove();
}

function getRegion(selectId) {
  const id = d3.select(selectId).property("value");
  return regions.find((d) => d.id === id) || regions[0];
}

function bboxString(region) {
  return region.bbox.join(",");
}

function nasaWmsUrl({ layer, date, region, width = 900, height = 500, format = "image/png", transparent = true }) {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    FORMAT: format,
    TRANSPARENT: transparent ? "true" : "false",
    LAYERS: layer,
    CRS: "EPSG:4326",
    STYLES: "",
    WIDTH: width,
    HEIGHT: height,
    BBOX: bboxString(region),
    TIME: date
  });

  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${params.toString()}`;
}

function monthDate(monthIndex, year = 2024) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function drawMapImage({
  svgSelector,
  layer,
  date,
  region,
  title,
  showBase = false,
  overlayLayer = null,
  overlayOpacity = 0.95
}) {
  const { width, height } = svgSize(svgSelector);
  clear(svgSelector);

  const svg = d3.select(svgSelector).attr("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 18, right: 18, bottom: 54, left: 18 };
  const mapW = width - margin.left - margin.right;
  const mapH = height - margin.top - margin.bottom;

  svg
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 10)
    .attr("fill", "#eaf0f2");

  if (showBase) {
    svg
      .append("image")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", mapW)
      .attr("height", mapH)
      .attr("preserveAspectRatio", "none")
      .attr("href", nasaWmsUrl({
        layer: layers.trueColor,
        date,
        region,
        width: Math.round(mapW),
        height: Math.round(mapH),
        format: "image/jpeg",
        transparent: false
      }));
  }

  svg
    .append("image")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("preserveAspectRatio", "none")
    .attr("opacity", showBase && overlayLayer ? overlayOpacity : 1)
    .attr("href", nasaWmsUrl({
      layer,
      date,
      region,
      width: Math.round(mapW),
      height: Math.round(mapH),
      transparent: true
    }));

  if (overlayLayer) {
    svg
      .append("image")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", mapW)
      .attr("height", mapH)
      .attr("preserveAspectRatio", "none")
      .attr("opacity", overlayOpacity)
      .attr("href", nasaWmsUrl({
        layer: overlayLayer,
        date,
        region,
        width: Math.round(mapW),
        height: Math.round(mapH),
        transparent: true
      }));
  }

  svg
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 10)
    .attr("fill", "transparent")
    .attr("stroke", "#d9ded7")
    .on("mousemove", (event) => {
      showTip(
        event,
        `<strong>${title}</strong><br>
         ${layerDescriptions[layer]}<br>
         Date: ${date}<br>
         Region: ${region.label}<br>
         BBOX: ${region.bbox.join(", ")}`
      );
    })
    .on("mouseleave", hideTip);

  svg
    .append("text")
    .attr("class", "label")
    .attr("x", margin.left)
    .attr("y", height - 28)
    .text(`${region.label} · ${region.note}`);

  svg
    .append("text")
    .attr("class", "label")
    .attr("x", margin.left)
    .attr("y", height - 10)
    .text(`NASA GIBS WMS layer: ${layer} · TIME=${date}`);
}

function renderSmallMultiples({ containerSelector, layer, region, dates, showBase = false, overlayLayer = null }) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  const cards = container
    .selectAll(".mini-card")
    .data(dates)
    .join("div")
    .attr("class", "mini-card");

  cards
    .append("img")
    .attr("alt", (d) => `${layer} ${d.label}`)
    .attr("src", (d) => nasaWmsUrl({
      layer: showBase ? layers.trueColor : layer,
      date: d.date,
      region,
      width: 380,
      height: 220,
      format: showBase ? "image/jpeg" : "image/png",
      transparent: !showBase
    }));

  if (overlayLayer) {
    cards
      .append("img")
      .attr("class", "mini-overlay")
      .attr("alt", (d) => `${overlayLayer} ${d.label}`)
      .attr("src", (d) => nasaWmsUrl({
        layer: overlayLayer,
        date: d.date,
        region,
        width: 380,
        height: 220,
        transparent: true
      }));
  }

  cards
    .append("p")
    .html((d) => `<strong>${d.label}</strong><br>${d.date}`);
}

function renderNdviMap() {
  const month = +d3.select("#ndvi-month").property("value");
  const region = getRegion("#ndvi-region");
  const date = monthDate(month, 2024);

  d3.select("#ndvi-month-label").text(months[month]);

  drawMapImage({
    svgSelector: "#ndvi-map",
    layer: layers.ndvi,
    date,
    region,
    title: "MODIS NDVI"
  });

  renderSmallMultiples({
    containerSelector: "#ndvi-small-multiples",
    layer: layers.ndvi,
    region,
    dates: [
      { label: "Winter", date: "2024-01-01" },
      { label: "Spring", date: "2024-04-01" },
      { label: "Summer", date: "2024-07-01" },
      { label: "Fall", date: "2024-10-01" }
    ]
  });
}

function renderFireMap() {
  const date = d3.select("#fire-date").property("value");
  const region = getRegion("#fire-region");
  const showBase = d3.select("#fire-base-toggle").property("checked");

  drawMapImage({
    svgSelector: "#fire-map",
    layer: showBase ? layers.trueColor : layers.fires,
    date,
    region,
    title: "MODIS Fire Detections",
    showBase,
    overlayLayer: showBase ? layers.fires : null,
    overlayOpacity: 0.95
  });

  const selected = new Date(`${date}T00:00:00`);
  const before = new Date(selected);
  before.setDate(selected.getDate() - 14);

  const after = new Date(selected);
  after.setDate(selected.getDate() + 14);

  const formatDate = d3.timeFormat("%Y-%m-%d");

  renderSmallMultiples({
    containerSelector: "#fire-comparison",
    layer: layers.trueColor,
    region,
    showBase: true,
    overlayLayer: layers.fires,
    dates: [
      { label: "Two weeks before", date: formatDate(before) },
      { label: "Selected date", date },
      { label: "Two weeks after", date: formatDate(after) }
    ]
  });
}

function renderTempMap() {
  const date = d3.select("#temp-date").property("value");
  const region = getRegion("#temp-region");

  drawMapImage({
    svgSelector: "#temp-map",
    layer: layers.lst,
    date,
    region,
    title: "MODIS Land Surface Temperature"
  });

  renderSmallMultiples({
    containerSelector: "#temp-small-multiples",
    layer: layers.lst,
    region,
    dates: [
      { label: "January", date: "2024-01-15" },
      { label: "April", date: "2024-04-15" },
      { label: "July", date: "2024-07-15" },
      { label: "October", date: "2024-10-15" }
    ]
  });
}

function setupTabs() {
  d3.selectAll(".tab").on("click", function () {
    const id = this.dataset.view;

    d3.selectAll(".tab").classed("is-active", false);
    d3.select(this).classed("is-active", true);

    d3.selectAll(".view").classed("is-active", false);
    d3.select(`#${id}`).classed("is-active", true);

    renderAll();
  });
}

function setupRegionSelects() {
  ["#ndvi-region", "#fire-region", "#temp-region"].forEach((selector) => {
    d3.select(selector)
      .selectAll("option")
      .data(regions)
      .join("option")
      .attr("value", (d) => d.id)
      .text((d) => d.label);
  });

  d3.select("#ndvi-region").property("value", "global");
  d3.select("#fire-region").property("value", "california");
  d3.select("#temp-region").property("value", "india");
}

function setupControls() {
  d3.select("#ndvi-month").on("input", renderNdviMap);
  d3.select("#ndvi-region").on("change", renderNdviMap);

  d3.select("#fire-date").on("change", renderFireMap);
  d3.select("#fire-region").on("change", renderFireMap);
  d3.select("#fire-base-toggle").on("change", renderFireMap);

  d3.select("#temp-date").on("change", renderTempMap);
  d3.select("#temp-region").on("change", renderTempMap);
}

function renderAll() {
  renderNdviMap();
  renderFireMap();
  renderTempMap();
}

setupTabs();
setupRegionSelects();
setupControls();
renderAll();

window.addEventListener("resize", renderAll);