<script lang="ts">
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
  import AutoComplete from "simple-svelte-autocomplete";
  import type { Region, RegionalTrends, RegionalTrendLine } from "./data";
  import {
    fetchRegionData,
    fetchRegionalTrendsData,
    fetchRegionalTrendLines,
    RegionType,
  } from "./data";
  import { onMount } from "svelte";
  import { params } from "./stores";
  import { getRegionName, getCountryName, handleInfoPopup } from "./utils";
  import * as d3 from "d3";
  import {
    createMap,
    decrementMapDate,
    incrementMapDate,
    resetToUnitedStates,
    setMapTrend,
    setSelectedCounty,
    setSelectedState,
  } from "./choropleth.js";
  import { fetchCountryMetaData } from "./metadata";
  import TimeSeries from "./TimeSeries.svelte";

  let selectedRegion: Region;
  let regions: Region[];
  let regionsByPlaceId: Map<string, Region> = new Map<string, Region>();
  let placeId: string;
  let selectedRegionName: string;
  let selectedCountryName: string;
  let regionalTrends: Map<string, RegionalTrends>;
  let selectedMapTrendId: string = "vaccination";

  let mapData: Promise<RegionalTrendLine[]>;
  let isMapInitialized: boolean = false;

  export let covid_vaccination_title: string;
  export let vaccination_intent_title: string;
  export let safety_side_effects_title: string;
  export let selectedCountryMetadata;

  // TODO(patankar): Update all metric names where they appear.
  let covid19VaccinationChartContainer: HTMLElement;
  let vaccinationIntentChartContainer: HTMLElement;
  let safetySideEffectsChartContainer: HTMLElement;

  function onChangeMapTrend(): void {
    selectedMapTrendId = this.id;
    setMapTrend(selectedMapTrendId);
  }

  function filterDropdownItems(regions: Region[]): Region[] {
    return regions?.filter(
      (region) =>
        !region.sub_region_3 && region.country_region == selectedCountryName
    );
  }

  function setParentRegionButton() {
    d3.select(".parent-region-button").style("display", "block");
  }

  onMount(async () => {
    regionsByPlaceId = await fetchRegionData();
    regions = Array.from(regionsByPlaceId.values());

    params.subscribe((param) => {
      placeId = param.placeId;
      if (placeId) {
        selectedRegion = regionsByPlaceId.get(placeId);
        selectedRegionName = getRegionName(selectedRegion);
        selectedCountryName = getCountryName(selectedRegion);
        if (!selectedCountryMetadata) {
          selectedCountryMetadata =
            fetchCountryMetaData(selectedCountryName)[0];
        }
      }

      setParentRegionButton();
    });

    if (placeId) {
      selectedRegion = regionsByPlaceId.get(placeId);
    }

    setParentRegionButton();

    if (selectedCountryMetadata) {
      mapData = fetchRegionalTrendLines(selectedCountryMetadata.dataFile);
      regionalTrends = await fetchRegionalTrendsData(mapData);

      if (selectedCountryMetadata.countryCode == "US") {
        mapData.then((mapData) => {
          createMap(mapData, selectedMapTrendId, regions, onMapSelection);
          isMapInitialized = true;
          if (selectedRegion) {
            setMapSelection(selectedRegion);
          }
        });
      }
    }
  });

  function onChangeHandler(selectedRegion: Region): void {
    if (selectedRegion != undefined) {
      params.update((p) => {
        if (selectedRegion.place_id !== p.placeId) {
          p.placeId = selectedRegion.place_id;
          p.updateHistory = true;
        }

        return p;
      });

      if (isMapInitialized) {
        setMapSelection(selectedRegion);
      }
    }
  }

  function setMapSelection(selectedRegion: Region): void {
    if (selectedRegion.sub_region_2_code) {
      setSelectedCounty(selectedRegion.sub_region_2_code);
    } else if (selectedRegion.sub_region_1_code) {
      setSelectedState(selectedRegion.sub_region_1_code);
    } else {
      resetToUnitedStates();
    }
  }

  function onMapSelection(id: string): void {
    params.update((p) => {
      p.placeId = id;
      p.updateHistory = true;
      return p;
    });
  }

  function selectMapInfoPopup(): string {
    switch (selectedMapTrendId) {
      case "vaccination":
        return "#info-popup-vaccine";
      case "intent":
        return "#info-popup-intent";
      case "safety":
        return "#info-popup-safety";
      default:
        console.log(`Unknown trend: ${selectedMapTrendId} set on map`);
        return "";
    }
  }

  function goToParentRegion(): void {
    const parentRegion = regions.find(
      (region) =>
        region.region_type === selectedRegion.parent_region_type &&
        region[`${region.region_type}_code`] ===
          selectedRegion[`${selectedRegion.parent_region_type}_code`]
    );

    params.update((p) => {
      p.placeId = parentRegion.place_id;
      p.updateHistory = true;

      return p;
    });
  }
