const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const regions = [
  { id: "amazon", label: "Amazon Basin", bbox: [-80, -20, -45, 8], note: "dense tropical forest and strong year-round greenness" },
  { id: "california", label: "California", bbox: [-125, 31, -113, 43], note: "dry-season vegetation change and wildfire risk" },
  { id: "india", label: "India", bbox: [66, 5, 98, 36], note: "monsoon-linked greening and high pre-monsoon heat" },
  { id: "australia", label: "Australia", bbox: [112, -44, 154, -10], note: "drylands, seasonal heat, and fire activity" },
  { id: "sahel", label: "Sahel", bbox: [-18, 8, 38, 22], note: "semi-arid landscape with seasonal green-up" },
  { id: "global", label: "Global land view", bbox: [-180, -60, 180, 80], note: "broad overview of global MODIS patterns" }
];

const layers = {
  trueColor: "MODIS_Terra_CorrectedReflectance_TrueColor",
  ndvi: "MODIS_Terra_NDVI_8Day",
  fires: "MODIS_Fires_All",
  temperature: "MODIS_Terra_Land_Surface_Temp_Day"
};

const layerText = {
  [layers.trueColor]: "MODIS Terra corrected reflectance true color",
  [layers.ndvi]: "MODIS Terra NDVI 8-Day",
  [layers.fires]: "MODIS active fire detections",
  [layers.temperature]: "MODIS Terra daytime land surface temperature"
};

function d3Ready() {
  if (!window.d3) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="error-banner"><strong>D3 did not load.</strong> Check your internet connection or replace the CDN script with a local d3.v7.min.js file.</div>`
    );
    return false;
  }
  return true;
}

function selectedRegion() {
  const id = d3.select("#region-select").property("value");
  return regions.find((d) => d.id === id) || regions[0];
}

function monthDate(monthIndex, year = 2024) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
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

function svgBox(selector) {
  const node = document.querySelector(selector);
  const width = Math.max(640, node.clientWidth || 840);
  const height = Math.max(390, node.clientHeight || 440);
  return { width, height };
}

function showTip(event, html) {
  d3.select("#tooltip")
    .attr("aria-hidden", "false")
    .style("opacity", 1)
    .html(html)
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 14}px`);
}

function hideTip() {
  d3.select("#tooltip").attr("aria-hidden", "true").style("opacity", 0);
}

function drawWmsMap({ selector, region, date, layer, title, baseLayer = null, overlayLayer = null }) {
  const { width, height } = svgBox(selector);
  const svg = d3.select(selector).attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();

  const margin = { top: 18, right: 18, bottom: 62, left: 18 };
  const mapW = width - margin.left - margin.right;
  const mapH = height - margin.top - margin.bottom;

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 16)
    .attr("fill", "#eef3ef");

  if (baseLayer) {
    svg.append("image")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", mapW)
      .attr("height", mapH)
      .attr("preserveAspectRatio", "none")
      .attr("href", wmsUrl({ layer: baseLayer, date, region, width: mapW, height: mapH, format: "image/jpeg", transparent: false }));
  }

  svg.append("image")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("preserveAspectRatio", "none")
    .attr("opacity", baseLayer ? 0.95 : 1)
    .attr("href", wmsUrl({
      layer,
      date,
      region,
      width: mapW,
      height: mapH,
      format: layer === layers.trueColor ? "image/jpeg" : "image/png",
      transparent: layer !== layers.trueColor
    }));

  if (overlayLayer) {
    svg.append("image")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", mapW)
      .attr("height", mapH)
      .attr("preserveAspectRatio", "none")
      .attr("href", wmsUrl({ layer: overlayLayer, date, region, width: mapW, height: mapH, transparent: true }));
  }

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", mapW)
    .attr("height", mapH)
    .attr("rx", 16)
    .attr("fill", "transparent")
    .attr("stroke", "#d8ded6")
    .attr("stroke-width", 1)
    .on("mousemove", (event) => {
      showTip(event, `<strong>${title}</strong><br>${layerText[layer]}<br>Date: ${date}<br>Region: ${region.label}<br>BBOX: ${region.bbox.join(", ")}`);
    })
    .on("mouseleave", hideTip);

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", height - 38)
    .attr("class", "svg-label")
    .text(`${region.label}: ${region.note}`);

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", height - 16)
    .attr("class", "svg-source")
    .text(`NASA GIBS WMS · layer=${layer} · time=${date}`);
}

