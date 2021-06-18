/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mesh, feature } from "topojson-client";
import * as d3 from "d3";
import * as d3g from "d3-geo";
import * as us from "us-atlas/counties-albers-10m.json";

export const mapBounds = {
  width: 975,
  height: 610,
  margin: 30,
};

const path = d3.geoPath();

const colorScaleVaccine = buildVaccineColorScale();
const colorScaleIntent = buildIntentColorScale();
const colorScaleSafety = buildSafetyColorScale();

let mapSvg;
let mapZoom;
let latestCountyData;

function buildVaccineColorScale() {
  return d3
    .scaleThreshold()
    .domain([7, 14, 21, 28, 35, 42])
    .range([
      "#f7fbff",
      "#dae8f6",
      "#b9d5ea",
      "#85bcdc",
      "#509bcb",
      "#2676b8",
      "#084594",
    ]);
}

function buildIntentColorScale() {
  return d3
    .scaleThreshold()
    .domain([3, 6, 9, 12, 15, 18])
    .range([
      "#fff5eb",
      "#fee2c7",
      "#fdc590",
      "#fd9e53",
      "#f57521",
      "#dd4d04",
      "#8c2d04",
    ]);
}

function buildSafetyColorScale() {
  return d3
    .scaleThreshold()
    .domain([1.5, 2.8, 4.1, 5.4, 6.7, 8])
    .range([
      "#fff7f3",
      "#fddcd8",
      "#fbb8bc",
      "#f984ab",
      "#e6459a",
      "#b60982",
      "#7a0177",
    ]);
}

function isInMapCallout(event) {
  let elem = document.elementFromPoint(event.clientX, event.clientY);
  if (elem && elem.id == "map-callout") {
    return true;
  } else {
    return false;
  }
}

function drawLegend(color) {
  const margin = 20;
  const height = 20;
  const blockWidth = 40;
  const labelWidth = 140;
  const width = blockWidth * color.range().length;

  d3.select(".mapLegend").selectAll("*").remove();

  const svg = d3
    .select(".mapLegend")
    .append("svg")
    .attr("width", width + margin + margin + labelWidth)
    .attr("height", height + margin + margin)
    .attr(
      "viewBox",
      `${-margin} 0 ${width + margin + margin + labelWidth} ${height + margin}`
    )
    .style("overflow", "visible");

  svg
    .append("g")
    .selectAll("rect")
    .data(color.range())
    .join("rect")
    .attr("x", (d, i) => labelWidth + i * blockWidth)
    .attr("y", height + margin)
    .attr("width", 40)
    .attr("height", 20)
    .attr("fill", (d, i) => d);

  svg
    .append("g")
    .selectAll("text")
    .data(color.domain())
    .join("text")
    .attr("x", (d, i) => labelWidth + (i + 1) * blockWidth)
    .attr("y", height + margin - 5)
    .attr("text-anchor", "middle")
    .attr("class", "mapTrendRange")
    .text((d, i) => Math.round(d));

  svg
    .append("g")
    .append("text")
    .attr("x", 0)
    .attr("y", height + margin + margin - 10)
    .attr("alignment-baseline", "central")
    .attr("class", "mapTrendRange")
    .text("Relative query volume");

  svg
    .append("g")
    .append("text")
    .attr("x", width + labelWidth)
    .attr("y", height + margin + margin - 10)
    .attr("alignment-baseline", "central")
    .attr("class", "mapLegendInfo material-icons")
    .text("info_outline");
}

export function setMapData(countryData) {
  latestCountyData = countryData;
}

export function setMapTrend(trend) {
  let accessor;
  let colorScale;

  switch (trend) {
    case "vaccination":
      accessor = (d) => (d ? d.snf_covid19_vaccination : 0);
      colorScale = colorScaleVaccine;
      break;
    case "intent":
      accessor = (d) => (d ? d.snf_vaccination_intent : 0);
      colorScale = colorScaleIntent;
      break;
    case "safety":
      accessor = (d) => (d ? d.snf_safety_side_effects : 0);
      colorScale = colorScaleSafety;
      break;
    default:
      console.log(`Unknown trend: ${trend} set on map`);
      return;
  }

  d3.select("#county")
    .selectAll("path")
    .join("path")
    .attr("fill", function (d) {
      let id = this.id.slice(5, 10);
      let data = latestCountyData.get(id);
      if (data) {
        if (accessor(data) === 0) {
          return "transparent";
        } else {
          return colorScale(accessor(data));
        }
      } else {
        return "transparent";
      }
    });
  drawLegend(colorScale);
}

function resetZoom() {
  mapSvg.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity);
}

function resetOnClickHandlers() {
  mapSvg
    .select("#state")
    .selectAll("path")
    .join("path")
    .attr("fill", "transparent");
  mapSvg
    .select("#county")
    .on("mouseleave", null)
    .on("mouseenter", null)
    .on("mouseover", null);
}

function zoomToBounds(d) {
  const [[x0, y0], [x1, y1]] = path.bounds(d);
  mapSvg
    .transition()
    .duration(750)
    .call(
      mapZoom.transform,
      d3.zoomIdentity
        .translate(mapBounds.width / 2, mapBounds.height / 2)
        .scale(
          Math.min(
            25,
            0.95 /
              Math.max(
                (x1 - x0) / mapBounds.width,
                (y1 - y0) / mapBounds.height
              )
          )
        )
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
      d3.pointer(event, mapSvg.node())
    );
}

export function setSelectedCounty(fipsCode) {
  const stateCode = fipsCode.slice(0, 2);
  resetOnClickHandlers();
  mapSvg.select("#state").select(`#fips-${stateCode}`).attr("fill", "none");

  //TODO: navigate to next level of hierachy, for now reset
  mapSvg
    .select("#county")
    .select(`#fips-${fipsCode}`)
    .on("click", resetZoomOnClickHandler);

  const d = mapSvg.select("#county").select(`#fips-${fipsCode}`).datum();

  zoomToBounds(d);
}

