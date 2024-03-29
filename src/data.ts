/*
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

import { parse, ParseResult } from "papaparse";
import * as d3 from "d3";
import * as d3Collection from "d3-collection";
import { getCountyFipsCode } from "./zcta-county";
import { dateRange } from "./stores";

export interface Region {
  country_region: string;
  country_region_code: string;
  sub_region_1: string;
  sub_region_1_code: string;
  sub_region_2: string;
  sub_region_2_code: string;
  sub_region_3: string;
  sub_region_3_code: string;
  place_id: string;
  region_type: RegionType;
  parent_region_type: RegionType;
}

export enum RegionType {
  CountryRegion = 'country_region',
  SubRegionOne = 'sub_region_1',
  SubRegionTwo = 'sub_region_2',
  SubRegionThree = 'sub_region_3'
}

export interface RegionalTrendLine {
  date: string;
  country_region: string;
  country_region_code: string;
  sub_region_1: string;
  sub_region_1_code: string;
  sub_region_2: string;
  sub_region_2_code: string;
  sub_region_3: string;
  sub_region_3_code: string;
  place_id: string;
  sni_covid19_vaccination: number;
  sni_vaccination_intent: number;
  sni_safety_side_effects: number;
}

export interface RegionalTrendAggregate {
  sni_covid19_vaccination: number;
  sni_vaccination_intent: number;
  sni_safety_side_effects: number;
}

export interface Country {
  country_region: string;
  country_region_code: string;
  place_id: string;
}

export interface CountryTrendLine {
  date: string;
  country_region: string;
  country_region_code: string;
  place_id: string;
  sni_covid19_vaccination: number;
  sni_vaccination_intent: number;
  sni_safety_side_effects: number;
}

export interface TrendValue {
  date: string;
  value: number;
}

export interface RegionalTrends {
  place_id: string;
  trends: {
    covid19_vaccination: TrendValue[];
    vaccination_intent: TrendValue[];
    safety_side_effects: TrendValue[];
  };
}

const GLOBAL_TRENDS_FILENAME = "Global_l0_vaccination_search_insights.csv";
const PERCENTAGE: number = 100;

const ZIP_FILENAME_STRUCTURE = {
  "US": geoid => `${geoid}.geo.json`,
  "AU": geoid => `AU/${geoid}.json`,
};

let regions: Map<string, Region>;
let regionalTrends: Map<string, RegionalTrends>;
let regionalTrendLines: RegionalTrendLine[];

let globalTrends: Map<string, RegionalTrends>;
let globalTrendLines: CountryTrendLine[];

//https://thoughtspile.github.io/2018/06/20/serialize-promises/
function serializePromises<T>(immediate: () => Promise<T>): () => Promise<T> {
  // This works as our promise queue
  let last: Promise<any> = Promise.resolve();
  return function () {
    // Catch is necessary here — otherwise a rejection in a promise will
    // break the serializer forever
    last = last.catch(() => { }).then(() => immediate());
    return last;
  };
}

/**
 * Methods for getting all remote data, like regions and trends
 */
export function fetchRegionData(): Promise<Map<string, Region>> {
  if (regions) {
    return Promise.resolve(regions);
  } else {
    let regionPromise = new Promise<Map<string, Region>>((resolve, reject) => {
      parse("./data/regions.csv", {
        download: true,
        header: true,
        complete: function (results: ParseResult<Region>) {
          console.log(`Received region data, with ${results.data.length} rows`);
          const regionMap = results.data.reduce((acc, region) => {
            if (region.sub_region_3_code) {
              region.region_type = RegionType.SubRegionThree;
              region.parent_region_type = RegionType.SubRegionTwo;
            } else if (region.sub_region_2_code) {
              region.region_type = RegionType.SubRegionTwo;
              region.parent_region_type = RegionType.SubRegionOne;
            } else if (region.sub_region_1_code) {
              region.region_type = RegionType.SubRegionOne;
              region.parent_region_type = RegionType.CountryRegion;
            } else if (region.country_region_code) {
              region.region_type = RegionType.CountryRegion;
            }

            // for special cases like Washington DC
            if (region.parent_region_type && !region[region.parent_region_type]) {
              if (region.sub_region_1_code && region.region_type !== RegionType.SubRegionOne) {
                region.parent_region_type = RegionType.SubRegionOne;
              } else if (region.country_region_code) {
                region.parent_region_type = RegionType.CountryRegion;
              }
            }

            acc.set(region.place_id, region);
            return acc;
          }, new Map<string, Region>());
          regions = regionMap;
          resolve(regionMap);
        },
      });
    });

    return regionPromise;
  }
}


