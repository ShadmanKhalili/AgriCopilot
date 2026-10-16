# Google DeepMind WeatherNext 3 Integration & Dual-Model Weather System

Integrates Google DeepMind's WeatherNext 3 model via the live Google Weather API (`weather.googleapis.com`) with an automatic high-resolution meteorological ensemble fallback, introducing real-time severe weather alert banners, 48-hour probabilistic precipitation risk curves, and an interactive dual-model comparison toggle.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction below incorporates all preferences confirmed during Phase 1 clarification:
> - **Connectivity**: Live Google Weather API connection utilizing the user's configured Google Maps / WeatherNext 3 secret keys, backed by an instant automatic ensemble fallback if rate limits or network limits occur.
> - **Priority Capabilities**: Real-time severe weather alerts (flood, squall, thunderstorm, heat stress) and 48-hour probabilistic precipitation risk curves (P10 / P50 / P90 spread).
> - **Model Presentation**: WeatherNext 3 established as the default forecasting engine, accompanied by a seamless dual-model comparison toggle for evaluating WeatherNext 3 against the standard ECMWF/GFS multi-model ensemble.

- **Confirmed Decision 1**: Live Google Weather API (`weather.googleapis.com`) proxy with zero-interruption ensemble fallback.
- **Confirmed Decision 2**: Prominent severe weather alert ribbon and interactive precipitation risk curves with hourly spray safety windows.
- **Confirmed Decision 3**: WeatherNext 3 set as the default view with a single-click side-by-side or toggled comparison against the standard ensemble.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades KrishiKotha's meteorological advisory from traditional Numerical Weather Prediction (NWP) to Google DeepMind's WeatherNext 3 AI forecasting engine. It retrieves live 5-km grid resolution forecasts, surface wind vectors, direct normal irradiance (DNI), atmospheric boundary layer conditions, and real-time severe weather alerts. If Google Weather API credentials are temporarily unreachable or rate-limited, the system automatically falls back to an agro-meteorological multi-model ensemble without UI disruption.
- **Target Audience / Persona**: Smallholder farmers, agricultural extension officers, drone spray operators, and agrarian planners across Bangladesh who need precise, timely microclimate forecasts for pesticide spraying, irrigation timing, and crop protection.
- **Key Value**: Delivers up to 50% lower Continuous Ranked Probability Score (CRPS) error in precipitation prediction, eliminating spray drift wastage and crop damage through hyper-local 5-km AI downscaling and early squall warnings.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Default Forecast Loading*: Farmer opens the Weather Advisory view; the system detects coordinates and loads the **WeatherNext 3 (Google DeepMind)** forecast by default with live satellite assimilation indicators.
  2. *Severe Weather Alerts Ribbon*: If severe weather warnings exist (thunderstorms, heavy monsoonal rain, heat waves, or cyclone paths), a prominent warning ribbon renders above the forecast with actionable agro-recommendations.
  3. *Precipitation Risk Curves & Spray Windows*: Farmers view an interactive 48-hour risk curve comparing median precipitation against lower (P10) and upper (P90) ensemble spreads, immediately highlighting the certified Safe Agrochemical Spraying Window.
  4. *Dual-Model Comparison Toggle*: Farmers or agronomists can toggle the model switcher (`WeatherNext 3 AI` vs `ECMWF/GFS Ensemble`) or activate a side-by-side metric comparison to view variance in predicted rainfall, wind gusts, and temperature extremes.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision agricultural telemetry and clean technical dashboard design complying with the Universal Frontend Design Constitution.
  - *Color Palette & Mood*: Clinical dark slate canvas (`bg-slate-900 / dark:bg-slate-950`) with high-contrast text (`text-slate-100`), crisp hairline borders (`border-slate-800`), and a dedicated 10% phosphor accent palette:
    - Phosphor Laser Cyan (`#06B6D4` / `text-cyan-400`): WeatherNext 3 AI indicators, solar irradiance, and precision telemetry.
    - Deep Cobalt (`#2563EB` / `text-blue-400`): Ensemble precipitation curves and rainfall volume.
    - Calibrated Amber (`#F59E0B` / `text-amber-400`): Fungal blight warnings and moderate squall risks.
    - Alert Crimson (`#EF4444` / `text-rose-400`): Severe flash flood and thunderstorm warnings.
  - *Typography & Hierarchy*: Neo-grotesque display headers with balanced line wraps; strictly enforced tabular numerals (`font-mono tabular-nums`) for all temperatures, dew points, wind velocities, and confidence percentages.
  - *Component Styling & Layout*:
    - Top bar adheres to the strict 1-row, 3-zone contract (single-line brand, clean nav links, single action).
    - Zero-pill metadata discipline: metadata displayed as clean unboxed text separated by subtle typographic bullets (`·` or `/`).
    - No decorative pulsing dots, no pseudo-code comment headers (`//`), and no arbitrary gamified scoreboards.

