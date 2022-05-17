// Since zip codes can span over multiple counties, this provides a poper taxonomy mapping
// For the US, converted CSV at
// http://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt
import usZctaCounty from "../public/geo/zcta-county-us.json";
import auZctaCounty from "../public/geo/zcta-county-au.json";
import gbCountyFipsCode from "../public/geo/gb-counties-fips.json";
import auCountyFipsCode from "../public/geo/au-counties-fips.json";

const AU_CAMBELLTOWN_CITY_COUNCIL_CODE = {
    "AU-NSW": "11500",
    "AU-SA": "40910",
};

const usCountyZctaMap = usZctaCounty.reduce((acc,r)=> {
    acc.set(r.geoid,r.zcta)
    return acc;
}, new Map<string, Array<string>>());

const auCountyZctaMap = auZctaCounty.reduce((acc, r) => {
    acc.set(r.geoid, r.zcta)
    return acc;
}, new Map<string, Array<string>>());

/**
 * Mapping of county names as appear in data CSV file to county IDs as they appear in 
 * the map shapefile for the UK
 */
const gbCountyFipsCodeMap = gbCountyFipsCode.reduce((acc, r) => {
    acc.set(r.county_name, r.county_fips_code)
    return acc;
}, new Map<string, string>());

/**
 * Mapping of county names as appear in data CSV file to county IDs as they appear in 
 * the map shapefile for Australia
 */
const auCountyFipsCodeMap = auCountyFipsCode.reduce((acc, r) => {
    acc.set(r.county_name, r.county_fips_code)
    return acc;
}, new Map<string, string>());

/**
 * In case sub_region_2_code is missing in the data file (currently only relevant for AU and GB),
 * use the lookup table to match county name with the map shape ID of that county. 
 */
export function getCountyFipsCode(county_name: string, state_name: string, country_code: string) {
    switch (country_code) {
        case "AU":
            // Region with the same county name, but located in different states
            if (county_name == "Campbelltown City Council") {
                return AU_CAMBELLTOWN_CITY_COUNCIL_CODE[state_name];
            } else {
                return auCountyFipsCodeMap.get(county_name);
            }
        case "GB":
            return gbCountyFipsCodeMap.get(county_name);
        default:
            return ""
    }
}

/**
 * Get list of zip codes for the country
 */
export function getCountyZctas(fipsCode: string, country_code: string) {
    switch (country_code) {
        case "AU":
            return auCountyZctaMap.get(fipsCode);
        case "US":
            return usCountyZctaMap.get(fipsCode);
        default:
            return ""
    }
}