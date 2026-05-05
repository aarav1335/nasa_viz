const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// BBOX format below is [west, south, east, north]. WMS 1.1.1 keeps lon/lat order for EPSG:4326.
const regions = [
  { id: "global", label: "Global", bbox: [-180, -60, 180, 80], note: "global land patterns" },
  { id: "amazon", label: "Amazon Basin", bbox: [-80, -20, -45, 8], note: "tropical forest greenness" },
  { id: "california", label: "California", bbox: [-125, 31, -113, 43], note: "western U.S. fires and dry-season vegetation" },
  { id: "india", label: "India", bbox: [66, 5, 98, 36], note: "monsoon-linked vegetation and heat" },
  { id: "australia", label: "Australia", bbox: [112, -44, 154, -10], note: "drylands, heat, and fire activity" },
  { id: "sahel", label: "Sahel", bbox: [-18, 8, 38, 22], note: "semi-arid seasonal greening" }
];

const layers = {
  trueColor: "MODIS_Terra_CorrectedReflectance_TrueColor",
  ndvi: "MODIS_Terra_NDVI_8Day",
  fires: "MODIS_Fires_All",
  lst: "MODIS_Terra_Land_Surface_Temp_Day"
};

const layerLabels = {
  [layers.trueColor]: "MODIS Terra true-color corrected reflectance",
  [layers.ndvi]: "MODIS Terra NDVI 8-day vegetation index",
  [layers.fires]: "MODIS active fire detections",
  [layers.lst]: "MODIS Terra land surface temperature, daytime"
};

const tooltip = d3.select("body")
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

function clear(selector) {
  d3.select(selector).selectAll("*").remove();
}

function svgSize(selector) {
  const node = document.querySelector(selector);
  return {
    width: Math.max(360, node.clientWidth || 720),
    height: Math.max(360, node.clientHeight || 420)
  };
}

function selectedRegion(selector) {
  const id = d3.select(selector).property("value");
  return regions.find(d => d.id === id) || regions[0];
}

