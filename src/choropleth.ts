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
import { quantileSeq, range, round } from "mathjs";
import {
  buildRegionCodeToPlaceIdMapping,
  dcCountyFipsCode,
  dcStateFipsCode,
  fipsCodeFromElementId,
  levelNameFromElementId,
  regionOneToFipsCode,
  stateFipsCodeFromCounty,
  getAtlas,
  getUSAtlas,
  getGbPostalCentroids,
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
  fetchZipData,
  getTrendValue,
  TrendValueType,
} from "./data";
import { getCountyZctas } from "./zcta-county";
import { mapData } from "./stores";
import type { UsAtlas } from "topojson";

enum GeoLevel {
  Country = 1,
  SubRegion1, //e.g. State
  SubRegion2, //e.g. County
  SubRegion3, //e.g. Zip
}

const unknownColor = "#DADCE0"; //material grey 300
const mobileScreenWidth = 450; //material grey 300

// Using different styling for areas with no borders with the main map
const alaskaFipsCode: string = "02";
const northernIrelandFipsCode: string = "N";
const canadianTerritories: Array<string> = ["60", "61", "62"];

const STATE_LEVEL = 1;
const COUNTY_LEVEL = 2;
const POSTCODE_LEVEL = 3

let path = d3.geoPath();

// currently resetting to the US
let resetNavigationPlaceId: string = "ChIJCzYy5IS16lQRQrfeQ5K5Oxw"
let selectedCountryCode: string = "US";
let currentGeoLevel = GeoLevel.Country;
let currentGeoId: string = resetNavigationPlaceId;

let mapSvg: d3.Selection<SVGGElement, any, any, any>;
let mapZoom;
let trendData: RegionalTrendLine[];
let colorScales: Map<TrendValueType, d3.ScaleThreshold<number, string, never>>;
let latestStateData: Map<string, RegionalTrendAggregate>;
let latestCountyData: Map<string, RegionalTrendAggregate>;
let latestZipData: Map<string, RegionalTrendAggregate>;
let selectedTrend: string;
let dateList: string[];
let selectedDateIndex: number;
let regionCodesToPlaceId;
let selectionCallback;
let mapTimeoutRef;
let lastZoom: number = 0;
let displayLevels: number[];

//
// Exports for clients
//
export const mapBounds = {
  width: 975,
  height: 610,
  margin: 30,
};

const AU_PROJECTION = d3.geoAlbers()
  .scale(1000)
  .rotate([-133, 50])
  .center([0, 25])
  .translate([mapBounds.width / 2, mapBounds.height / 2])

const IE_PROJECTION = d3.geoAlbers()
  .center([-4, 53.4])
  .rotate([4.4, 0])
  .parallels([50, 60])
  .scale(8800)
  .translate([mapBounds.width / 2, mapBounds.height / 2])

const CA_PROJECTION = d3.geoAlbers()
  .parallels([30, 77])
  .rotate([96, 0, 0])
  .center([87, 37])
  .translate([mapBounds.width / 2, mapBounds.height / 2])
  .scale(840);

// GB postal code geo path with projection
const gbPostalPath = d3.geoPath()
  .projection(getGBprojection().rotate([7.145, -45.78, -3.95]));


export async function createMap(
  trend: string,
  regions,
  selectionFn,
  selectedCountryMetadata
) {
  resetNavigationPlaceId = selectedCountryMetadata.placeId;
  selectedCountryCode = selectedCountryMetadata.countryCode;
  mapData.subscribe((v) => trendData = v)
  displayLevels = selectedCountryMetadata.displayLevels;
  
  selectedTrend = trend;

  // build in-order list of available dates
  dateList = buildDateRangeList(trendData);
  selectedDateIndex = dateList.length - 1;
  setDateControlState();

  colorScales = calculateColorScales(trendData,dateList[selectedDateIndex]);

  // generate the region to trend data for a given date slice
  generateRegionToTrendDataForDateSlice();
  regionCodesToPlaceId = buildRegionCodeToPlaceIdMapping(regions,
                                                         selectedCountryCode);
  selectionCallback = selectionFn;

  await initializeMap();
  colorizeMap();
}

