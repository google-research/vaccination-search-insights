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

import type { UsAtlas } from "topojson";
import * as us from "us-atlas/counties-albers-10m.json";
import * as gb from "../public/geo/gb_states.json";
import type { Region } from "./data";

let regionCodesToPlaceId: Map<string, string>;

export const dcStateFipsCode: string = "11";
export const dcCountyFipsCode: string = "11001";

export const regionOneToFipsCode: Map<string, string> = new Map([
  ["US-AL", "01"],
  ["US-AK", "02"],
  ["US-AZ", "04"],
  ["US-AR", "05"],
  ["US-CA", "06"],
  ["US-CO", "08"],
  ["US-CT", "09"],
  ["US-DE", "10"],
  ["US-DC", "11"],
  ["US-FL", "12"],
  ["US-GA", "13"],
  ["US-HI", "15"],
  ["US-ID", "16"],
  ["US-IL", "17"],
  ["US-IN", "18"],
  ["US-IA", "19"],
  ["US-KS", "20"],
  ["US-KY", "21"],
  ["US-LA", "22"],
  ["US-ME", "23"],
  ["US-MD", "24"],
  ["US-MA", "25"],
  ["US-MI", "26"],
  ["US-MN", "27"],
  ["US-MS", "28"],
  ["US-MO", "29"],
  ["US-MT", "30"],
  ["US-NE", "31"],
  ["US-NV", "32"],
  ["US-NH", "33"],
  ["US-NJ", "34"],
  ["US-NM", "35"],
  ["US-NY", "36"],
  ["US-NC", "37"],
  ["US-ND", "38"],
  ["US-OH", "39"],
  ["US-OK", "40"],
  ["US-OR", "41"],
  ["US-PA", "42"],
  ["US-RI", "44"],
  ["US-SC", "45"],
  ["US-SD", "46"],
  ["US-TN", "47"],
  ["US-TX", "48"],
  ["US-UT", "49"],
  ["US-VT", "50"],
  ["US-VA", "51"],
  ["US-WA", "53"],
  ["US-WV", "54"],
  ["US-WI", "55"],
  ["US-WY", "56"],
  ["US-AS", "60"],
  ["US-GU", "66"],
  ["US-MP", "69"],
  ["US-PR", "72"],
  ["US-VI", "78"],
]);

export function stateFipsCodeFromCounty(countyFipsCode: string): string {
  return countyFipsCode.slice(0, 2);
}

export function fipsCodeFromElementId(id: string): string {
  return id.slice(5);
}

export function getAtlas(countryCode: string): UsAtlas {
  if (countryCode == "US") {
    return us as unknown as UsAtlas;
  } else if (countryCode == "GB") {
    return gb as unknown as UsAtlas;
  }
}

export function buildRegionCodeToPlaceIdMapping(
  regions: Region[]
): Map<string, string> {
  return regions.reduce((acc, region) => {
    if (region.sub_region_3_code != "") {
      // TODO: Ignore zipcodes-level data for now.
      // Can't just use sub_region_3_code directly because it overlaps with
      // sub_region_2_code, eg '06043' is a zipcode in CT and fips in CA.
    } else if (region.sub_region_2_code == "") {
      acc.set(
        regionOneToFipsCode.get(region.sub_region_1_code),
        region.place_id
      );
    } else {
      acc.set(region.sub_region_2_code, region.place_id);
    }
    return acc;
  }, new Map<string, string>());
}
