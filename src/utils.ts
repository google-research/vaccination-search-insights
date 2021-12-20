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

import { Region, RegionType } from "./data";
import * as d3 from "d3";

let activePopupId: string;

export function getRegionName(region: Region): string {
  let regionName: string;
  let parentRegionName: string;

  if (!region) {
    return "";
  }

  if (region.region_type === RegionType.SubRegionThree) {
    regionName = region[`${region.region_type}_code`];
  } else {
    regionName = region[region.region_type];
  }

  parentRegionName = region[region.parent_region_type];

  if (parentRegionName) {
    return `${regionName}, ${parentRegionName}`;
  } else {
    return regionName;
  }
}

export function getCountryName(region: Region): string{  
  return region.country_region;
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
  if (id === activePopupId) {
    dismissInfoPopup(event);
  } else {
    const popup: d3.Selection<SVGGElement, any, any, any> = d3.select(id);
    const infoRect: DOMRect = event.target.getBoundingClientRect();
    const popupRectWidth = 310;
    const rightPadding = 20;

    if (activePopupId) {
      dismissInfoPopup(event);
    }

    const offsetOnRight = infoRect.x + infoRect.width + window.pageXOffset;

    const left =
      offsetOnRight + popupRectWidth > window.innerWidth
        ? window.innerWidth - popupRectWidth - rightPadding
        : offsetOnRight;

    popup
      .style("display", "block")
      .style("left", `${left}px`)
      .style("top", `${infoRect.y + infoRect.height + window.pageYOffset}px`);

    event.stopPropagation();
    activePopupId = id;
    document.addEventListener("click", dismissInfoPopup);
  }
}

function dismissInfoPopup(event): void {
  const popup: d3.Selection<SVGGElement, any, any, any> =
    d3.select(activePopupId);
  if (
    !inClientBounds(
      event.clientX,
      event.clientY,
      popup.node().getBoundingClientRect()
    )
  ) {
    popup.style("display", "none");
    document.removeEventListener("click", dismissInfoPopup);
    activePopupId = null;
    event.stopPropagation();
  }
}

type HtmlSelection = d3.Selection<HTMLElement, any, any, any>;
type SvgSelection = d3.Selection<SVGGElement, any, any, any>;
type ElementSection = HtmlSelection | SvgSelection;

export function formatDateForDisplay(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function formatDateForStorage(date: Date): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "2-digit" }).format(
    date
  );
  const day = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(
    date
  );
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(
    date
  );

  return `${year}-${month}-${day}`;
}

export function convertStorageDate(storageDate: string): Date {
  const date = new Date(storageDate);
  const time = date.getTime();
  const timeZoneOffset = date.getTimezoneOffset() * 60 * 1000;
  const adjustedTime = time + timeZoneOffset;

  return new Date(adjustedTime);
}

export function getClosestDate(selected, earlier, later) {
  if (!earlier && later) {
    return later;
  } else if (!later && earlier) {
    return earlier;
  } else if (
    selected.getTime() - earlier.getTime() <
    later.getTime() - selected.getTime()
  ) {
    return earlier;
  } else {
    return later;
  }
}