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
  import { onMount } from "svelte";
  import { params } from "./stores";
  import { fetchCountryMetaData, fetchCountryNames } from "./metadata";

  import TrendsOverview from "./TrendsOverview.svelte";
  import TopQueries from "./TopQueries.svelte";
  import CountryPicker from "./CountryPicker.svelte";

  const COVID_19_VACCINATION_TITLE = "COVID-19 vaccination searches";
  const VACCINATION_INTENT_TITLE = "Vaccination intent searches";
  const SAFETY_SIDE_EFFECTS_TITLE = "Safety and side effect searches";

  let selectedCountry: string;
  let selectedCountryID: string;
  let placeId: string;
  let selectedCountryMetadata;

  onMount(async () => {
    document.addEventListener("scroll", handleDocumentScroll);
    document
      .getElementById("download-link")
      .addEventListener("click", handleDownloadPopup);

    params.subscribe((param) => {
      placeId = param.placeId;
    });

    if (placeId) {
      selectedCountryID = placeId;
    }
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
    document.addEventListener("click", dismissDownloadPopupOnClick);
  }

  function handleDocumentScroll(): void {
    const sep: HTMLElement = document.getElementById("header-divider");
    if (window.pageYOffset > 0) {
      sep.classList.add("header-content-divider-scrolled");
    } else {
      sep.classList.remove("header-content-divider-scrolled");
    }
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

  // This function will conditionally close the download popup if the user
  // clicks outside of the popup bounds.
  function dismissDownloadPopupOnClick(event): void {
    const popup = document.getElementById("header-download-popup");
    if (
      !inBounds(event.clientX, event.clientY, popup.getBoundingClientRect())
    ) {
      closeDownloadPopup();
    }
  }

  // This fuction will unconditionally close the download popup window.
  function closeDownloadPopup(): void {
    const popup = document.getElementById("header-download-popup");
    popup.style.display = "none";
    document.removeEventListener("click", dismissDownloadPopupOnClick);
  }

  function onCountrySelectHandler(selectedCountryName: string): void {
    if (selectedCountryName) {
      selectedCountryMetadata = fetchCountryMetaData(selectedCountryName)[0];

      selectedCountryID = selectedCountryMetadata.placeId;
      if (selectedCountryID != undefined) {
        params.update((p) => {
          if (selectedCountryID !== p.placeId) {
            p.placeId = selectedCountryID;
            p.updateHistory = true;
          }
          return p;
        });
      }
    }
  }
</script>

<svelte:head>
  <title>COVID-19 Vaccine Search Insights</title>
</svelte:head>

<main>
  <header>
    <div class="header-topbar">
      <div style="display: flex">
        <a href="https://www.google.com/">
          <svg role="img" aria-hidden="true" class="header-topbar-glue-logo">
            <use xlink:href="glue/glue-icons.svg#google-color-logo" />
          </svg>
        </a>
        <a href="/" class="header-topbar-text">
          COVID-19 Vaccine Search Insights
        </a>
      </div>
      <div class="header-topbar-menu">
        <div id="download-link" class="link-item">
          <span class="material-icons-outlined header-download-icon"
            >file_download</span
          >
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
        Covid-19 Vaccination Search Insights
      </h3>
      <p class="header-download-popup-body">
        In order to download or use the data or insights, you must agree to the
        Google
        <a href="https://policies.google.com/terms">Terms of Service</a>.
      </p>
      <h4 class="header-download-popup-subtitle">Download dataset</h4>
      <p class="header-download-popup-link-list">
        <a
          class="header-download-popup-link"
          href="https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/CA_vaccination_search_insights.csv"
          on:click={(e) => closeDownloadPopup()}
          ><span class="material-icons-outlined header-download-popup-icon"
            >file_download</span
          >Canada</a
        >
        <a
          class="header-download-popup-link"
          href="https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/GB_vaccination_search_insights.csv"
          on:click={(e) => closeDownloadPopup()}
          ><span class="material-icons-outlined header-download-popup-icon"
            >file_download</span
          >United Kingdom</a
        >
        <a
          class="header-download-popup-link"
          href="https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/US_vaccination_search_insights.csv"
          on:click={(e) => closeDownloadPopup()}
          ><span class="material-icons-outlined header-download-popup-icon"
            >file_download</span
          >United States</a
        >
      </p>
    </div>
    {#if !placeId}
      <div class="container-header">
        <div class="header-search-bar">
          <div class="header-search-container">
            <AutoComplete
              items={fetchCountryNames()}
              bind:selectedItem={selectedCountry}
              placeholder={"Select a country"}
              onChange={onCountrySelectHandler}
              inputClassName={"header-search-box"}
              className={"header-search-container"}
            />
          </div>
        </div>
        <div id="header-divider" class="header-content-divider" />
      </div>
    {/if}
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

      {#if placeId}
        <TrendsOverview
          {selectedCountryMetadata}
          covid_vaccination_title={COVID_19_VACCINATION_TITLE}
          vaccination_intent_title={VACCINATION_INTENT_TITLE}
          safety_side_effects_title={SAFETY_SIDE_EFFECTS_TITLE}
        />
      {:else}
        <CountryPicker
          id="covid-19-vaccination"
          trendLine={(t) => {
            return t.trends.covid19_vaccination;
          }}
        />
      {/if}

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
        without identifying any individual person. Additionally, we don’t show data
        for regions that are smaller than 3 km<sup>2</sup>.
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
            We’d love to hear more about how you’re using the data. Send
            feedback using our form.
          </p>
          <p>
            <a
              href="https://google-health.force.com/s/form?type=VSIFeedbackForm"
              >Feedback
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

<style lang="scss" global>
  @import "./global.scss";
</style>
