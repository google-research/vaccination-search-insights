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

import { feature } from "topojson-client";
import type { GeometryCollection } from "topojson-specification";
import {
  buildRegionCodeToPlaceIdMapping,
  fipsCodeFromElementId,
  regionOneToFipsCode,
  stateFipsCodeFromCounty,
  getUsAtlas,
} from "./geo-utils";
import * as d3 from "d3";

const path = d3.geoPath();
const colorScaleVaccine = buildVaccineColorScale();
const colorScaleIntent = buildIntentColorScale();
const colorScaleSafety = buildSafetyColorScale();

// currently resetting to the US
const resetNavigationPlaceId: string = "ChIJCzYy5IS16lQRQrfeQ5K5Oxw";

let mapSvg: d3.Selection<SVGGElement, any, any, any>;
let mapZoom;

let latestStateData;
let latestCountyData;
let selectedTrend;

let regionCodesToPlaceId;
let selectionCallback;

//
// Exports for clients
//
export const mapBounds = {
  width: 975,
  height: 610,
  margin: 30,
};

export function createMap(stateData, countyData, trend, regions, selectionFn) {
  latestCountyData = countyData;
  selectedTrend = trend;

  // US gemoetry files are keyed off of fips code, so for now
  // re-key the state data by fips code to make it easier to
  // work with
  latestStateData = new Map();
  stateData.forEach((value, key) => {
    latestStateData.set(regionOneToFipsCode.get(key), value);
  });

  regionCodesToPlaceId = buildRegionCodeToPlaceIdMapping(regions);
  selectionCallback = selectionFn;

  initializeMap();
  colorizeMap(trend);
}

export function setSelectedState(regionOneCode) {
  setSelectedStateByFipsCode(regionOneToFipsCode.get(regionOneCode));
}

export function setSelectedCounty(fipsCode) {
  activateSelectedState(stateFipsCodeFromCounty(fipsCode), false);
  activateSelectedCounty(fipsCode, true);
}

export function setMapTrend(trend) {
  selectedTrend = trend;
  colorizeMap(trend);
}

function setSelectedStateByFipsCode(fipsCode) {
  activateSelectedState(fipsCode, true);
}
//
// Map drawing routines
//
function initializeMap() {
  mapSvg = d3
    .select("#map")
    .append("svg")
    .attr("viewBox", [0, 0, mapBounds.width, mapBounds.height].join(" "))
    .classed("map-svg", true);

  const g = mapSvg.append("g").attr("id", "transformer");
  // keep in inverse order
  g.append("g").attr("id", "county");
  g.append("g").attr("id", "state");

  const topology = getUsAtlas();
  const countyFeatures = feature(
    topology,
    topology.objects.counties as GeometryCollection
  );
  const stateFeatures = feature(
    topology,
    topology.objects.states as GeometryCollection
  );

  d3.select("#county")
    .selectAll("path")
    .data(countyFeatures.features)
    .join("path")
    .attr("id", (d) => `fips-${d.id}`)
    .attr("class", (d) => `state-${stateFipsCodeFromCounty(d.id as string)}`)
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-width", 0)
    .attr("vector-effect", "non-scaling-stroke");

  d3.select("#state")
    .selectAll("path")
    .data(stateFeatures.features)
    .join("path")
    .attr("id", (d) => `fips-${d.id}`)
    .attr("class", "state")
    .attr("d", path)
    .attr("fill", "transparent")
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .attr("vector-effect", "non-scaling-stroke")
    .on("mouseenter", enterStateBoundsHandler)
    .on("mouseleave", leaveStateBoundsHandler)
    .on("mousemove", moveMapCallout)
    .on("click", stateSelectionOnClickHandler);

  mapZoom = d3.zoom().scaleExtent([1, 100]).on("zoom", zoomHandler);
  mapSvg.call(mapZoom);
}

function colorizeMap(trend) {
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
      let id = fipsCodeFromElementId((this as Element).id);
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

function zoomHandler({ transform }) {
  d3.select("#transformer").attr("transform", transform);
}

function resetZoom() {
  mapSvg.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity);
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
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    );
}

function dateRangeString(date: string): string {
  const dataPeriodStart: Date = d3.timeParse("%Y-%m-%d")(
    latestCountyData["latestDate"]
  );
  let dataPeriodEnd: Date = new Date(dataPeriodStart);
  dataPeriodEnd.setDate(dataPeriodStart.getDate() + 7);

  const formatterStart = d3.timeFormat("%b %d");
  const formatterEnd = d3.timeFormat("%b %d, %Y");

  return `${formatterStart(dataPeriodStart)} - ${formatterEnd(dataPeriodEnd)}`;
}

