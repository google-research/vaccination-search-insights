<script type="ts">
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

    let selectedListId: string = "vaccination";

    const MINIMUM_DATE_INDEX = 0;

    /**
     * Change selectedListId so that the selected button becomes active and display the list associated with the selectedListId.
     *
     * TODO(mhkshum): Add code to change the currently displayed list to the list associated with the category selected.
     */
    function changeCategory() {
        selectedListId = this.id;
    }

    let dateList: string[] = [];
    let selectedDateIndex: number = dateList.length - 1;
    let date = dateList.length != MINIMUM_DATE_INDEX ? dateList[selectedDateIndex] : "No Data";

    function incrementDate() {
        if (selectedDateIndex < dateList.length - 1) {
            selectedDateIndex += 1;
            setDate(selectedDateIndex);
        }
    }

    function decrementDate() {
        if (selectedDateIndex > MINIMUM_DATE_INDEX) {
            selectedDateIndex -= 1;
            setDate(selectedDateIndex);
        }
    }

    function setDate(index: number): void {
        date = dateList[selectedDateIndex];
    }

    export let covid_vaccination_button_title: string;
    export let vaccination_intent_button_title: string;
    export let safety_side_effects_button_title: string;
</script>

<div id="top-queries">
    <div class="map-trend-selector-group">
        <button
            id="vaccination"
            class={selectedListId == "vaccination"
                ? "map-trend-selector-button map-trend-selector-selected"
                : "map-trend-selector-button"}
            on:click={changeCategory}
            title="Search interest in any aspect of COVID-19 vaccination. For example, “when can i get the covid vaccine” or “cdc vaccine tracker”. A scaled value that you can compare across regions and times. This parent category includes searches from the other two subcategories."
        >
            {#if selectedListId == "vaccination"}
                <div class="map-trend-icon-container">
                    <span class="material-icons map-trend-selected-icon"
                        >done</span
                    >
                </div>
            {/if}
            {covid_vaccination_button_title}
        </button>
        <button
            id="intent"
            class={selectedListId == "intent"
                ? "map-trend-selector-button map-trend-selector-selected"
                : "map-trend-selector-button"}
            on:click={changeCategory}
            title="Search interest in the eligibility, availability, and accessibility of COVID-19 vaccines. For example, “covid vaccine near me” or “safeway covid vaccine”. A scaled value that you can compare across regions and times."
        >
            {#if selectedListId == "intent"}
                <div class="map-trend-icon-container">
                    <span class="material-icons map-trend-selected-icon"
                        >done</span
                    >
                </div>
            {/if}
            {vaccination_intent_button_title}
        </button>
        <button
            id="safety"
            class={selectedListId == "safety"
                ? "map-trend-selector-button map-trend-selector-selected"
                : "map-trend-selector-button"}
            on:click={changeCategory}
            title="Search interest in the safety and side effects of COVID-19 vaccines. For example, “is the covid vaccine safe” or “pfizer vaccine side effects”. A scaled value that you can compare across regions and times."
        >
            {#if selectedListId == "safety"}
                <div class="map-trend-icon-container">
                    <span class="material-icons map-trend-selected-icon"
                        >done</span
                    >
                </div>
            {/if}
            {safety_side_effects_button_title}
        </button>
    </div>
    <div class="queries-lists">
        <div class="top-searches">
            <div class="query-list-title">Top searches</div>
        </div>
        <div class="rising-searches">
            <div class="query-list-title">Rising</div>
            <div class="date-nav-control">
                <div id="map-legend-date" class="date-nav-display">
                    {date}
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
        </div>
    </div>
</div>