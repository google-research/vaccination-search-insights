import { parse, ParseResult } from "papaparse";
import { fetchRegionalTrendsData, RegionalTrendLine, RegionalTrends } from "./data";
import { mapData, regionalTrends } from "./stores";

const US_ZIP_FILENAMES = ["./data/US_zips_2021.csv", "./data/US_zips_2022.csv", "./data/US_zips_2023.csv"]

function coerceNumber(u: unknown) {
  if (u === "") {
    return NaN;
  } else {
    return Number.parseFloat(u as string);
  }
}

export function fetchZipTrendLines(filename: string): Promise<RegionalTrendLine[]> {
  let results: Promise<RegionalTrendLine[]> = new Promise(
    (resolve, reject) => {
      parse(filename /*change this if the file location changes*/, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results: ParseResult<RegionalTrendLine>) {
          console.log(
            `Load regional zips trend data with ${results.data.length} from zips file `
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
          
          resolve(mappedData);
        },
      });
    }
  );
  return results;
}


export async function updateWithZipsData() {
  let zipsTrendLineData: RegionalTrendLine[] = [];
  for (const filename of US_ZIP_FILENAMES) {
    zipsTrendLineData = zipsTrendLineData.concat(await fetchZipTrendLines(filename))
  }

  mapData.update((m) => m.concat(zipsTrendLineData));

  let regT: Map<string, RegionalTrends>;
  regionalTrends.subscribe((map) => { regT = map });
  let RegionalTrendZipData = fetchRegionalTrendsData(Promise.all(zipsTrendLineData))
  RegionalTrendZipData.then((rTZD) => {
    for (let [k, v] of rTZD) {
      regT.set(k, v);
    }
    regionalTrends.set(regT);
  });

  return [zipsTrendLineData, RegionalTrendZipData]
}
