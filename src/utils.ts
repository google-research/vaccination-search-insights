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

import type { Region } from "./data";
import * as d3 from "d3";

export function getRegionName(region: Region): string {
  let regionName: string;

  if (!region) {
    return "";
  }
  if (region.sub_region_3) {
    regionName = region.sub_region_3_code;

    if (region.sub_region_2) {
      regionName += `, ${region.sub_region_2}`;
    }
  } else if (region.sub_region_2) {
    regionName = region.sub_region_2;

    if (region.sub_region_1) {
      regionName += `, ${region.sub_region_1}`;
    }
  } else if (region.sub_region_1) {
    regionName = region.sub_region_1;

    if (region.country_region) {
      regionName += `, ${region.country_region}`;
    }
  } else if (region.country_region) {
    regionName = region.country_region;
  }

  return regionName;
}

export function inClientBounds(
  clientX: number,
  clientY: number,
  bounds: DOMRect
): boolean {
  return (
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
}

export function handleInfoPopup(event, id): void {
  if (id === document.activePopupId) {
    dismissInfoPopup(event);
  } else {
    const popup: d3.Selection<SVGGElement, any, any, any> = d3.select(id);
    const infoRect: DOMRect = event.target.getBoundingClientRect();

    if (document.activePopupId) {
      dismissInfoPopup(event);
    }

    popup
      .style("display", "block")
      .style("left", `${infoRect.x + infoRect.width + window.pageXOffset}px`)
      .style("top", `${infoRect.y + infoRect.height + window.pageYOffset}px`);

    event.stopPropagation();
    document.activePopupId = id;
    document.addEventListener("click", dismissInfoPopup);
  }
}

function dismissInfoPopup(event): void {
  const popup: d3.Selection<SVGGElement, any, any, any> = d3.select(document.activePopupId);
  if (
    !inClientBounds(
      event.clientX,
      event.clientY,
      popup.node().getBoundingClientRect()
    )
  ) {
    popup.style("display", "none");
    document.removeEventListener("click", dismissInfoPopup);
    document.activePopupId = null;
    event.stopPropagation();
  }
}

