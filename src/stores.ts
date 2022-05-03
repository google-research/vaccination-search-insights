/**
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

/**
 * @fileoverview The state of the application persisted to query parameters
 */

import { writable } from "svelte/store";
import type { RegionalTrends } from "./data";
import { fetchDateData } from "./data";

let rt = new Map<string, RegionalTrends>();
let allDates: string[]

type Params = {
  placeId: string;
  updateHistory: boolean;
};

// TODO(patankar): Make browser back/forward update params after refactor.

function loadParams(): Params {
  const searchParams = new URLSearchParams(window.location.search);
  const placeId = searchParams.has("placeId")
    ? searchParams.get("placeId")
    : "";
  return {
    placeId,
    updateHistory: true,
  };
}

function saveParams(param: Params) {
  if (param.placeId && param.updateHistory) {
    history.pushState(null, null, `?placeId=${param.placeId}`);
  } else if (!param.placeId && param.updateHistory) {
    history.pushState(null, null, "?")
  }
}

export const params = writable(loadParams());
params.subscribe(saveParams);
window.onpopstate = function () {
  params.update((p) => {
    p = loadParams();
    p.updateHistory = false;
    return p;
  });
};

// Using stores to keep the data to be used for the map visual.
// This allows the data to be updated in cases where we load additional data later.
// i.e. US zip codes.
export const mapData = writable([]);
// Using stores to keep the data to be used for the time series visuals.
// This allows the data to be updated in cases where we load additional data later.
// i.e. US zip codes.
export const regionalTrends = writable(rt);

// A parameter to track whether the zipcodes file has been downloaded.
// This helps prevent repeatedly fetching the large file.
export const isZipsDownloaded = writable(false);

/** 
 * A store to contain an array of all valid dates
 */
export const dateRange = writable<string[]>(fetchDateData());


