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
        fetchAllQueries,
        createDateList,
        createSerialisedQueryKey,
    } from "./data";
    import type {Query} from "./data";
    import { params } from "./stores";

    const MINIMUM_DATE_INDEX = 0;
    const TOP_QUERY_TYPE = "top";
    const RISING_QUERY_TYPE = "rising";
    const DAYS_BETWEEN = 6;

    let selectedListId: string = "covid19_vaccination";
    let dateList: string[] = [];
    let selectedDateIndex: number = dateList.length - 1;
    let dateKey: string = "";
    let dateRange: string = "";
    let queriesData: Map<string, Query[]> = new Map<string, Query[]>();
    let placeId: string;
    let topQueriesList = [];
    let risingQueriesList = [];

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

    /**
     * Converts a simple numerical string to an English 7 days date range,
     * in which the initial date would only include the month and day and
     * the end date would include the month, day, and year.
     *
     * Example: "2021-11-22" would be converted to "Nov 22 - Nov 28, 2021".
     */
    function convertDateToRange(date: string): string {
        let initialDate: Date = new Date(date);
        let dateRange: string = initialDate.toLocaleString("en-us", {
            month: "short",
            day: "2-digit",
        });
        let endDate: Date = new Date(
            initialDate.setDate(initialDate.getDate() + DAYS_BETWEEN)
        );
        dateRange +=
            " - " +
            endDate.toLocaleString("en-us", {
                month: "short",
                day: "2-digit",
                year: "numeric",
            });
        return dateRange;
    }

    function setDate(index: number): void {
        if (dateList.length != MINIMUM_DATE_INDEX) {
            dateKey = dateList[selectedDateIndex];
            dateRange = convertDateToRange(dateKey);
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
        topQueriesList = queriesData.has(topKey) ? queriesData.get(topKey) : [];
        risingQueriesList = queriesData.has(risingKey)
            ? queriesData.get(risingKey)
            : [];
    }

    export let covid_vaccination_button_title: string;
    export let vaccination_intent_button_title: string;
    export let safety_side_effects_button_title: string;

    // runs after component is first rendered to the DOM
    onMount(async () => {
        queriesData = await fetchAllQueries();
        dateList = createDateList([...queriesData.keys()]);
        selectedDateIndex = dateList.length - 1;
        setDate(selectedDateIndex);
        // subscribe to 'params' so any placeId (location changes) made by the user
        // will update the queries displayed in the TopQueries component.
        params.subscribe((newParams) => {
            placeId = newParams.placeId;
            if (placeId) {
                updateQueries();
            }
        });
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
        <div class="info-button">
            <span class="material-icons-outlined">info</span>
        </div>
    </div>
    <div class="queries-lists">
        <div class="top-searches">
            <div class="query-list-title">Top searches</div>
            <ul class="bullet-list">
                {#each topQueriesList as query}
                    <li class="bullet-list-text">{query.query}</li>
                {:else}
                    <div class="no-queries">Not enough data</div>
                {/each}
            </ul>
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
            <ul class="bullet-list">
                {#each risingQueriesList as query}
                    <li class="bullet-list-text">{query.query}</li>
                {:else}
                    <div class="no-queries">Not enough data</div>
                {/each}
            </ul>
        </div>
    </div>
</div>