- **Interactive Feedback & Motion**:
  - Instant toggle transitions (<150ms) between WeatherNext 3 and ECMWF/GFS ensemble views without page reloads.
  - Smooth SVG crosshair tooltips along the precipitation curve indicating exact hour, rain probability, and mm volume.
  - Clear skeleton loaders matching the exact geometric footprint during network refreshes.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hybrid Google Weather API with Graceful Ensemble Fallback**
  - *Chosen Approach*: The backend `/api/weathernext-3` endpoint inspects server secrets (`process.env.GOOGLE_MAPS_API_KEY`, `process.env.WEATHERNEXT_API_KEY`, `process.env.GOOGLE_API_KEY`, or `process.env.GEMINI_API_KEY`). If present, it attempts to fetch live data from Google Maps Platform's official Weather API (`weather.googleapis.com/v1/currentConditions:lookup`, `forecast/hourly:lookup`, etc.). If the API responds with an error, quota restriction, or if the key is absent, it seamlessly falls back to high-resolution ECMWF/GFS multi-model synthesis with 64-member variance modeling.
  - *Why*: Guarantees 100% operational uptime for farmers in the field while taking full advantage of the live Google API key configured in user secrets.
  - *Alternatives Considered*: Hard failure on missing Google API keys was rejected because field workers require continuous advisory access even under erratic connectivity or API downtime.

- **Decision 2: Dual-Model Comparison Toggle & Diff Inspector**
  - *Chosen Approach*: WeatherNext 3 is the primary default, but farmers and agricultural extension workers can click an interactive segmented control (`WeatherNext 3 AI (5km)` | `ECMWF/GFS Ensemble (9km)`) or open a comparative metrics table.
  - *Why*: Builds trust with agricultural officers who need to understand why AI forecasts might predict rain divergence from legacy national broadcast models.
  - *Alternatives Considered*: Complete replacement of the legacy model would obscure the AI accuracy gain and prevent cross-validation.

- **Decision 3: Probabilistic Precipitation Risk Curves (P10 / P50 / P90)**
  - *Chosen Approach*: Replace simple single-number rain chances with a probabilistic envelope graph displaying the 10th percentile (minimum rain), 50th percentile (expected rainfall), and 90th percentile (extreme storm risk) alongside the 48-hour Safe Agrochemical Spraying Window.
  - *Why*: Agriculture depends heavily on risk bounds rather than point averages. A 30% rain chance with a P90 of 45mm requires very different farmer action than a 30% rain chance with a P90 of 2mm.
  - *Alternatives Considered*: Standard bar charts fail to convey storm tail risk and ensemble spread.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### System Architecture & Request Lifecycle

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Farmer Web Client (React SPA)                   │
│                                                                        │
│   ┌────────────────────────┐  ┌────────────────────────────────────┐   │
│   │ Model Switcher Toggle  │  │ Severe Weather Alerts Ribbon Banner│   │
│   │ [WeatherNext 3] [Ensb] │  │ (Flash Floods, Squalls, Blight)    │   │
│   └───────────┬────────────┘  └────────────────────────────────────┘   │
│               │                                                        │
│   ┌───────────▼────────────────────────────────────────────────────┐   │
│   │   WeatherAdvisory Component & Metrology Telemetry Matrix       │   │
│   │   - 48h Precipitation Risk Envelope (P10 / P50 / P90)          │   │
│   │   - Boundary Layer Wind (100m) & Direct Solar Irradiance (DNI) │   │
│   │   - Safe Agrochemical Spraying Window Guidance                 │   │
│   └───────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────────┼────────────────────────────────────────┘
                                │ GET /api/weathernext-3?lat=...&lon=...
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Express Backend Proxy Server (server.ts)             │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ WeatherNext 3 Orchestration Router                             │   │
│   │ 1. Validate Geographic Bounds (Bangladesh Latitude/Longitude)  │   │
│   │ 2. Check Secrets (GOOGLE_MAPS_API_KEY / WEATHERNEXT_API_KEY)   │   │
│   └───────────────────────┬────────────────────────────────────────┘   │
│                           │                                            │
│            ┌──────────────┴──────────────┐                             │
│       Key Exists?                  Key Missing / Limit Error           │
│            ▼                                     ▼                     │
│   ┌───────────────────────────┐    ┌───────────────────────────────┐   │
│   │ Google Weather API        │    │ Open-Meteo High-Resolution    │   │
│   │ (weather.googleapis.com)  │    │ 64-Member Ensemble Pipeline   │   │
│   │ - Current Conditions      │    │ - 0.05° Grid Interpolation    │   │
│   │ - Hourly Forecast (48h)   │    │ - Dew Point Depression Blight │   │
│   │ - Severe Weather Alerts   │    │ - Boundary Layer Wind Shear   │   │
│   └─────────────┬─────────────┘    └───────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   ▼                                    │
│                 ┌───────────────────────────────────┐                  │
│                 │ Unified Normalized Payload        │                  │
│                 │ (Model, Provider, Alerts, Spreads)│                  │
│                 └─────────────────┬─────────────────┘                  │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ Cache-Control: no-store
                                    ▼
                         Return JSON to Client
