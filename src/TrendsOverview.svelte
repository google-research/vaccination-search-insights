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
  import type {
    Region,
    RegionalTrends,
    RegionalTrendLine,
    RegionalTrendAggregate,
    TrendValue,
  } from "./data";
  import {
    fetchRegionData,
    fetchRegionalTrendsData,
    fetchRegionalTrendLines,
  } from "./data";
  import { onMount } from "svelte";
  import { params } from "./stores";
  import { getRegionName, inClientBounds, handleInfoPopup } from "./utils";
  import * as d3 from "d3";
  import {
    createMap,
    decrementMapDate,
    incrementMapDate,
    setMapTrend,
    setSelectedCounty,
    setSelectedState,
  } from "./choropleth.js";
  import TimeSeries from "./TimeSeries.svelte";

  let selectedRegion: Region;
  let regions: Region[];
  let regionsByPlaceId: Map<string, Region> = new Map<string, Region>();
  let placeId: string;
  let selectedRegionName: string;
  let regionalTrends: Map<string, RegionalTrends>;
  let selectedMapTrendId: string = "vaccination";

  const mapData: Promise<RegionalTrendLine[]> = fetchRegionalTrendLines();
  let isMapInitialized: boolean = false;

  const COVID_19_VACCINATION_TITLE = "COVID-19 vaccination searches";
  const VACCINATION_INTENT_TITLE = "Vaccination intent searches";
  const SAFETY_SIDE_EFFECTS_TITLE = "Safety and side effect searches";

  // TODO(patankar): Update all metric names where they appear.
  let covid19VaccinationChartContainer: HTMLElement;
  let vaccinationIntentChartContainer: HTMLElement;
  let safetySideEffectsChartContainer: HTMLElement;

  function onChangeMapTrend(): void {
    selectedMapTrendId = this.id;
    setMapTrend(selectedMapTrendId);
  }

  function filterDropdownItems(regions: Region[]): Region[] {
    return regions?.filter((region) => !region.sub_region_3);
  }

  function isCountry(region: Region): boolean {
    return (
      region.sub_region_3 === "" &&
      region.sub_region_2 === "" &&
      region.sub_region_1 === "" &&
      region.country_region !== ""
    );
  }

  onMount(async () => {
    regionsByPlaceId = await fetchRegionData();
    regionalTrends = await fetchRegionalTrendsData();
    regions = Array.from(regionsByPlaceId.values());

    document.addEventListener("scroll", handleDocumentScroll);
    document
      .getElementById("download-link")
      .addEventListener("click", handleDownloadPopup);

    params.subscribe((param) => {
      placeId = param.placeId;
      if (placeId) {
        selectedRegion = regionsByPlaceId.get(placeId);
        selectedRegionName = getRegionName(selectedRegion);
      }
    });

    if (placeId) {
      selectedRegion = regionsByPlaceId.get(placeId);
    } else {
      selectedRegion = regions.find((region) => isCountry(region));
    }

    mapData.then((mapData) => {
      createMap(mapData, selectedMapTrendId, regions, onMapSelection);
      isMapInitialized = true;
      if (selectedRegion) {
        setMapSelection(selectedRegion);
      }
    });
  });

  function handleDownloadPopup(event): void {
    const downloadRect: DOMRect = document
      .getElementById("download-link")
      .getBoundingClientRect();
    const popup = document.getElementById("header-download-popup");

    const downloadCenterX: number = downloadRect.left + downloadRect.width / 2;
    const popupLeft: number = downloadCenterX - 10 - 312 / 2;

    popup.style.left = popupLeft + "px";
    popup.style.display = "inline";
    document.addEventListener("click", dismissDownloadPopup);
  }

  function inBounds(
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

  function dismissDownloadPopup(event): void {
    const popup = document.getElementById("header-download-popup");
    if (
      !inBounds(event.clientX, event.clientY, popup.getBoundingClientRect())
    ) {
      popup.style.display = "none";
    }
  }

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
    }
  }

  function onMapSelection(id: string): void {
    params.update((p) => {
      p.placeId = id;
      p.updateHistory = true;
      return p;
    });
  }

  function handleDocumentScroll(): void {
    const sep: HTMLElement = document.getElementById("header-divider");
    if (window.pageYOffset > 0) {
      sep.classList.add("header-content-divider-scrolled");
    } else {
      sep.classList.remove("header-content-divider-scrolled");
    }
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
</script>

<main>
  <header>
    <div class="header-topbar">
      <div style="display: flex">
        <a href="https://www.google.com/">
          <svg role="img" aria-hidden="true" class="header-topbar-glue-logo">
            <use xlink:href="glue/glue-icons.svg#google-color-logo" />
          </svg>
        </a>
        <div class="header-topbar-text">COVID-19 Vaccine Search Insights</div>
      </div>
      <div class="header-topbar-menu">
        <div id="download-link" class="link-item">
          <span class="material-icons-outlined header-download-icon">file_download</span>
          Download data
        </div>
        <div class="link-item">
          <a
            class="link-item-anchor"
            href="https://storage.googleapis.com/gcs-public-datasets/COVID-19%20Vaccination%20Search%20Insights%20documentation.pdf"
            >Documentation</a
          >
        </div>
      </div>
    </div>
    <div id="header-download-popup" class="header-download-popup">
      <h3 class="header-downlod-popup-title">
        COVID-19 Vaccination Search Insights
      </h3>
      <p class="header-download-popup-body">
        In order to download or use the data or insights, you must agree to the
        Google
        <a href="https://policies.google.com/terms">Terms of Service</a>.
      </p>
      <p>
        <a
          class="header-download-popup-link"
          href="https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/Global_vaccination_search_insights.csv"
          >Download dataset - United States</a
        >
      </p>
    </div>
    <div class="header-search-bar">
      <div class="header-search-container">
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
  </header>
  <div class="content-area">
    <div class="content-body">
      <h1>COVID-19 Vaccine Search Insights</h1>
      <p>
        Explore searches for COVID-19 vaccination topics by region. This
        aggregated and anonymized data helps you understand and compare
        communities&apos; information needs. We’re releasing this data to inform
        public health vaccine-confidence efforts.
        <a href="#about">Learn more</a>
      </p>
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
              title="Search interest in any aspect of COVID-19 vaccination. A scaled value that you can compare across regions and times."
            >
              {#if selectedMapTrendId == "vaccination"}
                <div class="map-trend-icon-container">
                  <span class="material-icons map-trend-selected-icon"
                    >done</span
                  >
                </div>
              {/if}
              {COVID_19_VACCINATION_TITLE}
            </button>
            <button
              id="intent"
              class={selectedMapTrendId == "intent"
                ? "map-trend-selector-button map-trend-selector-selected"
                : "map-trend-selector-button"}
              on:click={onChangeMapTrend}
              title="Search interest in the eligibility, availability, and accessibility of COVID-19 vaccines. A scaled value that you can compare across regions and times."
            >
              {#if selectedMapTrendId == "intent"}
                <div class="map-trend-icon-container">
                  <span class="material-icons map-trend-selected-icon"
                    >done</span
                  >
                </div>
              {/if}
              {VACCINATION_INTENT_TITLE}
            </button>
            <button
              id="safety"
              class={selectedMapTrendId == "safety"
                ? "map-trend-selector-button map-trend-selector-selected"
                : "map-trend-selector-button"}
              on:click={onChangeMapTrend}
              title="Search interest in the safety and side effects of COVID-19 vaccines. A scaled value that you can compare across regions and times."
            >
              {#if selectedMapTrendId == "safety"}
                <div class="map-trend-icon-container">
                  <span class="material-icons map-trend-selected-icon"
                    >done</span
                  >
                </div>
              {/if}
              {SAFETY_SIDE_EFFECTS_TITLE}
            </button>
          </div>
          <!-- map header/legend -->
          <div id="map-callout" class="map-callout">
            <div id="map-callout-title" class="map-callout-title">
              Region Name
            </div>
            <div class="map-callout-metric-header">Interest</div>
            <div>
              <div class="map-callout-metric-column map-callout-color">
                <svg id="callout-vaccine" width="12" height="12">
                  <rect width="12" height="12" stroke="none" />
                </svg>
              </div>
              <div class="map-callout-metric-column map-callout-metric-label">
                {COVID_19_VACCINATION_TITLE}
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
                {VACCINATION_INTENT_TITLE}
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
                {SAFETY_SIDE_EFFECTS_TITLE}
              </div>
              <div
                id="callout-safety-value"
                class="map-callout-metric-column map-callout-metric-value"
              />
            </div>
            <div class="map-callout-tip">
              <span id="not-enough-data-message" style="display: none;">* Not enough data</span>
              <span>Click to drill down</span>
            </div>
          </div>

          <!-- Choropleth Map -->

          <!-- Map header section with controls and legend -->
          <div class="map-header-container">
            <div class="map-legend">
              <div class="map-legend-label">Interest</div>
              <div style="display:flex">
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
            {COVID_19_VACCINATION_TITLE}
          </h3>
          <p class="info-text">
            Search interest in any aspect of COVID-19 vaccination. A scaled
            value that you can compare across regions, times, or topics.
          </p>
          <p>
            <a href="#about" class="info-link">Learn more</a>
          </p>
        </div>
        <div id="info-popup-intent" class="info-popup">
          <h3 class="info-header">
            {VACCINATION_INTENT_TITLE}
          </h3>
          <p class="info-text">
            Search interest in the eligibility, availability, and accessibility
            of COVID-19 vaccines. A scaled value that you can compare across
            regions, times, or topics.
          </p>
          <p>
            <a href="#about" class="info-link">Learn more</a>
          </p>
        </div>
        <div id="info-popup-safety" class="info-popup">
          <h3 class="info-header">
            {SAFETY_SIDE_EFFECTS_TITLE}
          </h3>
          <p class="info-text">
            Search interest in the safety and side effects of COVID-19 vaccines.
            A scaled value that you can compare across regions, times, or
            topics.
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
          title={COVID_19_VACCINATION_TITLE}
        >
          <p class="info-text">
            Search interest in any aspect of COVID-19 vaccination. A scaled
            value that you can compare across regions, times, or topics.
          </p>
        </TimeSeries>
        <TimeSeries
          id="vaccination-intent"
          {regionsByPlaceId}
          regionalTrendsByPlaceId={trends}
          trendLine={(t) => {
            return t.trends.vaccination_intent;
          }}
          title={VACCINATION_INTENT_TITLE}
        >
          <p class="info-text">
            Search interest in the eligibility, availability, and accessibility
            of COVID-19 vaccines. A scaled value that you can compare across
            regions, times, or topics.
          </p>
        </TimeSeries>
        <TimeSeries
          id="safety-side-effects"
          {regionsByPlaceId}
          regionalTrendsByPlaceId={trends}
          trendLine={(t) => {
            return t.trends.safety_side_effects;
          }}
          title={SAFETY_SIDE_EFFECTS_TITLE}
        >
          <p class="info-text">
            Search interest in the safety and side effects of COVID-19 vaccines.
            A scaled value that you can compare across regions, times, or
            topics.
          </p>
        </TimeSeries>
      {/await}
      <a id="about" class="about-anchor">
        <!-- Empty - keep to avoid warnings on empty anchor -->
      </a>
      <h2 class="first-section-header">About this data</h2>
      <p>
        You can use this data to compare search interest between topics related
        to COVID-19 vaccination. The value for search interest isn’t an absolute
        number of searches—it’s a value representing relative interest which we
        scale to make it easier to compare regions with one another, or the same
        region over time. If you’d like to know more about our calculation and
        process, see our <a
          href="https://storage.googleapis.com/gcs-public-datasets/COVID-19%20Vaccination%20Search%20Insights%20documentation.pdf"
          >technical docs</a
        >.
      </p>
      <h2>How to best use this data</h2>
      <p>
        We used the same normalization and scaling everywhere so that you can
        make these comparisons:
      </p>
      <ul>
        <li>
          Compare a region with others to see where you might focus effort.
        </li>
        <li>
          Compare a region over time to see how your community’s information
          needs have changed or see the impact of your communication efforts and
          news events.
        </li>
      </ul>
      <p>
        Remember, the data shows people’s interest—not opinions or actual
        events. You can’t conclude that a community is suffering from many side
        effects because there’s increased interest in the safety and side
        effects category.
      </p>
      <h2>Protecting privacy</h2>
      <p>
        We developed the Vaccine Search Insights to be helpful while adhering to
        our stringent privacy protocols for search data. No individual search
        queries or other personally identifiable information are made available
        at any point. For this data, we use <a
          href="https://www.youtube.com/watch?v=FfAdemDkLsc&feature=youtu.be&hl=en"
          >differential privacy,
        </a>
        which adds artificial noise to our data while enabling high quality results
        without identifying any individual person.
      </p>
      <p>
        To learn more about the privacy methods used to generate the data, read
        the
        <a href="https://arxiv.org/abs/2107.01179"
          >anonymization process description</a
        >.
      </p>
      <h2>Availability and updates</h2>
      <p>
        To download or use the data or insights, you must agree to the
        <a href="https://policies.google.com/terms">Google Terms of Service</a>.
      </p>
      <p>
        We’ll update the data each week. You can check the dates in the charts
        to see the most recent day in the data. If you download the CSV,
        remember to get an updated version each week.
      </p>
      <p>
        We'll continue to update this product while public health experts find
        it useful in their COVID-19 vaccination efforts. Our published data will
        remain publicly available to support long-term research and evaluation.
      </p>
      <div id="next-steps" class="next-steps-container">
        <div class="next-steps-item">
          <h3>Query the dataset with SQL</h3>
          <p>
            Get insights using Google Cloud’s BigQuery. Analyze with SQL,
            generate reports, or call the API from your code.
          </p>
          <p />
          <p>
            <a
              href="http://console.cloud.google.com/marketplace/product/bigquery-public-datasets/covid19-vaccination-search-insights"
              >Bigquery public dataset</a
            >
          </p>
        </div>
        <div class="next-steps-item">
          <h3>Analyze with covariate data</h3>
          <p>
            Analyze this data alongside other covariates in the COVID-19
            Open-Data repository.
          </p>
          <p>
            <a href="https://github.com/GoogleCloudPlatform/covid-19-open-data"
              >Github repository</a
            >
          </p>
        </div>
        <div class="next-steps-item">
          <h3>Tell us about your project</h3>
          <p>
            We’d love to hear more about how you’re using Vaccination Search
            Insights. If you’ve solved problems, we’d like to help you share
            your solutions.
          </p>
          <p>
            <a
              href="mailto:covid-19-search-trends-feedback+webcallout@google.com"
              >Email us
            </a>
          </p>
        </div>
      </div>
    </div>
  </div>
  <footer>
    <div class="footer-referencebar">
      <div class="footer-referencebar-logo-container">
        <a href="https://www.google.com" title="Google">
          <svg
            role="img"
            aria-hidden="true"
            class="footer-referencebar-glue-logo"
          >
            <use xlink:href="glue/glue-icons.svg#google-solid-logo" />
          </svg>
        </a>
      </div>
      <ul class="footer-items">
        <li class="link-item">
          <a class="link-item-anchor" href="https://www.google.com/about"
            >About Google</a
          >
        </li>
        <li class="link-item">
          <a
            class="link-item-anchor"
            href="https://www.google.com/about/products">Google Products</a
          >
        </li>
        <li class="link-item">
          <a class="link-item-anchor" href="https://policies.google.com/privacy"
            >Privacy</a
          >
        </li>
        <li class="link-item">
          <a class="link-item-anchor" href="https://policies.google.com/terms"
            >Terms</a
          >
        </li>
      </ul>
    </div>
  </footer>
</main>
