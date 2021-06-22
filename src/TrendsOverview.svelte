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
  import type {Region, RegionalTrends, RegionalTrendLine, RegionalTrendAggregate} from "./data";
  import {fetchRegionData, fetchRegionalTrendsData, fetchRegionalTrendLines, getLatestRegionData, 
    selectRegionOneTrends, selectRegionTwoTrends, subRegionOneCode, subRegionTwoCode} from "./data";
  import { onMount } from 'svelte';
  import {params} from "./stores";
  import * as d3 from "d3";
  import { createMap, setMapTrend, setSelectedCounty, setSelectedState } from "./choropleth.js";

  let selectedRegion: Region;
  let regions: Region[];
  let regionsByPlaceId: Map<string, Region> = new Map<string, Region>();
  let placeId: string;
  let selectedRegionName: string;
  let regionalTrends: RegionalTrends[];
  let selectedMapTrendId:string = "vaccination";

  const mapData: Promise<RegionalTrendLine[]> = fetchRegionalTrendLines();
  const latestRegionOneData: Promise<Map<string, RegionalTrendAggregate>> = 
    mapData.then((rtls) => getLatestRegionData(selectRegionOneTrends(rtls), subRegionOneCode));
  const latestRegionTwoData: Promise<Map<string, RegionalTrendAggregate>> = 
    mapData.then((rtls) => getLatestRegionData(selectRegionTwoTrends(rtls), subRegionTwoCode));

  // TODO(patankar): Update all metric names where they appear.
  let covid19VaccinationChartContainer: HTMLElement;
  let vaccinationIntentChartContainer: HTMLElement;
  let safetySideEffectsChartContainer: HTMLElement;

  const chartMargin = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  const chartWidth: number = 800 - chartMargin.left - chartMargin.right;
  const chartHeight: number = 400 - chartMargin.top - chartMargin.bottom;

  function getLegendComponentText(): string {
    if (selectedRegion.sub_region_3) {
      return "";
    }
    if (selectedRegion.sub_region_2) {
      return "Zipcodes";
    }
    if (selectedRegion.sub_region_1) {
      return "Counties";
    }
    if (selectedRegion.country_region) {
      return "States";
    }
  }

  // TODO(patankar): Generalize this to allow for different selections.
  function generateTrendChartLegend(el: HTMLElement) {

    const legendContainerElement: HTMLElement = el.querySelector(".chartLegendContainer");
    const legendComponentText: string = getLegendComponentText();

    d3.select(legendContainerElement)
      .selectAll("*")
      .remove();

    d3.select(legendContainerElement)
      .append("div")
        .attr("class", "trendChartLegendRectContainer")
      .append("svg")
      .append("g")
	    .append("rect")
        .attr("class", `trendChartLegendRect ${el.id}`)
        .attr("width", 16)
        .attr("height", 4);
      
    d3.select(legendContainerElement)
      .append("div")
        .attr("class", "trendChartLegendTextContainer")
      .append("text")
        .attr("class", "trendChartLegendText")
        .text(selectedRegionName);

    if (legendComponentText) {
      d3.select(legendContainerElement)
        .append("div")
          .attr("class", "trendChartLegendRectContainer")
        .append("svg")
        .append("g")
        .append("rect")
          .attr("width", 16)
          .attr("height", 4)
          .attr("fill", "#BDC1C6");

      d3.select(legendContainerElement)
        .append("div")
          .attr("class", "trendChartLegendTextContainer")
        .append("text")
          .attr("class", "trendChartLegendText")
          .text(legendComponentText);
    }
  }

  function generateTrendChartHoverCard(el: HTMLElement, trendLine, data: RegionalTrends[], dates: Date[], xScale) {

    const trendlineHoverCardMargin: number = 7;

    const chartElement: HTMLElement = el.querySelector(".chart");
    const verticalLineElement: HTMLElement = el.querySelector(".trendChartVerticalLine");
    const hoverCardElement: HTMLElement = el.querySelector(".hoverCard");
    const verticalLine: Selection = d3.select(verticalLineElement);
    const hoverCard: Selection = d3.select(hoverCardElement);

    hoverCard
      .selectAll("*")
      .remove();

    const hoverCardDate: Selection = hoverCard
      .append("text")
        .attr("class", "hoverCardDate");

    const hoverCardTable: Selection = hoverCard
      .append("table")
        .attr("class", "hoverCardTable");

    // Each of the hover card rows has three entities: the icon (rectangle or "High"/"Low"), the name of the selected region, and the value for the selected region on the selected date.
    const hoverCardSelected: Selection = hoverCardTable
      .append("tr")
        .attr("id", "hoverCardSelected");

    const hoverCardSelectedIcon: Selection = hoverCardSelected
      .append("td")
      .append("div")
        .attr("id", "hoverCardSelectedIcon")
        .attr("class", `hoverCardSelectedIcon ${el.id}`);

    const hoverCardSelectedName: Selection = hoverCardSelected
      .append("td")
        .attr("id", "hoverCardSelectedName")
        .attr("class", "hoverCardName")
        .text(selectedRegionName);

    const hoverCardSelectedValue: Selection = hoverCardSelected
      .append("td")
        .attr("id", "hoverCardSelectedValue")
        .attr("class", "hoverCardValue");

    const hoverCardHigh: Selection = hoverCardTable
      .append("tr")
        .attr("id", "hoverCardHigh");

    const hoverCardHighIcon: Selection = hoverCardHigh
      .append("td")
        .attr("id", "hoverCardHighIcon")
        .attr("class", "hoverCardIconText")
        .text("High");

    const hoverCardHighName: Selection = hoverCardHigh
      .append("td")
        .attr("id", "hoverCardHighName")
        .attr("class", "hoverCardName");

    const hoverCardHighValue: Selection = hoverCardHigh
      .append("td")
        .attr("id", "hoverCardHighValue")
        .attr("class", "hoverCardValue");

    const hoverCardLow: Selection = hoverCardTable
      .append("tr")
        .attr("id", "hoverCardLow");

    const hoverCardLowIcon: Selection = hoverCardLow
      .append("td")
        .attr("id", "hoverCardLowIcon")
        .attr("class", "hoverCardIconText")
        .text("Low");

    const hoverCardLowName: Selection = hoverCardLow
      .append("td")
        .attr("id", "hoverCardLowName")
        .attr("class", "hoverCardName");

    const hoverCardLowValue: Selection = hoverCardLow
      .append("td")
        .attr("id", "hoverCardLowValue")
        .attr("class", "hoverCardValue");

    const dataByDate: Map<string, { place_id: string, value: number }[]> = new Map<string, { place_id: string, value: number }[]>();
    const selectedDataByDate: Map<string, number> = new Map<string, number>();

    data.forEach((regionalTrend) => {
      const trendValues = trendLine(regionalTrend);

      trendValues.forEach((trendValue) => {
        if (regionalTrend.key === placeId) {
          selectedDataByDate.set(trendValue.date, trendValue.value);
        } else {
          if (dataByDate.has(trendValue.date)) {
            dataByDate.get(trendValue.date).push({ place_id: regionalTrend.key, value: trendValue.value });
          } else {
            dataByDate.set(trendValue.date, [{ place_id: regionalTrend.key, value: trendValue.value }]);
          }
        }
      });
    });

    const chartMouseEnter = function (d) {
      verticalLine
        .attr("class", "trendChartVerticalLine");

      hoverCard
        .attr("class", "hoverCard");
    }

    const chartMouseLeave = function (d) {
      verticalLine
        .attr("class", "trendChartVerticalLine inactive");

      hoverCard
        .attr("class", "hoverCard inactive");
    }

    const chartMouseMove = function (d) {
      dates.sort((a, b) => a - b);

      const eventX: number = d3.pointer(event)[0];
      const eventY: number = d3.pointer(event)[1];

      // This date might be in between provided dates.
      const hoveredDate: Date = xScale.invert(eventX);
      const hoveredDateIndex: number = d3.bisectLeft(dates, hoveredDate);
      const earlierDate: Date = dates[hoveredDateIndex - 1];
      const laterDate: Date = dates[hoveredDateIndex];
      let closestDate: Date;

      let closestDateX: number;
      let hoverCardX: number;

      if ((hoveredDate - earlierDate) < (laterDate - hoveredDate)) {
        closestDate = earlierDate;
      } else {
        closestDate = laterDate;
      }

      closestDateX = xScale(closestDate);

      verticalLine
        .attr("x1", closestDateX)
        .attr("x2", closestDateX);

      hoverCardDate
        .text(formatDateForDisplay(closestDate));

      const selectedValue: number = selectedDataByDate.get(formatDateForStorage(closestDate));
      hoverCardSelectedValue.text(Math.round(selectedValue));

      if (dataByDate.size > 0) {
        const placeValues: { place_id: string, value: number }[] = dataByDate.get(formatDateForStorage(closestDate));
        const { min, max } = findMinAndMax(placeValues);
        const minPlaceId: string = min.place_id;
        const minRegion: Region = regionsByPlaceId.get(minPlaceId);
        const minValue: number = min.value;
        const maxPlaceId: string = max.place_id;
        const maxRegion: Region = regionsByPlaceId.get(maxPlaceId);
        const maxValue: number = max.value;

        hoverCardHighName.text(getRegionName(maxRegion));
        hoverCardHighValue.text(Math.round(maxValue));
        hoverCardLowName.text(getRegionName(minRegion));
        hoverCardLowValue.text(Math.round(minValue));
      } else {
        hoverCardHigh.attr("class", "hoverCard inactive");
        hoverCardLow.attr("class", "hoverCard inactive");
      }

      // Determine which side of the vertical line the hover card should be on and calculate the overall position.
      const hoverCardRect = hoverCardElement.getBoundingClientRect();
      const hoverCardWidth = hoverCardRect.width;
      const hoverCardHeight = hoverCardRect.height;
      const chartRect = chartElement.getBoundingClientRect();
      const chartX = chartRect.x;
      const chartY = chartRect.y;

      if (closestDateX < (chartWidth / 2)) {
        hoverCardX = closestDateX + trendlineHoverCardMargin;
      } else {
        hoverCardX = closestDateX - trendlineHoverCardMargin - hoverCardWidth;
      }

      hoverCard
        .style("left", `${chartX + window.scrollX + hoverCardX}px`)
        .style("top", `${chartY + window.scrollY + (chartHeight - hoverCardHeight) / 2}px`);
    }

    chartElement.addEventListener("mouseenter", chartMouseEnter);
    chartElement.addEventListener("mouseleave", chartMouseLeave);
    chartElement.addEventListener("mousemove", chartMouseMove);
  }

  function findMinAndMax(placeValues: { place_id: string, value: number }[]) {

    let min: { place_id: string, value: number };
    let max: { place_id: string, value: number };

    placeValues.forEach((placeValue) => {
      if (!min || placeValue.value < min.value) {
        min = placeValue;
      }

      if (!max || placeValue.value > max.value) {
        max = placeValue;
      }
    });

    return { min, max };
  }

  function formatDateForDisplay(date: Date): string {

    const options = { month: "short", day: "numeric", year: "numeric" };
    return new Intl.DateTimeFormat("en-US", options).format(date);
  }

  function formatDateForStorage(date: Date): string {

    const month = new Intl.DateTimeFormat("en-US", { month: "2-digit" }).format(date);
    const day = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(date);
    const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(date);

    return `${year}-${month}-${day}`;
  }

  function convertStorageDate(storageDate: string): Date {

    const date = new Date(storageDate);
    const time = date.getTime();
    const timeZoneOffset = date.getTimezoneOffset() * 60 * 1000;
    const adjustedTime = time + timeZoneOffset;

    return new Date(adjustedTime);
  }

  function generateTrendChart(el: HTMLElement, trendLine) { 

    const chartElement: HTMLElement = el.querySelector(".chart");
    const chartAreaElement: HTMLElement = chartElement.querySelector("g");
    const xElement: HTMLElement = el.querySelector(".x.axis");
    const yElement: HTMLElement = el.querySelector(".y.axis");
    const pathsElement: HTMLElement = el.querySelector(".paths");
    const verticalLineElement: HTMLElement = el.querySelector(".trendChartVerticalLine");
    let chartArea: Selection;
    let x: Selection;
    let y: Selection;
    let paths: Selection;
    let verticalLine: Selection;

    if (chartAreaElement) {
      chartArea = d3.select(chartAreaElement);
    } else {
      chartArea = d3.select(chartElement)
        .append("g")
        .attr("transform", "translate(" + chartMargin.left + "," + chartMargin.top + ")");
    }

    if (xElement) {
      x = d3.select(xElement);
    } else {
      x = chartArea.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0, " + chartHeight + ")");
    }

    if (yElement) {
      y = d3.select(yElement);
    } else {
      y = chartArea.append("g")
        .attr("class", "y axis");
    }

    if (pathsElement) {
      paths = d3.select(pathsElement);
    } else {
      paths = chartArea.append("g")
        .attr("class", "paths");
    }

    if (verticalLineElement) {
      verticalLine = d3.select(verticalLineElement);
    } else {
      verticalLine = chartArea.append("g")
        .append("line")
          .attr("class", "trendChartVerticalLine inactive")
          .attr("y1", 0)
          .attr("y2", chartHeight);
    }

    let data:RegionalTrends[] = regionalTrends.filter((regionalTrend) => {
      const region = regionsByPlaceId.get(regionalTrend.key);
      let inSelectedRegion: boolean;

      if (selectedRegion.sub_region_2) {
        // County is selected, want component zipcodes.
        inSelectedRegion = region.sub_region_2_code === selectedRegion.sub_region_2_code;
      }
      else if (selectedRegion.sub_region_1) {
        // State is selected, want component counties.
        inSelectedRegion = !region.sub_region_3 && region.sub_region_1_code === selectedRegion.sub_region_1_code;
      }
      else if (selectedRegion.country_region) {
        // Country is selected, want component states.
        inSelectedRegion = !region.sub_region_2 && region.country_region_code === selectedRegion.country_region_code;
      }

      return inSelectedRegion || region.place_id === selectedRegion.place_id;
    });

    const dates: Date[] = trendLine(regionalTrends[0]).map(trend => convertStorageDate(trend.date));

    let xScale = d3.scaleTime()
      .range([0, chartWidth])
      .domain(d3.extent(dates));
    let xAxis = d3.axisBottom(xScale).ticks(5).tickSizeOuter(0);

    let max =
      data.map((region) => d3.max(trendLine(region), (trendValue) => {return trendValue.value;}));

    let yScale = d3.scaleLinear()
      .range([chartHeight, 0])
      .domain([0, d3.max(max)]);
    let yAxis = d3.axisRight(yScale).ticks(5).tickSize(chartWidth);

    // TODO(patankar): Define constants for styling.
    x.call(xAxis)
      .call(g => g.select(".domain")
        .attr("stroke-width", 1)
        .attr("stroke", "#80868B"))
      .call(g => g.selectAll(".tick line")
        .attr("stroke-width", 1)
        .attr("stroke", "#80868B"))
      .call(g => g.selectAll(".tick text")
        .attr("color", "#5F6368")
        .attr("font-family", "Roboto")
        .attr("font-size", 12));
    y.call(yAxis)
      .call(g => g.select(".domain")
        .remove())
      .call(g => g.selectAll(".tick")
        .filter(t => {
          return t === 0;
        })
        .remove())
      .call(g => g.selectAll(".tick line")
        .attr("stroke-width", 1)
        .attr("stroke", "#DADCE0"))
      .call(g => g.selectAll(".tick text")
        .attr("color", "#5F6368")
        .attr("font-family", "Roboto")
        .attr("font-size", 12))
      .call(g => g.select(".yLabel")
        .remove())
      .call(g => g.append("text")
        .attr("class", "yLabel")
        .attr("x", chartWidth - 120)
        .attr("y", -10)
        .attr("fill", "#5F6368")
        .attr("font-family", "Roboto")
        .attr("font-size", 11)
        .text("RELATIVE SEARCH VOLUME"));

    generateTrendChartLegend(el);
    generateTrendChartHoverCard(el, trendLine, data, dates, xScale);

    let lineFn = d3.line()
          .defined((d) => !isNaN(d.value))
          .x((d) => xScale(new Date(d.date)))
          .y((d) => yScale(d.value))
          .curve(d3.curveLinear);

    paths
      .selectAll("path")
      .data(data, d => d.key)
      .join("path")
        .sort((a, b) => {
          if (a.key != placeId) {
            return -1;
          }

          return 1;
        })
        .attr("id", d=> d.key)
        .attr("class", (regionalTrend) => {
          if (regionalTrend.key === placeId) {
            return `trendline trendline-selected ${el.id}`;
          } else {
            return "trendline";
          }
        })
        .attr("d", d => lineFn(trendLine(d)));
  }

  function onChangeMapTrend(): void {
    selectedMapTrendId = this.id;
    Promise.all([latestRegionOneData, latestRegionTwoData]).then((values) => {
	    setMapTrend(selectedMapTrendId);
	  });
  }

  function getRegionName(region: Region): string {
    let regionName: string;

    if (region.sub_region_3) {
      regionName = region.sub_region_3;

      if (region.sub_region_2) {
        regionName += `, ${region.sub_region_2}`;
      }
    }
    else if (region.sub_region_2) {
      regionName = region.sub_region_2;

      if (region.sub_region_1) {
        regionName += `, ${region.sub_region_1}`;
      }
    }
    else if (region.sub_region_1) {
      regionName = region.sub_region_1;

      if (region.country_region) {
        regionName += `, ${region.country_region}`;
      }
    }
    else if (region.country_region) {
      regionName = region.country_region;
    }

    return regionName;
  }

 onMount(async () => {
              
    regions = await fetchRegionData();
    regions.forEach((region) => {
      // TODO(patankar): Clean up after component refactor to avoid redundancies like this one.
      regionsByPlaceId.set(region.place_id, region);
      });

    regionalTrends = await fetchRegionalTrendsData();

    if (placeId) {
      selectedRegion = regionsByPlaceId.get(placeId);
    }
    params.subscribe((param) => {
      placeId = param.placeId;
      if (placeId) {
        selectedRegion = regionsByPlaceId.get(placeId);
        selectedRegionName = getRegionName(selectedRegion);
        generateTrendChart(covid19VaccinationChartContainer, (t) => {return t.value.covid19_vaccination;});
        generateTrendChart(vaccinationIntentChartContainer, (t) => {return t.value.vaccination_intent;});
        generateTrendChart(safetySideEffectsChartContainer, (t) => {return t.value.safety_side_effects;});
       }
    })

    Promise.all([latestRegionOneData, latestRegionTwoData]).then((values) => {
	    createMap(values[0], values[1], selectedMapTrendId);
	  });
  });

  function onChangeHandler(selectedRegion: Region):void {
    if (selectedRegion != undefined) {
      params.update((p) => {
        p.placeId = selectedRegion.place_id;
        return p;
      });
      if(selectedRegion.sub_region_2_code){
        setSelectedCounty(selectedRegion.sub_region_2_code);
      }else if(selectedRegion.sub_region_1_code){
        setSelectedState(selectedRegion.sub_region_1_code);
      }
    }
  }