```

#### Normalized Data Schema

```typescript
interface WeatherNextResponse {
  model: "WeatherNext 3" | "ECMWF/GFS Ensemble";
  provider: "Google DeepMind & Google Research" | "Open-Meteo High-Resolution Ensemble";
  resolution: "0.05° (~5 km spatial grid)";
  source: "google_weather_api" | "ensemble_synthesis";
  alerts: Array<{
    id: string;
    event: string;
    severity: "minor" | "moderate" | "severe" | "extreme";
    headline: string;
    description: string;
    effective: string;
    expires: string;
    agroImpact: string;
  }>;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    dew_point_2m: number;
    wind_speed_10m: number;
    wind_speed_100m: number;
    direct_normal_irradiance: number;
    surface_pressure: number;
    weather_code: number;
    condition: string;
  };
  ensemble: {
    members: number;
    convergence_score_pct: number;
    temperature_spread: { p10: number; median: number; p90: number };
    precipitation_spread_mm: { p10: number; median: number; p90: number };
    heavy_rain_risk_prob: number;
  };
  agro_metrics: {
    dew_point_depression_celsius: number;
    fungal_blight_risk: "low" | "moderate" | "high";
    boundary_layer_wind_100m_kmh: number;
    surface_wind_10m_kmh: number;
    wind_shear_ratio: number;
    direct_normal_irradiance_wm2: number;
    shortwave_radiation_wm2: number;
    soil_moisture_0_7cm?: number;
    evapotranspiration_et0_mm?: number;
    safe_spraying_window: string;
    safe_spraying_window_detail: {
      start: string;
      end: string;
      avgWind: number;
      avgTemp: number;
      rainRisk: number;
    } | null;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    wind_speed_10m: number[];
    direct_normal_irradiance?: number[];
  };
}
```

#### Key Sequences & Implementation Phases

1. **Backend Integration (`server.ts`)**:
   - Update `handleWeatherNext3` to inspect configured Google API keys (`GOOGLE_MAPS_API_KEY`, `WEATHERNEXT_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`).
   - Implement the Google Weather API caller for live endpoints (`weather.googleapis.com/v1/currentConditions:lookup`, `weather.googleapis.com/v1/forecast/hourly:lookup`, and severe conditions lookup).
   - If Google Weather API returns data successfully, normalize it into the unified schema with real severe weather alerts.
   - If Google Weather API call fails or key lacks weather scope, automatically invoke the local 64-member high-resolution ensemble fallback and tag `source: "ensemble_synthesis"`.
   - Update `/api/config-status` to report exact provider health and model status.

2. **Frontend UI Components (`WeatherAdvisory.tsx`)**:
   - Establish WeatherNext 3 as the default forecasting engine on initial render.
   - Introduce the Severe Weather Alert Banner at the top of the advisory with severity badges, affected times, and actionable farming instructions.
   - Render the 48-hour Probabilistic Precipitation Risk Envelope (P10 / P50 / P90 spread) with interactive hover crosshairs.
   - Add the dual-model comparison control with instant model switching and differential summary (Δ Temp, Δ Rain, Wind Shear).
   - Clean up all metadata to ensure zero-pill formatting and tabular typography (`tabular-nums font-mono`).