function calculateColorScales(trendData: RegionalTrendLine[], date: string): 
  Map<TrendValueType,d3.ScaleThreshold<number, string, never>>{
  const map = new Map<TrendValueType,d3.ScaleThreshold<number, string, never>>();
  const trendArrays = [[],[],[]];

  trendData.forEach(t=>{
    if(t.date == date){
      if(t.sni_covid19_vaccination) trendArrays[0].push(t.sni_covid19_vaccination);
      if(t.sni_safety_side_effects) trendArrays[1].push(t.sni_safety_side_effects);
      if(t.sni_vaccination_intent) trendArrays[2].push(t.sni_vaccination_intent);
    }
  });

  const vaccineColorScale = buildVaccineColorScale(calculateDomain(trendArrays[0]));
  map.set(TrendValueType.Vaccination,vaccineColorScale);
  const safetyColorScale = buildSafetyColorScale(calculateDomain(trendArrays[1]))
  map.set(TrendValueType.Safety,safetyColorScale);
  const intentColorScale = buildIntentColorScale(calculateDomain(trendArrays[2]))
  map.set(TrendValueType.Intent,intentColorScale);

  return map;
}

/**
 * Calculate buckets for a given array based on their normally distributed 90th and 10th 
 * percentiles.
 * 
 * Our color scheme is discrete, so here we dynamically calculate bucket widths in order
 * to maximize differentiability, i.e. contrast.  Note that if apply this method
 * for each date, we lose some temporal consistency (e.g. the same color blue means 
 * the same thing over time.).
 * 
 * @param a An unsorted array of numbers
 * @returns An array of `numBuckets` between 10P and 90P inclusive
 */
function calculateDomain(a: number[]): number[]{
  const domain = quantileSeq(a,DOMAIN_PERCENTILES) as number[];
  
  return domain;
}
const DOMAIN_PERCENTILES: number[] = function(){
  //This could be extracted as just a constant since our number of buckets is 
  //unlikely to change, but this is a little less magical than
  //DOMAIN_PERCENTILES = [ 0.1, 0.26, 0.42, 0.58, 0.74, 0.9 ]
  const minPercentile = 0.10;
  const maxPercentile = 0.90;
  const numBuckets = 6;
  const bucketWidth = (maxPercentile-minPercentile)/(numBuckets-1);
  const percentiles = range(minPercentile,maxPercentile,bucketWidth,true)
    .toArray().map(i=>round(i,2)) as number[];//floating point math here requires a round 
  return percentiles;
}();

export function setSelectedState(regionOneCode) {
  currentGeoLevel = GeoLevel.SubRegion1;
  currentGeoId = regionOneCode;
  setSelectedStateByFipsCode(
      regionOneToFipsCode.get(selectedCountryCode).get(regionOneCode));
}

export function setSelectedCounty(fipsCode) {
  currentGeoLevel = GeoLevel.SubRegion2;
  currentGeoId = fipsCode;
  activateSelectedState(stateFipsCodeFromCounty(fipsCode, selectedCountryCode), false);
  activateSelectedCounty(fipsCode, true);
}

export function setMapTrend(trend) {
  selectedTrend = trend;
  colorizeMap();
}

export function decrementMapDate(controlId: string): void {
  if (selectedDateIndex > 0) {
    selectedDateIndex -= 1;
    colorScales = calculateColorScales(trendData,dateList[selectedDateIndex]);
    generateRegionToTrendDataForDateSlice();
    setDateControlState();
    colorizeMap();
  }
}

export function incrementMapDate(controld: string): void {
  if (selectedDateIndex < dateList.length - 1) {
    selectedDateIndex += 1;
    colorScales = calculateColorScales(trendData,dateList[selectedDateIndex]);
    generateRegionToTrendDataForDateSlice();
    setDateControlState();
    colorizeMap();
  }
}

function setSelectedStateByFipsCode(fipsCode) {
  activateSelectedState(fipsCode, true);
}

export function resetToCountryLevel() {
  mapSvg
    .select("#county")
    .selectAll("path")
    .attr("stroke-width", 0)
    .on("click", null)
    .on("mouseenter", enterCountyBoundsHandler)
    .on("mouseleave", leaveCountyBoundsHandler)
    .on("mousemove", inCountyMovementHandler);
  if (displayLevels.includes(COUNTY_LEVEL)) {
    mapSvg.select("#state").selectAll("path").attr("fill", (d) => (canadianTerritories.includes(d.id as string) ? getFillColor(d.id): "transparent"));
  }
  resetZoom();
  selectionCallback(resetNavigationPlaceId);
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
    fipsCodedStateData.set(regionOneToFipsCode.get(
        selectedCountryCode).get(key), value);
  });
  latestStateData = fipsCodedStateData;

  latestCountyData = aggregateRegionDataForDate(
    selectRegionTwoTrends(trendData),
    dateList[selectedDateIndex],
    subRegionTwoCode
  );
}