function coerceNumber(u: unknown) {
  if (u === "") {
    return NaN;
  } else {
    return Number.parseFloat(u as string);
  }
}


export function fetchRegionalTrendLines(selectedCountryMetadata): Promise<RegionalTrendLine[]> {
  if (regionalTrendLines && regionalTrendLines[0].country_region_code == selectedCountryMetadata.countryCode) {
    return Promise.resolve(regionalTrendLines);
  } else if (selectedCountryMetadata) {
    let results: Promise<RegionalTrendLine[]> = new Promise(
      (resolve, reject) => {
        parse("./data/" + selectedCountryMetadata.dataFile, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function (results: ParseResult<RegionalTrendLine>) {
            console.log(
              `Load regional trend data with ${results.data.length} from ${selectedCountryMetadata.dataFile}`
            );
            const mappedData = results.data.map((d) => {
              const parsedRow: RegionalTrendLine = {
                date: d.date,
                country_region: d.country_region,
                country_region_code: d.country_region_code,
                sub_region_1: d.sub_region_1,
                sub_region_1_code: d.sub_region_1_code,
                sub_region_2: d.sub_region_2,
                sub_region_2_code: d.sub_region_2_code,
                sub_region_3: d.sub_region_3,
                sub_region_3_code: d.sub_region_3_code,
                place_id: d.place_id,
                //We need to coerce number parsing since papaparse only gives us strings
                sni_covid19_vaccination: coerceNumber(
                  d.sni_covid19_vaccination
                ),
                sni_vaccination_intent: coerceNumber(d.sni_vaccination_intent),
                sni_safety_side_effects: coerceNumber(
                  d.sni_safety_side_effects
                ),
              };
              return parsedRow;
            });
            regionalTrendLines = mappedData;
            resolve(mappedData);
          },
        });
      }
    );
    return results;
  }
}


// Serialize access to make sure we don't do a double request
export const fetchGlobalTrendLines: () => Promise<CountryTrendLine[]> =
  serializePromises(_fetchGlobalTrendLines);

function _fetchGlobalTrendLines(): Promise<CountryTrendLine[]> {
  if (globalTrendLines) {
    return Promise.resolve(globalTrendLines);
  } else {
    let results: Promise<CountryTrendLine[]> = new Promise(
      (resolve, reject) => {
        parse("./data/" + GLOBAL_TRENDS_FILENAME, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function (results: ParseResult<CountryTrendLine>) {
            console.log(
              `Load global trend data with ${results.data.length} rows`
            );
            const mappedData = results.data.map((d) => {
              const parsedRow: CountryTrendLine = {
                date: d.date,
                country_region: d.country_region,
                country_region_code: d.country_region_code,
                place_id: d.place_id,
                //We need to coerce number parsing since papaparse only gives us strings
                sni_covid19_vaccination: coerceNumber(
                  d.sni_covid19_vaccination
                ),
                sni_vaccination_intent: coerceNumber(d.sni_vaccination_intent),
                sni_safety_side_effects: coerceNumber(
                  d.sni_safety_side_effects
                ),
              };
              return parsedRow;
            });
            globalTrendLines = mappedData;
            resolve(mappedData);
          },
        });
      }
    );
    return results;
  }
}

export function fetchZipData(geoid: string, selectedCountryCode: string): Promise<any> {
  var baseUrl =
    "https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/staging/geo"
  return fetch(`${baseUrl}/${ZIP_FILENAME_STRUCTURE[selectedCountryCode](geoid)}`).then((response) =>
    response.json()
  );
}

