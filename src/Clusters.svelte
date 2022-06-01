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
        fetchTopLevelClusterFiles,
        createDateList,
        createSerialisedQueryKey,
        fetchClustersFile,
    } from "./data";
    import type { Region, Cluster } from "./data";
    import { params } from "./stores";
    import { getCountryCode, handleInfoPopup } from "./utils";
    import { dateRangeString } from "./choropleth";
    import { _ } from "svelte-i18n"

    const MINIMUM_DATE_INDEX = 0;
    const TOP_QUERY_TYPE = "top";
    const RISING_QUERY_TYPE = "rising";
    const NO_CHANGE_COLOR = "#202124";
    const POSITIVE_CHANGE_COLOR = "#1e8e3e";
    const NEGATIVE_CHANGE_COLOR = "#d93025";

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

    /* Export tooltips to be available in trendsOverview for modifcation */
    export let vaccineTooltip: string = "";
    export let intentTooltip = "";
    export let safetypTooltip: string = "";


    function capitaliseFirstLetter(str: string): string {
        return str[0].toUpperCase() + str.slice(1);
    }

    function formatMembersList(stringArray: string[]): string {
        if (stringArray.length === 0) {
            return "";
        }
        return stringArray
            .map((member) => capitaliseFirstLetter(member))
            .join(", ");
    }

    function formatChange(change: number): string {
        if (change === null) {
            return "-";
        }
        if (change === Infinity) {
            return "NEW"; //TODO(meganshum): Add translation for this!
        }
        var changeStr = change.toLocaleString("en", {
            notation: "compact",
            compactDisplay: "short"
        });
        if (change > 0) {
            return `+${changeStr}%`;
        } else if (change < 0) {
            return `${changeStr}%`;
        } else {
            return "0";
        }
    }

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
        topLevelData = await fetchTopLevelClusterFiles(selectedCountryCode);
        dateList = createDateList([...topLevelData.keys()]);
        selectedDateIndex = dateList.length - 1;
        setDate(selectedDateIndex);

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
                updateQueries();
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
                        )}_l2_vaccination_trending_searches.csv`,
                        getCountryCode(newRegion)
                    )
                ).then(function (newCountyData) {
                    countyData = newCountyData;
                    updateQueries();
                    loading = false;
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
                title={vaccineTooltip}
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
                title={intentTooltip}
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
                title={safetypTooltip}
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
            <div class="query-list-title">{$_('content.top_queries.top_searches')}</div>
            {#if loading}
                <div class="no-queries">{$_('hints.loading_data')}</div>
            {:else}
                {#if topQueriesList.length !== 0}
                    <div class="clusters-sub-header">
                        <div class="related-queries-header">{$_('content.top_queries.related')}</div>
                        <div class="interest-header">{$_('legend.interest')}</div>
                        <div class="change-header">{$_('legend.change')}</div>
                    </div>
                {/if}
                {#each topQueriesList as query}
                    <div class="cluster">
                        <div class="cluster-text-box">
                            <div class="cluster-text">
                                <span class="cluster-emphasis">
                                    {query.members.length === 0 ? query.query: query.query + ","}
                                </span>
                                {formatMembersList(query.members)}
                            </div>
                        </div>
                        <div class="sni">
                            {(Math.round(query.sni * 100) / 100).toFixed(2)}
                        </div>
                        {#if query.change === null || query.change === 0}
                            <div class="change" style="color:{NO_CHANGE_COLOR}">{formatChange(query.change)}</div>
                        {:else if query.change > 0}
                            <div class="change"style="color:{POSITIVE_CHANGE_COLOR}">
                                {formatChange(query.change)}
                            </div>
                        {:else}
                            <div class="change" style="color:{NEGATIVE_CHANGE_COLOR}">
                                {formatChange(query.change)}
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="no-queries">{$_('legend.no_data')}</div>
                {/each}
            {/if}
        </div>
        <div class="rising-searches">
            <div class="query-list-title">{$_('content.top_queries.rising')}</div>
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
            
            {#if loading}
                <div class="no-queries">{$_('hints.loading_data')}</div>
            {:else}
                {#if risingQueriesList.length !== 0}
                    <div class="clusters-sub-header">
                        <div class="related-queries-header">{$_('content.top_queries.related')}</div>
                        <div class="interest-header">{$_('legend.interest')}</div>
                        <div class="change-header">{$_('legend.change')}</div>
                    </div>
                {/if}
                {#each risingQueriesList as query}
                    <div class="cluster">
                        <div class="cluster-text-box">
                            <div class="cluster-text">
                                <span class="cluster-emphasis">
                                    {query.members.length === 0 ? query.query: query.query + ","}
                                </span>
                                {formatMembersList(query.members)}
                            </div>
                        </div>
                        <div class="sni">
                            {(Math.round(query.sni * 100) / 100).toFixed(2)}
                        </div>
                        {#if query.change === null || query.change === 0}
                            <div class="change" style="color:{NO_CHANGE_COLOR}">{formatChange(query.change)}</div>
                        {:else if query.change > 0}
                            <div class="change"style="color:{POSITIVE_CHANGE_COLOR}">
                                {formatChange(query.change)}
                            </div>
                        {:else}
                            <div class="change" style="color:{NEGATIVE_CHANGE_COLOR}">
                                {formatChange(query.change)}
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="no-queries">{$_('legend.no_data')}</div>
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
        {$_('tooltips.vaccine_top_query')}
    </p>
    <p class="info-text">
        {$_('tooltips.parent_tooltip')}
    </p>
    <p>
        <a href="#about" class="info-link">{$_('tooltips.learn_more')}</a>
    </p>
</div>
<div id="info-popup-vaccination_intent" class="info-popup">
    <h3 class="info-header">
        {vaccination_intent_button_title}
    </h3>
    <p class="info-text">
        {$_('tooltips.intent_top_query')}
    </p>
    <p>
        <a href="#about" class="info-link">{$_('tooltips.learn_more')}</a>
    </p>
</div>
<div id="info-popup-safety_side_effects" class="info-popup">
    <h3 class="info-header">
        {safety_side_effects_button_title}
    </h3>
    <p class="info-text">
        {$_('tooltips.intent_top_query')}
    </p>
    <p>
        <a href="#about" class="info-link">{$_('tooltips.learn_more')}</a>
    </p>
</div>
