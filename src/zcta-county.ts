// Since zip codes can span over multiple counties, this provides a poper taxonomy mapping
// For the US, converted CSV at
// http://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt
import usZctaCounty from "../public/geo/zcta-county-us.json";
import auZctaCounty from "../public/geo/zcta-county-au.json";
import gbCountryFipsCode from "../public/geo/gb-counties-fips.json";
import auCountryFipsCode from "../public/geo/au-counties-fips.json";

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
const gbCountyFipsCodeMap = gbCountryFipsCode.reduce((acc, r) => {
    acc.set(r.county_name, r.county_fips_code)
    return acc;
}, new Map<string, string>());

/**
 * Mapping of county names as appear in data CSV file to county IDs as they appear in 
 * the map shapefile for Australia
 */
const auCountyFipsCodeMap = auCountryFipsCode.reduce((acc, r) => {
    acc.set(r.county_name, r.county_fips_code)
    return acc;
}, new Map<string, string>());

/**
 * In case sub_region_2_code is missing in the data file (currently only relevant for AU and GB),
 * use the lookup table to match county name with the map shape ID of that county. 
 */
export function getCountyFipsCode(county_name: string, country_code: string) {
    switch(country_code) {
        case "GB":
            return gbCountyFipsCodeMap.get(county_name);
        case "AU":
            return auCountyFipsCodeMap.get(county_name);
        default:
            return ""
    }
}

export function getCountyZctas(fipsCode: string, country_code: string) {
    if (country_code == "US") {
        return usCountyZctaMap.get(fipsCode);
    } else if (country_code == "AU") {
        return auCountyZctaMap.get(fipsCode);
    }
}