// Create GB only Albers projection for the map 
function getGBprojection(): d3.GeoConicProjection {
  return d3.geoAlbers()
    .center([3, 8.7])
    .rotate([0, 4])
    .parallels([50, 20])
    .scale(4000)
    .translate([mapBounds.width / 2, mapBounds.height / 2]);
}

//
// Map drawing routines
//
async function initializeMap() {
  let topology: UsAtlas;
  if (selectedCountryCode == "US") {
    topology = getUSAtlas()
  } else {
    topology = await getAtlas(selectedCountryCode);
  }
  // check to ensure country is valid ATLAS
  if (!topology) { console.log("Country atlas not found") };

  mapSvg = d3
    .select("#map")
    .append("svg")
    .attr("viewBox", [0, 0, mapBounds.width, mapBounds.height].join(" "))
    .classed("map-svg", true);

  const g = mapSvg.append("g").attr("id", "transformer");

  //Order is important here, since groups positioned later in the DOM get drawn on top
  // i.e. z-order, of groups written earlier, nation must be top because it's used as
  // a background fill for non-assigned areas
  g.append("g").attr("id", "nation");
  g.append("g").attr("id", "zip");
  g.append("g").attr("id", "county");
  g.append("g").attr("id", "state");
  g.append("g").attr("id", "gbPostalCentroids");

  switch (selectedCountryCode) {
    case "AU":
      path = path.projection(AU_PROJECTION);
      break;
    case "GB":
      path = path.projection(getGBprojection());
      break;
    case "IE":
      path = path.projection(IE_PROJECTION);
      break;
    case "CA":
      path = path.projection(CA_PROJECTION);
      break;
    case "US":
      path = d3.geoPath();
      break;
    default:
      console.log("Projection not specified");
      break;
  }

  const nationFeatures = feature(
    topology,
    topology.objects.nation as GeometryCollection
  );

  d3.select("#nation")
    .selectAll("path")
    .data(nationFeatures.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#f1f3f4");

  if (displayLevels.includes(COUNTY_LEVEL)) {
    const countyFeatures = feature(
      topology,
      topology.objects.counties as GeometryCollection
    );

    d3.select("#county")
      .selectAll("path")
      .data(countyFeatures.features)
      .join("path")
      .attr("id", (d) => `fips-${d.id}`)
      .attr("class", (d) => `state-${stateFipsCodeFromCounty(d.id as string, selectedCountryCode)}`)
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", 0)
      .attr("vector-effect", "non-scaling-stroke");
  }

  if (displayLevels.includes(STATE_LEVEL)) {
    const stateFeatures = feature(
      topology,
      topology.objects.states as GeometryCollection
    );

    d3.select("#state")
      .selectAll("path")
      .data(stateFeatures.features)
      .join("path")
      .attr("id", (d) => `fips-${d.id}`)
      .attr("class", "state")
      .attr("d", path)
      .attr("fill", "transparent")
      .attr("stroke", (d) => ([alaskaFipsCode, northernIrelandFipsCode].includes(d.id as string) ? "#e8eaed" : "white"))
      .attr("stroke-width", 1)
      .attr("vector-effect", "non-scaling-stroke")
      .on("mouseenter", enterStateBoundsHandler)
      .on("mouseleave", leaveStateBoundsHandler)
      .on("mousemove", inStateMovementHandler)
      .on("click", stateSelectionOnClickHandler);
  }
  mapZoom = d3.zoom().scaleExtent([1, 250]).on("zoom", zoomHandler);
  mapSvg.call(mapZoom);

  mapSvg.on("mouseleave", mapOnMouseLeaveHandler);
}

function getFillColor(fipsCode) {
  let data;
  if (fipsCode == dcCountyFipsCode) {
    data = latestStateData.get(stateFipsCodeFromCounty(fipsCode, selectedCountryCode));
  } else if (!displayLevels.includes(COUNTY_LEVEL)) {
    data = latestStateData.get(fipsCode);
  } else if (canadianTerritories.indexOf(fipsCode) > -1 ) {
    data = latestStateData.get(fipsCode);
  }else {
    data = latestCountyData.get(fipsCode);
  }
  if (data) {
    let trendValue = getTrendValue(selectedTrend, data as RegionalTrendLine);
    let colorScale = colorScales.get(selectedTrend as TrendValueType);
    if (trendValue === 0) { 
      return unknownColor;
    } else {
      return colorScale(trendValue);
    }
  } else {
    return unknownColor;
  }
}

function colorizeMap() {
  const colorScale = colorScales.get(selectedTrend as TrendValueType);
  
  d3.select(displayLevels.includes(COUNTY_LEVEL) ? "#county" : "#state")
    .selectAll("path")
    .join("path")
    .attr("fill", function (d) {
      let id = fipsCodeFromElementId((this as Element).id);
      return getFillColor(id);
    });

  if(selectedCountryCode == "CA") {
    d3.select(displayLevels.includes(STATE_LEVEL) ? "#state" : null)
    .selectAll("path")
    .filter(function(p) {
      let result = canadianTerritories.includes(p.id as string) 
      return result
      })
    .join("path")
    .attr("fill", function (d) {

      let id = fipsCodeFromElementId((this as Element).id);
      return getFillColor(id);
    });

  }

  drawLegend(colorScale);
  if (currentGeoLevel == GeoLevel.SubRegion2) {
    drawZipData(currentGeoId);
  }
}

function zoomHandler({ transform }) {
  d3.select("#transformer").attr("transform", transform);

  // Change diameter for postal code centroids in GB
  if (lastZoom != transform.k && selectedCountryCode == "GB") {
    lastZoom = transform.k;
    var rad = window.innerWidth > mobileScreenWidth ? 11 : 21;
    d3.select("#gbPostalCentroids")
      .selectAll("path")
      .attr("d", gbPostalPath.pointRadius(Math.min(rad/transform.k, 4)))
      .attr("filter", "drop-shadow(0 0 " + 1/transform.k + "px rgba(0, 0, 0, 0.5))");
  }
}

function resetZoom() {
  currentGeoLevel = GeoLevel.Country;
  currentGeoId = resetNavigationPlaceId;
  removeZipData();
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
            60,
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

/**
 * Converts a simple numerical string to an English 7 days date range.
 * If initial and end dates:
 *  - are in different months: "MM DD - MM DD, YYYY" (i.e. "Nov 29 - Dec 05, 2021").
 *  - have the same month: "MM DD - DD, YYYY" (i.e. "Nov 22 - 28, 2021").
 *  - are in different years: "MM DD, YYYY - MM DD, YYYY" (i.e. "Dec 27, 2021 - Jan 02, 2022").
 */
export function dateRangeString(startDate: string): string {
  const periodStart: Date = d3.timeParse("%Y-%m-%d")(startDate);
  let periodEnd: Date = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 6);

  let formatterStart = d3.timeFormat("%b %d");
  let formatterEnd = d3.timeFormat("%b %d, %Y");

  if (periodStart.getMonth() === periodEnd.getMonth()) {
    formatterStart = d3.timeFormat("%b %d");
    formatterEnd = d3.timeFormat("%d, %Y");
  } else if (periodStart.getFullYear() !== periodEnd.getFullYear()) {
    formatterStart = d3.timeFormat("%b %d, %Y");
    formatterEnd = d3.timeFormat("%b %d, %Y");
  }

  return `${formatterStart(periodStart)} - ${formatterEnd(periodEnd)}`;
}

function drawLegend(color) {
  const blockWidth: number = 40;
  const blockHeight: number = 20;

  d3.select("div#map-legend-scale-breaks").selectAll("div").remove();

  const maxDomain = Math.max(color.domain());
  d3.select("div#map-legend-scale-breaks")
    .selectAll("div")
    .data(color.domain())
    .join("div")
    .classed("map-legend-scale-number", true)
    .text((d: number, i) => {
      return maxDomain < 10 || d > 100 ? d.toFixed(0) : d.toFixed(1)
    });

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
    d3.select("#date-nav-button-back")
      .classed("date-nav-button-active", null)
      .classed("date-nav-button-inactive", true);
    d3.select("#date-nav-button-forward")
      .classed("date-nav-button-inactive", null)
      .classed("date-nav-button-active", true);
  } else if (selectedDateIndex == dateList.length - 1) {
    d3.select("#date-nav-button-back")
      .classed("date-nav-button-active", true)
      .classed("date-nav-button-inactive", null);
    d3.select("#date-nav-button-forward")
      .classed("date-nav-button-active", null)
      .classed("date-nav-button-inactive", true);
  } else {
    d3.select("#date-nav-button-back")
      .classed("date-nav-button-active", true)
      .classed("date-nav-button-inactive", null);
    d3.select("#date-nav-button-forward")
      .classed("date-nav-button-active", true)
      .classed("date-nav-button-inactive", null);
  }
}

