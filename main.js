const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const showTip = (event, html) => {
  tooltip
    .style("opacity", 1)
    .html(html)
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 14}px`);
};

const hideTip = () => tooltip.style("opacity", 0);

const svgSize = (selector) => {
  const node = document.querySelector(selector);
  const width = Math.max(320, node.clientWidth || 700);
  const height = Math.max(320, node.clientHeight || 390);
  return { width, height };
};

const clear = (selector) => d3.select(selector).selectAll("*").remove();

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

function seasonalNdvi(lat, lon, month, biome) {
  const northSeason = Math.max(0, Math.sin(((month - 2) / 12) * Math.PI * 2));
  const southSeason = Math.max(0, Math.sin(((month + 4) / 12) * Math.PI * 2));
  const season = lat >= 0 ? northSeason : southSeason;
  const tropicWet = 0.5 + 0.25 * Math.sin(((month + lon / 45) / 12) * Math.PI * 2);

  const profiles = {
    tropical: 0.72 + 0.12 * tropicWet,
    temperate: 0.2 + 0.58 * season,
    boreal: 0.12 + 0.66 * Math.pow(season, 1.8),
    grassland: 0.16 + 0.42 * season,
    desert: 0.06 + 0.08 * season,
  };

  const noise = 0.035 * Math.sin(lat * 0.7 + lon * 0.13);
  return Math.max(0.03, Math.min(0.9, profiles[biome] + noise));
}

function biomeFor(lat, lon) {
  const absLat = Math.abs(lat);
  if (absLat < 18) return "tropical";
  if (absLat > 54) return "boreal";
  if ((lon > -125 && lon < -90 && lat > 20 && lat < 42) || (lon > 10 && lon < 55 && lat > 15 && lat < 35)) {
    return "desert";
  }
  if ((lon > -110 && lon < -70) || (lon > 35 && lon < 115)) return "grassland";
  return "temperate";
}

const ndviCells = d3.range(-72, 73, 8).flatMap((lat) =>
  d3.range(-176, 177, 8).map((lon) => ({ lat, lon, biome: biomeFor(lat, lon) })),
);

function renderNdviMap() {
  const month = +d3.select("#month-slider").property("value");
  const filter = d3.select("#biome-select").property("value");
  d3.select("#month-label").text(months[month]);

  const { width, height } = svgSize("#ndvi-map");
  clear("#ndvi-map");
  const svg = d3.select("#ndvi-map").attr("viewBox", `0 0 ${width} ${height}`);
  const margin = { top: 12, right: 18, bottom: 36, left: 38 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const x = d3.scaleLinear().domain([-180, 180]).range([margin.left, margin.left + innerW]);
  const y = d3.scaleLinear().domain([80, -80]).range([margin.top, margin.top + innerH]);
  const color = d3.scaleSequential(d3.interpolateYlGn).domain([0.02, 0.9]);

  svg
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("rx", 8)
    .attr("fill", "#eaf0f2");

  svg
    .append("g")
    .selectAll("rect")
    .data(ndviCells)
    .join("rect")
    .attr("x", (d) => x(d.lon - 3.8))
    .attr("y", (d) => y(d.lat + 3.8))
    .attr("width", Math.max(2, x(4) - x(-4) - 1))
    .attr("height", Math.max(2, y(-4) - y(4) - 1))
    .attr("rx", 2)
    .attr("fill", (d) => color(seasonalNdvi(d.lat, d.lon, month, d.biome)))
    .attr("opacity", (d) => (filter === "all" || d.biome === filter ? 1 : 0.18))
    .on("mousemove", (event, d) => {
      const ndvi = seasonalNdvi(d.lat, d.lon, month, d.biome);
      showTip(event, `<strong>${d.biome}</strong><br>${months[month]} NDVI: ${ndvi.toFixed(2)}<br>Lat ${d.lat}, Lon ${d.lon}`);
    })
    .on("mouseleave", hideTip);

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${margin.top + innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${d}°`));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}°`));

  drawLegend(svg, width - 190, height - 28, 150, color, "NDVI");
}

function renderNdviChart() {
  const filter = d3.select("#biome-select").property("value");
  const chosen = filter === "all" ? ["tropical", "temperate", "boreal", "grassland", "desert"] : [filter];
  const series = chosen.map((biome) => ({
    biome,
    values: months.map((_, month) => ({ month, ndvi: seasonalNdvi(biome === "tropical" ? 0 : biome === "boreal" ? 62 : 38, 0, month, biome) })),
  }));

  const { width, height } = svgSize("#ndvi-chart");
  clear("#ndvi-chart");
  const svg = d3.select("#ndvi-chart").attr("viewBox", `0 0 ${width} ${height}`);
  const margin = { top: 20, right: 104, bottom: 52, left: 50 };
  const x = d3.scalePoint().domain(d3.range(12)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, 0.9]).nice().range([height - margin.bottom, margin.top]);
  const color = d3.scaleOrdinal().domain(["tropical", "temperate", "boreal", "grassland", "desert"]).range(["#0b7a53", "#54a24b", "#2b7bba", "#c9a227", "#d9822b"]);
  const line = d3
    .line()
    .x((d) => x(d.month))
    .y((d) => y(d.ndvi))
    .curve(d3.curveCatmullRom.alpha(0.5));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat((d) => months[d].slice(0, 3)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

  svg
    .append("g")
    .selectAll("path")
    .data(series)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d) => color(d.biome))
    .attr("stroke-width", 3)
    .attr("d", (d) => line(d.values));

  svg
    .append("g")
    .selectAll("circle")
    .data(series.flatMap((s) => s.values.map((v) => ({ ...v, biome: s.biome }))))
    .join("circle")
    .attr("cx", (d) => x(d.month))
    .attr("cy", (d) => y(d.ndvi))
    .attr("r", 4)
    .attr("fill", (d) => color(d.biome))
    .on("mousemove", (event, d) => showTip(event, `<strong>${d.biome}</strong><br>${months[d.month]} NDVI: ${d.ndvi.toFixed(2)}`))
    .on("mouseleave", hideTip);

  const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${width - margin.right + 18},${margin.top + 6})`);
  legend
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("transform", (_, i) => `translate(0,${i * 20})`)
    .call((g) => {
      g.append("circle").attr("r", 5).attr("fill", (d) => color(d.biome));
      g.append("text").attr("x", 10).attr("dy", "0.35em").text((d) => d.biome);
    });
}

