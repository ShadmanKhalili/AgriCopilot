# AgriCopilot: AI and data audit for an "AI-first farming partner"

Read-only audit of `main` (HEAD), 28 Nov 2026. Paths are relative to `AgriCopilot/`. Line numbers are approximate to the version read.

Headline: the app already holds a lot of per-farmer data and has one strong deterministic "what to do today" engine, but **no AI call sees more than a district name, a crop, and (for Live video only) a 3-event history**. There is no shared assistant, no AI memory, no AI write path, and no proactive AI message. The Home screen is a weather card plus four doors, which is why it reads as a weather app.

---

## 1. AI call inventory

### 1.0 Plumbing common to all text calls

- Client: `src/services/ai.ts`. All text calls go through `generateContent` -> `callAiProxy` (ai.ts:~97-160) -> `POST /api/ai-proxy` with a Firebase ID token (`ensureAiSession`, firebase.ts:121, which silently creates an anonymous "guest" account on first AI use) and optional App Check header. Responses stream as NDJSON. Client concurrency limiter = 2 in flight (ai.ts:~88), `AI_MAX_ATTEMPTS = 2` (ai.ts:~357) so one failed action can be charged twice.
- Server: `netlify/functions/ai-proxy.ts` (mirrored, and reportedly drifted, in `server.ts:444`). The server owns the model list (`AI_TEXT_MODELS`, default `gemini-3.8-flash, 3.6-flash, 2.5-flash, 3.5-flash-lite`, ai-proxy.ts:~75-83), clamps output tokens (`AI_MAX_OUTPUT_TOKENS` default 8192), applies server safety settings, charges quota BEFORE calling (ai-proxy.ts:~780-795).
- **Allowed config keys are a whitelist** (`netlify/functions/_shared/ai-config.ts:14-25`): systemInstruction, temperature, topP, topK, stopSequences, responseMimeType, responseSchema, responseModalities, speechConfig, mediaResolution (+ capped thinkingConfig). **Tools: only `googleSearch` survives** (`sanitizeTools`, ai-proxy.ts:~228). So **no function calling / tool use is possible through the proxy today**, and the Live token locks tools to none (`lockAdditionalFields: ['tools']`, `_shared/live-token.ts:~214`).
- Models actually in use (ai.ts:277-321): `STANDARD_MODEL`/`BACKUP_MODEL`/`CHAT_MODEL` = `gemini-3.5-flash-lite`; `ADVANCED_MODEL`/`SEARCH_MODEL` = `gemini-3.6-flash`; TTS `gemini-3.8-flash-lite-tts` / `gemini-3.8-flash-tts`; Live `gemini-3.8-live` (quick) and `gemini-3.8-live-extended-thinking` (deep). Per the code comments the key does NOT serve `3.8-flash` or `2.5-flash`, and **Google Search grounding is reported as refused by this key** (ai.ts:~258-275, `services/marketPrices.ts:1-25`). The `googleSearch` calls therefore probably run ungrounded after the proxy's automatic retry without the tool (ai-proxy.ts:~120-160). Treat "grounded" claims as unproven.
- Quotas (server, `netlify/functions/_shared/usage-quota.ts:58-93`): per account per UTC day, ALL kinds together (text + audio/TTS + live token): guest 10 (`AI_GUEST_DAILY_LIMIT`), free 100 (`AI_FREE_DAILY_LIMIT`), premium 1000 (`AI_PREMIUM_DAILY_LIMIT`). Live sessions on top: guest 1 / free 20 / premium 200 (`AI_*_DAILY_LIVE_SESSIONS`). Live session length 15 min (`AI_LIVE_SESSION_MINUTES`, live-token.ts:~58). Optional global cap `AI_GLOBAL_DAILY_CALL_CAP`. Per-IP 30/min (`AI_MAX_CALLS_PER_IP_PER_MINUTE`, ip-limit.ts:~169), 10 live tokens/IP/min. Netlify edge limit 120/min on `/api/ai-proxy`, 30/min on live-token (netlify.toml). "Guest" includes anonymous accounts and unverified email accounts (`firebase.ts:160`), i.e. most farmers = **10 AI calls a day**. A chat turn, a TTS read-aloud and a diagnosis each cost one. A daily briefing must be cheap (one call, or no AI call at all).
- Second, client-only counter: `src/hooks/useUsageTracking.ts:~45-70` (per-tab localStorage counters, limits 10/100/1000, premium-analysis 1 for free). Duplicates the server quota and only gates some screens (e.g. `MarketConnect.tsx:101`, `:230`).

### 1.1 Text / vision calls (ai.ts)

Context column key: LOC = `buildLocationContext(coords)` (`src/utils/farmerContext.ts:127`: district/upazila by nearest-GPS, district climate risks, Rabi/Kharif season). MEM = `buildFarmMemoryContext` (farmMemory.ts). Neither is used by anything below except as stated.