function drawLegend(color) {
  const margin = 20;
  const height = 20;
  const blockWidth = 40;
  const labelWidth = 60;
  const width = blockWidth * color.range().length;

  d3.select(".mapLegendContainer").selectAll("*").remove();

  const svg: d3.Selection<SVGSVGElement, any, any, any> = d3
    .select(".mapLegendContainer")
    .append("svg")
    .attr("width", width + margin + margin + labelWidth)
    .attr("height", height + margin + margin)
    .attr(
      "viewBox",
      `0 0 ${width + margin + margin + labelWidth} ${height + margin}`
    )
    .style("overflow", "visible");

  let colorRange = color.range();
  svg
    .append("g")
    .selectAll("rect")
    .data(colorRange)
    .join("rect")
    .attr("x", (d, i) => labelWidth + i * blockWidth)
    .attr("y", height + margin)
    .attr("width", 40)
    .attr("height", 20)
    .attr("fill", (d: string) => d);

  svg
    .append("g")
    .selectAll("text")
    .data(color.domain())
    .join("text")
    .attr("x", (d, i) => labelWidth + (i + 1) * blockWidth)
    .attr("y", height + margin - 5)
    .attr("text-anchor", "middle")
    .attr("class", "mapTrendRange")
    .text((d: number, i) => Math.round(d));

  svg
    .append("g")
    .append("text")
    .attr("x", 0)
    .attr("y", height + margin + margin - 10)
    .attr("alignment-baseline", "central")
    .attr("class", "mapTrendRange")
    .text("Interest")
    .append("title")
    .text(
      "A scaled value, showing relative interest, that you can compare across regions and times."
    );

  svg
    .append("g")
    .append("text")
    .attr("x", width + labelWidth)
    .attr("y", height + margin + margin - 10)
    .attr("alignment-baseline", "central")
    .attr("class", "map-legend-info material-icons")
    .text("info_outline")
    .on("click", handleLegendInfoPopup);

  // build date range
  d3.select(".mapLegendContainer")
    .append("svg")
    .attr("width", labelWidth)
    .attr("height", height + margin + margin)
    .attr("viewBox", `0 0 ${labelWidth} ${height + margin}`)
    .style("overflow", "visible")
    .style("float", "right")
    .append("g")
    .append("text")
    .attr("x", labelWidth)
    .attr("y", height + margin + margin - 10)
    .attr("alignment-baseline", "central")
    .attr("text-anchor", "end")
    .attr("class", "mapTrendRange")
    .text(dateRangeString(latestCountyData["latestDate"]));
}

function handleLegendInfoPopup(event, d): void {
  const popup: d3.Selection<SVGGElement, any, any, any> = d3.select(
    "#map-legend-info-popup"
  );
  const hidden: boolean = popup.style("display") == "none";
  if (hidden) {
    const infoRect: DOMRect = event.target.getBoundingClientRect();
    popup
      .style("display", "block")
      .style("left", infoRect.x + infoRect.width + window.pageXOffset + "px")
      .style("top", infoRect.y + infoRect.height + window.pageYOffset + "px");

    event.stopPropagation();
    document.addEventListener("click", dismissLegendInfoPopup);
  }
}

