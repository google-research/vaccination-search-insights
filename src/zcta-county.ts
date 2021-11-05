// Since zip codes can span over multiple counties, this provides a poper taxonomy mapping
// For the US, converted CSV at
// http://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt
import zctaCounty from "../public/geo/zcta-county-us.json";

const countyZctaMap = zctaCounty.reduce((acc,r)=> {
    acc.set(r.geoid,r.zcta)
    return acc;
},new Map<string,Array<string>>());

export function getCountyZctas(fipsCode: string){
    return countyZctaMap.get(fipsCode);
}