function wmsUrl({ layer, date, region, width = 900, height = 520, format = "image/png", transparent = true }) {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    FORMAT: format,
    TRANSPARENT: transparent ? "TRUE" : "FALSE",
    LAYERS: layer,
    SRS: "EPSG:4326",
    STYLES: "",
    WIDTH: Math.round(width),
    HEIGHT: Math.round(height),
    BBOX: region.bbox.join(","),
    TIME: date
  });

  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${params.toString()}`;
}

function monthDate(monthIndex, year = 2024) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function drawMap({ selector, date, region, mainLayer, title, baseLayer = null, overlayLayer = null }) {
  const { width, height } = svgSize(selector);
  clear(selector);

  const svg = d3.select(selector).attr("viewBox", `0 0 ${width} ${height}`);
  const margin = { top: 16, right: 16, bottom: 58, left: 16 };
  const mapW = width - margin.left - margin.right;
  const mapH = height - margin.top - margin.bottom;

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 12)
    .attr("fill", "#edf2ef");

  if (baseLayer) {
    svg.append("image")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", mapW)
      .attr("height", mapH)
      .attr("preserveAspectRatio", "none")
      .attr("href", wmsUrl({
        layer: baseLayer,
        date,
        region,
        width: mapW,
        height: mapH,
        format: "image/jpeg",
        transparent: false
      }));
  }

  svg.append("image")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("preserveAspectRatio", "none")
    .attr("opacity", baseLayer ? 0.9 : 1)
    .attr("href", wmsUrl({
      layer: mainLayer,
      date,
      region,
      width: mapW,
      height: mapH,
      format: mainLayer === layers.trueColor ? "image/jpeg" : "image/png",
      transparent: mainLayer !== layers.trueColor
    }));

  if (overlayLayer) {
    svg.append("image")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", mapW)
      .attr("height", mapH)
      .attr("preserveAspectRatio", "none")
      .attr("href", wmsUrl({
        layer: overlayLayer,
        date,
        region,
        width: mapW,
        height: mapH,
        transparent: true
      }));
  }

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 12)
    .attr("fill", "transparent")
    .attr("stroke", "#d9ded7")
    .on("mousemove", (event) => showTip(event, `
      <strong>${title}</strong><br>
      ${layerLabels[mainLayer]}<br>
      Date: ${date}<br>
      Region: ${region.label}<br>
      BBOX: ${region.bbox.join(", ")}
    `))
    .on("mouseleave", hideTip);

  svg.append("text")
    .attr("class", "map-label")
    .attr("x", margin.left)
    .attr("y", height - 34)
    .text(`${region.label}: ${region.note}`);

  svg.append("text")
    .attr("class", "map-label muted")
    .attr("x", margin.left)
    .attr("y", height - 13)
    .text(`NASA GIBS WMS · layer=${mainLayer} · time=${date}`);
}

function renderMiniCards({ selector, region, dates, layer, baseLayer = null, overlayLayer = null }) {
  const root = d3.select(selector);
  root.selectAll("*").remove();

  const cards = root.selectAll(".mini-card")
    .data(dates)
    .join("div")
    .attr("class", "mini-card");

  cards.append("div")
    .attr("class", "mini-img-wrap")
    .each(function(d) {
      const wrap = d3.select(this);
      if (baseLayer) {
        wrap.append("img")
          .attr("alt", `${baseLayer} ${d.label}`)
          .attr("src", wmsUrl({ layer: baseLayer, date: d.date, region, width: 430, height: 250, format: "image/jpeg", transparent: false }));
      }

      wrap.append("img")
        .attr("class", baseLayer || overlayLayer ? "overlay-img" : null)
        .attr("alt", `${layer} ${d.label}`)
        .attr("src", wmsUrl({
          layer,
          date: d.date,
          region,
          width: 430,
          height: 250,
          format: layer === layers.trueColor ? "image/jpeg" : "image/png",
          transparent: layer !== layers.trueColor
        }))
        .on("error", function() {
          d3.select(this.parentNode).append("div").attr("class", "image-error").text("Layer did not load for this date.");
        });

      if (overlayLayer) {
        wrap.append("img")
          .attr("class", "overlay-img")
          .attr("alt", `${overlayLayer} ${d.label}`)
          .attr("src", wmsUrl({ layer: overlayLayer, date: d.date, region, width: 430, height: 250, transparent: true }));
      }
    });

  cards.append("p")
    .html(d => `<strong>${d.label}</strong><br>${d.date}`);
}

function renderNdvi() {
  const month = +d3.select("#ndvi-month").property("value");
  const region = selectedRegion("#ndvi-region");
  const date = monthDate(month);
  d3.select("#ndvi-month-label").text(months[month]);

  drawMap({
    selector: "#ndvi-map",
    date,
    region,
    mainLayer: layers.ndvi,
    title: "Selected-month MODIS NDVI"
  });

  renderMiniCards({
    selector: "#ndvi-small-multiples",
    region,
    layer: layers.ndvi,
    dates: [
      { label: "Winter", date: "2024-01-01" },
      { label: "Spring", date: "2024-04-01" },
      { label: "Summer", date: "2024-07-01" },
      { label: "Fall", date: "2024-10-01" }
    ]
  });
}

function renderFires() {
  const date = d3.select("#fire-date").property("value");
  const region = selectedRegion("#fire-region");
  const showBase = d3.select("#fire-base-toggle").property("checked");

  drawMap({
    selector: "#fire-map",
    date,
    region,
    mainLayer: showBase ? layers.fires : layers.fires,
    baseLayer: showBase ? layers.trueColor : null,
    title: "MODIS active fire detections"
  });

  const selected = new Date(`${date}T00:00:00`);
  const before = d3.timeDay.offset(selected, -14);
  const after = d3.timeDay.offset(selected, 14);
  const fmt = d3.timeFormat("%Y-%m-%d");

  renderMiniCards({
    selector: "#fire-comparison",
    region,
    layer: layers.fires,
    baseLayer: layers.trueColor,
    dates: [
      { label: "Two weeks before", date: fmt(before) },
      { label: "Selected date", date },
      { label: "Two weeks after", date: fmt(after) }
    ]
  });
}

function renderTemperature() {
  const date = d3.select("#temp-date").property("value");
  const region = selectedRegion("#temp-region");

  drawMap({
    selector: "#temp-map",
    date,
    region,
    mainLayer: layers.lst,
    title: "MODIS land surface temperature"
  });

  renderMiniCards({
    selector: "#temp-small-multiples",
    region,
    layer: layers.lst,
    dates: [
      { label: "January", date: "2024-01-15" },
      { label: "April", date: "2024-04-15" },
      { label: "July", date: "2024-07-15" },
      { label: "October", date: "2024-10-15" }
    ]
  });
}

function setupRegionMenus() {
  ["#ndvi-region", "#fire-region", "#temp-region"].forEach(selector => {
    d3.select(selector)
      .selectAll("option")
      .data(regions)
      .join("option")
      .attr("value", d => d.id)
      .text(d => d.label);
  });

  d3.select("#ndvi-region").property("value", "amazon");
  d3.select("#fire-region").property("value", "california");
  d3.select("#temp-region").property("value", "india");
}

function setupTabs() {
  d3.selectAll(".tab").on("click", function() {
    const id = this.dataset.view;
    d3.selectAll(".tab").classed("is-active", false);
    d3.select(this).classed("is-active", true);
    d3.selectAll(".view").classed("is-active", false);
    d3.select(`#${id}`).classed("is-active", true);
    renderVisible();
  });
}

function setupControls() {
  d3.select("#ndvi-month").on("input", renderNdvi);
  d3.select("#ndvi-region").on("change", renderNdvi);
  d3.select("#fire-date").on("change", renderFires);
  d3.select("#fire-region").on("change", renderFires);
  d3.select("#fire-base-toggle").on("change", renderFires);
  d3.select("#temp-date").on("change", renderTemperature);
  d3.select("#temp-region").on("change", renderTemperature);
}

function renderVisible() {
  const active = d3.select(".view.is-active").attr("id");
  if (active === "greenness") renderNdvi();
  if (active === "fires") renderFires();
  if (active === "temperature") renderTemperature();
}

function renderAll() {
  renderNdvi();
  renderFires();
  renderTemperature();
}

setupRegionMenus();
setupTabs();
setupControls();
renderAll();
window.addEventListener("resize", renderVisible);
