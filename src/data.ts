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
}

export interface RegionalTrendLine {
  date: Date;
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

let regions: Map<string, Region>;
let regionalTrends: Map<string, RegionalTrends>;
let regionalTrendLines: RegionalTrendLine[];

//https://thoughtspile.github.io/2018/06/20/serialize-promises/
function serializePromises<T>(immediate: () => Promise<T>): () => Promise<T> {
  // This works as our promise queue
  let last: Promise<any> = Promise.resolve();
  return function () {
    // Catch is necessary here — otherwise a rejection in a promise will
    // break the serializer forever
    last = last.catch(() => {}).then(() => immediate());
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
    return 0;
  } else {
    return Number.parseFloat(u as string);
  }
}

//During initialization it's possible this is called twice in succession before we get a chance to cache the result.
//So let's serialize access to make sure we don't do a double request
export const fetchRegionalTrendLines: () => Promise<RegionalTrendLine[]> =
  serializePromises(_fetchRegionalTrendLines);

function _fetchRegionalTrendLines(): Promise<RegionalTrendLine[]> {
  if (regionalTrendLines) {
    return Promise.resolve(regionalTrendLines);
  } else {
    let results: Promise<RegionalTrendLine[]> = new Promise(
      (resolve, reject) => {
        parse("./data/Global_vaccination_search_insights.csv", {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function (results: ParseResult<RegionalTrendLine>) {
            console.log(
              `Load regional trend data with ${results.data.length} rows`
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

export function fetchRegionalTrendsData(): Promise<
  Map<string, RegionalTrends>
> {
  if (regionalTrends) {
    return Promise.resolve(regionalTrends);
  } else {
    return fetchRegionalTrendLines().then((rtls) => {
      // Convert table data into per-trend time-series.
      let nestedTrends = d3Collection
        .nest<RegionalTrendLine, RegionalTrends>()
        .key((row: RegionalTrendLine) => {
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
      regionalTrends = trends;
      return trends;
    });
  }
}

export function selectRegionOneTrends(
  rtls: RegionalTrendLine[]
): RegionalTrendLine[] {
  return rtls.filter((region) => subRegionTwoCode(region) == "");
}

export function selectRegionTwoTrends(
  rtls: RegionalTrendLine[]
): RegionalTrendLine[] {
  return rtls.filter((region) => subRegionTwoCode(region) != "");
}

export function subRegionOneCode(region: RegionalTrendLine): string {
  return region.sub_region_1_code;
}

export function subRegionTwoCode(region: RegionalTrendLine): string {
  return region.sub_region_2_code;
}

export function getLatestRegionData(
  rtls: RegionalTrendLine[],
  aggKeyFn: (RegionalTrendLine) => string
): Map<string, RegionalTrendAggregate> {
  const latestDate = d3.max(rtls.map((rtl) => rtl.date));
  const dataMap = rtls
    .filter((rtl) => rtl.date == latestDate)
    .reduce((acc, region) => {
      acc.set(aggKeyFn(region), {
        sni_covid19_vaccination: +region.sni_covid19_vaccination,
        sni_vaccination_intent: +region.sni_vaccination_intent,
        sni_safety_side_effects: +region.sni_safety_side_effects,
      });
      return acc;
    }, new Map<string, RegionalTrendAggregate>());
  dataMap["latestDate"] = latestDate;
  return dataMap;
}
