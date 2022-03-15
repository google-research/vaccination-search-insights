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

    import { onMount } from "svelte";
    import {
        fetchTopLevelQueries,
        createDateList,
        createSerialisedQueryKey,
        fetchClustersFile,
    } from "./data";
    import type { Region, Cluster } from "./data";
    import { params } from "./stores";
    import { getCountryCode, handleInfoPopup } from "./utils";
    import { dateRangeString } from "./choropleth";

    const MINIMUM_DATE_INDEX = 0;
    const TOP_QUERY_TYPE = "top";
    const RISING_QUERY_TYPE = "rising";

    let loading: boolean = true;
    let selectedListId: string = "covid19_vaccination";
    let dateList: string[] = [];
    let selectedDateIndex: number = dateList.length - 1;
    let dateKey: string = "";
    let dateRange: string = "";
    let topLevelData: Map<string, Cluster[]> = new Map<string, Cluster[]>();
    let countyData: Map<string, Cluster[]>;
    let placeId: string;
    let topQueriesList = [];
    let risingQueriesList = [];
    let currentSubRegion: string = "";
    /**
     * Changes selectedListId so that the selected button becomes active and
     * updates the Top Queries and Rising Queries lists associated with the selectedListId.
     */
    function changeCategory() {
        selectedListId = this.id;
        updateQueries();
    }

    /**
     * Increments the date displayed and updates lists based on the new date.
     */
    function incrementDate() {
        if (selectedDateIndex < dateList.length - 1) {
            selectedDateIndex += 1;
            setDate(selectedDateIndex);
            updateQueries();
        }
    }

    /**
     * Increments the date displayed and updates lists based on the new date.
     */
    function decrementDate() {
        if (selectedDateIndex > MINIMUM_DATE_INDEX) {
            selectedDateIndex -= 1;
            setDate(selectedDateIndex);
            updateQueries();
        }
    }

    function setDate(index: number): void {
        if (dateList.length != MINIMUM_DATE_INDEX) {
            dateKey = dateList[selectedDateIndex];
            dateRange = dateRangeString(dateKey);
        } else {
            dateKey = "";
            dateRange = "";
        }
    }

    /**
     * Creates 2 new keys whenever a parameter (placeID, date, selectedListId) is modified
     * and uses the 2 new keys to grab the list of queries.
     */
    function updateQueries() {
        let topKey: string = createSerialisedQueryKey(
            placeId,
            dateKey,
            TOP_QUERY_TYPE,
            selectedListId
        );
        let risingKey: string = createSerialisedQueryKey(
            placeId,
            dateKey,
            RISING_QUERY_TYPE,
            selectedListId
        );
        if (countyData) {
            topQueriesList = countyData.has(topKey)
                ? countyData.get(topKey)
                : [];
            risingQueriesList = countyData.has(risingKey)
                ? countyData.get(risingKey)
                : [];
        } else {
            topQueriesList = topLevelData.has(topKey)
                ? topLevelData.get(topKey)
                : [];
            risingQueriesList = topLevelData.has(risingKey)
                ? topLevelData.get(risingKey)
                : [];
        }
    }

    export let covid_vaccination_button_title: string;
    export let vaccination_intent_button_title: string;
    export let safety_side_effects_button_title: string;
    export let regionsByPlaceId: Map<string, Region> = new Map<
        string,
        Region
    >();
    export let selectedCountryCode: string;

    // runs after component is first rendered to the DOM
    onMount(async () => {
        // Currently don't have topLevelData
        // topLevelData = await fetchTopLevelQueries(selectedCountryCode);
        // dateList = createDateList([...topLevelData.keys()]);
        // selectedDateIndex = dateList.length - 1;
        // setDate(selectedDateIndex);
        // subscribe to 'params' so any placeId (location changes) made by the user
        // will update the queries displayed in the TopQueries component.
        params.subscribe((newParams) => {
            placeId = newParams.placeId;
            if (!placeId || !regionsByPlaceId) {
                return;
            }

            let newRegion: Region = regionsByPlaceId.get(placeId);
            let newSubRegion: string = newRegion.sub_region_1;

            /**
             * Not County Level: clear county data and reset current SubRegion
             * County Level in a New Subregion: fetch new county data
             * County Level in the Same Subregion: update using existing county data
             */
            if (newRegion.sub_region_2 === "") {
                // if placeId is not county level
                countyData = null;
                currentSubRegion = null;
                // updateQueries();
                // Currently, L0 and L1 data are not available for clusters
            } else if (newSubRegion !== currentSubRegion) {
                // if county in a new subregion
                currentSubRegion = newSubRegion;
                loading = true;
                Promise.resolve(
                    fetchClustersFile(
                        `${getCountryCode(
                            newRegion
                        )}_${currentSubRegion.replaceAll(
                            " ",
                            "_"
                        )}_l2_vaccination_trending_searches.csv`
                    )
                ).then(function (newCountyData) {
                    countyData = newCountyData;
                    dateList = createDateList([...countyData.keys()]);
                    selectedDateIndex = dateList.length - 1;
                    setDate(selectedDateIndex);
                    loading = false;
                    updateQueries();
                });
            } else {
                // county within the same subregion
                updateQueries();
            }
        });
        loading = false;
    });
</script>