| # | Function (ai.ts line) | Purpose | Model | Inputs | Farmer context | Output | Tools | Surfaced in | Mode / taps from Home |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `diagnoseCrop` (505) | Photo diagnosis, up to 5 photos plus auto close-ups | `getModelName(isAdvanced)`: lite, or `3.6-flash` if premium | images, crop, stage, analysis type, GPS coords, free-text note | LOC + `buildCropKnowledge` (diseaseKb.ts:747). **No history, no profile, no plot/season, no weather** | JSON schema (status, symptoms, >=3 ranked candidates with score, differential, diagnosis, severity, confidence, verification advice), `mediaResolution HIGH`, `minItems 3` | none | `AgriCopilot.tsx:1421` ("Crop" tab) | Simple + Full. Home -> "ফসল দেখান" = 1 tap, then pick photos |
| 2 | `deepDiagnoseCrop` (650) | Second-opinion audit of #1 | `gemini-3.5-flash-lite` hardcoded (ai.ts:~760) | images + basic diagnosis text, crop, stage, coords, note | LOC + date + cropKnowledge | JSON schema | none | `AgriCopilot.tsx:1737` | after #1 |
| 3 | `startAgriChat().sendMessage` (1361) | Follow-up Q&A about ONE diagnosis | CHAT_MODEL lite | first turn: diagnosis text + `locationContext` string + question; later turns: plain history array kept in memory | Diagnosis text + LOC only. **History lives in the closure, lost on reload** (only an optional `summarizeConversation` summary is stored on the diagnosis doc) | free text (markdown) | none | `AgriCopilot.tsx:944,1156,1194,1459` | Only exists after a diagnosis. Simple + Full |
| 4 | `summarizeConversation` (952) | Summarise the chat into bullets, stored as `diagnoses.chatSummary` | lite (BACKUP_MODEL) | chat messages | none | free text | none | `AgriCopilot.tsx:1303` | after chat |
| 5 | `translateText` (780) | Translate diagnosis/advice | lite | text, target lang | none | free text | none | `AgriCopilot.tsx:1105-1106` | after diagnosis |
| 6 | `generateSpeech` (883) | Gemini TTS (voice Kore) | tts-lite / tts | text | none | audio (WAV base64) | none | `AgriCopilot.tsx:1118,1341`, `DigitalPrescriptionModal.tsx:210`, `LiveVideoCopilot.tsx:1755` (`FarmActionTrafficLight.tsx:128` is unused code per docs/REVIEW C7) | counts as 1 quota unit ("audio") |
| 7 | `gradeProduce` (975) | Photo grading of harvested produce, rough price guess | lite or 3.6-flash | 1 image, produce name, lang | none (explicitly "you have no market data") | JSON schema | none | `SmartGrade.tsx:132` | **Full only** (All services) |
| 8 | `getMarketInsights` (1034) | Explain the official DAM bulletin figure, give estimate range and selling tips | lite/3.6-flash; falls back to BACKUP | produce, lang, coords | LOC (if coords) + **real bulletin text** from `fetchOfficialBulletin` (`bulletinPromptContext`, marketPrices.ts:174) | JSON schema | the code path sets none (the `SEARCH_MODEL` branch exists, ai.ts:~1128) | `MarketConnect.tsx:246` | Simple + Full. Home -> "বাজার দর" 1 tap + button press |
| 9 | `getPlantingRecommendations` (1228) | Top-3 crops, avoid list, diversification | lite/3.6-flash | form: land type, size, irrigation, previous crop, budget, target time, weather, Sentinel NDVI/NDMI | LOC + manual form | JSON (schema) | none | `SmartPlanting.tsx:139` | **Full only** |
| 10 | `startSchemeChat` (1393) | Q&A on one government scheme | lite | scheme text, question | scheme only. **Does not use farmer crop/district/land** | free text | none | `GovSchemes.tsx:71` | Full only |
| 11 | `syncCuratedSchemes` (1437) | Admin-style "refresh schemes via Google Search" and write into `gov_schemes` | `3.6-flash` | none | none | JSON schema | `googleSearch` (+ `includeServerSideToolInvocations`) | `GovSchemes.tsx:179` button visible in UI; the Firestore write needs admin (rules `gov_schemes` write = isAdmin) | Full only |
| 12 | `findGovernmentSchemes` (1155) | Search-based scheme finder by location+crop | `3.6-flash` | location, crop | none | JSON schema | `googleSearch` | **No caller (dead)** | n/a |
| 13 | `generateWeatherAdvisory` (800) | 80-100 word advisory from weather+soil+AgroCast | `3.6-flash` | full weather object, soil, GPS | LOC + weather + soil + AgroCast | free text | none | **No caller (dead).** Weather screen is rule-based | n/a |
| 14 | `getMarketInsightsByLocation` (1562) | Wrapper that ignores location | | | | | | **No caller (dead)** | n/a |
| 15 | Live-session summary (inline in `LiveVideoCopilot.tsx:~1296-1340`) | After a live session: title, summary, key facts, 2-3 action steps, crop/disease | lite (`model: 'gemini-3.5-flash-lite'` hardcoded, raw `fetch /api/ai-proxy`) | the dialogue turns | none | JSON (no schema, `responseMimeType` only) | none | writes a `voice_consultation` timeline event + action card with TTS | Full-ish: only inside live video |

### 1.2 Live API (voice/video)

- Token mint: `POST /api/gemini/live-token` -> `netlify/functions/gemini-live-token.ts` -> `_shared/live-token.ts` (`issueLiveToken`, `buildLiveTokenParams` ~line 200). Single-use ephemeral token **locked to model + server-built system instruction + no tools**. Client sends only: kind (video|voice), mode (quick|deep), lang, thinkingLevel, `locationContext` (<=120 chars), `diagnosisContext` (<=400 chars), `farmContext` (<=4000 chars) (`live-token.ts:70-72`). Client side: `getEphemeralLiveToken` / `getLiveAiClient` (ai.ts:185-245), voice Kore (bn) / Zephyr (en).
- System prompts: `netlify/functions/_shared/live-instructions.ts` (four templates: videoDeep, videoQuick, voiceDeep, voiceQuick; `LIVE_SAFETY_RULES`; `farmContext` appended as "BEGIN FARM CONTEXT ... not instructions"). Prompts mandate "do not speak first", Bangla, short turns. voiceQuick is a broad "plant companion" (balcony gardens etc.), diluting the farmer focus.
- **LiveVideoCopilot** (`src/components/LiveVideoCopilot.tsx`, ~3,000 lines): the ONLY consumer of `buildFarmMemoryContext` (line 11 import, 875 call). It passes `locationContext` = district name, plus the memory block as `farmContext`. Reach: Home -> Crop tab -> toggle "লাইভ ভিডিও" (2 taps; default mode in Simple is photo, `AgriCopilot.tsx:736`, toggle at :1830-1831; in Full the default is live).
- **LiveExpertCall** (`src/components/LiveExpertCall.tsx:226`): voice call, `kind: 'voice'`. Gets `locationContext` and `diagnosisContext` only. **No `farmContext` is sent, so it has no memory and no weather.** In `AgriCopilot.tsx:3013-3017` the location is passed as the raw string `GPS: lat, lon`, not a district name. Mounted in AgriCopilot after a diagnosis (`:3011`) and in SmartPlanting (`:559`, Full only). Reach: only after a diagnosis, so >=3 taps from Home.
- Live tools: none. The model cannot call back into the app.