export function setSelectedState(fipsCode) {
  mapSvg
    .select("#county")
    .selectAll(`.state-${fipsCode}`)
    .on("click", countySelectionOnClickHandler)
    .on("mouseenter", showMapCallout)
    .on("mouseleave", hideMapCallout)
    .on("mousemove", moveMapCallout);

  const d = mapSvg
    .select("#state")
    .select(`path#fips-${fipsCode}`)
    .attr("fill", "none")
    .datum();
  zoomToBounds(d);
}

function stateSelectionOnClickHandler(event, d) {
  const fipsCode = this.id.slice(5, 7);
  setSelectedState(fipsCode);
}

function countySelectionOnClickHandler(event, d) {
  const fipsCode = this.id.slice(5, 10);
  setSelectedCounty(fipsCode);
}

function resetZoomOnClickHandler(event, d) {
  resetOnClickHandlers();
  resetZoom();
}

function drawMapCalloutInfo(fipsCode) {
  const height = 20;
  const width = 20;
  const margin = 10;

  const trendsLabels = [
    "Covid-19 Vaccination",
    "Vaccination intent",
    "Safety and Side-effects",
  ];
  const trends = latestCountyData.get(fipsCode);
  let values;
  let colors;
  if (trends) {
    values = [
      trends.snf_covid19_vaccination,
      trends.snf_vaccination_intent,
      trends.snf_safety_side_effects,
    ];
    colors = [
      colorScaleVaccine(trends.snf_covid19_vaccination),
      colorScaleIntent(trends.snf_vaccination_intent),
      colorScaleSafety(trends.snf_safety_side_effects),
    ];
  } else {
    values = ["None", "None", "None"];
    colors = ["transparent", "transparent", "transparent"];
  }
  d3.select("svg#map-callout-info").select("g").remove();
  const g = d3
    .select("svg#map-callout-info")
    .attr(
      "height",
      height * trendsLabels.length + margin * (trendsLabels.length - 1)
    )
    .append("g");

  trendsLabels.forEach((e, i) => {
    const row = g.append("g");
    row
      .append("rect")
      .attr("x", 0)
      .attr("y", i * (height + margin))
      .attr("width", width)
      .attr("height", height)
      .attr("fill", colors[i]);
    row
      .append("text")
      .attr("x", width + margin)
      .attr("y", i * (height + margin) + 10)
      .attr("class", "map-callout-text")
      .attr("alignment-baseline", "central")
      .text(e);
    row
      .append("text")
      .attr("x", 200)
      .attr("y", i * (height + margin) + 10)
      .attr("class", "map-callout-text")
      .attr("text-anchor", "end")
      .attr("alignment-baseline", "central")
      .text(Math.round(values[i]));
  });
}

function moveMapCallout(event, d) {
  if (isInMapCallout(event)) {
    return;
  }
  let callout = d3.select("div#map-callout");
  let left = parseInt(callout.style("left"), 10);
  let top = parseInt(callout.style("top"), 10);

  let dist = Math.sqrt(
    Math.pow(left - event.pageX, 2) + Math.pow(top - event.pageY, 2)
  );
  if (dist > 45.0) {
    callout
      .style("left", event.pageX + 5 + "px")
      .style("top", event.pageY + 5 + "px");
  }
}

function showMapCallout(event, d) {
  if (isInMapCallout(event)) {
    return;
  }

  let callout = d3.select("div#map-callout");
  if (event.target.id.length == 10) {
    const fipsCode = event.target.id.slice(5, 11);
    callout.select("#map-callout-title").text(d.properties.name);
    drawMapCalloutInfo(fipsCode);
    callout
      .style("left", event.pageX + 5 + "px")
      .style("top", event.pageY + 5 + "px")
      .transition()
      .duration(500)
      .style("display", "block");
  }
}

function hideMapCallout(event, d) {
  if (isInMapCallout(event)) {
    return;
  }

  d3.select("div#map-callout")
    .transition()
    .duration(500)
    .style("display", "none");
}

export function drawMap() {
  mapSvg = d3
    .select(".map")
    .append("svg")
    .attr("viewBox", [
      -mapBounds.margin,
      0,
      mapBounds.width + mapBounds.margin,
      mapBounds.height + mapBounds.margin,
    ])
    .style("margin-top", "15px");

  const g = mapSvg.append("g").attr("id", "transformer");
  // keep in inverse order
  g.append("g").attr("id", "zip");
  g.append("g").attr("id", "county");
  g.append("g").attr("id", "state");

  d3.select("#county")
    .selectAll("path")
    .data(feature(us, us.objects.counties).features)
    .join("path")
    .attr("id", (d) => `fips-${d.id}`)
    .attr("class", (d) => `county state-${d.id.slice(0, 2)}`)
    .attr("d", path)
    .attr("fill", "transparent")
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .attr("vector-effect", "non-scaling-stroke");

  d3.select("#state")
    .selectAll("path")
    .data(feature(us, us.objects.states).features)
    .join("path")
    .attr("id", (d) => {
      return `fips-${d.id}`;
    })
    .attr("class", "state")
    .attr("d", path)
    .attr("fill", "transparent")
    .attr("stroke", "black")
    .attr("stroke-width", 0.5)
    .attr("vector-effect", "non-scaling-stroke")
    .on("click", stateSelectionOnClickHandler);

  mapZoom = d3.zoom().scaleExtent([1, 100]).on("zoom", zoomHandler);
  mapSvg.call(mapZoom);
}

function zoomHandler({ transform }) {
  d3.select("#transformer").attr("transform", transform);
}
