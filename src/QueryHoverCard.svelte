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

    import * as d3 from "d3";
    import { fade } from "svelte/transition";
    import { tick } from "svelte";

    export let query: string;

    let hovering = false;

    async function enter() {
        hovering = true;
        await tick();

        // set the dimensions and margins of the graph
        const margin = { top: 30, right: 30, bottom: 70, left: 60 },
            width = 460 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        const svg = d3
            .select("#my_dataviz")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        let queryData: {
            date: string;
            interest: number;
        }[] = [
            { date: "Jan 17", interest: 3 },
            { date: "Jan 24", interest: 100 },
            { date: "Jan 31", interest: 45 },
            { date: "Feb 7", interest: 12 },
            { date: "Feb 14", interest: 25 },
            { date: "Feb 21", interest: 9 },
        ];
            // X axis
            const x = d3
                .scaleBand()
                .range([0, width])
                .domain(queryData.map((d) => d.date))
                .paddingInner(0.1)
                .paddingOuter(1)
                .align(0.5);
            svg.append("g")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x).tickSizeOuter(0))
                .selectAll("text")
                .attr("transform", "translate(0,0)")
                // .style("text-anchor", "end");

            // Add Y axis
            
            const y = d3.scaleLinear().domain([0, 110]).range([height, 0]);
            svg.append("g").call(d3.axisLeft(y).tickSizeOuter(width).tickSizeInner(0)).select(".domain").remove()
                // .selectAll(".tick:not(:first-of-type) line").attr("stroke", "#777");

            // Bars
            svg.selectAll("mybar")
                .data(queryData)
                .join("rect")
                .attr("x", (d) => x(d.date))
                .attr("y", (d) => y(d.interest))
                .attr("width", x.bandwidth())
                .attr("height", (d) => height - y(d.interest))
                .attr("fill", "#4285F4");
    }

    const leave = () => (hovering = false);
</script>

<li class="bullet-list-text" on:mouseenter={enter} on:mouseleave={leave}>
    {query}
</li>
{#if hovering}
    <div in:fade={{ duration: 150 }} class="query-hover-card">
        <div>{query}</div>
        <div id="my_dataviz" contenteditable="true" />
    </div>
{/if}
