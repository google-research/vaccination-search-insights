// Since zip codes can span over multiple counties, this provides a poper taxonomy mapping
// For the US, converted CSV at
// http://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt
import zctaCounty from "../public/geo/zcta-county-us.json";
import zctaCountyGb from "../public/geo/zcta-county-gb.json";
import gbCountryFipsCode from "../public/geo/gb_counties_fips.json";

const countyZctaMap = zctaCounty.reduce((acc,r)=> {
    acc.set(r.geoid,r.zcta)
    return acc;
}, new Map<string, Array<string>>());

const countyZctaMapGb = zctaCountyGb.reduce((acc, r) => {
    acc.set(r.geoid, r.postal_codes)
    return acc;
}, new Map<string, Array<string>>());

const gbCountryFipsCodeMap = gbCountryFipsCode.reduce((acc, r) => {
    acc.set(r.county_name, r.county_fips_code)
    return acc;
}, new Map<string, string>());

export function getCountyFipsCode(county_name: string) {
    return gbCountryFipsCodeMap.get(county_name);
}

export function getCountyZctas(fipsCode: string){
    return countyZctaMap.get(fipsCode);
}