/**
 * A method to read in the ALL_dates.csv file into an array of dates strings.
 * @returns an array of date string values
 */
 export function fetchDateData() {
  parse("./data/All_dates.csv", {
    download: true,
    header: false,
    complete: function (results: ParseResult<string>) {
      console.log(`Recieved date data with: ${results.data.length} rows`);
      const dates = results.data.map((dates) => dates[0]);
      dates.pop();
      dateRange.set(dates)
      //return output;
    }
  })
  return ['']
}

export function fetchRegionalTrendsData(trendLines: Promise<RegionalTrendLine[]>): Promise<
  Map<string, RegionalTrends>
> {
  // TODO(jelenako): check if regionalTrends already loaded for selected country
  // if (regionalTrends) {
  //   return Promise.resolve(regionalTrends);
  // } else {
  return trendLines.then((rtls) => {
    // Convert table data into per-trend time-series.
    regionalTrends = _convert_table_to_trend_timeseries(rtls);
    return regionalTrends;
  });
}

export function fetchGlobalTrendsData(): Promise<Map<string, RegionalTrends>> {
  if (globalTrends) {
    return Promise.resolve(globalTrends);
  } else {
    return fetchGlobalTrendLines().then((rtls) => {
      // Convert table data into per-trend time-series.
      globalTrends = _convert_table_to_trend_timeseries(rtls);
      return globalTrends;
    });
  }
}

// Convert table data into per-trend time-series.
function _convert_table_to_trend_timeseries(rtls) {
  let nestedTrends = d3Collection
    .nest<CountryTrendLine, RegionalTrends>()
    .key((row: CountryTrendLine) => {
      return row.place_id;
    })
    .sortValues((leaf_l, leaf_r) => d3.ascending(leaf_l.date, leaf_r.date))
    .rollup((leaves) => {
      let covid19_vaccination = [];
      let vaccination_intent = [];
      let safety_side_effects = [];
      leaves.map((leaf) => {
        covid19_vaccination.push({
          date: leaf.date,
          value: leaf.sni_covid19_vaccination,
        });
        vaccination_intent.push({
          date: leaf.date,
          value: leaf.sni_vaccination_intent,
        });
        safety_side_effects.push({
          date: leaf.date,
          value: leaf.sni_safety_side_effects,
        });
      });
      return {
        place_id: leaves[0].place_id,
        trends: {
          covid19_vaccination,
          vaccination_intent,
          safety_side_effects,
        },
      };
    })
    .entries(rtls);
  //d3Collection nest/rollup gives us an output that is just untyped Key-Value pairs
  //so let's convert it into an actual map.
  const trends = nestedTrends.reduce((acc, trend) => {
    acc.set(trend.key, trend.value);
    return acc;
  }, new Map<string, RegionalTrends>());
  return trends
}

export function selectRegionOneTrends(
  rtls: RegionalTrendLine[]
): RegionalTrendLine[] {
  return rtls.filter(
    (region) =>
      subRegionTwoCode(region) == "" && subRegionThreeCode(region) == ""
  );
}

export function selectRegionTwoTrends(
  rtls: RegionalTrendLine[]
): RegionalTrendLine[] {
  return rtls.filter(
    (region) =>
      subRegionTwoCode(region) != "" && subRegionThreeCode(region) == ""
  );
}

export function subRegionOneCode(region: RegionalTrendLine): string {
  return region.sub_region_1_code;
}

export function subRegionTwoCode(region: RegionalTrendLine): string {
  if (region.sub_region_2_code != "") {
    return region.sub_region_2_code;
  } else if (["AU", "GB"].includes(region.country_region_code) && region.sub_region_2 != "") {
    // GB and AU don't have sub_region_2_code in the data CSV, therefore use lookup table
    return getCountyFipsCode(region.sub_region_2, region.sub_region_1, region.country_region_code);
  } else {
    return "";
  }
}

export function subRegionThreeCode(region: RegionalTrendLine): string {
  return region.sub_region_3_code;
}

