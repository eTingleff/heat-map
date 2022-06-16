'use strict';

import * as d3 from "https://cdn.skypack.dev/d3@7";

const dataUrl = 'https://raw.githubusercontent.com/freeCodeCamp/ProjectReferenceData/master/global-temperature.json';

const getData = async () => {
  const data = await d3.json(dataUrl);

  return data;
}

const {
  baseTemperature,
  monthlyVariance: data,
} = await getData();

const margin = {
  top: 50,
  right: 0,
  bottom: 50,
  left: 100,
};

const width = 1500 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select('#heat-map-container')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', `translate(${margin.left}, ${margin.top})`);

let yearExtent = d3.extent(data, (d) => d.year);
yearExtent[0] -= 1;
yearExtent[1] += 1;

// Create a linear scale for the xAxis (years)
const xLinearScale = d3.scaleLinear()
  .range([0, width])
  .domain(yearExtent);

const xAxis = d3.axisBottom(xLinearScale)
  .tickFormat(d3.format('d'));

// Add the xAxis to the main svg
svg.append('g')
  .attr('id', 'x-axis')
  .attr('transform', `translate(0, ${height})`)
  .call(xAxis);

// Create a band scale for the yAxis (months of the year)
const yScale = d3.scaleBand()
  .range([height, 0])
  .domain(d3.range(12).map((v) => v += 1).reverse());

// The yScale domain is an array of numbers so the month formatter has to
// parse and then format
const formatMonth = (m) => d3.timeFormat('%-B')(d3.timeParse('%-m')(`${m}`));

const yAxis = d3.axisLeft(yScale)
  .tickFormat(formatMonth);

// Add the yAxis to the main svg
svg.append('g')
  .attr('id', 'y-axis')
  .call(yAxis);

const [min, max] = d3.extent(data, d => d.variance);
const minTemp = min + baseTemperature;
const maxTemp = max + baseTemperature;
const absoluteMax = Math.max(Math.abs(min), Math.abs(max));
// The built-in interpolateRdBu method would give colors from red(low) to
// blue(high). To reverse this, (1 - t) is passed as the argument
const getColor = d3.scaleDiverging([-absoluteMax, 0, absoluteMax], (t) => d3.interpolateRdBu(1 - t));

// Create a second scale for the xAxis, this time a band scale.
// The linear one is used for tick placement and heat map cell placement
// but the band scale is be used to set the appropriate width on each cell
const xBandScale = d3.scaleBand()
  .range([0, width])
  .domain(data.map((d) => d.year));

// Add the tooltip div with its styles and set to be hidden initially
const tooltip = d3.select('#heat-map-container')
  .append('div')
  .attr('id', 'tooltip')
  .attr('class', 'tooltip')
  .style('position', 'absolute')
  .style('background-color', 'black')
  .style('opacity', '0.8')
  .style('border-radius', '5px')
  .style('padding', '10px')
  .style('color', 'white')
  .style('text-align', 'center')
  .style('font-family', 'arial')
  .style('visibility', 'hidden');


const formatTemperature = d3.format('-.1f');
const formatVariance = d3.format('+.1f');

// Helper function to format the html to display in the tooltip
const getTooltipString = (e) => {
  const attributes = e.target.attributes;
  const year = attributes['data-year'].value;
  // Add 1 to the value of data-month here because the FCC tests require
  // that the data-month be 0-based
  const month = formatMonth(attributes['data-month'].value + 1);
  const variance = formatVariance(attributes['data-variance'].value);
  const temperature = formatTemperature(attributes['data-temp'].value);

  return `${year} - ${month}<br>${temperature}&degC<br>${variance}&degC`;
}

const getTooltipWidth = () => {
  const el = document.getElementById('tooltip');
  if (el) {
    return el.offsetWidth;
  }
}

