(function () {
  "use strict";

  // ------------------------------------------------------------------
  // CONFIG
  // ------------------------------------------------------------------

  // USGS feed past 30 days
  // "all_month.geojson" for everything
  // "2.5_month.geojson" for only 2.5+
  var FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
  var WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
  var REFRESH_MS = 5 * 60 * 1000;

  var VIEW_W = 960;
  var VIEW_H = 500;

  // ------------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------------

  var quakes = []; // { id, lon, lat, mag, place, timeMs, depth }
  var selectedId = null;
  var currentHours = 1;

  // Domain starts at 2.5 (the feed's floor) rather than 0, so the
  // realistic magnitude range actually spreads across the pixel range
  // instead of bunching up near one end.
  var radiusScale = d3.scaleSqrt().domain([2, 7]).range([3, 32]).clamp(true);
  var colorScale = d3.scaleLinear()
    .domain([2, 4, 5.5, 7])
    .range(["#38d9e8", "#facc15", "#fb923c", "#ef4444"])
    .clamp(true);

  function colorForMag(mag) {
    return colorScale(mag);
  }

  // ------------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------------

  var mapContainer = document.getElementById("map-container");
  var tooltip = document.getElementById("tooltip");
  var slider = document.getElementById("time-slider");
  var timeWindow = document.getElementById("time-window");
  var countNumber = document.getElementById("count-number");
  var presetBtns = Array.prototype.slice.call(document.querySelectorAll(".preset-btn"));
  var statusBadge = document.getElementById("status-badge");
  var statusText = document.getElementById("status-text");

  // ------------------------------------------------------------------
  // SVG / projection setup
  // ------------------------------------------------------------------

  var svg = d3.select(mapContainer).append("svg")
    .attr("viewBox", "0 0 " + VIEW_W + " " + VIEW_H)
    .attr("preserveAspectRatio", "xMidYMid meet");

  var zoomLayer = svg.append("g").attr("class", "zoom-layer");

  var projection = d3.geoNaturalEarth1().fitSize([VIEW_W, VIEW_H], { type: "Sphere" });
  var geoPath = d3.geoPath(projection);
  var graticule = d3.geoGraticule10();

  zoomLayer.append("path").datum({ type: "Sphere" }).attr("class", "sphere-outline").attr("d", geoPath);
  zoomLayer.append("path").datum(graticule).attr("class", "graticule").attr("d", geoPath);
  var landGroup = zoomLayer.append("g").attr("class", "land-group");
  var pointsGroup = zoomLayer.append("g").attr("class", "points-group");

  var currentK = 1;

  var zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [VIEW_W, VIEW_H]])
    .on("start", function () { mapContainer.classList.add("dragging"); })
    .on("zoom", function (event) {
      zoomLayer.attr("transform", event.transform);
      if (event.transform.k !== currentK) {
        currentK = event.transform.k;
        updatePointRadii();
      }
    })
    .on("end", function () { mapContainer.classList.remove("dragging"); });

  function updatePointRadii() {
    pointsGroup.selectAll("circle.quake-point")
      .attr("r", function (d) { return radiusScale(d.mag) / currentK; })
      .attr("stroke-width", function () { return 0.6 / currentK; });
  }

  svg.call(zoom);

  document.getElementById("zoom-in").addEventListener("click", function () {
    svg.transition().duration(200).call(zoom.scaleBy, 1.5);
  });
  document.getElementById("zoom-out").addEventListener("click", function () {
    svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.5);
  });

  function setStatus(mode, text) {
    statusBadge.classList.remove("live", "error");
    if (mode) statusBadge.classList.add(mode);
    statusText.textContent = text;
  }

  d3.json(WORLD_ATLAS_URL).then(function (world) {
    var countries = topojson.feature(world, world.objects.countries);
    landGroup.selectAll("path")
      .data(countries.features)
      .join("path")
      .attr("class", "land")
      .attr("d", geoPath);
  }).catch(function () {
  });

  function fetchQuakes() {
    d3.json(FEED_URL).then(function (geojson) {
      quakes = geojson.features.map(function (f) {
        var p = f.properties;
        return {
          id: f.id,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          depth: f.geometry.coordinates[2],
          mag: p.mag,
          place: p.place || "Unknown location",
          timeMs: p.time
        };
      }).filter(function (q) { return typeof q.mag === "number"; });

      quakes.sort(function (a, b) { return a.mag - b.mag; });

      buildPoints();
      updatePointRadii();
      applyTimeFilter();
      setStatus("live", "Live — updated at " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
    }).catch(function () {
      setStatus("error", "Couldn't load USGS data");
    });
  }

  fetchQuakes();
  setInterval(fetchQuakes, REFRESH_MS);

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  function buildPoints() {
    var sel = pointsGroup.selectAll("circle.quake-point")
      .data(quakes, function (d) { return d.id; });

    sel.exit().remove();

    sel.enter()
      .append("circle")
      .attr("class", "quake-point")
      .attr("cx", function (d) { var xy = projection([d.lon, d.lat]); return xy ? xy[0] : -999; })
      .attr("cy", function (d) { var xy = projection([d.lon, d.lat]); return xy ? xy[1] : -999; })
      .attr("r", function (d) { return radiusScale(d.mag); })
      .attr("fill", function (d) { return colorForMag(d.mag); })
      .on("click", function (event, d) {
        event.stopPropagation();
        selectedId = d.id;
        pointsGroup.selectAll("circle.quake-point").classed("selected", function (p) { return p.id === d.id; });
        showTooltip(event, d);
      });
  }

  function applyTimeFilter() {
    var now = Date.now();
    var cutoff = now - currentHours * 3600 * 1000;
    var freshCutoff = now - 3600 * 1000;
    var visibleCount = 0;

    pointsGroup.selectAll("circle.quake-point")
      .style("display", function (d) {
        var visible = d.timeMs >= cutoff;
        if (visible) visibleCount++;
        return visible ? null : "none";
      })
      .classed("fresh", function (d) { return d.timeMs >= freshCutoff && d.timeMs >= cutoff; });

    countNumber.textContent = visibleCount.toLocaleString("en-US");
    timeWindow.textContent = formatHours(currentHours);
  }

  function formatHours(h) {
    if (h == 1) return "hour";
    else if (h < 24) return h + " hours";
    var days = Math.round(h / 24);
    if (days == 1) return "day";
    return days + " days";
  }

  // ------------------------------------------------------------------
  // Tooltip
  // ------------------------------------------------------------------

  function showTooltip(event, d) {
    var dateStr = new Date(d.timeMs).toLocaleString("en-US", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
    });

    tooltip.innerHTML =
      '<div class="tooltip-mag-row">' +
        '<div class="tooltip-mag-badge" style="background:' + colorForMag(d.mag) + '">M' + d.mag.toFixed(1) + "</div>" +
        '<div class="tooltip-title">' + escapeHtml(d.place) + "</div>" +
      "</div>" +
      '<div class="tooltip-meta">' + dateStr + "<br>Depth: " + Math.round(d.depth) + " km</div>";

    positionTooltip(event.clientX, event.clientY);
    tooltip.classList.add("visible");
  }

  function positionTooltip(x, y) {
    var pad = 16;
    var rect = tooltip.getBoundingClientRect();
    var left = x + pad;
    var top = y + pad;
    if (left + rect.width > window.innerWidth) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight) top = y - rect.height - pad;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener("click", function () {
    selectedId = null;
    pointsGroup.selectAll("circle.quake-point").classed("selected", false);
    tooltip.classList.remove("visible");
  });

  // ------------------------------------------------------------------
  // Time controls
  // ------------------------------------------------------------------

  slider.addEventListener("input", function () {
    currentHours = Number(slider.value);
    presetBtns.forEach(function (b) { b.classList.toggle("active", Number(b.dataset.hours) === currentHours); });
    applyTimeFilter();
  });

  presetBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      currentHours = Number(btn.dataset.hours);
      slider.value = currentHours;
      presetBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
      applyTimeFilter();
    });
  });

})();