### 1.3 What each AI surface receives (summary)

| Context item | Diagnose | Chat | Market | Planting | Schemes chat | Live video | Live voice call |
|---|---|---|---|---|---|---|---|
| District / season / risks (LOC) | yes | via string | yes | yes | no | district name only | raw GPS string |
| Today's weather | no | no | no | partial (current temp/humidity/rain) | no | yes (farmMemory fetches `/api/weathernext-3`) | no |
| Farmer profile (crops, land, soil, irrigation) | no | no | no | manual form | no | yes (from `farmer_profiles`) | no |
| Recent history (last 3 timeline events) | no | no | no | no | no | yes | no |
| Past diagnoses / recovery logs | no | no | no | no | no | indirectly (timeline) | no |
| Plots / seasons / expenses / sales | **never** | | | | | | |
| Tasks, crop plan, main crop | **never** | | | | | | |
| Area warnings, local prices | **never** | | | | | | |
| Official bulletin prices | no | no | **yes** | no | no | no | no |

Confirmed by grep: `buildFarmMemoryContext` has one caller (LiveVideoCopilot); `buildLocationContext` is used in ai.ts (diagnose, deep, advisory, market, planting) and AgriCopilot (chat context). `mainCrop` (onboarding) appears in NO AI prompt (grep of `mainCrop` shows only HomeCalendarTasks, MarketConnect, KrishiProfitCalculator, GovSchemes, AppSettings; `AgriCopilot.tsx` does not even prefill the crop from it).

---

## 2. Farmer data inventory

### 2.1 Firestore (rules in `firestore.rules`; writers from `src/`)

