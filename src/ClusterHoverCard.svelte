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

    import { fade } from "svelte/transition";
    import { tick } from "svelte";
    import type { Cluster } from "./data";

    const NO_CHANGE_COLOR = "#202124";
    const POSITIVE_CHANGE_COLOR = "#1e8e3e";
    const NEGATIVE_CHANGE_COLOR = "#d93025";

    let hovering = false;

    async function enter() {
        hovering = true;
        await tick();
    }

    const leave = () => (hovering = false);

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
            compactDisplay: "short",
        });
        if (change > 0) {
            return `+${changeStr}%`;
        } else if (change < 0) {
            return `${changeStr}%`;
        } else {
            return "0";
        }
    }

    export let query: Cluster;
</script>

<div class="cluster-container">
    <div class="cluster" on:mouseenter={enter} on:mouseleave={leave}>
        <div class="cluster-text-box">
            <div class="cluster-text">
                <span class="cluster-emphasis">
                    {query.members.length === 0 ? query.query : query.query + ","}
                </span>
                {formatMembersList(query.members)}
            </div>
        </div>
        <div class="sni">
            {(Math.round(query.sni * 100) / 100).toFixed(2)}
        </div>
        {#if query.change === null || query.change === 0}
            <div class="change" style="color:{NO_CHANGE_COLOR}">
                {formatChange(query.change)}
            </div>
        {:else if query.change > 0}
            <div class="change" style="color:{POSITIVE_CHANGE_COLOR}">
                {formatChange(query.change)}
            </div>
        {:else}
            <div class="change" style="color:{NEGATIVE_CHANGE_COLOR}">
                {formatChange(query.change)}
            </div>
        {/if}
    </div>
    {#if hovering}
    <div in:fade={{ duration: 150 }} class="cluster-hover-card">
        <div class="hover-queries">
            <div class="hover-query-color" />
            <div class="hover-query-text">{capitaliseFirstLetter(query.query)}</div>
            {#each query.members as member}
                <div class="hover-query-color" />
                <div class="hover-query-text">{capitaliseFirstLetter(member)}</div>
            {/each}
        </div>
    </div>
    {/if}
</div>


