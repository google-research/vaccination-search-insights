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
  snf_covid19_vaccination: number;
  snf_vaccination_intent: number;
  snf_safety_side_effects: number;
}

export interface RegionalTrendAggregate {
  snf_covid19_vaccination: number;
  snf_vaccination_intent: number;
  snf_safety_side_effects: number;
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

let regions: Region[];
let regionalTrends: RegionalTrends[];
let regionalTrendLines: RegionalTrendLine[];

/**
 * Methods for getting all remote data, like regions and trends
 */
export function fetchRegionData(): Promise<Region[]> {
  if (regions) {
    return Promise.resolve(regions);
  } else {
    let results: Promise<Region[]> = new Promise((resolve, reject) => {
      parse("./data/regions.csv", {
        download: true,
        header: true,
        complete: function (results: ParseResult<Region>) {
          console.log(`Received the data, with ${results.data.length} rows`);
          regions = results.data;
          resolve(results.data);
        },
      });
    });
    return results;
  }
}

export function fetchRegionalTrendLines(): Promise<RegionalTrendLine[]> {
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
            results.data.map((d) => {
              // temporary work around for
              if (d.sub_region_2_code.length == 4) {
                d.sub_region_2_code = "0" + d.sub_region_2_code;
              }
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
                snf_covid19_vaccination: +d.snf_covid19_vaccination,
                snf_vaccination_intent: +d.snf_vaccination_intent,
                snf_safety_side_effects: +d.snf_safety_side_effects,
              };
              return parsedRow;
            });
            resolve(results.data);
          },
        });
      }
    );
    return results;
  }
}

export function fetchRegionalTrendsData(): Promise<RegionalTrends[]> {
  if (regionalTrends) {
    return Promise.resolve(regionalTrends);
  } else {
    return fetchRegionalTrendLines().then((rtls) => {
      // Convert table data into per-trend time-series.
      let nestedTrends = d3Collection
        .nest()
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
              value: parseFloat(leaf.snf_covid19_vaccination),
            });
            vaccination_intent.push({
              date: leaf.date,
              value: parseFloat(leaf.snf_vaccination_intent),
            });
            safety_side_effects.push({
              date: leaf.date,
              value: parseFloat(leaf.snf_safety_side_effects),
            });
          });
          return {
            covid19_vaccination,
            vaccination_intent,
            safety_side_effects,
          };
        })
        .entries(rtls);
      return nestedTrends;
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
        snf_covid19_vaccination: +region.snf_covid19_vaccination,
        snf_vaccination_intent: +region.snf_vaccination_intent,
        snf_safety_side_effects: +region.snf_safety_side_effects,
      });
      return acc;
    }, new Map<string, RegionalTrendAggregate>());
  return dataMap;
}