| Path | Fields | Written by | Read by AI? |
|---|---|---|---|
| `users/{uid}` (rules :212) | uid, email, name, role, tier, usageCount, lastUsedDate, createdAt/updatedAt (profile owner may only change usageCount, lastUsedDate, name, updatedAt). Role `agri-preneur`/`expert`/`admin` | AuthProvider on sign-in | No |
| `users/{uid}/aiUsage/{id}` (:822) | uid, day (YYYYMMDD), kind text/audio/live, at | AI proxy, with the caller's token | Quota only |
| `users/{uid}/moderationEvents/{id}` (:859) | metadata of refused requests | AI proxy | No |
| `users/{uid}/tasks/{id}` (:977) | uid, **kind (only `'follow_up'`)**, title<=200, dueDate YYYY-MM-DD, status open/done, createdAt, diagnosisId?, crop?, doneAt? | `services/farmTasks.ts` `addFollowUpTask` (only caller: `AgriCopilot.tsx:1021`, "remind me in 3 days"); done via HomeToday | No |
| `users/{uid}/recoveryLogs/{id}` (:1011) | uid, diagnosisId, date, action<=500, change<=500, createdAt (create/delete only) | `PlantHealthRecoveryTracker.tsx:332` -> `services/recoveryLog.ts` | No |
| `users/{uid}/seasons/{id}` (:1068) | uid, crop (slug), landSize, landUnit, expectedYieldMon, expectedPricePerMon, plannedCost, createdAt, updatedAt, plotId?, stage planned/growing/harvested, sowingDate?, harvestDate?, harvestMon? | `profit/useSeasonPlans.ts` -> `services/seasons.ts` `saveSeason`; progress via `services/farmRecord.ts` `updateSeasonProgress` | No (server `record-facts.ts` reads it for the record score only) |
| `.../seasons/{id}/expenses/{id}` (:1081) | uid, seasonId, category (seeds/fertilizer/pesticide/irrigation/labor/tillage/transport/lease/other), amount **int** 1..1e7, note<=200, date, createdAt. **Requires the parent season to exist** | `profit/ExpenseNotes.tsx:69` (`addExpense`), with `VoiceAmountButton` | No |
| `.../seasons/{id}/sales/{id}` (:1102) | uid, seasonId, quantityMon, pricePerMon int, buyerType, date, createdAt | `farmRecord/FarmRecordSection.tsx:142` | No |
| `users/{uid}/plots/{id}` (:1135) | name, landSize, landUnit, tenure own/lease/sharecrop, createdAt/updatedAt | `FarmRecordSection.tsx:86` `savePlot` | No |
| `farm_record_scores/{uid}` (:1147) | server-calculated score, pillars | `netlify/functions/farm-record-score.ts` (service account) | No |
| `diagnoses/{id}` (:309) | userId, crop, cropStage, analysisType, diagnosisText<=30000, qualitativeSeverity, symptomsBreakdown<=25, verificationAdvice, createdAt, district?, upazila?, diseaseKey?; later: deepDiagnosis (map), deepDiagnosedAt, helpful, chatSummary | `AgriCopilot.tsx:~1495` | **No** (never re-read as history for prompts; only server `record-facts.ts` counts them; area-report validates against them) |
| `farmer_profiles/{uid}` (:375) | fullName, primaryCrop, cropsGrown[], totalLandDecimals, locationDistrict/Upazila, soilType, irrigationType, totalSessionsCompleted, totalDiagnoses, lastInteractionSummary/Date, keyInsights[], plus frozen creditReadinessScore/insuranceRiskTier | `utils/farmerProfiler.ts` `recordFarmerInteractionEvent` (only first-write-wins merges: crop and district from diagnosis; soil/irrigation/land only via the Dossier edit form `FarmerDossier.tsx:121`) | **Live video only** (farmMemory) |
| `farmer_timeline_events/{id}` (:404) | userId, eventType (voice_consultation / crop_diagnosis / weather_alert / smart_grading / market_mandi / planting_intent), title, summary, keyFacts[], confidenceScore, origin, evidenceStatus, isDemoOrGuest, createdAt | AgriCopilot diag (:1561), LiveVideoCopilot (:1354,1408), SmartGrade (:160) | **Live video only**: last 3 non-demo events |
| `prescriptions/{id}` (:252) | rxId, userId, farmerName, crop, diseaseName, severity, confidence, location, createdAt, verified | `DigitalPrescriptionModal.tsx:301` | No |
| `certificates/{id}` (:334) | produce, grade, justification, estimatedPriceBdt | `SmartGrade.tsx:144` | No |
| `market_queries/{id}` (:352) | produce, insights text, isAdvanced | `MarketConnect.tsx:~262` | No |
| `planting_intents/{id}` (:361) | lat/lng, landType, landSize, irrigation, previousCrop, budget, targetTime, recommendedCrop | SmartPlanting | No |
| `alerts/{id}` (:343) | scenario, message | no `src/` writer found | No |
| `consultations/{id}` (:671) + `/case`, `/messages`, `/photos`, `/events` | farmerId, expertId, status, urgency, category, crop, district, upazila, consent scope/expiry, SLA, rating... ; case: symptoms + consentSnapshot (crop, stage, diagnosisSummary, severity, photosCount, district, landDecimals, soilType, irrigationType, phone, previousConsultations); messages: text/audio/image + structured `advisory` (confirmation, actions, dosage, followUpDays, escalateIf) | `services/expertService.ts`, ExpertRequestWizard, ConsultationRoom | No (an expert `advisory.followUpDays` could seed a task but nothing does) |
| `experts_public`, `experts_private`, `expert_applications`, `expert_reviews` | expert directory and applications | Expert onboarding, admin | No |
| `push_subscriptions/{uid_slot}` (:956) | uid, endpoint, p256dh, auth, lang, areaKey?, createdAt (slots 0-4) | `services/pushNotifications.ts` | Server push only |
| `area_summaries/{areaKey}` (:902) | anonymous per-upazila problem counts (>=3 farmers) and sale-price bands | server `area-report.ts` (service account) | No. Read by AreaWarningStrip, LocalPriceCard |
| `area_raw`, `area_reporters` | private per-farmer reports | server only | No |
| `broadcasts/{id}` (:919) | messageBn/En, district, severity, expiresDay | admin | No |
| `gov_schemes/{id}` (:370) | scheme title/description/eligibility/howToApply/benefits/provider/tags/sourceLinks (en+bn) | admin seed (`seedSchemes.ts`) or AI sync | Only scheme chat (one scheme at a time) |

Guests: a signed-in anonymous account can write all the user-scoped paths (rules only need `isSignedIn`), except `farmer_profiles/timeline` are skipped for ids that start `guest_` or demo flag (`farmerProfiler.ts:~300`); also `firebase.ts` creates the anonymous session on first AI call. When signed out entirely, seasons/expenses/sales/plots live in localStorage and are copied to the account (`services/deviceRecordMove.ts`).

### 2.2 localStorage / sessionStorage

| Key | Content | Notes / AI use |
|---|---|---|
| `krishi_lang` | bn/en | prompts get `lang` passed in |
| `krishi_theme`, `krishi_ui_mode` (simple/full), `krishi_onboarded` | UI prefs | no |
| `smart_krishi_global_location` | {latitude, longitude}, only if inside Bangladesh (AppSettingsContext.tsx:107) | feeds weather and LOC |
| `krishi_place` | {district, districtBn, upazila?, upazilaBn?} (the area the farmer picked by name) | used by diagnosis save, area warnings, scheme match. AI prompts use GPS-derived district instead |
| `krishi_main_crop` | one of 9 crop ids (paddy, potato, tomato, onion, brinjal, chili, maize, mustard, jute; `data/mainCrops.ts`) | **no AI prompt** |
| `krishi_crop_plan` | `{cropKey, sowingDate, completedStages[]}` (single plan, `utils/cropPlan.ts`) | drives Home calendar tasks; **not linked to the Firestore `seasons`**; no AI |
| `krishi_seasons_v1`, `krishi_sales_v1`, `krishi_plots_v1` | signed-out copies of the farm record | no AI |
| `krishi_farmer_profile_{uid}`, `krishi_farmer_events_{uid}` | local cache of profile/timeline (farmerProfiler.ts:~40) | used by farmMemory as offline fallback |
| `farmer_saved_prescriptions` | saved Rx list (DigitalPrescriptionModal.tsx:281) | no |
| `agri_cached_weather_*`, `agri_cached_market_*`, `agri_last_sync_timestamp`, `agri.marketBulletin.v1` | caches (weather 20 min, market 12 h, bulletin) | no |
| `agri.expertReadAt.v1` | per-case read markers | no |
| `anonDate_/anonUsage_/premiumUsage_/fallbackUsage_*` | client usage counters | no |
| sessionStorage `agri_temp_guest_session_id`, `agri-inapp-banner-dismissed` | misc | no |