function buildVaccineColorScale(domain=[7, 14, 21, 28, 35, 42]) {
  return d3
    .scaleThreshold<number, string>()
    .domain(domain)
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

function buildIntentColorScale(domain=[3, 6, 9, 12, 15, 18]) {

  return d3
    .scaleThreshold<number, string>()
    .domain(domain)
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

function buildSafetyColorScale(domain=[1.5, 2.8, 4.1, 5.4, 6.7, 8]) {
  return d3
    .scaleThreshold<number, string>()
    .domain(domain)
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
  removeZipData();

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

  if (displayLevels.includes(COUNTY_LEVEL)) {
    // disable any active state selection, then activate
    mapSvg.select("#state").selectAll("path").attr("fill", "transparent");
    mapSvg.select("#state").select(`path#fips-${fipsCode}`).attr("fill", "none");
    
  }

  if (zoom) {
    zoomToBounds(
      mapSvg.select("#state").select(`path#fips-${fipsCode}`).datum()
    );
  }

  // special case Washington D.C.
  if (fipsCode == dcStateFipsCode && selectedCountryCode == 'US') {
    activateSelectedCounty(dcCountyFipsCode, zoom);
  }
}

function activateSelectedCounty(fipsCode, zoom = true) {
  resetLastSelectedCountyFill();

  mapSvg
    .select("#county")
    .select(`#fips-${fipsCode}`)
    .on("click", selectedCountyOnClickHandler);

  if (zoom) {
    zoomToBounds(mapSvg.select("#county").select(`#fips-${fipsCode}`).datum());
  }
  drawZipData(fipsCode);
}

let setLastSelectedCounty: string;

function resetLastSelectedCountyFill() {
  if (setLastSelectedCounty) {
    d3.select(`#fips-${setLastSelectedCounty}`).attr(
      "fill",
      getFillColor(setLastSelectedCounty)
    );
    setLastSelectedCounty = null;
  }
}


function drawZipData(fipsCode) {
  const currentDate = dateList[selectedDateIndex];  
  setLastSelectedCounty = fipsCode;
  
  if (["US", "AU"].includes(selectedCountryCode)) {
    const zipsForCounty = new Set(getCountyZctas(fipsCode, selectedCountryCode));

    if (zipsForCounty.size > 0) {
      const zipTrends: Map<String, RegionalTrendLine> = trendData
        .filter(
          (t) =>
            zipsForCounty.has(t.sub_region_3_code) &&
            t.date == currentDate &&
            getTrendValue(selectedTrend, t) != 0
        )
        .reduce((acc, trend) => {
          acc.set(trend.sub_region_3_code, trend);
          return acc;
        }, new Map<string, RegionalTrendLine>());
      
      d3.selectAll(`#fips-${fipsCode}`).attr("fill", "none");

      fetchZipData(fipsCode, selectedCountryCode)
        .then((zipData) => {
          if (selectedCountryCode == "US") {
            zipData.features.forEach((f) => {
              f.properties.name = `Zip code ${f.properties.GEOID10}`;
            });
          } else if (selectedCountryCode == "AU") {
            for (const geometries of Object.values(zipData.objects)) {
              zipData = feature(
                zipData,
                geometries as GeometryCollection
              );
            }
            zipData.features.forEach((f) => {
              f.properties.name = `Postcode ${f.properties.GEOID10}`;
            });
          }

          d3.select("#zip")
            .selectAll("path")
            .data(zipData.features)
            .join("path")
            .attr("class", "sub-region-3")
            .attr("id", (z: any) => `zcta-${z.properties.GEOID10}`)
            .attr("d", path)
            .attr("fill", (d: any) => {
              const colorScale = colorScales.get(selectedTrend as TrendValueType);
              const trend = zipTrends.get(d.properties.GEOID10);
              const trendValue = getTrendValue(selectedTrend, trend);
              if (trendValue && trendValue != 0) {
                return colorScale(trendValue);
              } else {
                return unknownColor;
              }
            })
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("vector-effect", "non-scaling-stroke")
            .on("mouseenter", enterCountyBoundsHandler)
            .on("mouseleave", leaveCountyBoundsHandler)
            .on("mousemove", movementHandler(zipTrends));
        })
        .catch((err) => {
          console.log(
            `No ZIP data available for ${fipsCode}:${JSON.stringify(err)}`
          );
          removeZipData();
        });
    }
  } else if (selectedCountryCode == "GB") {
    drawGbPostalCodes(getGbPostalCentroids(), currentDate);
  }
}


// Draw postal code centroids for the UK
function drawGbPostalCodes(postalCentroids, currentDate) {
  const postalTrends: Map<String, RegionalTrendLine> = trendData
    .filter(
      (t) =>
        t.date == currentDate &&
        getTrendValue(selectedTrend, t) != 0
    )
    .reduce((acc, trend) => {
      acc.set(trend.sub_region_3_code, trend);
      return acc;
    }, new Map<string, RegionalTrendLine>());
  
  postalCentroids.then(postalCentroids => {
    const postalFeatures = feature(
      postalCentroids,
      postalCentroids.objects.postal as GeometryCollection
    );

    d3.select("#gbPostalCentroids")
      .selectAll("path")
      .data(postalFeatures.features)
      .join("path")
      .attr("class", "postcode")
      .attr("id", (z: any) => `postcode-${z.properties.name}`)
      .attr("d", gbPostalPath)
      .attr("fill", (d: any) => {
        const colorScale = colorScales.get(selectedTrend as TrendValueType);
        const trend = postalTrends.get(d.properties.name);
        const trendValue = getTrendValue(selectedTrend, trend);
        if (trendValue && trendValue != 0) {
          return colorScale(trendValue);
        } else {
          return unknownColor;
        }
      })
      .attr("stroke", "white")
      .attr("stroke-width", 1.7)
      .attr("vector-effect", "non-scaling-stroke")
      .on("mouseenter", enterCountyBoundsHandler)
      .on("mouseleave", leaveCountyBoundsHandler)
      .on("mousemove", movementHandler(postalTrends));
  })
}


function removeZipData() {
  resetLastSelectedCountyFill();

  d3.select("#zip").selectAll("path").remove();
  d3.select("#gbPostalCentroids").selectAll("path").remove();
}

function addRegionHighlight(regionId: string): void {
  d3.select("#" + regionId).attr("stroke-width", 3);
}

function removeRegionHighlight(regionId: string): void {
  if (levelNameFromElementId(regionId) == "postcode") {
    d3.select("#" + regionId).attr("stroke-width", 1.7);
  } else {
    d3.select("#" + regionId).attr("stroke-width", 1);
  }
}

//
// Map callout routines
//

function drawMapCalloutInfo(data, fipsCode) {
  const height = 12;
  const width = 12;
  const margin = 10;

  let trends: RegionalTrendAggregate;
  // Need to special case Washington D.C.
  if (fipsCode == dcCountyFipsCode) {
    trends = latestStateData.get(stateFipsCodeFromCounty(dcCountyFipsCode, selectedCountryCode));
  } else {
    trends = data.get(fipsCode);
  }

  if ((typeof trends == "undefined") || (typeof trends != "undefined" && isNaN(trends.sni_covid19_vaccination) && isNaN(trends.sni_safety_side_effects) && isNaN(trends.sni_vaccination_intent))) {
    trends = {
      sni_covid19_vaccination: 0.0,
      sni_vaccination_intent: 0.0,
      sni_safety_side_effects: 0.0,
    };
  }
  
  const renderValue = (value: number): string => {
    //TODO(tilchris): Add more robust NaN handling
    //It should be the cases where any 0 value should be interpreted
    //as "Not enough data available" instead of an actual measurement
    //of 0, but this assumption may not hold.  For example, in the
    //far far beautiful feature where nobody needs to search for
    //COVID-19 at all.
    if (value == 0) {
      return "n/a";
    } else {
      return value.toFixed(1);
    }
  };

  // Use || here to test for existence instead of single |, otherwise the value is converted
  // into an integer and precision is lost
  let trendval: number = trends.sni_covid19_vaccination || 0;
  d3.select("svg#callout-vaccine")
    .select("rect")
    .style("fill", trendval == 0 ? unknownColor : colorScales.get(TrendValueType.Vaccination)(trendval));
  d3.select("div#callout-vaccine-value").text(renderValue(trendval));

  trendval = trends.sni_vaccination_intent || 0;
  d3.select("svg#callout-intent")
    .select("rect")
    .attr("fill", trendval == 0 ? unknownColor : colorScales.get(TrendValueType.Intent)(trendval));
  d3.select("div#callout-intent-value").text(renderValue(trendval));

  trendval = trends.sni_safety_side_effects || 0;
  d3.select("svg#callout-safety")
    .select("rect")
    .attr("fill", trendval == 0 ? unknownColor : colorScales.get(TrendValueType.Safety)(trendval));
  d3.select("div#callout-safety-value").text(renderValue(trendval));

  const hasNa = !Object.keys(trends).every((key) => trends[key] !== 0);

  if (hasNa) {
    d3.select("#not-enough-data-message").style("display", "inline-block");
  } else {
    d3.select("#not-enough-data-message").style("display", "none");
  }
}

function showMapCallout(data, event, d): void {
  const elemFipsCode: string = fipsCodeFromElementId(event.target.id);
  drawMapCalloutInfo(data, elemFipsCode);

  const callout: d3.Selection<SVGGElement, any, any, any> =
    d3.select("div#map-callout");

  // set the callout title text
  // Add a rule to include some text for Canadian FSAs on the card for Canada
  callout.select("#map-callout-title").text((selectedCountryCode == "CA" && d.id != d.properties.prID) ? (d.properties.prname+" FSA: "+d.properties.name) : d.properties.name);

  // Hide the drilldown message for zip/postcode level, and current selected county
  if ((["zcta", "postcode"].indexOf(levelNameFromElementId(event.target.id)) > -1)
      || setLastSelectedCounty == elemFipsCode
      || (selectedCountryCode == "CA" && (elemFipsCode.match(/\w\d\w/) != null))
      || (![COUNTY_LEVEL, POSTCODE_LEVEL].every(level => displayLevels.includes(level)) && (["IE"].indexOf(selectedCountryCode) > -1 ))) {
    d3.select("#map-callout-drilldown-msg").style("display", "none");
  } else {
    d3.select("#map-callout-drilldown-msg").style("display", null);
  }

  callout.style("display", "block");
  const boundingRect: DOMRect = callout.node().getBoundingClientRect();

  // Base callout location on the screen dimenstions
  if (window.innerWidth > mobileScreenWidth) {
    callout
      .style("left", Math.min(Math.max(event.pageX - boundingRect.width / 2, 0),
                              window.innerWidth - 300) + "px")
      .style("top", event.pageY - boundingRect.height - 20 + "px");
  } else {
    // on mobile
    callout
      .style("left", "auto")
      .style("top", "auto");
  }
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
  var fipsCode = fipsCodeFromElementId(this.id)
  if (regionCodesToPlaceId.get(fipsCode)) {
    activateSelectedCounty(fipsCode);
    selectionCallback(regionCodesToPlaceId.get(fipsCode));
  } else {
    console.log(`No place id for map region code ${fipsCode}`)
  }
}

function enterCountyBoundsHandler(event, d) {
  addRegionHighlight(event.target.id);
}

function leaveCountyBoundsHandler(event, d) {
  hideMapCallout(event, d);
  removeRegionHighlight(event.target.id);
}

function handleZipMapTimeout(event, d) {
  mapTimeoutRef = "";
  if (d3.select("#map-callout").style("display") == "none") {
    showMapCallout(latestZipData, event, d);
  }
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

function handleMapTimeout(data) {
  return (event, d) => {
    mapTimeoutRef = "";
    if (d3.select("#map-callout").style("display") == "none") {
      showMapCallout(data, event, d);
    }
  };
}

function movementHandler(data) {
  return (event, d) => {
    if (mapTimeoutRef) {
      clearTimeout(mapTimeoutRef);
      mapTimeoutRef = "";
    }
    mapTimeoutRef = setTimeout(handleMapTimeout(data), 200, event, d);
  };
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
  
  if (displayLevels.includes(COUNTY_LEVEL)) {
    mapSvg
      .select("#state")
      .selectAll("path")
      .attr("fill", "transparent")
      .attr("stroke-width", 1.0);
  }

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

export function updateMap() {
  mapSvg.exit().remove();
  mapSvg.enter();
  console.log("updating map")
  initializeMap();
}
