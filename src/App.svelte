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
  import { onMount, createEventDispatcher } from "svelte";
  import { params } from "./stores";
  import { fetchCountryMetaData, fetchCountryNames } from "./metadata";

  import TrendsOverview from "./TrendsOverview.svelte";
  import CountryPicker from "./CountryPicker.svelte";

  import {
    _,
    addMessages,
    init,
    locale,
  } from "svelte-i18n";

  import en from "../public/lang/en.json";
  import fr from "../public/lang/fr.json";
import { set, values } from "d3-collection";
import { e } from "mathjs";

  addMessages("en", en);
  addMessages("fr", fr);

  const COVID_19_VACCINATION_TITLE = "COVID-19 vaccination searches";
  const VACCINATION_INTENT_TITLE = "Vaccination intent searches";
  const SAFETY_SIDE_EFFECTS_TITLE = "Safety and side effect searches";

  const COUNTRY_LIST = fetchCountryNames();

  let selectedCountryID: string;
  let placeId: string;
  let selectedCountryMetadata;

  init({
    initialLocale: "getLocaleFromNavigator()",
    fallbackLocale: "en"
  });

  // Interacting with the locale
  locale.subscribe((newLocale) => {console.log("Locale Subscribed")});

  locale.set("en");

  const handleLocaleChange = e => {
    e.preventDefault();
    locale.set(e.target.value);
    console.log(`locale is now ${$locale}`)
  };

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
    // if small screen, then left = 0, otherwise calculate
    const popupLeft: number = downloadCenterX > 170? downloadCenterX - 10 - 312 / 2 : 0;

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
  <title>COVID-19 Vaccination Search Insights</title>
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
        <a href="?" class="header-topbar-text">
          COVID-19 Vaccination Search Insights
        </a>
      </div>
      <div class="header-topbar-menu">
        <div id="download-link" class="link-item">
          <span class="material-icons-outlined header-download-icon"
            >file_download</span
          >
          {$_('navigation.download_data')}
        </div>
        <div class="link-item">
          <a
            class="link-item-anchor"
            href="https://storage.googleapis.com/gcs-public-datasets/COVID-19%20Vaccination%20Search%20Insights%20documentation.pdf"
            >{$_('navigation.documentation')}</a
          >
        </div>
        <div class="link-item">
          <div class="header-language-picker">
            <select on:change={handleLocaleChange}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
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
        {#each COUNTRY_LIST as countryName}
          <a
            class="header-download-popup-link"
            href={"https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/" +
              fetchCountryMetaData(countryName)[0].countryCode + "_vaccination_search_insights.csv"}
            on:click={(e) => closeDownloadPopup()}
            ><span class="material-icons-outlined header-download-popup-icon">file_download</span>
            {countryName}
          </a>
        {/each}
      </p>
    </div>
    {#if !placeId}
      <div class="container-header">
        <div class="header-search-bar">
          <div class="header-search-container">
            <AutoComplete
              items={fetchCountryNames()}
              placeholder={$_('navigation.country_picker')}
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
      <h1>COVID-19 Vaccination Search Insights</h1>
      <p>
        { @html $_('content.app_overview', {values: {
          aboutUrl: "#about"
        }})}
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
          COUNTRY_LIST={COUNTRY_LIST}
          trendLine={(t) => {
            return t.trends.covid19_vaccination;
          }}
        />
      {/if}

      <h2 class="first-section-header">{$_('content.about_data_title')}</h2>
      <p>
        {@html $_('content.about_data_content', {values: {
          aboutDataUrl: "https://storage.googleapis.com/gcs-public-datasets/COVID-19%20Vaccination%20Search%20Insights%20documentation.pdf"
        }})}
      </p>
      <h2>{$_('content.best_use_title')}</h2>
      {@html $_('content.best_use_content')}
      <h2>{$_('content.protecting_privacy_title')}</h2>
      {@html $_('content.proctecting_privacy_content', {values: {
        diffPrivacyUrl: "https://www.youtube.com/watch?v=FfAdemDkLsc&feature=youtu.be&hl=en",
        anonymizationUrl: "https://arxiv.org/abs/2107.01179"}})}
      <h2>{$_('content.availability_title')}</h2>
      {@html $_('content.availability_content', {values: {tosUrl: "https://policies.google.com/terms"}})}
      <div id="next-steps" class="next-steps-container">
        <div class="next-steps-item">
          <h3>{$_('content.next_steps.query_dataset_title')}</h3>
          <p>
            {$_('content.next_steps.query_dataset_content')}
          </p>
          <p />
          <p>{@html $_('content.next_steps.query_dataset_link', {values: {bigQueryUrl: "http://console.cloud.google.com/marketplace/product/bigquery-public-datasets/covid19-vaccination-search-insights"}})}
          </p>
        </div>
        <div class="next-steps-item">
          <h3>{$_('content.next_steps.analyze_covariate_title')}</h3>
          <p>
            {$_('content.next_steps.analyze_covariate_content')}
          </p>
          <p>{@html $_('content.next_steps.analyze_covariate_link', {values: {gitHubUrl: "https://github.com/GoogleCloudPlatform/covid-19-open-data"}})}
          </p>
        </div>
        <div class="next-steps-item">
          <h3>{$_('content.next_steps.feedback_title')}</h3>
          <p>
            {$_('content.next_steps.feedback_content')}
          </p>
          <p>{@html $_('content.next_steps.feedback_link', {values: {feedBackUrl: "https://google-health.force.com/s/form?type=VSIFeedbackForm"}})}
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
            >{$_('navigation.footer.about')}</a
          >
        </li>
        <li class="link-item">
          <a
            class="link-item-anchor"
            href="https://www.google.com/about/products">{$_('navigation.footer.products')}</a
          >
        </li>
        <li class="link-item">
          <a class="link-item-anchor" href="https://policies.google.com/privacy"
            >{$_('navigation.footer.privacy')}</a
          >
        </li>
        <li class="link-item">
          <a class="link-item-anchor" href="https://policies.google.com/terms"
            >{$_('navigation.footer.terms')}</a
          >
        </li>
      </ul>
    </div>
  </footer>
</main>

<style lang="scss" global>
  @import "./global.scss";
</style>