### 2.3 Onboarding answers (`src/components/Onboarding.tsx`)

Three steps only: language -> area (GPS, or district + optional upazila) -> main crop (one of 9). All three live in localStorage only (`AppSettingsContext`); **nothing from onboarding is written to Firestore or to `farmer_profiles`**, so a second device or a cleared browser forgets it, and the server cannot personalise a push or briefing from it. Not asked: land size, tenure (owner/tenant), irrigation, soil, farming experience, income, phone number, other crops, what the farmer wants help with.

Other collectors: Dossier edit form (soilType etc., `FarmerDossier.tsx:~100-125`), plots and seasons screens, ExpertRequestWizard (reads profile for consent snapshot, `:132`).

---

## 3. Real data sources

| Source | Where | Real or estimated | Freshness | AI use |
|---|---|---|---|---|
| Weather (primary) | `netlify/functions/weathernext-3.ts` (`/api/weathernext-3`, alias `/api/weather-next`) | **Real**: Google Maps Platform Weather API when a server key is set (`source: google_weather_api`), else Open-Meteo 5 km (`source: ensemble_synthesis`). Daily completed to 7 days with Open-Meteo. Derived agro metrics (dew-point depression, fungal blight risk, safe spray window, rain "ensemble" spread) are **heuristic computations**, labelled as such (weathernext-3.ts:~820 `estimate_basis`) | server cache 10 min for the paid API; client 15 min (`useTodayWeather.ts:~20`) | Not by text AI. Live video memory fetches it (farmMemory.ts:76). `generateWeatherAdvisory` is dead code |
| Daily forecast | `daily-forecast.ts` (`/api/daily-forecast`, Open-Meteo proxy) | Real | live | SmartPlanting prompt (current temp/humidity/rain) |
| Historical weather | `historical-data.ts` (Open-Meteo archive) | Real | past | Weather screen only |
| Farm action rules | `_shared/farm-actions.ts` (spray / irrigate / fertilise, go/wait/stop with reason codes; thresholds rain 50/25 %, wind 20/14 km/h, hot 33 C, soil 0.22/0.35) + `src/utils/todaySignals.ts` (BN/EN wording, `signalsSpeech`) | Deterministic rules on real weather | same as weather | **Not given to any AI.** Only Home/Weather UI. Week view from `farm_actions.week` in the feed |
| Government market bulletin | `_shared/market-bulletin.ts` + `market-prices.ts` (`/api/market-prices`), source `market.dam.gov.bd/market_daily_price_report`; client `services/marketPrices.ts` | **Real** (scraped/parsed DAM bulletin; Dhaka wholesale ranges BDT/kg, a limited commodity list) | server cache 1 h, stale up to 24 h served when source down (market-bulletin.ts:~15-25). docs/REVIEW A4 says the refresh is not working correctly and "today" can be up to 24 h old | **Yes**, getMarketInsights gets it verbatim. Also `OfficialPriceCard`, `LiveMandiTicker`, `BulletinPriceLine`. Not used for the Home screen or briefing |
| Local prices | `area-report.ts` -> `area_summaries` (`LocalPriceCard`, `ReportPriceForm`) | Real but crowd-sourced; aggregated only at >=3 farmers (AREA_MIN_FARMERS), 14-day window (`_shared/area-model.ts`) | rolling | No |
| Area problem warnings | same function, push to area subscribers (`push-send.ts sendPushToArea`) | Real crowd signal, anonymous | rolling 14 days | No |
| Satellite | `sentinel.ts` (`/api/sentinel`) | **Real Sentinel-2 NDVI/NDMI only when `SENTINEL_HUB_CLIENT_ID/SECRET` are set**; otherwise `source: 'agro_climatic_model'` = calibrated seasonal model by coordinates seed, i.e. **estimated** (sentinel.ts:~50-60, 104; UI labels it `ai_estimate`, `SatelliteHealth.tsx:188`) | 30-day average, cached | SmartPlanting prompt (NDVI, NDMI) |
| Soil | `soil-properties.ts` (SoilGrids/ISRIC point) | Real (modelled global product, ~250 m, coarse in Bangladesh) | static | WeatherAdvisory UI; only the dead advisory prompt used it |
| Reverse geocode / IP | `loc-lookup.ts` (BigDataCloud), `ip-location.ts` (GeoJS) | Real (IP guess unreliable, docs/REVIEW A3/C2) | live | no |
| World Bank | `wb-indicators.ts` | Real | | Admin/investor views |
| Link previews | `link-preview.ts` | Real fetch | | Scheme cards |
| Schemes | `src/data/seedSchemes.ts` (8 curated schemes from a PDF, with `eligibilityTags` crop/district/land/tenure/provider) + `utils/schemeMatch.ts` (`matchSchemes`, MatchLevel strong/possible/general, reasons incl. `-unknown`) | Curated static (the PDF date is not shown); AI sync of `gov_schemes` is admin-only and probably ungrounded. `govSchemesDB.ts` is unused | static | Only the per-scheme chat. Match uses crop + district only (`GovSchemes.tsx:148`); land and tenure are never collected, so the "unknown" reasons always appear |
| Crop calendars | `src/data/cropCalendars.ts` (paddy, potato, tomato, onion, brinjal, chili, maize, mustard, jute; stages in days after sowing with action text and type fertilizer/irrigation/pesticide/harvest) + `utils/cropCalendar.ts` (`upcomingCalendarTasks`) | Static, "general guidance pending agronomist review" | static | No |
| Benchmarks | `src/data/cropBenchmarks.ts` (8 crops: per-bigha costs, yield, price; "typical, not market") | Static estimates | static | No (profit calculator only) |
| Disease KB | `src/data/diseaseKb.ts` (`CROP_KNOWLEDGE`, curated per-crop diseases with look-alikes and DAE-registered products) | Curated static | static | **Yes**: injected into diagnose and deep diagnose prompts |
| Disease keys | `utils/diseaseKey.ts` | Mapping of free text to `crop:disease` slugs | | area reports |
| Climate zones | `utils/climateZones.ts` (`getDistrictClimateRisks`: flood/salinity/drought/cold per district) | Static map | static | **Yes** via LOC |
| Geo | `utils/geoData.ts` (districts, upazilas, `findNearestLocation`), `_shared/area-catalog.ts` | Static | | yes via LOC |
| Season | `farmerContext.ts seasonForDate` (Rabi/Kharif-1/Kharif-2 by calendar) | Rule | | yes via LOC |
| Investor demo presets | `data/investorDemoPresets.ts` | Fake demo data | | demo mode (ships in farmer bundle, docs/REVIEW C7) |

