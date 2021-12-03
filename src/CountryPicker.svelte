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
  import type { Country, RegionalTrends, TrendValue } from "./data";
  import { fetchGlobalTrendsData, fetchGlobalData } from "./data";
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { params } from "./stores";
  import { fetchCountryMetaData, fetchCountryNames } from "./metadata";
  import {
    formatDateForDisplay,
    formatDateForStorage,
    convertStorageDate,
    getClosestDate,
  } from "./utils";

  export let id: string;
  export let trendLine: (trends: RegionalTrends) => TrendValue[];

  let globalTrendsByPlaceId: Map<string, RegionalTrends>;
  let countriesByPlaceId: Map<string, Country> = new Map<string, Country>();
  let placeId: string;
  let country_list;
  let chartContainerElement: HTMLElement;
  let countryNameToPlaceId = new Map();

  const chartBounds = {
    width: 480,
    height: 294,
  };

  //https://observablehq.com/@d3/margin-convention?collection=@d3/d3-axis
  const margin = { top: 10, bottom: 30, left: 0, right: 30 };

  function generateChartLegend() {
    const legendContainerElement: HTMLElement =
      chartContainerElement.querySelector(".chart-legend-container");

    d3.select(legendContainerElement).selectAll("*").remove();

    country_list.forEach((countryName) => {
      d3.select(legendContainerElement)
        .append("div")
        .attr("class", "chart-legend-rect-container")
        .append("svg")
        .append("g")
        .append("rect")
        .attr("class", `chart-legend-rect ${countryName.replace(/\s+/g, "_")}`)
        .attr("width", 16)
        .attr("height", 4);

      d3.select(legendContainerElement)
        .append("div")
        .attr("class", "chart-legend-text-container")
        .append("text")
        .attr("class", "chart-legend-text")
        .text(countryName);
    });

    d3.select(legendContainerElement)
      .append("div")
      .attr("class", "chart-legend-text-container chart-axis-label")
      .append("text")
      .text("INTEREST");
  }

  function generateChartHoverCard(
    data: RegionalTrends[],
    dates: Date[],
    xScale: d3.ScaleTime<number, number, never>
  ) {
    const trendlineHoverCardMargin: number = 7;

    const chartAreaHoverElement: HTMLElement =
      chartContainerElement.querySelector(".chart-area-hover");
    const chartAreaContainerElement: HTMLElement =
      chartContainerElement.querySelector(".chart-area-container");
    const verticalLineElement: SVGGElement =
      chartContainerElement.querySelector(".chart-vertical-line");
    const hoverCardElement =
      chartContainerElement.querySelector(".chart-hover-card");
    const verticalLine = d3.select(verticalLineElement);
    const hoverCard = d3.select(hoverCardElement);

    hoverCard.selectAll("*").remove();

    const hoverCardDate = hoverCard
      .append("text")
      .attr("class", "chart-hover-card-date");

    const hoverCardTable = hoverCard
      .append("table")
      .attr("class", "chart-hover-card-table");

    country_list.forEach((countryName) => {
      const hoverCard = hoverCardTable
        .append("tr")
        .attr("class", "chart-hover-card-selected")
        .style("display", "table-row");

      const hoverCardIcon = hoverCard
        .append("td")
        .append("div")
        .attr("class", "chart-hover-card-selected-icon")
        .attr(
          "class",
          `chart-hover-card-selected-icon ${countryName.replace(/\s+/g, "_")}`
        );

      const hoverCardName = hoverCard
        .append("td")
        .attr("class", "chart-hover-card-selected-name")
        .attr("class", "chart-hover-card-name")
        .attr("id", `name-${countryName.replace(/\s+/g, "_")}`)
        .text(countryName);

      const hoverCardValue = hoverCard
        .append("td")
        .attr("class", "chart-hover-card-selected-value")
        .attr("class", "chart-hover-card-value")
        .attr("id", `value-${countryName.replace(/\s+/g, "_")}`)
        .text("");
    });

    const dataByDate = new Map<string, { place_id: string; value: number }[]>();
    data.forEach((countryTrend) => {
      const trendValues = trendLine(countryTrend);

      trendValues.forEach((trendValue) => {
        if (dataByDate.has(trendValue.date)) {
          dataByDate.get(trendValue.date).push({
            place_id: countryTrend.place_id,
            value: trendValue.value,
          });
        } else {
          dataByDate.set(trendValue.date, [
            { place_id: countryTrend.place_id, value: trendValue.value },
          ]);
        }
      });
    });

    const chartMouseEnter = function (d) {
      verticalLine.attr("class", "chart-vertical-line");

      hoverCard.attr("class", "chart-hover-card");
    };

    const chartMouseLeave = function (d) {
      verticalLine.attr("class", "chart-vertical-line inactive");

      hoverCard.attr("class", "chart-hover-card inactive");
    };

    const chartMouseMove = function (d) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      //Calculate position relative to the SVG's viewBox
      //By default this uses the event's target which is the parent container
      //If the SVG is smaller than its defined viewBox (i.e. it was resized)
      //then the parent container offset gives us an incorrect value
      const eventX: number = d3.pointer(d, chartAreaContainerElement)[0];

      // This date might be in between provided dates.
      const hoveredDate: Date = xScale.invert(eventX);
      const hoveredDateIndex: number = d3.bisectLeft(dates, hoveredDate);
      const earlierDate: Date = dates[hoveredDateIndex - 1];
      const laterDate: Date = dates[hoveredDateIndex];
      let closestDate: Date = getClosestDate(
        hoveredDate,
        earlierDate,
        laterDate
      );
      let closestDateX: number;
      let hoverCardX: number;

      closestDateX = xScale(closestDate);

      verticalLine.attr("x1", closestDateX).attr("x2", closestDateX);

      hoverCardDate.text(formatDateForDisplay(closestDate));

      if (dataByDate.size > 0) {
        const placeValues: { place_id: string; value: number }[] =
          dataByDate.get(formatDateForStorage(closestDate));
        country_list.forEach((countryName) => {
          let the_value = placeValues.find(
            (placeValue) =>
              placeValue.place_id == countryNameToPlaceId.get(countryName)
          );
          let value_cell = document.getElementById(
            `value-${countryName.replace(/\s+/g, "_")}`
          );
          value_cell.textContent = the_value.value.toString();
        });
      }

      const mediabreakpoint = 600;
      if (window.innerWidth > mediabreakpoint) {
        // Determine which side of the vertical line the hover card should be on and calculate the overall position.
        const hoverCardRect = hoverCardElement.getBoundingClientRect();
        const hoverCardWidth = hoverCardRect.width;
        const hoverCardHeight = hoverCardRect.height;
        const chartRect = chartAreaContainerElement.getBoundingClientRect();
        const chartY = chartRect.y;

        const lineRect = verticalLineElement.getBoundingClientRect();

        const isLayoutOnRight = lineRect.x < window.innerWidth / 2;

        if (isLayoutOnRight) {
          hoverCardX = lineRect.x + trendlineHoverCardMargin;
        } else {
          hoverCardX = lineRect.x - trendlineHoverCardMargin - hoverCardWidth;
        }

        hoverCard
          .style("left", `${hoverCardX}px`)
          .style(
            "top",
            `${
              chartY + window.scrollY + (chartRect.height - hoverCardHeight) / 2
            }px`
          );
      }
    };

    chartAreaHoverElement.addEventListener("mouseenter", chartMouseEnter);
    chartAreaHoverElement.addEventListener("mouseleave", chartMouseLeave);
    chartAreaHoverElement.addEventListener("mousemove", chartMouseMove);
  }

  type HtmlSelection = d3.Selection<HTMLElement, any, any, any>;
  type SvgSelection = d3.Selection<SVGGElement, any, any, any>;
  type ElementSection = HtmlSelection | SvgSelection;

  function generateChart() {
    const chartAreaContainerElement: SVGElement =
      chartContainerElement.querySelector(".chart-area-container");
    const chartAreaElement: SVGGElement =
      chartAreaContainerElement.querySelector("g");
    const xElement: SVGGElement =
      chartContainerElement.querySelector(".x.axis");
    const yElement: SVGGElement =
      chartContainerElement.querySelector(".y.axis");
    const pathsElement: SVGGElement =
      chartContainerElement.querySelector(".paths");
    const verticalLineElement: SVGGElement =
      chartContainerElement.querySelector(".chart-vertical-line");
    let chartArea: SvgSelection;
    let x: SvgSelection;
    let y: SvgSelection;
    let paths: SvgSelection;
    let verticalLine: SvgSelection;

    if (chartAreaElement) {
      chartArea = d3.select(chartAreaElement);
    } else {
      chartArea = d3
        .select(chartAreaContainerElement)
        .attr(
          "viewBox",
          [0, 0, chartBounds.width, chartBounds.height].join(" ")
        )
        .append("g");
    }

    if (xElement) {
      x = d3.select(xElement);
    } else {
      x = chartArea.append("g").attr("class", "x axis");
    }

    if (yElement) {
      y = d3.select(yElement);
    } else {
      y = chartArea.append("g").attr("class", "y axis");
    }

    if (pathsElement) {
      paths = d3.select(pathsElement);
    } else {
      paths = chartArea.append("g").attr("class", "paths");
    }

    if (verticalLineElement) {
      verticalLine = d3.select(verticalLineElement);
    } else {
      verticalLine = chartArea
        .append("g")
        .append("line")
        .attr("class", "chart-vertical-line inactive")
        .attr("y1", margin.top)
        .attr("y2", chartBounds.height - margin.bottom);
    }

    let data: RegionalTrends[] = Array.from(globalTrendsByPlaceId.values());

    // A superset of dates for shown trendlines.
    // TODO(patankar): Efficiency.
    const dates: Date[] = [];
    data.forEach((regionalTrends) => {
      const regionalTrendValues = trendLine(regionalTrends);

      regionalTrendValues.forEach((regionalTrendValue) => {
        const date = convertStorageDate(regionalTrendValue.date);

        if (!dates.includes(date)) {
          dates.push(date);
        }
      });
    });

    let xScale = d3
      .scaleTime()
      .range([margin.left, chartBounds.width - margin.right])
      .domain(d3.extent(dates));
    let xAxis: d3.Axis<Date | d3.NumberValue> = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickSizeOuter(0);

    let max = d3.max(
      data.flatMap((region) => trendLine(region).map((trend) => trend.value))
    );

    let yScale = d3
      .scaleLinear()
      .range([chartBounds.height - margin.bottom, margin.top])
      .domain([0, max]);
    let yAxis = d3
      .axisRight(yScale)
      .ticks(5)
      .tickSize(chartBounds.width - margin.right);

    // TODO(patankar): Define constants for styling.
    x.call(xAxis)
      .attr("transform", `translate(0,${chartBounds.height - margin.bottom})`)
      .call((g) =>
        g.select(".domain").attr("stroke-width", 1).attr("stroke", "#80868B")
      )
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke-width", 1)
          .attr("stroke", "#80868B")
      )
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("color", "#5F6368")
          .attr("font-family", "Roboto")
          .attr("font-size", 12)
      );
    y.call(yAxis)
      //.attr("transform",`translate(${chartBounds.width-margin.right},0)`)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke-width", 1)
          .attr("stroke", "#DADCE0")
      )
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("color", "#5F6368")
          .attr("font-family", "Roboto")
          .attr("font-size", 12)
      );

    scaleChartText();

    generateChartLegend();
    generateChartHoverCard(data, dates, xScale);

    let lineFn = d3
      .line<TrendValue>()
      .defined((d) => !isNaN(d.value))
      .x((d) => xScale(new Date(d.date)))
      .y((d) => yScale(d.value))
      .curve(d3.curveLinear);

    paths
      .selectAll("path")
      .data(data, (d: RegionalTrends) => d.place_id)
      .join("path")
      .sort((a, b) => {
        return -1;
      })
      .attr("id", (d) => d.place_id)
      .attr("class", (regionalTrend) => {
        let countryName = [...countryNameToPlaceId].find(
          ([key, val]) => val === regionalTrend.place_id
        )[0];
        return `trendline trendline-selected ${countryName.replace(
          /\s+/g,
          "_"
        )}`;
      })
      .attr("d", (d) => lineFn(trendLine(d)));
  }

  function scaleChartText() {
    // as per d3
    const padding: number = 3;
    const tickSize: number = 6;

    const chartAreaContainerElement: SVGElement =
      chartContainerElement.querySelector(".chart-area-container");
    const chartXAxisElement: SVGElement =
      chartAreaContainerElement.querySelector(".x.axis");
    const chartYAxisElement: SVGElement =
      chartAreaContainerElement.querySelector(".y.axis");
    const chartXAxisTickTextElements: NodeList =
      chartXAxisElement.querySelectorAll(".tick text");
    const chartYAxisTickTextElements: NodeList =
      chartYAxisElement.querySelectorAll(".tick text");

    const chartXAxisTickTexts: SvgSelection = d3.selectAll(
      chartXAxisTickTextElements
    );
    const chartYAxisTickTexts: SvgSelection = d3.selectAll(
      chartYAxisTickTextElements
    );

    const chartAreaScale: number =
      chartAreaContainerElement.getBoundingClientRect().width /
      chartBounds.width;
    chartXAxisTickTexts
      .attr("transform", `scale(${1 / chartAreaScale})`)
      .attr("y", `${tickSize * chartAreaScale + padding}`);
    chartYAxisTickTexts
      .attr("transform", `scale(${1 / chartAreaScale})`)
      .attr(
        "x",
        `${(chartBounds.width - margin.right) * chartAreaScale + padding}`
      );
  }

  function onCountrySelectHandler(): void {
    var selectedCountryName = this.getAttribute("data-countryName");
    if (selectedCountryName) {
      let selectedCountryID = countryNameToPlaceId.get(selectedCountryName);
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

  onMount(async () => {
    params.subscribe((param) => {
      placeId = param.placeId;
    });

    if (!placeId) {
      country_list = fetchCountryNames();
      country_list.forEach((countryName) => {
        let country_metadata = fetchCountryMetaData(countryName)[0];
        countryNameToPlaceId.set(countryName, country_metadata.placeId);
      });
      let menu, item, div;

      countriesByPlaceId = await fetchGlobalData();
      globalTrendsByPlaceId = await fetchGlobalTrendsData();

      menu = document.getElementById("menu");
      country_list.forEach((countryName) => {
        // Row
        item = document.createElement("a");
        item.classList.add("menu-item");
        item.setAttribute("data-countryName", countryName);
        item.addEventListener("click", onCountrySelectHandler, false);
        menu.appendChild(item);

        // Color
        div = document.createElement("div");
        div.setAttribute(
          "class",
          `country-picker-icon chart-hover-card-selected-icon ${countryName.replace(
            /\s+/g,
            "_"
          )}`
        );
        item.appendChild(div);

        // Label
        div = document.createElement("div");
        div.appendChild(document.createTextNode(countryName));
        item.appendChild(div);
      });

      if (globalTrendsByPlaceId && countriesByPlaceId) {
        generateChart();
      }

      window.addEventListener("resize", scaleChartText);
    }
  });
</script>

<div bind:this={chartContainerElement}>
  <div class="world-picker">
    <div class="menu">
      <div class="menu-title">Select a country</div>
      <div class="menu-list" id="menu" />
    </div>

    <div class="chart">
      <div class="chart-title">COVID-19 vaccination searches</div>
      <div class="chart-area-hover">
        <svg class="chart-area-container" />
        <div class="chart-hover-card inactive" />
      </div>
      <div class="chart-graph" id="chart" />
    </div>
  </div>
</div>
