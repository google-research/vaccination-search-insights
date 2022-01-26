import { parse, ParseResult } from "papaparse";
import type { RegionalTrendLine } from "./data";

let rTL: RegionalTrendLine[];

export function coerceNumber(u: unknown) {
  if (u === "") {
    return NaN;
  } else {
    return Number.parseFloat(u as string);
  }
}

export function fetchZipTrendLines(): Promise<RegionalTrendLine[]> {
  if (rTL && rTL[0].country_region_code == 'US'){ //selectedCountryMetadata.countryCode) {
    return Promise.resolve(rTL);
  } else {//if (selectedCountryMetadata) {
    let results: Promise<RegionalTrendLine[]> = new Promise(
      (resolve, reject) => {
        parse("./data/" + "zips_US.csv", {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function (results: ParseResult<RegionalTrendLine>) {
            console.log(
              `Load regional zips trend data with ${results.data.length} from zips file `//${selectedCountryMetadata.dataFile}`
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
            rTL = mappedData;
            resolve(mappedData);
          },
        });
      }
    );
    return results;
  }
}