---

## 4. Home and navigation

### 4.1 Simple-mode Home, top to bottom (`src/components/HomeToday.tsx`)

1. `h1` "আজ আপনার খামারে / Your farm today" (:89).
2. **Weather Card** (:92-168): if no location, a "Set your area" button; else place name, `ListenButton` (reads the 3 signals aloud with device TTS), big temperature, rain chance today, "updated at", `SignalList` = three rule-based rows (spray / irrigate / fertilise, `todaySignals`), and a "See the full weather" link. Error and loading states.
3. `AreaWarningStrip` (:171): admin broadcasts + crop problems reported by >=3 farmers in the upazila (max 2 items; hidden when signed out or empty).
4. "My tasks" card (:173-210): open Firestore tasks (only `follow_up` kind ever created: "check your crop again"), max 3, buttons "Check crop" and "Done".
5. `HomeCalendarTasks` (:212): with a saved sowing date, up to 3 upcoming stages from the static calendar, flagged if today's signal says do not spray/fertilise; without it, a one-time "When did you plant your {main crop}?" date prompt. Hidden if no main crop with a calendar.
6. 2x2 `BigActionButton` grid (:215-246): Check my crop -> `agri-copilot`; Weather -> `weather-advisory`; Market price -> `market-connect`; Talk to an expert -> `expert-hub` (unread badge).
7. "See all services" button (:248) -> opens the drawer.
8. Static line: "If urgent, call Krishi Call Centre 16123" (:256).

### 4.2 Navigation

- Bottom bar in Simple (`MobileBottomNav.tsx:~46-52`): **Home, Crop, Weather, Market, All**. Full mode bar: Ask Crop, Weather, Expert, Farm Record, More. Expert is not on the Simple bar (only a Home tile).
- "All services" drawer (Layout.tsx:~250-405, 681-720) lists **every tab in both modes** (`TAB_LEVEL`/`isTabInMode` in `nav/tabs.ts` are defined but never used for filtering: grep finds no consumer), grouped in 4 pillars: Crop health (agri-copilot, crop-health, community-radar), Weather (weather-advisory, smart-planting, climate-resilience), Economics (krishi-profit, market-connect, smart-grade, gov-schemes), Support (expert-hub, farmer-dossier = "Smart Krishi Card", user-guide, profile, admin). The pillar filter chips and search are Full-only (:592).
- 16 tabs (`nav/tabs.ts:9-26`); hash routing; simple = home, agri-copilot, weather-advisory, market-connect, expert-hub, profile.

### 4.3 Where AI entry points are

- Simple Home: **none visible as "AI"**. The only AI-backed door is "Check my crop" (photo diagnosis). The Home itself is rule-based, no AI text, no ask box, no mic.
- Crop tab: photo diagnosis (Simple default), toggle "Live video" (Live API with memory), after diagnosis: chat, translate, TTS, deep diagnosis, **voice call (LiveExpertCall)**, expert escalation.
- Market tab: "Get insights" button (AI explanation of the bulletin).
- Weather tab: no AI.
- Full only (via All services): Smart Grade (AI), Smart Planting (AI + voice call), Gov Schemes (scheme chat, AI sync), Climate/Satellite (estimated), Dossier (timeline of AI events).

### 4.4 Why it feels like a weather app

- The first and largest card is temperature + rain chance, with a weather icon; 1 of 4 big doors and 1 of 4 bottom tabs is also Weather. Three of five bottom entries are information lookups (weather, market, crop photo).
- The "advice" is three rule rows about spray/irrigate/fertilise driven by weather only; they are the same for every farmer in the district whatever the crop, stage, or history (todaySignals takes only weather).
- Tasks and calendar are the only personal items, and both hide until the farmer has done something (a diagnosis, a sowing date).
- No greeting, no name, no "what happened since yesterday", no money (spent/earned/price of my crop), no season status, no AI voice or ask box on Home. Experts are a button to a separate tab. The word "AI" is mostly absent on Simple Home.
- Costs, plots, seasons ("Farm Record") live behind All services (Dossier tab) and the Profit calculator, so the money side never shows on Home.

---

## 5. Gaps and building blocks

### 5.1 Data exists, no AI uses it