</script>

<main>
  <div class="container-header">
    <div class="header-search-bar">
      <div class="header-search-container">
        <div class="parent-region-button-container">
          <span
            class="parent-region-button material-icons-outlined"
            on:click={(e) => {
              goToParentRegion();
            }}>arrow_back</span
          >
        </div>
        <AutoComplete
          items={filterDropdownItems(regions)}
          bind:selectedItem={selectedRegion}
          placeholder={"United States"}
          labelFunction={getRegionName}
          onChange={onChangeHandler}
          inputClassName={"header-search-box"}
          className={"header-search-container"}
        />
      </div>
    </div>
    <div id="header-divider" class="header-content-divider" />
  </div>

  {#await regionalTrends}
    <!-- Empty -->
  {:then trends}
    <div class="map-content-container">
      <div class="map-trend-selector-group">
        <button
          id="vaccination"
          class={selectedMapTrendId == "vaccination"
            ? "map-trend-selector-button map-trend-selector-selected"
            : "map-trend-selector-button"}
          on:click={onChangeMapTrend}
          title="Search interest in any aspect of COVID-19 vaccination. For example, “when can i get the covid vaccine” or “cdc vaccine tracker”. A scaled value that you can compare across regions and times. This parent category includes searches from the other two subcategories."
        >
          {#if selectedMapTrendId == "vaccination"}
            <div class="map-trend-icon-container">
              <span class="material-icons map-trend-selected-icon">done</span>
            </div>
          {/if}
          {covid_vaccination_title}
        </button>
        <button
          id="intent"
          class={selectedMapTrendId == "intent"
            ? "map-trend-selector-button map-trend-selector-selected"
            : "map-trend-selector-button"}
          on:click={onChangeMapTrend}
          title="Search interest in the eligibility, availability, and accessibility of COVID-19 vaccines. For example, “covid vaccine near me” or “safeway covid vaccine”. A scaled value that you can compare across regions and times."
        >
          {#if selectedMapTrendId == "intent"}
            <div class="map-trend-icon-container">
              <span class="material-icons map-trend-selected-icon">done</span>
            </div>
          {/if}
          {vaccination_intent_title}
        </button>
        <button
          id="safety"
          class={selectedMapTrendId == "safety"
            ? "map-trend-selector-button map-trend-selector-selected"
            : "map-trend-selector-button"}
          on:click={onChangeMapTrend}
          title="Search interest in the safety and side effects of COVID-19 vaccines. For example, “is the covid vaccine safe” or “pfizer vaccine side effects”. A scaled value that you can compare across regions and times."
        >
          {#if selectedMapTrendId == "safety"}
            <div class="map-trend-icon-container">
              <span class="material-icons map-trend-selected-icon">done</span>
            </div>
          {/if}
          {safety_side_effects_title}
        </button>
      </div>
      <!-- map header/legend -->
      <div id="map-callout" class="map-callout">
        <div id="map-callout-title" class="map-callout-title">Region Name</div>
        <div class="map-callout-metric-header">Interest</div>
        <div>
          <div class="map-callout-metric-column map-callout-color">
            <svg id="callout-vaccine" width="12" height="12">
              <rect width="12" height="12" stroke="none" />
            </svg>
          </div>
          <div class="map-callout-metric-column map-callout-metric-label">
            {covid_vaccination_title}
          </div>
          <div
            id="callout-vaccine-value"
            class="map-callout-metric-column map-callout-metric-value"
          />
        </div>
        <div>
          <div class="map-callout-metric-column map-callout-color">
            <svg id="callout-intent" width="12" height="12">
              <rect width="12" height="12" stroke="none" />
            </svg>
          </div>
          <div class="map-callout-metric-column map-callout-metric-label">
            {vaccination_intent_title}
          </div>
          <div
            id="callout-intent-value"
            class="map-callout-metric-column map-callout-metric-value"
          />
        </div>
        <div>
          <div class="map-callout-metric-column map-callout-color">
            <svg id="callout-safety" width="12" height="12">
              <rect width="12" height="12" stroke="none" />
            </svg>
          </div>
          <div class="map-callout-metric-column map-callout-metric-label">
            {safety_side_effects_title}
          </div>
          <div
            id="callout-safety-value"
            class="map-callout-metric-column map-callout-metric-value"
          />
        </div>
        <div class="map-callout-tip">
          <span id="not-enough-data-message" style="display: none;"
            >* Not enough data</span
          >
          <span id="map-callout-drilldown-msg">Click to drill down</span>
        </div>
      </div>

      <!-- Choropleth Map -->

      <!-- Map header section with controls and legend -->
      <div class="map-header-container">
        <div class="map-legend">
          <div class="map-legend-label">Interest</div>
          <div class="map-legend-scale">
            <div id="map-legend-scale-breaks" class="map-legend-scale-top">
              <!-- breaks added by drawLegend routine -->
            </div>
            <div>
              <svg id="map-legend-swatch-bar" width="280" height="20">
                <!-- swatches added by drawLegend routine -->
              </svg>
            </div>
          </div>
          <div class="map-legend-label map-legend-no-data-label">
            Not enough data
          </div>
          <div style="display:flex">
            <div class="map-legend-scale">
              <div class="map-legend-no-data">
                <svg width="20" height="20">
                  <rect x="0" y="0" width="20" height="20" fill="#dadce0" />
                </svg>
              </div>
            </div>
            <div
              class="map-info-button"
              on:click={(e) => {
                handleInfoPopup(e, selectMapInfoPopup());
              }}
            >
              <span class="material-icons-outlined">info</span>
            </div>
          </div>
        </div>
        <div class="date-nav-control">
          <div id="map-legend-date" class="date-nav-display">
            <!-- date added by drawLegend routine -->
          </div>
          <div
            id="date-nav-button-back"
            class="date-nav-button"
            on:click={(e) => {
              decrementMapDate("#date-nav-button-back");
            }}
          >
            <span class="material-icons-outlined">arrow_back_ios</span>
          </div>
          <div
            id="date-nav-button-forward"
            class="date-nav-button"
            on:click={(e) => {
              incrementMapDate("#date-nav-button-forward");
            }}
          >
            <span class="material-icons-outlined">arrow_forward_ios</span>
          </div>
        </div>
      </div>

      <!-- Map body -->
      <div id="map" />

      <!-- Map attribution line -->
      <div class="map-attribution">
        <p class="map-attribution-text">
          Chart includes geographic data from the US Census Bureau
        </p>
      </div>
    </div>

    <!-- Info Popups -->
    <div id="info-popup-vaccine" class="info-popup">
      <h3 class="info-header">
        {covid_vaccination_title}
      </h3>
      <p class="info-text">
        Search interest in any aspect of COVID-19 vaccination. For example,
        “when can i get the covid vaccine” or “cdc vaccine tracker”. A scaled
        value that you can compare across regions, times, or topics.
      </p>
      <p class="info-text">
        This parent category includes searches from the other two subcategories.
      </p>
      <p>
        <a href="#about" class="info-link">Learn more</a>
      </p>
    </div>
    <div id="info-popup-intent" class="info-popup">
      <h3 class="info-header">
        {vaccination_intent_title}
      </h3>
      <p class="info-text">
        Search interest in the eligibility, availability, and accessibility of
        COVID-19 vaccines. For example, “covid vaccine near me” or “safeway
        covid vaccine”. A scaled value that you can compare across regions,
        times, or topics.
      </p>
      <p>
        <a href="#about" class="info-link">Learn more</a>
      </p>
    </div>
    <div id="info-popup-safety" class="info-popup">
      <h3 class="info-header">
        {safety_side_effects_title}
      </h3>
      <p class="info-text">
        Search interest in the safety and side effects of COVID-19 vaccines. For
        example, “is the covid vaccine safe” or “pfizer vaccine side effects”. A
        scaled value that you can compare across regions, times, or topics.
      </p>
      <p>
        <a href="#about" class="info-link">Learn more</a>
      </p>
    </div>
    <TimeSeries
      id="covid-19-vaccination"
      {regionsByPlaceId}
      regionalTrendsByPlaceId={trends}
      trendLine={(t) => {
        return t.trends.covid19_vaccination;
      }}
      title={covid_vaccination_title}
    >
      <p class="info-text">
        Search interest in any aspect of COVID-19 vaccination. For example,
        “when can i get the covid vaccine” or “cdc vaccine tracker”. A scaled
        value that you can compare across regions, times, or topics.
      </p>
      <p class="info-text">
        This parent category includes searches from the other two subcategories.
      </p>
    </TimeSeries>
    <TimeSeries
      id="vaccination-intent"
      {regionsByPlaceId}
      regionalTrendsByPlaceId={trends}
      trendLine={(t) => {
        return t.trends.vaccination_intent;
      }}
      title={vaccination_intent_title}
    >
      <p class="info-text">
        Search interest in the eligibility, availability, and accessibility of
        COVID-19 vaccines. For example, “covid vaccine near me” or “safeway
        covid vaccine”. A scaled value that you can compare across regions,
        times, or topics.
      </p>
    </TimeSeries>
    <TimeSeries
      id="safety-side-effects"
      {regionsByPlaceId}
      regionalTrendsByPlaceId={trends}
      trendLine={(t) => {
        return t.trends.safety_side_effects;
      }}
      title={safety_side_effects_title}
    >
      <p class="info-text">
        Search interest in the safety and side effects of COVID-19 vaccines. For
        example, “is the covid vaccine safe” or “pfizer vaccine side effects”. A
        scaled value that you can compare across regions, times, or topics.
      </p>
    </TimeSeries>
  {/await}

  <a id="about" class="about-anchor">
    <!-- Empty - keep to avoid warnings on empty anchor -->
  </a>
</main>