function imagePanel({ date, label, region, layer, baseLayer = null, overlayLayer = null }) {
  const wrapper = document.createElement("div");
  wrapper.className = "mini-card";

  const imgWrap = document.createElement("div");
  imgWrap.className = "mini-image-wrap";

  function addImg(src, className, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    if (className) img.className = className;
    img.onerror = () => {
      const msg = document.createElement("div");
      msg.className = "img-fallback";
      msg.textContent = "NASA layer did not load for this date. Try another date/region.";
      imgWrap.appendChild(msg);
    };
    imgWrap.appendChild(img);
  }

  if (baseLayer) {
    addImg(wmsUrl({ layer: baseLayer, date, region, width: 430, height: 245, format: "image/jpeg", transparent: false }), "", `${baseLayer} ${label}`);
  }

  addImg(wmsUrl({
    layer,
    date,
    region,
    width: 430,
    height: 245,
    format: layer === layers.trueColor ? "image/jpeg" : "image/png",
    transparent: layer !== layers.trueColor
  }), baseLayer ? "overlay-img" : "", `${layer} ${label}`);

  if (overlayLayer) {
    addImg(wmsUrl({ layer: overlayLayer, date, region, width: 430, height: 245, transparent: true }), "overlay-img", `${overlayLayer} ${label}`);
  }

  const cap = document.createElement("p");
  cap.innerHTML = `<strong>${label}</strong><br>${date}`;

  wrapper.appendChild(imgWrap);
  wrapper.appendChild(cap);
  return wrapper;
}

function renderPanels(selector, panels) {
  const root = document.querySelector(selector);
  root.replaceChildren(...panels);
}

function renderNdvi() {
  const region = selectedRegion();
  const monthIndex = +d3.select("#ndvi-month").property("value");
  const date = monthDate(monthIndex);
  d3.select("#ndvi-month-label").text(months[monthIndex]);

  drawWmsMap({
    selector: "#ndvi-main",
    region,
    date,
    layer: layers.ndvi,
    title: "Selected-month MODIS NDVI"
  });

  d3.select("#ndvi-caption").html(
    `Selected view: <strong>${region.label}</strong> in <strong>${months[monthIndex]} 2024</strong>. Darker greens generally represent denser vegetation; tan/black areas indicate sparse or missing vegetation signal.`
  );

  const dates = [
    { label: "January", date: "2024-01-01" },
    { label: "April", date: "2024-04-01" },
    { label: "July", date: "2024-07-01" },
    { label: "October", date: "2024-10-01" }
  ];
  renderPanels("#ndvi-seasons", dates.map((d) => imagePanel({ ...d, region, layer: layers.ndvi })));
}

function renderFires() {
  const region = selectedRegion();
  const date = d3.select("#fire-date").property("value");

  drawWmsMap({
    selector: "#fire-main",
    region,
    date,
    layer: layers.trueColor,
    overlayLayer: layers.fires,
    title: "MODIS fire detections on true-color imagery"
  });

  d3.select("#fire-caption").html(
    `Selected view: <strong>${region.label}</strong> on <strong>${date}</strong>. Fire detections are shown as an overlay above MODIS true-color imagery.`
  );

  const selected = new Date(`${date}T00:00:00`);
  const before = d3.timeDay.offset(selected, -14);
  const after = d3.timeDay.offset(selected, 14);
  const fmt = d3.timeFormat("%Y-%m-%d");
  const dates = [
    { label: "Two weeks before", date: fmt(before) },
    { label: "Selected date", date },
    { label: "Two weeks after", date: fmt(after) }
  ];

  renderPanels("#fire-sequence", dates.map((d) => imagePanel({
    ...d,
    region,
    layer: layers.trueColor,
    overlayLayer: layers.fires
  })));
}

function renderTemperature() {
  const region = selectedRegion();
  const date = d3.select("#temp-date").property("value");

  drawWmsMap({
    selector: "#temp-main",
    region,
    date,
    layer: layers.temperature,
    title: "MODIS land surface temperature"
  });

  d3.select("#temp-caption").html(
    `Selected view: <strong>${region.label}</strong> on <strong>${date}</strong>. This measures surface heat, so bare land often appears hotter than vegetated areas.`
  );

  const dates = [
    { label: "January", date: "2024-01-15" },
    { label: "April", date: "2024-04-15" },
    { label: "July", date: "2024-07-15" },
    { label: "October", date: "2024-10-15" }
  ];
  renderPanels("#temp-seasons", dates.map((d) => imagePanel({ ...d, region, layer: layers.temperature })));
}

function renderAll() {
  renderNdvi();
  renderFires();
  renderTemperature();
}

function setup() {
  if (!d3Ready()) return;

  d3.select("#region-select")
    .selectAll("option")
    .data(regions)
    .join("option")
    .attr("value", (d) => d.id)
    .text((d) => d.label);

  d3.select("#region-select").property("value", "california");

  d3.select("#region-select").on("change", renderAll);
  d3.select("#ndvi-month").on("input", renderNdvi);
  d3.select("#fire-date").on("change", renderFires);
  d3.select("#temp-date").on("change", renderTemperature);

  renderAll();
  window.addEventListener("resize", () => requestAnimationFrame(renderAll));
}

setup();
