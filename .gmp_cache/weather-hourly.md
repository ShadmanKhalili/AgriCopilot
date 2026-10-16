## Hourly Weather Forecast Retrieval

This capability utilizes the Weather API's `forecast.hours:lookup` endpoint to
provide granular weather information for up to 240 hours into the future,
starting from the current hour.

### Prerequisites

1.  **API Key:** An active Google Maps Platform API Key must be available.
2.  **Environment Variable:** Ensure the API key is accessible via the required
    global environment variable.

Required Variable | Description
:---------------- | :--------------------------------------------------
`GOOGLE_API_KEY`  | Your project's API key enabled for the Weather API.

### Available Tools

The agent uses a standard HTTP GET request.

| Tool     | Tool  | Endpoint                                                  |
: Name     : Type  :                                                           :
| :------- | :---- | :-------------------------------------------------------- |
| Hourly   | REST  | `https://weather.googleapis.com/v1/forecast/hours:lookup` |
: Forecast : API   :                                                           :
: Lookup   : (GET) :                                                           :

### Implementation Guide

Use the following steps to construct and execute a request for hourly forecast
data.

#### 1. Construct the Request

Send an HTTP GET request to the `forecast/hours:lookup` endpoint, ensuring the
latitude and longitude are specified using the canonical parameters
`location.latitude` and `location.longitude`.

**MANDATORY ATTRIBUTION HEADER**: For all REST/Web API requests, the agent MUST
include the `X-Goog-Maps-Solution-ID` HTTP header for internal traceability.

**Parameters**:

| Parameter                   | Type    | Description                          |
| :-------------------------- | :------ | :----------------------------------- |
| `key` (URL)                 | string  | Your API key.                        |
| `location.latitude` (URL)   | float   | The latitude of the location.        |
:                             :         : **Strictly preserve the sign and     :
:                             :         : specificity.**                       :
| `location.longitude` (URL)  | float   | The longitude of the location.       |
:                             :         : **Strictly preserve the sign and     :
:                             :         : specificity.**                       :
| `hours` (URL, Optional)     | integer | The total number of hours of         |
:                             :         : forecast data requested. Defaults to :
:                             :         : 240 hours.                           :
| `pageSize` (URL, Optional)  | integer | The number of hours to return per    |
:                             :         : page. Default is 24.                 :
| `pageToken` (URL, Optional) | string  | The token retrieved from a previous  |
:                             :         : response to fetch the next page of   :
:                             :         : results.                             :

**Request Example (Using `cURL`):**

To request the next 3 hours of forecast data for Mountain View, CA (37.4220,
-122.0841):

```bash
curl -X GET \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://weather.googleapis.com/v1/forecast/hours:lookup?key=YOUR_API_KEY&location.latitude=37.4220&location.longitude=-122.0841&hours=3"
```

#### 2. Process the Response Data

The response returns a `forecastHours` array containing detailed data points for
each interval hour. The data returned for each interval includes:

-   Current temperature, Apparent ("feels like") temperature, Dew point, Heat
    index, Wind chill, and Wet bulb temperature.
-   Relative humidity, UV index.
-   Weather condition description and icon (reference `weatherCondition.type`
    and `weatherCondition.iconBaseUri`).
-   Probability, percentage, and type of precipitation (reference
    `Precipitation#precipitationtype`).
-   Probability of thunderstorms.
-   Sea level pressure, Wind direction (reference `Wind#cardinaldirection`),
    speed, and gust.
-   Visibility and cloud cover.

**Example Response Structure Snippet:**

```json
{
  "forecastHours": [
    {
      "interval": {
        "startTime": "2025-02-05T23:00:00Z",
        "endTime": "2025-02-06T00:00:00Z"
      },
      "temperature": {
        "degrees": 12.7,
        "unit": "CELSIUS"
      },
      "relativeHumidity": 51,
      "uvIndex": 1,
      // ... extensive data points
    }
  ],
  "timeZone": {
    "id": "America/Los_Angeles"
  }
}
```

#### 3. Handle Pagination

By default, the `pageSize` is 24 hours. If the requested forecast duration
(`hours`) exceeds the `pageSize`, the response will contain a `nextPageToken`.

-   [ ] **Trigger Condition**: Response JSON contains the `nextPageToken` field.
-   [ ] **Action**: Use the value of `nextPageToken` in the subsequent request
    by setting the `pageToken` URL parameter.
-   [ ] **Verification Checkpoint**: Continue requesting until the response no
    longer contains a `nextPageToken`.

**Pagination Request Example:**

```bash
curl -X GET \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://weather.googleapis.com/v1/forecast/hours:lookup?key=YOUR_API_KEY&location.latitude=37.4220&location.longitude=-122.0841&hours=25&pageSize=3&pageToken=ChYKEgm8dJMYBLZCQBH-ZffkYYVewBAZEAMYAyIMCLKClb0GEJeO18kDKhNBbWVyaWNhL0xvc19BbmdlbGVz"
```

### Gotchas

-   **Maximum Duration Constraint**: The API supports a maximum of 240 hours of
    forecast information starting from the current hour (`About hourly forecast
    requests`). Requesting a duration significantly beyond this limit may result
    in an error or default to the maximum supported duration.
-   **Token Invalidity**: If you are implementing pagination, be aware that
    tokens become invalid if weather data is not available for at least one of
    the hours in the specified time period (`Specify number of hours to return
    per page`). Passing an invalid token into `pageToken` will return an error.

### References

*   [forecast.hours API Reference](https://developers.google.com/maps/documentation/weather/reference/rest/v1/forecast.hours/lookup?utm_campaign=gmp_git_agentskills_v1)
*   [Weather Condition Types](https://developers.google.com/maps/documentation/weather/reference/rest/v1/WeatherCondition?utm_campaign=gmp_git_agentskills_v1#type)
*   [Source URL: developers.google.com/maps/documentation/weather/hourly-forecast](https://developers.google.com/maps/documentation/weather/hourly-forecast?utm_campaign=gmp_git_agentskills_v1)

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
