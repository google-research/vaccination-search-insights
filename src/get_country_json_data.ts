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

import { handle_promise } from "svelte/internal";

/* This function returns the JSON from a given url.
 * The JSON is an array of country, state, and county values.
*/
export async function getCountryJson(loc: RequestInfo): Promise<any> {
    return await fetch(loc)
    .then((res) => {
        return res.json() 
        })
        .catch((err) => { 
            console.log("an error occured obtaining the json data: "+err);
        })
}

let promise = getCountryJson('../data/US.json')

function test() {
    promise = getCountryJson('../data/US.json');
    console.log("promise is: ")
    console.log(promise);
}

test();