const fireStages = [
  { name: "Before fire", veg: 0.78, severity: 0.02 },
  { name: "Ignition", veg: 0.62, severity: 0.28 },
  { name: "Peak burn", veg: 0.24, severity: 0.86 },
  { name: "One season later", veg: 0.38, severity: 0.55 },
  { name: "Three years later", veg: 0.61, severity: 0.22 },
];

const fireCells = d3.range(35).flatMap((row) =>
  d3.range(45).map((col) => {
    const cx = col - 22;
    const cy = row - 17;
    const ridge = Math.sin(col / 4) * 2.2;
    const dist = Math.hypot(cx / 1.25, cy + ridge);
    return { row, col, dist, ridge };
  }),
);

function renderFireMap() {
  const stageIndex = +d3.select("#fire-slider").property("value");
  const overlay = d3.select("#severity-toggle").property("checked");
  d3.select("#fire-label").text(fireStages[stageIndex].name);

  const { width, height } = svgSize("#fire-map");
  clear("#fire-map");
  const svg = d3.select("#fire-map").attr("viewBox", `0 0 ${width} ${height}`);
  const margin = { top: 14, right: 14, bottom: 14, left: 14 };
  const cell = Math.min((width - margin.left - margin.right) / 45, (height - margin.top - margin.bottom) / 35);
  const offsetX = (width - cell * 45) / 2;
  const offsetY = (height - cell * 35) / 2;
  const land = d3.scaleSequential(d3.interpolateYlGn).domain([0.05, 0.85]);
  const burn = d3.scaleSequential(d3.interpolateOrRd).domain([0, 1]);
  const stage = fireStages[stageIndex];

  svg
    .append("g")
    .selectAll("rect")
    .data(fireCells)
    .join("rect")
    .attr("x", (d) => offsetX + d.col * cell)
    .attr("y", (d) => offsetY + d.row * cell)
    .attr("width", cell + 0.3)
    .attr("height", cell + 0.3)
    .attr("rx", 1)
    .attr("fill", (d) => {
      const localSeverity = Math.max(0, stage.severity * (1 - d.dist / 22));
      const veg = Math.max(0.03, stage.veg - localSeverity * 0.5 + 0.08 * Math.sin((d.col + d.row) / 5));
      return overlay && localSeverity > 0.08 ? burn(localSeverity) : land(veg);
    })
    .on("mousemove", (event, d) => {
      const localSeverity = Math.max(0, stage.severity * (1 - d.dist / 22));
      showTip(event, `<strong>${stage.name}</strong><br>Burn severity: ${localSeverity.toFixed(2)}<br>Vegetation index: ${(stage.veg - localSeverity * 0.5).toFixed(2)}`);
    })
    .on("mouseleave", hideTip);

  svg
    .append("path")
    .attr("d", d3.line()(d3.range(45).map((col) => [offsetX + col * cell, offsetY + (17 + Math.sin(col / 4) * 2.2) * cell])))
    .attr("fill", "none")
    .attr("stroke", "#6c7770")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4 5")
    .attr("opacity", 0.75);
}

