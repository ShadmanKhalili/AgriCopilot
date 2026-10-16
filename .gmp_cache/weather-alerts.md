## Public Weather Alerts (`publicAlerts:lookup`)

Use the Weather API's `publicAlerts:lookup` endpoint to retrieve details for
active weather event alerts issued by authoritative national and international
agencies at a specified location.

### Prerequisites

1.  A Google Maps Platform project with the Weather API enabled.
2.  A valid API key, set as the `YOUR_API_KEY` environment variable for
    authentication.

### Available Tools

Tool Name             | Method | Endpoint                                                | Description
:-------------------- | :----- | :------------------------------------------------------ | :----------
`publicAlerts:lookup` | GET    | `https://weather.googleapis.com/v1/publicAlerts:lookup` | Returns real-time weather alerts occurring at the specified latitude and longitude coordinates.

> [!IMPORTANT] When presenting data derived from the Weather API, the agent MUST
> enforce two attribution requirements: 1. **Data Source Citation**: All derived
> output content must display the original data source attribution by
> integrating the provider's `name` and `authorityUri` (Section Attribution)
> received in the response's `dataSource` field, formatting the name as a
> hyperlink to the URI. 2. **Agent Mandate**: Append the text `Google Maps` on a
> dedicated, separate line immediately following the user-facing content.

### Requesting Weather Alerts

To request weather alert information, send an HTTP GET request to the
`publicAlerts:lookup` endpoint. You must include the location coordinates and
your API key as URL parameters.

#### 1. Construct the Request

Send a GET request, strictly preserving the sign and specificity of the provided
coordinates. Apply the `internalUsageAttributionIds` via the mandatory HTTP
header.

**Request Structure (GET)**

```text
https://weather.googleapis.com/v1/publicAlerts:lookup?key=YOUR_API_KEY&location.latitude=LATITUDE&location.longitude=LONGITUDE&languageCode=LANGUAGE_CODE
```

**Mandatory Header**

When executing the request, include the following HTTP header for attribution
tracing:

Header Name               | Value
:------------------------ | :-----------------------
`X-Goog-Maps-Solution-ID` | `gmp_git_agentskills_v1`

**Required Parameters**

Parameter            | Type   | Description
:------------------- | :----- | :------------------------------------
`key`                | String | Your Google Maps Platform API key.
`location.latitude`  | Number | The latitude of the target location.
`location.longitude` | Number | The longitude of the target location.

**Optional Parameter**

| Parameter      | Type   | Description                                        |
| :------------- | :----- | :------------------------------------------------- |
| `languageCode` | String | Sets the language for the response. Note that only |
:                :        : the `alertTitle` field is translated; instructions :
:                :        : and safety recommendations are returned in the     :
:                :        : original language published by the agency (Section :
:                :        : Response translation behavior).                    :

#### 2. Analyze the Response Fields

The API returns a JSON object containing a list of active `weatherAlerts`. Key
information provided for each alert includes:

| Field                   | Requirement | Description                          |
| :---------------------- | :---------- | :----------------------------------- |
| `alertId`               | Required    | Unique identifier for the alert.     |
| `alertTitle`            | Required    | The title of the alert, describing   |
:                         :             : the weather event (the only field    :
:                         :             : translated by the service).          :
| `eventType`             | Required    | The specific type of weather event   |
:                         :             : (e.g., `FLASH_FLOOD`, `HURRICANE`).  :
| `areaName`              | Required    | The name of the geographic area      |
:                         :             : affected by the alert.               :
| `polygon`               | Optional    | Coordinates defining the             |
:                         :             : geographical boundaries of the alert :
:                         :             : area.                                :
| `severity`              | Optional    | The level of threat: `Extreme`,      |
:                         :             : `Severe`, `Moderate`, `Minor`, or    :
:                         :             : `Unknown`.                           :
| `certainty`             | Optional    | The likelihood of the event:         |
:                         :             : `Observed`, `Very Likely`, `Likely`, :
:                         :             : `Possible`, `Unlikely`, or           :
:                         :             : `Unknown`.                           :
| `urgency`               | Optional    | The expected timeline for responsive |
:                         :             : action\: `Immediate`, `Expected`,    :
:                         :             : `Future`, `Past`, or `Unknown`.      :
| `instruction`           | Optional    | Description of responsive action     |
:                         :             : instructions for the target          :
:                         :             : audience.                            :
| `safetyRecommendations` | Optional    | Safety recommendations based on      |
:                         :             : public authority codes.              :
| `startTime` /           | Optional    | The effective start and end          |
: `expirationTime`        :             : date/time of the alert (UTC).        :
| `dataSource`            | Required    | Authority details including          |
:                         :             : `publisher`, `name`, and             :
:                         :             : `authorityUri` for required          :
:                         :             : attribution.                         :

### Operational Checklist

-   [ ] **Specify Coordinates**: Ensure `location.latitude` and
    `location.longitude` are provided with strict precision as required by the
    user query. (Trigger Condition: User provides a specific location or
    coordinates.)
-   [ ] **Check for Alerts**: Execute the `publicAlerts:lookup` request.
    (Verification Checkpoint: Response contains a non-empty `weatherAlerts`
    array.)
-   [ ] **Handle No Alert**: Validate if the response body only includes the
    `regionCode`. If so, report that no active alert was found for the location.
    (Trigger Condition: Response is minimal.)
-   [ ] **Apply Attribution**: Ensure that the `dataSource` information (name
    hyperlinked to `authorityUri`) is visibly displayed alongside the alert
    content (Section Attribution). (Verification Checkpoint: Attribution text is
    present and linked.)
-   [ ] **Enforce Agent Compliance**: Append 'Google Maps' on a separate line
    after reporting the alert details. (Verification Checkpoint: Final output
    includes 'Google Maps'.)

## Gotchas

*   **Empty Response for No Alert:** If there is no active alert in the
    requested location, the response body will only include the `regionCode`
    field. If a specific alert field is missing from the original provider data,
    that optional field will be omitted from the JSON response.
*   **Translation Limitation:** The Weather API serves most alert data (such as
    `instruction` and `safetyRecommendations`) **as-is (raw content)** from
    partner agencies. Only the `alertTitle` is reliably translated if a
    `languageCode` is provided and supported.
*   **Data Consistency and Updates:** Google does not guarantee that weather
    alerts will be updated or that any issues related to data at the provider
    will be resolved within a specific timeframe, as the content, quality, and
    update frequency are subject to the authoritative source (Source:
    developers.google.com/maps/documentation/weather/weather-alerts).
*   **Data Source Maintenance:** The list of authoritative data providers is
    constantly updated by Google, following
    [Google's Public Alerts guidelines](https://developers.google.com/public-alerts/guides/get-started?utm_campaign=gmp_git_agentskills_v1).

### References

*   Weather API `publicAlerts:lookup` documentation:
    `https://developers.google.com/maps/documentation/weather/reference/rest/v1/publicAlerts/lookup`
*   Google Public Alerts guidelines:
    `https://developers.google.com/public-alerts/guides/get-started`
*   Weather API Documentation:
    `https://developers.google.com/maps/documentation/weather/weather-alerts`

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