</script>

<main>
  <header>
    <div class="header-topbar">
      <div>
        <a href='https://www.google.com/'>
          <svg role="img" aria-hidden="true" class="header-topbar-glue-logo">
            <use xlink:href="glue/glue-icons.svg#google-color-logo"></use>
          </svg>
        </a>
        <div class="header-topbar-text">
          Vaccine Information Search Trends <span class="header-topbar-early-access">Early Access</span>
        </div>
      </div>
      <ul class="header-topbar-menu">
        <!-- TODO: replace with actual links once available -->
        <li class="link-item"><a class="link-item-anchor" href="http://health.google">Download</a></li>
        <li class="link-item"><a class="link-item-anchor" href="http://health.google">Documentation</a></li>
      </ul>
    </div>
    <div class="header-search-bar">
      <div class="header-search-container">
        <AutoComplete
          items={regions}
          bind:selectedItem={selectedRegion}
          placeholder={'United States'}
          labelFunction={
            region => getRegionName(region)
          }
          onChange={onChangeHandler}
          inputClassName={"header-search-box"}
          className={"header-search-container"} />
      </div>
    </div>
    <div class="header-content-divider" />
  </header>
  <div class="content-area">
    <div class="content-body">
      <h1>
        COVID-19 Vaccine Information Search Trends
      </h1>
      <p>
        Explore searches for COVID-19 vaccination topics by region. This aggregated and anonymized data helps you 
        understand and compare communities' information needs. We’re releasing this data to inform public health 
        vaccine-confidence efforts.
      </p>
      {#await regionalTrends}
      <!-- Empty -->
      {:then trends}
      <div>
        <div class="mapTrendSelectorGroup">
          <button id="vaccination"
                  class="{(selectedMapTrendId == 'vaccination' ) ? 'mapTrendSelector selectedTrend' : 'mapTrendSelector'}"
                  on:click={onChangeMapTrend}
                  title="Search interest in any aspect of COVID-19 vaccination. A scaled value that you can compare across regions and times." >
                  {#if selectedMapTrendId == 'vaccination'}
                    <span class="material-icons map-trend-selector-active" >done</span>
                  {/if}
                  Covid-19 vaccination searches
          </button>
          <button id="intent"
                  class="{(selectedMapTrendId == 'intent' ) ? 'mapTrendSelector selectedTrend' : 'mapTrendSelector'}"
                  on:click={onChangeMapTrend}
                  title="Search interest in the eligibility, availability, and accessibility of COVID-19 vaccines. A scaled value that you can compare across regions and times.
" >
                  {#if selectedMapTrendId == 'intent'}
                    <span class="material-icons map-trend-selector-active" >done</span>
                  {/if}
                  Vaccination intent searches
          </button>
          <button id="safety"
                  class="{(selectedMapTrendId == 'safety' ) ? 'mapTrendSelector selectedTrend' : 'mapTrendSelector'}"
                  on:click={onChangeMapTrend}
                  title="Search interest in the safety and side effects of COVID-19 vaccines. A scaled value that you can compare across regions and times." >
                  {#if selectedMapTrendId == 'safety'}
                    <span class="material-icons map-trend-selector-active" >done</span>
                  {/if}
                  Safety and side effect searches
          </button>
        </div>
        <!-- map header/legend -->
	<div id="map-callout" class="map-callout">
          <h3 id="map-callout-title" class="map-callout-title">Region Name</h3>
          <p class="map-callout-text">Interest</p>
          <svg id="map-callout-info" />
	</div>
        <div class="mapLegendContainer">
          <div class="mapLegend" />
        </div>
        <div class="map" />
      </div>
      {/await}
      <div id="covid19Vaccination"
        bind:this={covid19VaccinationChartContainer} >
        <h3>Covid-19 vaccination searches</h3>
        <div class="chartLegendContainer" />
        <div class="hoverCard inactive" />
        <svg
          class="chart"
          width="{chartWidth + chartMargin.left + chartMargin.right}"
          height="{chartHeight + chartMargin.top + chartMargin.bottom}" />
      </div>
      <div id="vaccinationIntent"
        bind:this={vaccinationIntentChartContainer} >
        <h3>Vaccination intent searches</h3>
        <div class="chartLegendContainer" />
        <div class="hoverCard inactive" />
        <svg
          class="chart"
          width="{chartWidth + chartMargin.left + chartMargin.right}"
          height="{chartHeight + chartMargin.top + chartMargin.bottom}" />
      </div>
      <div id="safetySideEffects"
        bind:this={safetySideEffectsChartContainer} >
        <h3>Safety and Side-effect searches</h3>
        <div class="chartLegendContainer" />
        <div class="hoverCard inactive" />
        <svg
          class="chart"
          width="{chartWidth + chartMargin.left + chartMargin.right}"
          height="{chartHeight + chartMargin.top + chartMargin.bottom}" />
      </div>
      <h2>About this data</h2>
      <p>
        You can use this data to compare search interest between topics related to COVID-19 vaccination. The value for 
        search interest isn’t an absolute number of searches—it’s a value representing relative interest which we scale 
        to make it easier to compare regions with one another, or the same region over time. If you’d like to know more 
        about our calculation and process, visit <a href="http://todo">technical docs</a>.
      </p>
      <h2>How to best use this data</h2>
      <p>
        We used the same normalization and scaling everywhere so that you can make these comparisons:
      </p>
      <ul>
        <li>Compare a region with others to see where you might focus effort.</li>
        <li>
          Compare a region over time to see how your community’s information needs have 
          changed or see the impact of your communication efforts and news events.
        </li>
      </ul>
      <p>
        Remember, the data shows people’s interest—not opinions or actual events. You can’t conclude that a community is 
        suffering from many side effects because there’s increased interest in the safety and side effects category. 
      </p>
      <h2>Protecting privacy</h2>
      <p>
        We developed the Vaccine Search Insights to be helpful while adhering to our stringent privacy protocols and protecting 
        people’s privacy. No individual search queries or other personally identifiable information are made available at any point. 
        For this data, we use <a href="https://www.youtube.com/watch?v=FfAdemDkLsc&feature=youtu.be&hl=en">differential privacy, </a>
        which adds artificial noise to our data while enabling high quality results without identifying any individual person.
      </p>
      <p>
        To learn more about the privacy methods used to generate the data, read the
        <a href="http://todo" >privacy paper</a>.
      </p>
      <h2>Availability and updates</h2>
      <p>
        To download or use the data or insights, you must agree to the 
        <a href="https://policies.google.com/terms">Google Terms of Service</a>.
      </p>
      <p>
        We’ll update the data each week. You can check the dates in the charts to see the most recent day in the data. If you 
        download the CSV, remember to get an updated version each week.
      </p>
      <p>
        We'll continue to update this product while public health experts find it useful in their COVID-19 vaccination efforts. 
        Our published data will remain publicly available to support long-term research and evaluation.
      </p>
      <div id="next-steps" class="next-steps-container">
        <div class="next-steps-item">
          <h3>Query the dataset</h3>
          <svg width="260" height="150" class="next-steps-icon-placeholder" />
          <p>
            Get real-time insights using Google Cloud’s BigQuery. Analyse with SQL or call APIs from your code.
          <p>
          <p>
            <a href="http://todo">Bigquery public dataset</a>
          </p>
        </div>
        <div class="next-steps-item" >
          <h3>Tell us about your project</h3>
          <svg width="260" height="150" class="next-steps-icon-placeholder" />
          <p>
            We’d love to hear more about how you’re using Vaccination Search Insights. If you’ve solved problems, 
            we’d like to help you share your solutions.
          </p>
          <p>
            <a href="http://todo">Submission page</a>
          </p>
        </div>
      </div>
    </div>
  </div>
  <footer>
    <div class="footer-referencebar">
      <div class="footer-referencebar-logo-container">
        <a href="https://www.google.com" title="Google" >
          <svg role="img" aria-hidden="true" class="footer-referencebar-glue-logo">
            <use xlink:href="glue/glue-icons.svg#google-solid-logo"></use>
          </svg>
        </a>
      </div>
      <ul class="footer-items">
        <li class="link-item"><a class="link-item-anchor" href="https://www.google.com/about">About Google</a></li>
	<li class="link-item"><a class="link-item-anchor" href="https://www.google.com/about/products">Google Products</a></li>
        <li class="link-item"><a class="link-item-anchor" href="https://policies.google.com/privacy">Privacy</a></li>
        <li class="link-item"><a class="link-item-anchor" href="https://policies.google.com/terms">Terms</a></li>
      </ul>
    </div>
  </footer>
</main>