function renderFireChart() {
  const { width, height } = svgSize("#fire-chart");
  clear("#fire-chart");
  const svg = d3.select("#fire-chart").attr("viewBox", `0 0 ${width} ${height}`);
  const margin = { top: 20, right: 20, bottom: 70, left: 50 };
  const x = d3.scalePoint().domain(d3.range(fireStages.length)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
  const line = (key) =>
    d3
      .line()
      .x((_, i) => x(i))
      .y((d) => y(d[key]))
      .curve(d3.curveMonotoneX);

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat((d) => fireStages[d].name))
    .selectAll("text")
    .attr("transform", "rotate(-28)")
    .style("text-anchor", "end");
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));

  [
    ["veg", "#1d7663", "Vegetation"],
    ["severity", "#b14532", "Burn severity"],
  ].forEach(([key, color, label]) => {
    svg.append("path").datum(fireStages).attr("fill", "none").attr("stroke", color).attr("stroke-width", 3).attr("d", line(key));
    svg
      .append("text")
      .attr("class", "label")
      .attr("x", width - margin.right - 96)
      .attr("y", y(fireStages.at(-1)[key]) - 8)
      .attr("fill", color)
      .text(label);
  });
}

const locations = [
  {
    id: "amazon",
    label: "Amazon forest edge",
    metric: "Forest cover index",
    color: "#1d7663",
    start: 0.82,
    slope: -0.012,
    pattern: "deforestation",
  },
  {
    id: "arctic",
    label: "Arctic tundra",
    metric: "Summer snow/ice index",
    color: "#3269a8",
    start: 0.68,
    slope: -0.018,
    pattern: "ice",
  },
  {
    id: "california",
    label: "California fire belt",
    metric: "Healthy vegetation index",
    color: "#b14532",
    start: 0.72,
    slope: -0.004,
    pattern: "fire",
  },
  {
    id: "himalaya",
    label: "Himalayan snowpack",
    metric: "Snow cover index",
    color: "#6c77b8",
    start: 0.76,
    slope: -0.009,
    pattern: "snow",
  },
];

const years = d3.range(2002, 2025);

function valueFor(location, year) {
  const t = year - 2002;
  const wave = 0.035 * Math.sin(t * 0.9 + location.id.length);
  const eventDip = location.id === "california" && [2007, 2013, 2018, 2020].includes(year) ? -0.16 : 0;
  return Math.max(0.12, Math.min(0.92, location.start + location.slope * t + wave + eventDip));
}

function renderChangeMap() {
  const year = +d3.select("#year-slider").property("value");
  const location = locations.find((d) => d.id === d3.select("#location-select").property("value")) || locations[0];
  d3.select("#year-label").text(year);

  const { width, height } = svgSize("#change-map");
  clear("#change-map");
  const svg = d3.select("#change-map").attr("viewBox", `0 0 ${width} ${height}`);
  const value = valueFor(location, year);
  const cells = d3.range(28).flatMap((row) => d3.range(40).map((col) => ({ row, col })));
  const cell = Math.min((width - 36) / 40, (height - 70) / 28);
  const offsetX = (width - cell * 40) / 2;
  const offsetY = 40;

  const palette = {
    deforestation: d3.scaleLinear().domain([0, 1]).range(["#c79d62", "#166c49"]),
    ice: d3.scaleLinear().domain([0, 1]).range(["#526b76", "#e9f7ff"]),
    fire: d3.scaleLinear().domain([0, 1]).range(["#7f3429", "#6ca85d"]),
    snow: d3.scaleLinear().domain([0, 1]).range(["#6d756b", "#f2fbff"]),
  }[location.pattern];

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 24)
    .attr("text-anchor", "middle")
    .attr("font-weight", 760)
    .attr("fill", "#16201b")
    .text(`${location.label}, ${year}`);

  svg
    .append("g")
    .selectAll("rect")
    .data(cells)
    .join("rect")
    .attr("x", (d) => offsetX + d.col * cell)
    .attr("y", (d) => offsetY + d.row * cell)
    .attr("width", cell + 0.3)
    .attr("height", cell + 0.3)
    .attr("rx", 1)
    .attr("fill", (d) => {
      const local = Math.max(0, Math.min(1, value + 0.12 * Math.sin(d.col / 4) - 0.08 * Math.cos(d.row / 3)));
      return palette(local);
    })
    .on("mousemove", (event, d) => {
      const local = Math.max(0, Math.min(1, value + 0.12 * Math.sin(d.col / 4) - 0.08 * Math.cos(d.row / 3)));
      showTip(event, `<strong>${location.metric}</strong><br>${year}: ${local.toFixed(2)}`);
    })
    .on("mouseleave", hideTip);

  svg
    .append("text")
    .attr("class", "label")
    .attr("x", width / 2)
    .attr("y", height - 18)
    .attr("text-anchor", "middle")
    .text(`${location.metric}: ${value.toFixed(2)}`);
}

