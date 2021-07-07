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
  dcCountyFipsCode,
  dcStateFipsCode,
  fipsCodeFromElementId,
  regionOneToFipsCode,
  stateFipsCodeFromCounty,
  getUsAtlas,
} from "./geo-utils";
import * as d3 from "d3";
import {
  aggregateRegionDataForDate,
  buildDateRangeList,
  RegionalTrendLine,
  RegionalTrendAggregate,
  selectRegionOneTrends,
  selectRegionTwoTrends,
  subRegionOneCode,
  subRegionTwoCode,
} from "./data";

const path = d3.geoPath();
const colorScaleVaccine = buildVaccineColorScale();
const colorScaleIntent = buildIntentColorScale();
const colorScaleSafety = buildSafetyColorScale();

const alaskaFipsCode: string = "02";

// currently resetting to the US
const resetNavigationPlaceId: string = "ChIJCzYy5IS16lQRQrfeQ5K5Oxw";

let mapSvg: d3.Selection<SVGGElement, any, any, any>;
let mapZoom;

let trendData: RegionalTrendLine[];
let latestStateData: Map<string, RegionalTrendAggregate>;
let latestCountyData: Map<string, RegionalTrendAggregate>;
let selectedTrend: string;
let dateList: string[];
let selectedDateIndex: number;

let regionCodesToPlaceId;
let selectionCallback;

let mapTimeoutRef;

//
// Exports for clients
//
export const mapBounds = {
  width: 975,
  height: 610,
  margin: 30,
};

export function createMap(
  mapData: RegionalTrendLine[],
  trend: string,
  regions,
  selectionFn
) {
  trendData = mapData;
  selectedTrend = trend;

  // build in-order list of available dates
  dateList = buildDateRangeList(trendData);
  selectedDateIndex = dateList.length - 1;
  setDateControlState();

  // generate the region to trend data for a given date slice
  generateRegionToTrendDataForDateSlice();

  regionCodesToPlaceId = buildRegionCodeToPlaceIdMapping(regions);
  selectionCallback = selectionFn;

  initializeMap();
  colorizeMap();
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
  colorizeMap();
}

export function decrementMapDate(controlId: string): void {
  if (selectedDateIndex > 0) {
    selectedDateIndex -= 1;
    generateRegionToTrendDataForDateSlice();
    setDateControlState();
    colorizeMap();
  }
}

export function incrementMapDate(controld: string): void {
  if (selectedDateIndex < dateList.length - 1) {
    selectedDateIndex += 1;
    generateRegionToTrendDataForDateSlice();
    setDateControlState();
    colorizeMap();
  }
}

function setSelectedStateByFipsCode(fipsCode) {
  activateSelectedState(fipsCode, true);
}

//
// Map data processing routines
//
function generateRegionToTrendDataForDateSlice(): void {
  const stateData: Map<string, RegionalTrendAggregate> =
    aggregateRegionDataForDate(
      selectRegionOneTrends(trendData),
      dateList[selectedDateIndex],
      subRegionOneCode
    );
  const fipsCodedStateData: Map<string, RegionalTrendAggregate> = new Map();
  stateData.forEach((value, key) => {
    fipsCodedStateData.set(regionOneToFipsCode.get(key), value);
  });
  latestStateData = fipsCodedStateData;

  latestCountyData = aggregateRegionDataForDate(
    selectRegionTwoTrends(trendData),
    dateList[selectedDateIndex],
    subRegionTwoCode
  );
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
    .attr("stroke", (d) => (d.id == alaskaFipsCode ? "#e8eaed" : "white"))
    .attr("stroke-width", 1)
    .attr("vector-effect", "non-scaling-stroke")
    .on("mouseenter", enterStateBoundsHandler)
    .on("mouseleave", leaveStateBoundsHandler)
    .on("mousemove", inStateMovementHandler)
    .on("click", stateSelectionOnClickHandler);

  mapZoom = d3.zoom().scaleExtent([1, 100]).on("zoom", zoomHandler);
  mapSvg.call(mapZoom);

  mapSvg.on("mouseleave", mapOnMouseLeaveHandler);
}

