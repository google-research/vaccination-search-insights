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

/* Simple component to return country metadata for a given country name. */
import metadata from '../public/data/VSI_metadata.json';
 
export function fetchCountryMetaData(countryNameString: string) {
    //const countryData = metadata;
    return metadata.filter(c => c.countryName === countryNameString);
}

export function fetchCountryNames() {
    // TODO: we can add some logic here and in the metadata.json to filter for a valid country tag.
    var countryList = [];
    metadata.forEach((country) => countryList.push(country.countryName));
    // TODO: remove filter CA or IE when it is ready for launch
    return countryList.filter(c => c != "Canada" && c != "Ireland");
}

// TODO: Remove these tests once we are satisfied this component does its job.
/*
function _testCountryMetaData(){
    const countries = ["Canada", "United Kingdom", "United States"]
    countries.forEach(country => {
       console.log("testing "+country);
       console.log(fetchCountryMetaData(country))
       console.log("done with "+country)
       
   });
}

function _testCountryList(){
    var myCountries = fetchCountryNames();
    console.log(myCountries);
}
 _testCountryMetaData();
 _testCountryList();
 */