function renderChangeChart() {
  const selectedYear = +d3.select("#year-slider").property("value");
  const location = locations.find((d) => d.id === d3.select("#location-select").property("value")) || locations[0];
  const data = years.map((year) => ({ year, value: valueFor(location, year) }));

  const { width, height } = svgSize("#change-chart");
  clear("#change-chart");
  const svg = d3.select("#change-chart").attr("viewBox", `0 0 ${width} ${height}`);
  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const x = d3.scaleLinear().domain(d3.extent(years)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
  const line = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(6));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));

  svg.append("path").datum(data).attr("fill", "none").attr("stroke", location.color).attr("stroke-width", 3).attr("d", line);
  svg
    .append("line")
    .attr("x1", x(selectedYear))
    .attr("x2", x(selectedYear))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#16201b")
    .attr("stroke-dasharray", "4 5");
  svg
    .append("circle")
    .attr("cx", x(selectedYear))
    .attr("cy", y(valueFor(location, selectedYear)))
    .attr("r", 6)
    .attr("fill", "#fff")
    .attr("stroke", location.color)
    .attr("stroke-width", 3);
  svg.append("text").attr("class", "label").attr("x", margin.left).attr("y", 14).text(location.metric);
}

function drawLegend(svg, x, y, width, color, label) {
  const gradientId = `grad-${label}`;
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient").attr("id", gradientId);
  d3.range(0, 1.01, 0.1).forEach((t) => gradient.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(0.02 + t * 0.88)));
  svg.append("rect").attr("x", x).attr("y", y).attr("width", width).attr("height", 10).attr("rx", 5).attr("fill", `url(#${gradientId})`);
  svg.append("text").attr("class", "label").attr("x", x).attr("y", y - 6).text(label);
  svg.append("text").attr("class", "label").attr("x", x).attr("y", y + 26).text("low");
  svg.append("text").attr("class", "label").attr("x", x + width).attr("y", y + 26).attr("text-anchor", "end").text("high");
}

function drawLabels(svg, series, x, y, color, keyName, valueName) {
  svg
    .append("g")
    .selectAll("text")
    .data(series)
    .join("text")
    .attr("class", "label")
    .attr("x", (d) => x(11) + 8)
    .attr("y", (d) => y(d.values.at(-1)[valueName]))
    .attr("fill", (d) => color(d[keyName]))
    .text((d) => d[keyName]);
}

function setupControls() {
  d3.select("#month-slider").on("input", () => {
    renderNdviMap();
  });
  d3.select("#biome-select").on("change", () => {
    renderNdviMap();
    renderNdviChart();
  });
  d3.select("#fire-slider").on("input", renderFireMap);
  d3.select("#severity-toggle").on("change", renderFireMap);
  d3.select("#year-slider").on("input", () => {
    renderChangeMap();
    renderChangeChart();
  });
  d3.select("#location-select").on("change", () => {
    renderChangeMap();
    renderChangeChart();
  });
  d3.select("#location-select")
    .selectAll("option")
    .data(locations)
    .join("option")
    .attr("value", (d) => d.id)
    .text((d) => d.label);
}

function renderAll() {
  renderNdviMap();
  renderNdviChart();
  renderFireMap();
  renderFireChart();
  renderChangeMap();
  renderChangeChart();
}

setupTabs();
setupControls();
renderAll();
window.addEventListener("resize", renderAll);
