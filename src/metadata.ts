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


//import { parse, ParseResult } from "papaparse";

import * as metadata from '../public/data/VSI_metadata.json';

export function fetchCountryMetaData(countryCode: string) {
    //let countryMetadata = JSON.parse(metadata)
    return metadata.filter((c) => c.countryCode == countryCode);
}

function _testCountryMetaData(){
    const countries = ["CA", "GB", "US"]
   countries.forEach(country => {
       console.log("testing "+country);
       console.log(fetchCountryMetaData(country))
       console.log("done with "+country)
       
   });
}

function c(c: any) {
    throw new Error('Function not implemented.');
}