function inClientBounds(
  clientX: number,
  clientY: number,
  bounds: DOMRect
): boolean {
  return (
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
}

function dismissLegendInfoPopup(event): void {
  const popup: d3.Selection<SVGGElement, any, any, any> = d3.select(
    "#map-legend-info-popup"
  );
  if (
    !inClientBounds(
      event.clientX,
      event.clientY,
      popup.node().getBoundingClientRect()
    )
  ) {
    popup.style("display", "none");
    document.removeEventListener("click", dismissLegendInfoPopup);
    event.stopPropagation();
  } else {
    console.log("Within popup ignoring");
  }
}

function buildVaccineColorScale() {
  return d3
    .scaleThreshold<number, string>()
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
    .scaleThreshold<number, string>()
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
    .scaleThreshold<number, string>()
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

//
// Map event handler state routines
//
function activateSelectedState(fipsCode, zoom = true) {
  mapSvg
    .select("#county")
    .selectAll("path")
    .attr("stroke-width", 0)
    .on("click", null)
    .on("mouseenter", enterCountyBoundsHandler)
    .on("mouseleave", leaveCountyBoundsHandler)
    .on("mousemove", inCountyMovementHandler);
  mapSvg
    .select("#state")
    .selectAll("path")
    .attr("fill", "transparent")
    .attr("stroke-width", 2.0);

  mapSvg
    .select("#county")
    .selectAll(`.state-${fipsCode}`)
    .attr("stroke-width", 1)
    .on("click", countySelectionOnClickHandler)
    .on("mouseenter", enterCountyBoundsHandler)
    .on("mouseleave", leaveCountyBoundsHandler)
    .on("mousemove", inCountyMovementHandler);

  mapSvg.select("#state").select(`path#fips-${fipsCode}`).attr("fill", "none");

  if (zoom) {
    zoomToBounds(
      mapSvg.select("#state").select(`path#fips-${fipsCode}`).datum()
    );
  }
}

function activateSelectedCounty(fipsCode, zoom = true) {
  mapSvg
    .select("#county")
    .select(`#fips-${fipsCode}`)
    .on("click", selectedCountyOnClickHandler);

  if (zoom) {
    zoomToBounds(mapSvg.select("#county").select(`#fips-${fipsCode}`).datum());
  }
}

//
// Map callout routines
//

function drawMapCalloutInfo(data, fipsCode) {
  const height = 20;
  const width = 20;
  const margin = 10;

  const trendsLabels = [
    "Covid-19 Vaccination",
    "Vaccination intent",
    "Safety and Side-effects",
  ];
  const trends = data.get(fipsCode);
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

function isInMapCallout(event) {
  let elem = document.elementFromPoint(event.clientX, event.clientY);
  if (elem && elem.id == "map-callout") {
    return true;
  } else {
    return false;
  }
}

function moveMapCallout(event, d) {
  if (isInMapCallout(event)) {
    return;
  }

  const callout = d3.select("div#map-callout");
  const left = parseInt(callout.style("left"), 10);
  const top = parseInt(callout.style("top"), 10);
  const dist = Math.sqrt(
    Math.pow(left - event.pageX, 2) + Math.pow(top - event.pageY, 2)
  );
  if (dist > 45.0) {
    callout
      .style("left", event.pageX + 5 + "px")
      .style("top", event.pageY + 5 + "px");
  }
}

function showMapCallout(data, event, d) {
  if (isInMapCallout(event)) {
    return;
  }

  const elemFipsCode = fipsCodeFromElementId(event.target.id);
  drawMapCalloutInfo(data, elemFipsCode);

  const callout = d3.select("div#map-callout");
  callout.select("#map-callout-title").text(d.properties.name);
  callout
    .style("left", event.pageX + 5 + "px")
    .style("top", event.pageY + 5 + "px")
    .transition()
    .duration(500)
    .style("display", "block");
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

//
// State level event handlers
//

function stateSelectionOnClickHandler(event, d) {
  setSelectedStateByFipsCode(fipsCodeFromElementId(this.id));
  selectionCallback(regionCodesToPlaceId.get(fipsCodeFromElementId(this.id)));
}

function enterStateBoundsHandler(event, d) {
  showMapCallout(latestStateData, event, d);
}

function leaveStateBoundsHandler(event, d) {
  hideMapCallout(event, d);
}

function inStateMovementHandler(event, d) {
  moveMapCallout(event, d);
}

//
// County level event handlers
//
function countySelectionOnClickHandler(event, d) {
  activateSelectedCounty(fipsCodeFromElementId(this.id));
  selectionCallback(regionCodesToPlaceId.get(fipsCodeFromElementId(this.id)));
}

function enterCountyBoundsHandler(event, d) {
  showMapCallout(latestCountyData, event, d);
}

function leaveCountyBoundsHandler(event, d) {
  hideMapCallout(event, d);
}

function inCountyMovementHandler(event, d) {
  moveMapCallout(event, d);
}

function selectedCountyOnClickHandler(event, d) {
  mapSvg
    .select("#county")
    .selectAll("path")
    .attr("stroke-width", 0)
    .on("click", null)
    .on("mouseenter", null)
    .on("mouseleave", null)
    .on("mousemove", null);
  mapSvg
    .select("#state")
    .selectAll("path")
    .attr("fill", "transparent")
    .attr("stroke-width", 1.0);
  resetZoom();
  selectionCallback(resetNavigationPlaceId);
}
