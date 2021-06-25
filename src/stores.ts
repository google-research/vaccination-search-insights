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

type Params = {
  placeId: string;
};

// TODO(patankar): Make browser back/forward update params after refactor.

function loadParams(): Params {
  const searchParams = new URLSearchParams(window.location.search);
  const placeId = searchParams.has("placeId")
    ? searchParams.get("placeId")
    : "";
  return {
    placeId,
  };
}

function saveParams(param: Params) {
  if (param.placeId) {
    history.pushState(null, null, `?placeId=${param.placeId}`);
  }
}

export const params = writable(loadParams());
params.subscribe(saveParams);
