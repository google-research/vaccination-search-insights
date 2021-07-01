# Vaccination Search Insights

This project provides an reference visualization for the Google [Vaccination Search Insights](http://console.cloud.google.com/marketplace/product/bigquery-public-datasets/covid19-vaccination-search-insights) data set.  

This is not an official Google product.

Keep reading or [download the data](https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/Global_vaccination_search_insights.csv) directly.

## About this data

You can use this data to compare search interest between topics related to COVID-19 vaccination. The value for search interest isn’t an absolute number of searches—it’s a value representing relative interest which we scale to make it easier to compare regions with one another, or the same region over time. If you’d like to know more about our calculation and process, see our [technical docs](https://storage.googleapis.com/gcs-public-datasets/COVID-19%20Vaccination%20Search%20Insights%20documentation.pdf).
## How to best use this data

We used the same normalization and scaling everywhere so that you can make these comparisons:

* Compare a region with others to see where you might focus effort.
* Compare a region over time to see how your community’s information needs have changed or see the impact of your communication efforts and news events.

Remember, the data shows people’s interest—not opinions or actual events. You can’t conclude that a community is suffering from many side effects because there’s increased interest in the safety and side effects category.

Protecting privacy
We developed the Vaccine Search Insights to be helpful while adhering to our stringent privacy protocols for search data. No individual search queries or other personally identifiable information are made available at any point. For this data, we use [differential privacy](https://www.youtube.com/watch?v=FfAdemDkLsc), which adds artificial noise to our data while enabling high quality results without identifying any individual person.
## Availability and updates

To download or use the data or insights, you must agree to the [Google Terms of Service](https://policies.google.com/terms).

We’ll update the data each week. You can check the dates in the charts to see the most recent day in the data. If you download the CSV, remember to get an updated version each week.

We'll continue to update this product while public health experts find it useful in their COVID-19 vaccination efforts. Our published data will remain publicly available to support long-term research and evaluation.

### Query the dataset

Get real-time insights using Google Cloud’s BigQuery. Analyse with SQL or call APIs from your code.

[Bigquery public dataset](http://console.cloud.google.com/marketplace/product/bigquery-public-datasets/covid19-vaccination-search-insights)

### Analyze with covariates

Analyze the data alongside other covariates in the [COVID-19 Open Data Repository](https://github.com/GoogleCloudPlatform/covid-19-open-data).

### Tell us about your project

We’d love to hear more about how you’re using Vaccination Search Insights. If you’ve solved problems, we’d like to help you share your solutions.

[covid-19-search-trends-feedback@google.com](mailto:covid-19-search-trends-feedback@google.com)

## Getting started with dashboard development

Install the dependencies...

```bash
npm install
```

...then start [Rollup](https://rollupjs.org):

```bash
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000). You should see your app running. Edit a component file in `src`, save it, and reload the page to see your changes.