export function aggregateRegionDataForDate(
  rtls: RegionalTrendLine[],
  date: string,
  aggKeyFn: (RegionalTrendLine) => string
): Map<string, RegionalTrendAggregate> {
  const dataMap = rtls
    .filter((rtl) => rtl.date == date)
    .reduce((acc, region) => {
      acc.set(aggKeyFn(region), {
        sni_covid19_vaccination: +region.sni_covid19_vaccination,
        sni_vaccination_intent: +region.sni_vaccination_intent,
        sni_safety_side_effects: +region.sni_safety_side_effects,
      });
      return acc;
    }, new Map<string, RegionalTrendAggregate>());
  return dataMap;
}

export function buildDateRangeList(rtls: RegionalTrendLine[]): string[] {
  const uniqueDates: Set<string> = rtls.reduce((acc, region) => {
    acc.add(region.date);
    return acc;
  }, new Set<string>());
  const dateList: string[] = Array.from(uniqueDates.values());
  dateList.sort();
  return dateList;
}

export function getTrendValue(
  trendName: string,
  trend: RegionalTrendLine
): number {
  switch (trendName) {
    case "vaccination":
      return trend ? trend.sni_covid19_vaccination | 0 : 0;
    case "intent":
      return trend ? trend.sni_vaccination_intent | 0 : 0;
    case "safety":
      return trend ? trend.sni_safety_side_effects | 0 : 0;
    default:
      console.log(`Unknown trend type: ${trendName}`);
      return;
  }
}

export enum TrendValueType {
  Vaccination = "vaccination",
  Intent = "intent",
  Safety = "safety"
}

export interface QueryRow {
  date: string;
  country_region: string;
  country_region_code: string;
  sub_region_1: string;
  sub_region_1_code: string;
  sub_region_2: string;
  sub_region_2_code: string;
  sub_region_3: string;
  sub_region_3_code: string;
  place_id: string;
  query_type: string;
  query: string;
  rank: number;
  sni: number;
  category: string;
}

export interface Query {
  query: string;
  rank: number;
}

export function createSerialisedQueryKey(place_id: string, date: string, query_type: string, category: string): string {
  return place_id + "," + date + "," + query_type + "," + category;
}

function extractDateFromQueryKey(key: string) {
  return key.split(',')[1];
}

/**
 * Creates a unique list of dates based on the data in the queries map keys.
 */
export function createDateList(keyList: string[]): string[] {
  const uniqueDates: Set<string> = keyList.reduce((dates, key) => {
    dates.add(extractDateFromQueryKey(key));
    return dates;
  }, new Set<string>());
  const dateList: string[] = Array.from(uniqueDates.values());
  dateList.sort();
  return dateList;
}

function createQuery(queryRow: QueryRow): Query {
  return { query: queryRow.query, rank: queryRow.rank };
}

let topQueriesDates: Set<string> = new Set<string>();
let topQueriesStoragePrefix: string = "https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/top_queries/";

/**
 * Reads a given csv file and returns a Promise that holds a map that has keys created
 * based on the location, date, query type, and category of an associated list of
 * queries.
 */
export function fetchQueriesFile(file: string): Promise<Map<string, Query[]>> {
  let topQueriesPromise: Promise<Map<string, Query[]>> = new Promise<Map<string, Query[]>>(
    (resolve, reject) => {
      parse(`${topQueriesStoragePrefix}${file}`, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results: ParseResult<QueryRow>) {
          console.log(`Received top queries data with ${results.data.length} rows`);
          const topQueries = results.data.reduce((accMap, row) => {
            topQueriesDates.add(row.date);
            let key = createSerialisedQueryKey(row.place_id, row.date, row.query_type, row.category);
            let query = createQuery(row);
            if (!accMap.has(key)) {
              accMap.set(key, []);
            }
            accMap.set(key, [...accMap.get(key), query]);
            return accMap;
          }, new Map<string, Query[]>());
          resolve(topQueries);
        },
      });
    });
  return topQueriesPromise;
}

/**
 * Reads all L0 and L1 TopQueries csv files and merges them into a single map.
 */