const onMouseOver = (d) => {
  // Display the tooltip centered and above the hovered cell
  tooltip
    .attr('data-year', d.target.attributes['data-year'].value)
    .style('visibility', 'visible')
    .style('left', `${d.pageX - (getTooltipWidth() / 2)}px`)
    .style('top', `${d.target.y.baseVal.value + margin.top + 30}px`)
    .html(getTooltipString(d));

  // Outline the hovered cell
  d3.select(d.target)
    .style('stroke', 'black')
    .style('opacity', 1);
}

const onMouseLeave = (d) => {
  d3.select(d.target)
    .style('stroke', 'none');
  tooltip.style('visibility', 'hidden');
}

// Add the cell rects using the data
svg.selectAll()
  .data(data)
  .join('rect')
  .attr('class', 'cell')
  // Subtract 1 from the month in each data point because the FCC tests
  // require data-month be a 0-based month value
  .attr('data-month', (d) => d.month - 1)
  .attr('data-year', (d) => d.year)
  .attr('data-variance', (d) => d.variance)
  .attr('data-temp', (d) => baseTemperature + d.variance)
  .attr('x', (d) => xLinearScale(d.year))
  .attr('y', (d) => yScale(d.month))
  .attr('width', xBandScale.bandwidth())
  .attr('height', yScale.bandwidth())
  .attr('fill', (d) => getColor(d.variance))
  .on('mouseover', onMouseOver)
  .on('mouseleave', onMouseLeave);

// Helper function to get the legend tick values.
// Starting with the base temperature as a midpoint of two values,
// build an array of values from inside out to be used as ticks in the legend.
const getLegendValues = () => {
  const median = baseTemperature;
  const span = maxTemp - minTemp;
  const chunkSize = span / 10;
  const halfChunk = chunkSize / 2;

  let values = [
    median - halfChunk,
    median + halfChunk,
  ];
  let lower = [];
  let upper = [];

  for (let i = 1; i < 5; i += 1) {
    let lowerValue = values[0] - (chunkSize * i);
    let upperValue = values[1] + (chunkSize * i);
    lower.push(lowerValue);
    upper.push(upperValue);
  }

  return [
    ...lower.reverse(),
    ...values,
    ...upper,
  ];
}

// Helper function to get the values used to get the color keys of the legend.
// Starting with the base temperature as the median value, build an array
// of values inside out.
const getLegendKeyValues = () => {
  const median = baseTemperature;
  const span = maxTemp - minTemp;
  const chunkSize = span / 9;

  let lower = [];
  let upper = [];
  for (let i = 1; i < 5; i += 1) {
    let lowerValue = median - (chunkSize * i);
    let upperValue = median + (chunkSize * i);
    lower.push(lowerValue);
    upper.push(upperValue)
  }

  return [...lower.reverse(), median, ...upper];
}

const legendMargin = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
};

const legendWidth = 500;
const legendHeight = 100;

const legendXScale = d3.scaleBand()
  .rangeRound([0, legendWidth])
  .domain(getLegendValues().map((d) => d));

const legendXAxis = d3.axisBottom(legendXScale)
  .tickFormat(formatTemperature);

const legend = d3.select('#legend-container')
  .append('svg')
  .attr('id', 'legend')
  .attr('width', legendWidth + margin.left + legendMargin.right)
  .attr('height', legendHeight + legendMargin.top + legendMargin.bottom)
  .append('g')
  .attr('transform', `translate(${margin.left}, ${legendMargin.top})`)

// Add the legend axis to the legend svg
legend.append('g')
  .attr('id', 'legendAxis')
  .attr('transform', `translate(0, ${legendHeight - legendMargin.bottom - legendMargin.top})`)
  .call(legendXAxis);

// Get the values to color and position the legend keys
const legendKeyValues = getLegendKeyValues();

const addLegendRects = () => {
  legendKeyValues.forEach((d, i) => {
    legend.append('rect')
      .attr('width', legendWidth / 10)
      .attr('height', legendWidth / 10)
      .attr('transform', `translate(${((legendWidth / 10) * i) + (legendWidth / 20)}, ${legendHeight - legendMargin.bottom - legendMargin.top - 50})`)
      .attr('fill', getColor(d - baseTemperature)); // getColor expects the temperature variance here
  });
}

addLegendRects();
