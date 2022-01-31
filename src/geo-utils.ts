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
import * as gb from "../public/geo/gb-counties-albers.json";
import * as ie from "../public/geo/ie-counties-albers.json";
import * as gb_postal_albers from "../public/geo/gb-postal-albers.json";
import type { Region } from "./data";

let regionCodesToPlaceId: Map<string, string>;

export const dcStateFipsCode: string = "11";
export const dcCountyFipsCode: string = "11001";

export const regionOneToFipsCode: Map<string, Map<string, string>> = new Map([
  ['US', new Map([
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
    ["US-VI", "78"]])],
  ['GB', new Map([
    ["GB-ENG", "E"],
    ["GB-SCT", "S"],
    ["GB-WLS", "W"],
    ["GB-NIR", "N"]])],
  ['CA', new Map([
    ["CA-BC", "59"],
    ["CA-AB", "48"],
    ["CA-SK", "47"],
    ["CA-MB", "46"],
    ["CA-ON", "35"],
    ["CA-QC", "24"],
    ["CA-NB", "13"],
    ["CA-NS", "12"],
    ["CA-PE", "11"],
    ["CA-NL", "10"],
    ["CA-YU", "60"],
    ["CA-NW", "61"],
    ["CA-NV", "62"]])],
  ['IE', new Map([
    ["IE-DL", "1"],
    ["IE-LK", "2"],
    ["IE-KE", "3"],
    ["IE-WD", "4"],
    ["IE-D", "5"],
    ["IE-WH", "6"],
    ["IE-MN", "7"],
    ["IE-WW", "8"],
    ["IE-CO", "9"],
    ["IE-KY", "10"],
    ["IE-RN", "11"],
    ["IE-WX", "12"],
    ["IE-LD", "13"],
    ["IE-MH", "14"],
    ["IE-CN", "15"],
    ["IE-CW", "16"],
    ["IE-MO", "17"],
    ["IE-LH", "18"],
    ["IE-SO", "19"],
    ["IE-LM", "20"],
    ["IE-KK", "21"],
    ["IE-OY", "22"],
    ["IE-LS", "23"],
    ["IE-G", "24"],
    ["IE-TA", "25"],
    ["IE-CE", "26"]])]]);

export function stateFipsCodeFromCounty(countyFipsCode: string, countryCode): string {
  if (countryCode == "US") {
    return countyFipsCode.slice(0, 2);
  } else if (countryCode == "GB") {
    return countyFipsCode.slice(0, 1);
  }
}

export function fipsCodeFromElementId(id: string): string {
  return id.split("-")[1];
}

// Get the name of the level from element ID (if "postcode-E14", returns "postcode")
export function levelNameFromElementId(id: string): string {
  return id.split("-")[0];
}

export function getAtlas(countryCode: string): UsAtlas {
  if (countryCode == "US") {
    return us as unknown as UsAtlas;
  } else if (countryCode == "GB") {
    return gb as unknown as UsAtlas;
  } else if (countryCode == "IE") {
    return ie as unknown as UsAtlas;
  } else if (countryCode == "CA") {
    //TODO: add CA atlas
    return null as unknown as UsAtlas;
  } 
}

export function getGbPostalCentroids(geoid: string) {
  return gb_postal_albers;
}

export function buildRegionCodeToPlaceIdMapping(
  regions: Region[], countryCode
): Map<string, string> {
  return regions.reduce((acc, region) => {
    if (region.sub_region_3_code != "") {
      // TODO: Ignore zipcodes-level data for now.
      // Can't just use sub_region_3_code directly because it overlaps with
      // sub_region_2_code, eg '06043' is a zipcode in CT and fips in CA.
    } else if (region.sub_region_2_code == "") {
      acc.set(
        regionOneToFipsCode.get(countryCode).get(region.sub_region_1_code),
        region.place_id
      );
    } else {
      acc.set(region.sub_region_2_code, region.place_id);
    }
    return acc;
  }, new Map<string, string>());
}