export function fetchTopLevelQueries(selectedCountryCode): Promise<Map<string, Query[]>> {
  let topQueriesFiles = [
    selectedCountryCode + "_l0_vaccination_trending_searches.csv",
    selectedCountryCode + "_l1_vaccination_trending_searches.csv"];
  let topQueriesData: Promise<Map<string, Query[]>> =
    Promise.all(topQueriesFiles.map((file) =>
      fetchQueriesFile(file)
    )
    ).then(
      (results) => {
        return results.reduce((combinedMap, currentMap) => {
          return new Map([...combinedMap, ...currentMap]);
        }, new Map<string, Query[]>());
      }
    );
  return topQueriesData;
}

export interface ClusterRow {
  date: string;
  country_region: string;
  country_region_code: string;
  sub_region_1: string;
  sub_region_1_code: string;
  sub_region_2: string;
  sub_region_2_code: string;
  sub_region_3: string;
  sub_region_3_code: string;
  place_id: string;
  query_type: string;
  query: string;
  rank: number;
  sni: number;
  history: string;
  members: string;
  num_members: number;
  category: string;
}

export interface Cluster {
  query: string;
  sni: number;
  rank: number;
  change: number;
  members: string[];
}

function removeDuplicate(clusterQuery: string, members: string[]): string[] {
  return members.filter(member => member != clusterQuery)
}

function calculateChange(history: number[], current: number) {
  if (history.length === 0) {
    return null
  }
  const previous = history[history.length - 1];
  return Math.round(((current - previous) / previous) * PERCENTAGE);
}

function createCluster(clusterRow: ClusterRow): Cluster {
  const historyList = !clusterRow.history ? [] : clusterRow.history.split("|").map(value => Number(value));
  const membersList = !clusterRow.members ? [] : removeDuplicate(clusterRow.query, clusterRow.members.split("|"));
  const clusterChange = calculateChange(historyList, clusterRow.sni);
  return { query: clusterRow.query, sni: clusterRow.sni, rank: clusterRow.rank, change: clusterChange, members: membersList };
}

let clustersStoragePrefix: string = "https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/top_clusters/";

/**
 * Reads a given csv file and returns a Promise that holds a map that has keys created
 * based on the location, date, query type, and category of an associated list of
 * queries.
 */
export function fetchClustersFile(file: string, selectedCountryCode: string): Promise<Map<string, Cluster[]>> {
  let storagePrefix: string = selectedCountryCode == 'US' ? clustersStoragePrefix : topQueriesStoragePrefix;
  if (selectedCountryCode == 'CA') {
    file = file.replace('_l2_', '_l3_');
  }
  let clustersPromise: Promise<Map<string, Cluster[]>> = new Promise<Map<string, Cluster[]>>(
    (resolve, reject) => {
      parse(`${storagePrefix}${file}`, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results: ParseResult<ClusterRow>) {
          console.log(`Received top queries data with ${results.data.length} rows`);
          const clusters = results.data.reduce((accMap, row) => {
            topQueriesDates.add(row.date);
            let key = createSerialisedQueryKey(row.place_id, row.date, row.query_type, row.category);
            let query = createCluster(row);
            if (!accMap.has(key)) {
              accMap.set(key, []);
            }
            accMap.set(key, [...accMap.get(key), query]);
            return accMap;
          }, new Map<string, Cluster[]>());
          resolve(clusters);
        },
      });
    });
  return clustersPromise;
}

/**
 * Reads all L0 and L1 Clusters csv files and merges them into a single map.
 */
export function fetchTopLevelClusterFiles(selectedCountryCode): Promise<Map<string, Cluster[]>> {
  let clusterFiles = [selectedCountryCode + "_l0_vaccination_trending_searches.csv",
                      selectedCountryCode + "_l1_vaccination_trending_searches.csv"];
  let clustersMap: Promise<Map<string, Cluster[]>> =
    Promise.all(clusterFiles.map((file) =>
      fetchClustersFile(file, selectedCountryCode)
      )
    ).then(
      (results) => {
        return results.reduce((combinedMap, currentMap) => {
          return new Map([...combinedMap, ...currentMap]);
        }, new Map<string, Cluster[]>());
      }
    );
  return clustersMap;
}