<div id="top-queries">
    <div class="queries-header">
        <div class="queries-category-selector">
            <button
                id="covid19_vaccination"
                class={selectedListId == "covid19_vaccination"
                    ? "map-trend-selector-button map-trend-selector-selected"
                    : "map-trend-selector-button"}
                on:click={changeCategory}
                title="Search interest in any aspect of COVID-19 vaccination. For example, “when can i get the covid vaccine” or “cdc vaccine tracker”. A scaled value that you can compare across regions and times. This parent category includes searches from the other two subcategories."
            >
                {#if selectedListId == "covid19_vaccination"}
                    <div class="map-trend-icon-container">
                        <span class="material-icons map-trend-selected-icon"
                            >done</span
                        >
                    </div>
                {/if}
                {covid_vaccination_button_title}
            </button>
            <button
                id="vaccination_intent"
                class={selectedListId == "vaccination_intent"
                    ? "map-trend-selector-button map-trend-selector-selected"
                    : "map-trend-selector-button"}
                on:click={changeCategory}
                title="Search interest in the eligibility, availability, and accessibility of COVID-19 vaccines. For example, “covid vaccine near me” or “safeway covid vaccine”. A scaled value that you can compare across regions and times."
            >
                {#if selectedListId == "vaccination_intent"}
                    <div class="map-trend-icon-container">
                        <span class="material-icons map-trend-selected-icon"
                            >done</span
                        >
                    </div>
                {/if}
                {vaccination_intent_button_title}
            </button>
            <button
                id="safety_side_effects"
                class={selectedListId == "safety_side_effects"
                    ? "map-trend-selector-button map-trend-selector-selected"
                    : "map-trend-selector-button"}
                on:click={changeCategory}
                title="Search interest in the safety and side effects of COVID-19 vaccines. For example, “is the covid vaccine safe” or “pfizer vaccine side effects”. A scaled value that you can compare across regions and times."
            >
                {#if selectedListId == "safety_side_effects"}
                    <div class="map-trend-icon-container">
                        <span class="material-icons map-trend-selected-icon"
                            >done</span
                        >
                    </div>
                {/if}
                {safety_side_effects_button_title}
            </button>
        </div>
        <div
            class="info-button info-button-top-queries"
            on:click={(e) =>
                handleInfoPopup(e, `#info-popup-${selectedListId}`)}
        >
            <span class="material-icons-outlined">info</span>
        </div>
    </div>
    <div class="queries-lists">
        <div class="top-searches">
            <div class="query-list-title">Top searches</div>
            <div class="clusters-sub-header">
                <div class="related-queries-header">Related Queries</div>
                <div class="interest-header">Interest</div>
                <div class="change-header">Change</div>
            </div>
            {#if loading}
                <div class="no-queries">Loading data...</div>
            {:else}
                {#each topQueriesList as query}
                <div class="cluster">
                    <div class="cluster-text-box">
                        <div class="cluster-text">
                            <span class="cluster-emphasis">{query.query}</span>,
                            {query.members.join(', ')}
                        </div>
                    </div>
                    <div class="sni">{Math.round(query.sni * 100) / 100}</div>
                    <div class="change">0%</div>
                </div>
                {:else}
                    <div class="no-queries">Not enough data</div>
                {/each}
            {/if}
        </div>
        <div class="rising-searches">
            <div class="query-list-title">Rising</div>
            <div class="date-nav-control">
                <div id="map-legend-date" class="date-nav-display">
                    {dateRange}
                </div>
                <div
                    id="date-nav-button-back"
                    class={selectedDateIndex <= MINIMUM_DATE_INDEX
                        ? "date-nav-button date-nav-button-inactive"
                        : "date-nav-button date-nav-button-active"}
                    on:click={decrementDate}
                >
                    <span class="material-icons-outlined">arrow_back_ios</span>
                </div>
                <div
                    id="date-nav-button-forward"
                    class={selectedDateIndex === dateList.length - 1
                        ? "date-nav-button date-nav-button-inactive"
                        : "date-nav-button date-nav-button-active"}
                    on:click={incrementDate}
                >
                    <span class="material-icons-outlined"
                        >arrow_forward_ios</span
                    >
                </div>
            </div>
            <div class="clusters-sub-header">
                <div class="related-queries-header">Related Queries</div>
                <div class="interest-header">Interest</div>
                <div class="change-header">Change</div>
            </div>
            {#if loading}
                <div class="no-queries">Loading data...</div>
            {:else}
                {#each risingQueriesList as query}
                <div class="cluster">
                    <div class="cluster-text-box">
                        <div class="cluster-text">
                            <span class="cluster-emphasis">{query.query}</span>,
                            {query.members.join(', ')}
                        </div>
                    </div>
                    <div class="sni">{Math.round(query.sni * 100) / 100}</div>
                    <div class="change">0%</div>
                </div>
                {:else}
                    <div class="no-queries">Not enough data</div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<!-- Info Popups -->
<div id="info-popup-covid19_vaccination" class="info-popup">
    <h3 class="info-header">
        {covid_vaccination_button_title}
    </h3>
    <p class="info-text">
        Most common searches related to any aspect of COVID-19 vaccination,
        listed in order of frequency.
    </p>
    <p class="info-text">
        This parent category includes searches from the other two subcategories.
    </p>
    <p>
        <a href="#about" class="info-link">Learn more</a>
    </p>
</div>
<div id="info-popup-vaccination_intent" class="info-popup">
    <h3 class="info-header">
        {vaccination_intent_button_title}
    </h3>
    <p class="info-text">
        Most common searches related to the eligibility, availability, and
        accessibility of COVID-19 vaccines, listed in order of frequency.
    </p>
    <p>
        <a href="#about" class="info-link">Learn more</a>
    </p>
</div>
<div id="info-popup-safety_side_effects" class="info-popup">
    <h3 class="info-header">
        {safety_side_effects_button_title}
    </h3>
    <p class="info-text">
        Most common searches related to the safety and side effects of COVID-19
        vaccines, listed in order of frequency.
    </p>
    <p>
        <a href="#about" class="info-link">Learn more</a>
    </p>
</div>