function colorizeMap() {
  let accessor;
  let colorScale;

  switch (selectedTrend) {
    case "vaccination":
      accessor = (d) => (d ? d.sni_covid19_vaccination | 0 : 0);
      colorScale = colorScaleVaccine;
      break;
    case "intent":
      accessor = (d) => (d ? d.sni_vaccination_intent | 0 : 0);
      colorScale = colorScaleIntent;
      break;
    case "safety":
      accessor = (d) => (d ? d.sni_safety_side_effects | 0 : 0);
      colorScale = colorScaleSafety;
      break;
    default:
      console.log(`Unknown trend: ${selectedTrend} set on map`);
      return;
  }

  d3.select("#county")
    .selectAll("path")
    .join("path")
    .attr("fill", function (d) {
      let id = fipsCodeFromElementId((this as Element).id);

      // special case for Washington D.C.
      let data;
      if (id == dcCountyFipsCode) {
        data = latestStateData.get(stateFipsCodeFromCounty(id));
      } else {
        data = latestCountyData.get(id);
      }
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

function dateRangeString(startDate: string): string {
  const periodStart: Date = d3.timeParse("%Y-%m-%d")(startDate);
  let periodEnd: Date = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 7);

  const formatterStart = d3.timeFormat("%b %d");
  const formatterEnd = d3.timeFormat("%b %d, %Y");

  return `${formatterStart(periodStart)} - ${formatterEnd(periodEnd)}`;
}

function drawLegend(color) {
  const blockWidth: number = 40;
  const blockHeight: number = 20;

  d3.select("div#map-legend-scale-breaks").selectAll("div").remove();

  d3.select("div#map-legend-scale-breaks")
    .selectAll("div")
    .data(color.domain())
    .join("div")
    .classed("map-legend-scale-number", true)
    .text((d: number, i) => d);

  d3.select("svg#map-legend-swatch-bar")
    .selectAll("rect")
    .data(color.range())
    .join("rect")
    .attr("width", blockWidth)
    .attr("height", blockHeight)
    .attr("y", 0)
    .attr("x", (d: string, i: number) => i * blockWidth)
    .attr("fill", (d: string) => d);

  d3.select("div#map-legend-date").text(
    dateRangeString(dateList[selectedDateIndex])
  );
}

function setDateControlState() {
  if (selectedDateIndex == 0) {
    console.log("setDateControlState: A");
    d3.select("#date-nav-button-back")
      .classed("date-nav-button-active", null)
      .classed("date-nav-button-inactive", true);
    d3.select("#date-nav-button-forward")
      .classed("date-nav-button-inactive", null)
      .classed("date-nav-button-active", true);
  } else if (selectedDateIndex == dateList.length - 1) {
    console.log("setDateControlState: B");
    d3.select("#date-nav-button-back")
      .classed("date-nav-button-active", true)
      .classed("date-nav-button-inactive", null);
    d3.select("#date-nav-button-forward")
      .classed("date-nav-button-active", null)
      .classed("date-nav-button-inactive", true);
  } else {
    console.log("setDateControlState: C");
    d3.select("#date-nav-button-back")
      .classed("date-nav-button-active", true)
      .classed("date-nav-button-inactive", null);
    d3.select("#date-nav-button-forward")
      .classed("date-nav-button-active", true)
      .classed("date-nav-button-inactive", null);
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

  // special case Washington D.C.
  if (fipsCode == dcStateFipsCode) {
    activateSelectedCounty(dcCountyFipsCode, zoom);
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

function addRegionHighlight(regionId: string): void {
  d3.select("#" + regionId).attr("stroke-width", 3);
}

function removeRegionHighlight(regionId: string): void {
  d3.select("#" + regionId).attr("stroke-width", 1);
}

//
// Map callout routines
//

function drawMapCalloutInfo(data, fipsCode) {
  const height = 12;
  const width = 12;
  const margin = 10;

  let trends;
  // Need to special case Washington D.C.
  if (fipsCode == dcCountyFipsCode) {
    trends = latestStateData.get(stateFipsCodeFromCounty(dcCountyFipsCode));
  } else {
    trends = data.get(fipsCode);
  }

  if (typeof trends == "undefined") {
    trends = {
      sni_covid19_vaccination: 0.0,
      sni_vaccination_intent: 0.0,
      sni_safety_side_effects: 0.0,
    };
  }

  let trendval: number = trends.sni_covid19_vaccination | 0;
  d3.select("svg#callout-vaccine")
    .select("rect")
    .style("fill", colorScaleVaccine(trendval));
  d3.select("div#callout-vaccine-value").text(trendval.toFixed(1));

  trendval = trends.sni_vaccination_intent | 0;
  d3.select("svg#callout-intent")
    .select("rect")
    .attr("fill", colorScaleIntent(trendval));
  d3.select("div#callout-intent-value").text(trendval.toFixed(1));

  trendval = trends.sni_safety_side_effects | 0;
  d3.select("svg#callout-safety")
    .select("rect")
    .attr("fill", colorScaleSafety(trendval));
  d3.select("div#callout-safety-value").text(trendval.toFixed(1));
}

function showMapCallout(data, event, d): void {
  const elemFipsCode: string = fipsCodeFromElementId(event.target.id);
  drawMapCalloutInfo(data, elemFipsCode);

  const callout: d3.Selection<SVGGElement, any, any, any> =
    d3.select("div#map-callout");

  // set the callout title text
  callout.select("#map-callout-title").text(d.properties.name);

  callout.style("display", "block");
  const boundingRect: DOMRect = callout.node().getBoundingClientRect();
  callout
    .style("left", event.pageX - boundingRect.width / 2 + "px")
    .style("top", event.pageY - boundingRect.height - 5 + "px");
}

function hideMapCallout(event, d) {
  d3.select("div#map-callout").style("display", null);
}

//
// State level event handlers
//

function stateSelectionOnClickHandler(event, d) {
  setSelectedStateByFipsCode(fipsCodeFromElementId(this.id));
  selectionCallback(regionCodesToPlaceId.get(fipsCodeFromElementId(this.id)));
}

function enterStateBoundsHandler(event, d) {
  addRegionHighlight(event.target.id);
}

function leaveStateBoundsHandler(event, d) {
  if (mapTimeoutRef) {
    clearTimeout(mapTimeoutRef);
    mapTimeoutRef = "";
  }
  hideMapCallout(event, d);
  removeRegionHighlight(event.target.id);
}

function handleStateMapTimeout(event, d) {
  mapTimeoutRef = "";
  if (d3.select("#map-callout").style("display") == "none") {
    showMapCallout(latestStateData, event, d);
  }
}

function inStateMovementHandler(event, d) {
  if (mapTimeoutRef) {
    clearTimeout(mapTimeoutRef);
    mapTimeoutRef = "";
  }
  mapTimeoutRef = setTimeout(handleStateMapTimeout, 200, event, d);
}

//
// County level event handlers
//
function countySelectionOnClickHandler(event, d) {
  activateSelectedCounty(fipsCodeFromElementId(this.id));
  selectionCallback(regionCodesToPlaceId.get(fipsCodeFromElementId(this.id)));
}

function enterCountyBoundsHandler(event, d) {
  addRegionHighlight(event.target.id);
}

function leaveCountyBoundsHandler(event, d) {
  hideMapCallout(event, d);
  removeRegionHighlight(event.target.id);
}

function handleCountyMapTimeout(event, d) {
  mapTimeoutRef = "";
  if (d3.select("#map-callout").style("display") == "none") {
    showMapCallout(latestCountyData, event, d);
  }
}

function inCountyMovementHandler(event, d) {
  if (mapTimeoutRef) {
    clearTimeout(mapTimeoutRef);
    mapTimeoutRef = "";
  }
  mapTimeoutRef = setTimeout(handleCountyMapTimeout, 200, event, d);
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

function mapOnMouseLeaveHandler(event, d) {
  if (mapTimeoutRef) {
    clearTimeout(mapTimeoutRef);
    mapTimeoutRef = "";
  }
  hideMapCallout(event, d);
}