- Diagnoses (crop, severity, symptoms, `chatSummary`, `deepDiagnosis`), recovery logs, prescriptions: never re-read in a prompt. A new diagnosis does not know the last one (no "this is the second blight this month").
- Plots, seasons (crop, stage, sowing date, expected yield/price/cost), expenses, sales, farm record score: none feed any AI call or Home card. Only the server score job reads them (`_shared/record-facts.ts`).
- Main crop and place (onboarding): feed rule screens, not AI. `krishi_crop_plan` (calendar) and Firestore `seasons` are two unconnected notions of "my crop this season".
- Tasks: only the Home list and the 7:00 push count read them.
- Area warnings, local prices: UI-only.
- `todaySignals` / `farm-actions` rule output (the app's best decision logic): not provided to chat, Live, or any prompt, so the AI and the Home card can contradict each other (Live video does get raw weather numbers but not the verdicts).
- Official bulletin: only the market AI sees it, not the Live memory block, not the Home.
- Soil, satellite, history: used by the weather UI and one planting prompt only.
- Consultation advisories (`followUpDays`, `escalateIf`, expert dosage): not turned into tasks or fed to the AI.
- `farmer_profiles` fields soil/irrigation/land are only filled if the farmer edits the Dossier (first-write-wins merges elsewhere), so memory is often empty.

### 5.2 AI calls lacking context

- `diagnoseCrop` / `deepDiagnoseCrop`: no season, stage from plan, previous diagnoses on this crop, recent weather (wetness favours blight), or area warnings for that disease.
- `startAgriChat`: no profile, weather, or past cases; history lost on reload; `locationContext` is a string given once.
- `LiveExpertCall`: no farm memory, no weather, location is raw `GPS:` text (AgriCopilot.tsx:3017).
- `startSchemeChat`: knows nothing about the farmer (does not use `matchSchemes` facts).
- `getMarketInsights`: not told the farmer's crop plan, expected harvest date, or cost basis; `getMarketInsightsByLocation` ignores location.
- `getPlantingRecommendations`: asks the farmer to retype land, irrigation, previous crop that exist in plots/seasons/profile.
- `gradeProduce`: no link to harvest/season or the bulletin price.

### 5.3 Duplicated assistants that do not share memory

Six "assistants": (1) diagnosis chat, (2) Live video copilot, (3) Live voice call, (4) market insights, (5) scheme chat, (6) human experts (separate consultation chat). Each builds its own prompt, none shares history or a memory object. Only #2 reads `farmMemory`. Two prompt families (client `ai.ts` strings vs server `live-instructions.ts`) with different personas. A separate client-side timeline write (`recordFarmerInteractionEvent`) is the only cross-surface memory, and it stores 3 truncated events.

### 5.4 No action capability

- The proxy cannot do function calling (whitelist, `ai-config.ts:14`, `sanitizeTools` ai-proxy.ts:228) and the Live token locks tools to none. The AI cannot create tasks, expenses, sales, plots, seasons, reminders, or open screens.
- Write APIs that exist and are safe to call from a confirm card: `addFollowUpTask` (farmTasks.ts), `addExpense` (seasons.ts:272, requires an existing season), `saveSeason` (:182), `savePlot`, `addSale`, `updateSeasonProgress`, `addRecoveryLog`, `sendAreaReport` (server-validated), `enableNotifications`, `setCropPlan`. Navigation: `onNavigate(tab, {crop, produce})` (`Layout.tsx:199`), expert request via `ExpertRequestSeed` (expertTypes.ts:186; `onRequestExpert(seed)` opens the wizard prefilled).
- Rules limit what can be written: tasks `kind` must be `'follow_up'` and the keys are fixed (rules :977-1000), so a "spray reminder" or "custom task" needs a rules change plus `FarmTaskDoc`, `task-reminders.ts` and HomeToday updates; expenses require a season, an int amount and a category from the enum; seasons need a crop slug and land size; none of the free-text can exceed the rule bounds.
- Practical pattern given the whitelist: ask the model for a **structured intent JSON** (`responseSchema`) and render a confirm card that calls the existing service functions. Proper tool calling needs a proxy change (extend `ALLOWED_CONFIG_KEYS`/`sanitizeTools`) or a new server function.
- No "find schemes for me" path: schemes tab is Full-only and `matchSchemes` has no land/tenure input. "Book experts" = the wizard seed, exists but only reachable from the diagnosis screen and Home tile.

### 5.5 No proactive messages

- The only scheduled job is `push-daily.ts` (cron `0 1 * * *` = 07:00 Dhaka): counts open tasks due or overdue and sends one generic "you have N farm tasks" push (`task-reminders.ts`). No weather, no price, no crop stage, no AI, no personalisation (name, crop).
- `area-report.ts` sends an area push when 3 farmers report a problem.
- Push subscriptions: `push_subscriptions` has uid, lang, areaKey; the server can already target a user (`sendPushToUser`) or an area (`sendPushToArea`). VAPID and service account are required (`pushConfigured`). Guests may subscribe (rules :956-975) but the farmer must opt in via `NotificationSettings`.
- No in-app briefing, no "since last visit" feed, no email/SMS/WhatsApp.

### 5.6 Other gaps and risks relevant to the plan

- Quota: 10 AI calls/day for guests. A chat assistant at one call per message exhausts it in minutes; TTS and diagnosis also count. A briefing should be rule-built (no call) or generated once per day per farmer on the server and cached.
- Guests are default; farm record data tied to an anonymous uid can be lost on sign-out (docs/REVIEW A8). Memory needs durable identity (link Google) or a nudge.
- Grounding probably does not work (comment trail), so any "latest schemes/prices" answer must come from our own data, not the model.
- Onboarding data not persisted server-side, so a server job cannot personalise (area, crop, language).
- `server.ts` duplicates the proxy and weather code (docs/REVIEW C6); any new endpoint must be added in both places or the Express mirror made to mount Netlify handlers.
- Dead or unused: `generateWeatherAdvisory`, `findGovernmentSchemes`, `getMarketInsightsByLocation`, `FarmActionTrafficLight.tsx`, `ui/MicButton.tsx` (grep shows it is only present in `ui/`), `govSchemesDB.ts`.
- A lot of safety copy and honesty rules exist (outputRules, DIAGNOSIS_HONESTY_RULES in ai.ts:~285-304; `LIVE_SAFETY_RULES`; banned-chemicals list). A single assistant should reuse these rather than rewrite.
- The review doc `docs/REVIEW_2026-11-28.md` lists open honesty issues that a briefing would inherit (A1 missing weather read as 0, A4 stale bulletin shown as today, A7 spray window at night, A11 calendar vs signal conflict).

### 5.7 Reusable building blocks (best first)

1. **`_shared/farm-actions.ts` + `utils/todaySignals.ts`**: deterministic, tested, bilingual; pure TS shared by server and browser. Ideal "facts" core for a briefing and an AI grounding block (feed verdicts into the prompt so AI cannot contradict them). Week view already in the feed (`weekActionsFromFeed`).
2. **`utils/farmerContext.ts`**: `buildLocationContext`, `describePlace`, `seasonForDate`, climate risks: a ready context builder to extend with crop/stage/season/last diagnosis.
3. **`utils/farmMemory.ts`** (`buildFarmMemoryContext`): a working "memory block" assembler with timeout (3.5 s), 10-min weather memo and honesty rules; currently Live-video-only. Extend to a general `buildFarmerBrief(uid)` and also attach to chat, voice call, market, planting.
4. **`_shared/record-facts.ts` + `farm-record-model.ts` (`seasonTotals`, `scoreFarmRecord`)** and service-account `adminFetch`: a server-side reader of plots, seasons, expenses, sales, diagnoses. Basis for server-built per-farmer briefings and for money coaching (costs vs plan, margin, profit per season, `planResult` in `utils/seasonMath.ts:193`).
5. **`push-daily.ts` + `task-reminders.ts` + `push-send.ts` + `pushNotifications.ts`**: working scheduled push pipeline, bilingual messages, per-user and per-area targeting, subscription slots. Turn the generic task push into a briefing push.
6. **`utils/speech.ts` (`speakChecked`, `speakWithBrowser`, `startListening`, `canListen`) + `ui/ListenButton.tsx` + `ui/MicButton.tsx` + `profit/VoiceAmountButton.tsx` (`parseSpokenAmount`)**: free, device-based Bangla TTS and speech-to-text, no quota. `ListenButton` is already on Home, weather, scheme, price cards. Voice amount parsing has known bugs (docs/REVIEW A9: "পাঁচ শ", "দেড় হাজার").
7. **`services/farmTasks.ts`, `seasons.ts`, `farmRecord.ts`, `recoveryLog.ts`**: typed, rule-matching write functions with offline-aware `Pending` handling, usable as action executors.
8. **`utils/cropCalendar.ts` + `data/cropCalendars.ts` + `useCropPlan`**: crop stage logic for "what is due this week" (needs linking to a Firestore season).
9. **`utils/schemeMatch.ts` + `seedSchemes.ts`**: eligibility matcher with reasons; add land/tenure answers and it becomes a "schemes for you" action.
10. **`ExpertRequestSeed` and `onRequestExpert`**: a ready hand-off to book an expert with crop, severity, district prefilled.
11. **`_shared/area-model.ts`/`area-store.ts`, `useAreaWarnings`, `LocalPriceCard`**: local signals (disease alerts, farm-gate prices) to include in a briefing.
12. **`services/marketPrices.ts` (`fetchOfficialBulletin`, `bulletinPromptContext`)**: real price anchor, with honest "not in bulletin" handling.
13. **`_shared/live-instructions.ts` + `live-token.ts`**: server-owned, injection-resistant system instruction with a `farmContext` slot (4000 chars). Add farm context to voice calls and a single "partner" persona.
14. **`ai-proxy.ts` pipeline** (quota, safety, streaming, failover, sanitizer): reuse; only needs a tool-calling extension or an intent-JSON convention.
15. **`diseaseKb.ts`, `climateZones.ts`, `cropBenchmarks.ts`**: curated knowledge that already improves prompts.
16. **`netlify/functions/_shared/farm-record-model.ts` `scoreFarmRecord`** and `farm_record_scores`: an engagement/"habit" metric that could drive coaching ("log 2 more costs to reach Good").

### 5.8 Smallest data-model changes that unlock most (suggestions, not changes)

- Persist onboarding (language, place, main crop) to `farmer_profiles` or `users/{uid}` so server jobs can personalise (needs rules entry; `farmer_profiles` update allows a fixed key list, rules :392-398).
- Unify "my crop this season": derive `krishi_crop_plan` from the active Firestore season (sowingDate, stage).
- A small `users/{uid}/assistant/*` store (conversation turns + remembered facts + last briefing) with its own rules.
- Widen `tasks.kind` (rules :986) and add optional `source`/`dueTime` so assistant-created reminders are distinguishable.

### 5.9 Addendum

- Speech-to-text is implemented three separate times (`AgriCopilot.tsx:1236` chat mic, `ExpertRequestWizard.tsx:177`, `profit/VoiceAmountButton.tsx`); the shared `speech.ts startListening` and `ui/MicButton.tsx` have no consumer. Consolidate before building a voice-first assistant.
- `GovSchemes.tsx:284` shows the "TRIGGER AI SYNC" button, but writes to `gov_schemes` require admin per rules, so for a farmer it spends quota and fails at the write.
