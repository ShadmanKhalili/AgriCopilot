# AgriCopilot feature audit: original (6fa2c78, 16 Oct 2026) versus now (HEAD ba14906, PR #45)

Read-only audit. Evidence: `orig:` = file at commit 6fa2c78 (`git show 6fa2c78:<path>`); `now:` = HEAD. "Taps" = taps from Home in Simple mode. PR numbers are from `gh pr view`.

## How to read the status column
Primary status is the first word: UNCHANGED, IMPROVED, HIDDEN (only behind a "More details / More options" disclosure, or only in Full mode), MOVED, REDUCED, REMOVED, REPLACED.

## Key structural facts (verified in code)

1. **No tool is actually removed from the app's navigation.** `src/nav/tabs.ts:47-67` defines `TAB_LEVEL` and `isTabInMode`, but nothing imports them (grep over `src`: only the definition). The "All" drawer in Simple mode (`Layout.tsx:254-406` tab list, no mode filter) lists every tool, grouped in the same four pillars. Every tool is therefore 2 taps from Home: Home, "See all services" (HomeToday.tsx), tool. What Simple mode hides is the sidebar search/pillar filter (`Layout.tsx:592`), the price ticker (`:881`), the expert banner (`:1044`), the quick-action bar (`:1086`), theme/install buttons (moved into the drawer, `:817`).
2. **Full mode switch** is a toggle "Show all features" in the drawer footer (`Layout.tsx:795-815`), not in Profile (the plan said Profile). Default is Full only for admin / expert / org_admin (`context/useUiMode.ts:6`). Anyone else starts Simple.
3. **The "original app" lacked the whole human-expert layer.** `ExpertHub`, `ExpertRequestWizard`, `ConsultationRoom`, `ExpertWorkspace`, `ExpertOnboarding` do not exist at 6fa2c78; they arrived in commits 28250ee..cf0658a (21-23 Oct), before PR #1. They are listed below as "added before the refactor".
4. **No file was deleted** between 6fa2c78 and HEAD (`git log --diff-filter=D 6fa2c78..HEAD` is empty). All removal happened inside files.
5. **AI is not personalised.** Only `buildLocationContext` (district, climate risks, season: `utils/farmerContext.ts:127`) is injected into AI prompts (`services/ai.ts:529,669,849,1046,1259`). Main crop, farm record, plots, seasons and saved plans are NOT passed to crop doctor, chat, planting, grading or market AI. `buildFarmMemoryContext` is used only by Live video (`LiveVideoCopilot.tsx:875`). `mainCrop` is read only by non-AI screens (Home calendar, schemes matching, profit default, market default).
6. **Home has zero AI calls.** `HomeToday.tsx` imports `useTodayWeather` and `todaySignals` (fixed rules), no `services/ai`. The plan's "rules decide, the AI explains" half is not built: `generateWeatherAdvisory` (`ai.ts:800`) exists but no screen calls it (it had no caller originally either; PR #37 says so).
7. **Three AI functions are dead code before and after:** `generateWeatherAdvisory`, `findGovernmentSchemes`, `getMarketInsightsByLocation` (only defined in `services/ai.ts`). `FarmActionTrafficLight.tsx` was never shown originally and is still unused (review C7).

## Table

### A. Shell, navigation, account

| # | Feature (what the farmer could do) | Worked originally? (evidence) | Status now (where, taps) | Why / PR | Bring back? |
|---|---|---|---|---|---|
| A1 | Sidebar of 14 tools in 4 pillars with search and pillar filter | Real navigation. `orig Layout.tsx:202-340` `allTabs` | REDUCED in Simple: replaced by 5-button bottom bar Home/Crop/Weather/Market/All (`MobileBottomNav.tsx:46-52`); drawer still lists all 14 tools (2 taps). Search/filter hidden. Full mode = original shell | #34, #35: first-time user saw 35 controls | no (keep Simple default). Do: show 6-8 tools as a visible grid on Home instead of only "See all services" |
| A2 | Mobile bottom bar: Ask Crop / Weather / Expert / Farm Record / More | `orig MobileBottomNav.tsx` | REPLACED in Simple (Expert and Farm Record no longer on bar; Expert is a Home big button, 1 tap; Farm Record is 2 taps). Full keeps old bar (`MobileBottomNav.tsx:56-83`) | #35 | no |
| A3 | Scrolling price ticker | Invented/frozen. `orig LiveMandiTicker.tsx:62,70,308` constants "Verified 30 Sep 2026"; AI "web search" (`orig ai.ts:866-890`) returned nothing because the Google Search tool was refused by the key (PR #18, #16) | HIDDEN (Full mode only, `Layout.tsx:881`); data now the real DAM bulletin (`LiveMandiTicker.tsx` 683 to 316 lines) | #18-#21, #38, #35 | yes-as-is as a Home strip: it is now real data, dated |
| A4 | Header badges "16.5M Farmers", "$450M Loss Shield" | Invented fixed numbers. `orig Layout.tsx:749,753` | REMOVED | #30 | no |
| A5 | Bangla/English toggle | Real | UNCHANGED (header); bug fix: language no longer resets on reload (#27) | #27 | n/a |
| A6 | Dark/light theme | Real | MOVED to drawer in Simple (`Layout.tsx:817`), header in Full | #35 | no |
| A7 | PWA install button | Real; installed PWA failed to boot offline (PR #4, #13) | MOVED to drawer in Simple; offline boot fixed | #4, #13, #22, #35 | no |
| A8 | Offline banner, offline weather cache | Partly invented: fixed "Cox's Bazar coastal zone" weather pre-seeded and shown as "saved forecast" for any district (`orig offlineCache.ts:31-42`; still at review A2) | IMPROVED: invented fallback removed (#42 A2); error shown instead | #42 | n/a |
| A9 | Opens straight on live-video screen, no onboarding | n/a (plan 1.2) | REPLACED by Home + 3-step welcome (language, area, crop) `Onboarding.tsx` | #35 | n/a (new, see N1) |
| A10 | GPS asked on load; silent fallback to Dhaka/IP | Misleading: silent Dhaka (`orig geolocation.ts`; review A3) | IMPROVED: no auto prompt, "Choose area" card; failures show a district list (#35, #42 A3). Still open: the crop doctor's "detect location" button (`AgriCopilot.tsx:1046`) and `MarketConnect.tsx:200` still call `detectUserLocation()` with the IP/Dhaka fallback enabled (only `Onboarding.tsx:93` passes `allowFallback:false`) | #35, #42 | n/a |
| A11 | Region modal (district/upazila) | Real | UNCHANGED | - | n/a |
| A12 | Pricing / tier modal (free vs premium, daily AI limits) | Real; server limits existed; meter showed 10/9999 vs server 100/1000 (#27) | UNCHANGED (opens from limit message `Layout.tsx:1353`); messages reworded (#33) | #27, #33 | n/a |
| A13 | Sign-in (Google/email), guest sessions | Real; first AI result of a new visitor was lost (#32) | IMPROVED: email verification, charge-before-call (#33) | #32, #33 | n/a |
| A14 | Legal/terms modal | Existed but unreachable (plan 1.4) | IMPROVED: Profile link (`Profile.tsx:235`) | #39 | n/a |
| A15 | In-app browser banner | Real | UNCHANGED | - | n/a |
| A16 | Expert availability banner/strip on crop doctor and home | Added after original (cb214d6, bbf3b89) | HIDDEN (Full only, `Layout.tsx:1044`); Simple has the Expert Home button with unread badge | #35 | no |
| A17 | Ads (AdSense) | CSP allowed AdSense (#27 item 9); no ad UI located in Layout | UNCHANGED/unverified (plan says "ads unchanged") | #35 | n/a |

### B. AI Crop Doctor (AgriCopilot.tsx)

| # | Feature | Worked originally? | Status now | Why / PR | Bring back? |
|---|---|---|---|---|---|
| B1 | Photo diagnosis, up to 5 photos, ranked causes, severity | Real Gemini call (`orig AgriCopilot.tsx:1303`, `ai.ts:231`) but: image downscaled to 800 px, single answer, `|| 95` fake confidence (PR #23); 2+ photos refused by proxy (#27 item 2) | IMPROVED: 1 tap from Home (button + bottom bar), photo-first. Ranked candidates, honest confidence, hi-res + focus crop (#23); safety policy (#24); refusal not saved (#30) | #23, #24, #27, #29, #30, #36 | n/a |
| B2 | Crop / stage / analysis type (disease, pest, abiotic) / notes inputs | Real inputs (`orig :3048-3290`) | HIDDEN under "More options (crop, area, notes)" in Simple (`AgriCopilot.tsx:3505`); visible in Full | #36 | no. Do: auto-fill crop from main crop |
| B3 | Field location (GPS / district / upazila) in crop doctor | Real | HIDDEN (same disclosure). Saved with diagnosis (district, upazila, diseaseKey) | #36 | n/a |
| B4 | Other possible causes / differential diagnosis | Real (shown) | HIDDEN under "More details" in result (`:2733-2987`), 1 extra tap | #36 | yes-as-is: show top-2 causes inline |
| B5 | Live video mode (primary tab in original: "Live Video AI (Primary)") | Real Gemini Live | MOVED: second option "Live video" (`AgriCopilot.tsx:1827-1856`, 2 taps); default is photo in Simple | #36 | yes-as-is: promote as a Home door ("Show live") |
| B6 | Deep diagnosis (deepDiagnoseCrop, step-by-step reasoning, dosages) | Partly invented: prompt said both "no internet" and "use Google Search"; listed sources the model could not look up; "EXACT dosages" (`orig ai.ts:331-445`, `:421`; #30, #36) | HIDDEN under "More details"; REDUCED: no sources list, no search claim, dose only if sure (#30) | #30, #36 | no |
| B7 | Precision spray / dosage calculator (knapsack) | Real maths but pre-filled 2 g/L "accurate ratio"; assumes 10 L per decimal (unverified, agronomist pending) (`orig DosageCalculator.tsx:46`; #30) | HIDDEN inside More details (`AgriCopilot.tsx:2917`); IMPROVED: empty start, per-L / 10 L / tank, read-back, PPE line (#30, #42 A5) | #30, #42 | n/a (needs agronomist check of 10 L/decimal) |
| B8 | Digital Krishi Rx (print/PDF/share) | Real but QR pointed to a domain the app does not own (`orig DigitalPrescriptionModal.tsx:117`), fake SHA256, "approved" doses | IMPROVED/REDUCED: plain reference number, "AI suggestion, check the label", doses held back when confidence low (#30, #36, #42 A6). Button visible in result (`:2398`) | #30, #36, #42 | n/a |
| B9 | Read-aloud of the answer (TTS) | Real (`orig :1267`) | IMPROVED: `ListenButton` on the result (`:2420`), no-Bangla-voice warning (#45) | #45 | n/a |
| B10 | Follow-up chat with AI (typed + voice input + quick context chips) | Real (`orig :1101,1166`; `startAgriChat`) | UNCHANGED (visible below result, `:2989`) | - | n/a |
| B11 | Summarise chat and save to farm record | Real (`orig :1236`) | UNCHANGED | - | n/a |
| B12 | Translate result Bangla/English | Real (`orig :1061`) | UNCHANGED | - | n/a |
| B13 | Rate helpfulness of answer | Real (`orig :2104`) | UNCHANGED | - | n/a |
| B14 | Share image / share text (WhatsApp etc.) | Real (`orig :1408,1464`) | UNCHANGED | - | n/a |
| B15 | 7-day plant recovery tracker | Invented: chlorophyll SPAD, "lesion arrest", "tissue healing", "risk reduced 95%" (`orig PlantHealthRecoveryTracker.tsx:53-102`), log lost on refresh | REPLACED: labelled general guide plus the farmer's own saved notes; HIDDEN under More details (`AgriCopilot.tsx:2779`) | #36 | n/a |
| B16 | "Verify with expert" button | Only opened Google Maps search for DAE offices, labelled "(Indicative)" (`orig :983-1000`) | REPLACED: real expert request seeded from the diagnosis (`:2655-2691`); maps button still at `:3350` | #28 layer (pre-refactor), #36 | n/a |
| B17 | "Talk to AI expert" voice call after diagnosis (LiveExpertCall) | Real Gemini Live, labelled "Expert Online" (`orig :2567`, `LiveExpertCall.tsx:827`) | IMPROVED: relabelled "AI voice call"; "Expert Online" removed (#29, #39) | #29, #39 | n/a |
| B18 | 20 sample disease cases (canned result) | Broken: every sample opened an empty result (#27 item 1); canned confidence 94 (`orig :31-50`) | HIDDEN under "See example diseases" (`:3769`); fixed (#27) | #27, #36 | no (canned data is not AI) |
| B19 | Investor pitch preset injector in crop doctor | Demo data shown to every farmer (`orig :1688-1710`) | HIDDEN: admin only (`:1966`) | #29, #30 | no |
| B20 | Cross-links to Profit / Market / Climate / Satellite at end of result | Real | UNCHANGED (`:3386`) | - | n/a |
| B21 | Header banner, "next steps" ribbon, "Clear all" | Cosmetic | HIDDEN/REMOVED in Simple (`:1789-1815`, `:2324`) | #36 | no |
| B22 | Deep-pathology / quick toggle, reasoning depth | Not in original (added later) | HIDDEN under More options in Live video start (`LiveVideoCopilot.tsx:2224-2272`); Quick is default in Simple | #36 | n/a |

### C. Live video copilot (LiveVideoCopilot.tsx)

| # | Feature | Worked originally? | Status now | Why / PR | Bring back? |
|---|---|---|---|---|---|
| C1 | Live camera + voice conversation with Gemini Live, interruptible | Real (`orig :718-1170`) | IMPROVED: 1280x720 frames, `MEDIA_RESOLUTION_HIGH`, token locked (#23, #44); 2 taps from Home (Crop > Live video) | #23, #36, #44 | yes-as-is: add a "Show live" button on Home |
| C2 | Subtitles, big tap-to-answer chips (crop age, days, last input) | Real (`orig :32-66`) | UNCHANGED | - | n/a |
| C3 | Farm memory (past sessions injected into the live prompt) | Real (`orig :886`, `utils/farmMemory.ts:193`) | UNCHANGED, and still the only AI path using farm history | - | yes-as-is: reuse the same context in photo diagnosis, chat and planting |
| C4 | Extended thinking vs quick mode | Extended always on (`orig :801`) | REDUCED default: Quick in Simple, Deep under "More options" (`LiveVideoCopilot.tsx:134`) | #36 | no (cost/latency) |
| C5 | Torch, flip camera, mute, fullscreen, call timer | Real | UNCHANGED | - | n/a |
| C6 | Capture frame and send to photo deep diagnosis | Real (`onCaptureFrameForDeepDiagnosis`) | UNCHANGED | - | n/a |
| C7 | End-of-call summary and action card saved to timeline, voice playback, Rx | Real (`orig :1170-1340`) | UNCHANGED | - | n/a |
| C8 | Investor demo presets and pitch stats ("16.5M Farmers + 3.5M Urban") | Demo shown to everyone (`orig :2048`) | HIDDEN: admin only | #30 | no |
| C9 | Quick-mode prompt | Was a rooftop-gardening helper | IMPROVED: smallholder field crops, steps for today, 16123 | #36 | n/a |

### D. Weather and climate

| # | Feature | Worked originally? | Status now | Why / PR | Bring back? |
|---|---|---|---|---|---|
| D1 | Current weather + 4 metrics (Google Weather API, Open-Meteo fallback) | Real (`orig weathernext-3.ts:84-110`) but Google path covered ~2 days; map labelled every place Cox's Bazar (#27); "6 C above normal" bug (#27) | IMPROVED: Home Today card (1 tap) and Weather screen (1 tap); "updated at" time (#45) | #27, #35, #37 | n/a |
| D2 | Today: Spray / Irrigate / Fertilise signals with Listen | Missing (traffic-light component existed but never shown) | NEW: `todaySignals`, `farm-actions.ts` rules, Home and Weather (1 tap). Thresholds await an agronomist | #35, #37, #42 A1 | n/a |
| D3 | 7-day plain-language strip ("good day to spray") | Missing | NEW: Weather screen (1 tap) | #37 | n/a |
| D4 | Severe-weather alerts banner | Real (Google publicAlerts), "P90 storm spike" figures in headlines (`orig SevereWeatherAlerts.tsx`) | IMPROVED: plain Bangla/English by alert type, real numbers only | #37 | n/a |
| D5 | 48-hour microclimate radar simulator | Invented: sine-wave hourly series, fake dBZ, rain rate, cloud distance and position (`orig MicroclimateRadarSimulator.tsx:83-100,157-160`) | REPLACED by "Hour-by-hour forecast" showing only real hourly values; HIDDEN under More details (`WeatherAdvisory.tsx:992`) | #37 | n/a |
| D6 | Dual-model comparison (WeatherNext vs standard) with "consensus %" and confidence | Invented: `ensembleSeed = sin(lat*12.9898+lon*78.233)` (`orig weathernext-3.ts:239,510`) | REDUCED: model toggle kept under More details, consensus/spread/"High accuracy" removed | #37 | no |
| D7 | Agro-microclimate cards: 100 m canopy wind, solar DNI, dew point and blight risk, rain range | Partly invented fallbacks (480 W/m2, 1.35x wind, blight "low" when unknown, 75% humidity) | HIDDEN (More details); fallbacks now "—" | #37 | n/a |
| D8 | 48-h precipitation risk envelope; 24-h hourly timeline | Real hourly; "P10-P90" band is a fixed multiple of expected rain | HIDDEN (More details); band no longer drawn on standard path | #37 | no |
| D9 | Soil and hydrology insights (SoilGrids pH, N, SOC) | Real but refused for most of Bangladesh (longitude checked against latitude range) | HIDDEN (More details); fixed (#29) | #29 | yes-rebuilt-with-real-data: feed pH/N/SOC into fertiliser signal and planting advice |
| D10 | Historical climate comparison (this month, last year) | Real (Open-Meteo archive); wrong baseline (#27) | HIDDEN (More details); baseline fixed | #27 | n/a |
| D11 | Google map with weather pin | Real; label wrong everywhere | HIDDEN (More details); neutral label | #27 | n/a |
| D12 | "Safe spray window" | Own thresholds that could contradict signals; could be 12-2 AM | IMPROVED: same rules; daytime only (#42 A7) | #37, #42 | n/a |
| D13 | AI-written weather advice paragraph | Never rendered: `generateWeatherAdvisory` had no caller (orig) | UNCHANGED (still dead code) | #37 notes it | yes-rebuilt-with-real-data: AI explains the rule outputs in one spoken line, using the same real feed |
| D14 | Smart Planting: AI top-3 crops, avoid list, diversification, from land type/size, irrigation, previous crop, budget, weather, NDVI | Real AI (`orig ai.ts:1013`), ignored zone risk, soil, prices, history | UNCHANGED in function; 2 taps (All > Smart Planting); only location + season context added; no Simple screen | #34 (context) | yes-rebuilt-with-real-data: pre-fill from main crop/plots/season; add soil, zone risk and bulletin prices to the prompt |
| D15 | Planting-intent pipeline (recommended, intended, sown, outcome) saved to `planting_intents` | Real writes (`orig SmartPlanting.tsx:183-242`) | UNCHANGED | - | yes-as-is: feed outcomes into the farm record |
| D16 | AI voice call inside Smart Planting | Real | UNCHANGED | - | n/a |
| D17 | Crop lifecycle calendar (stage-by-stage fertiliser, irrigation, spray, harvest) | Real fixed schedules for 4 crops; not saved; no reminders (`orig CropLifecycleCalendar.tsx:27,89,140,191`) | IMPROVED: 9 crops in `data/cropCalendars.ts`; sowing date saved; this week's tasks on Home with Done; daily push (#40, #45) | #37, #40, #42 A11 | n/a (agronomist must review stage days) |
| D18 | Climate Resilience Guide (flood, salinity, drought, cold varieties, comparison) | Static curated list; some claims unsourced ("engineered with modern biotechnology") (`orig ClimateResilienceGuide.tsx`) | UNCHANGED apart from district-aware filter added before refactor (cf0658a); 2 taps (All) | - | yes-rebuilt-with-real-data: pick varieties by the farmer's upazila risk (code exists in `utils/climateZones.ts`) and attach a BRRI/BINA source |
| D19 | Satellite crop health (NDVI/NDMI, stage context) | Real Sentinel-2 only when credentials set; else error. Scene date "2026-10-12", cloud 3.8% hard-coded (`orig SatelliteHealth.tsx:33-39`) | REPLACED in part: without credentials it returns a deterministic seasonal model (`sentinel.ts:16-53`, `isEstimated:true`), now labelled "AI estimate"; fixed scene metadata removed (#29). 2 taps (All) | d7cc8b7 (estimate path), #29 | yes-rebuilt-with-real-data: field boundary + trend, show only when real data |

### E. Market and money

| # | Feature | Worked originally? | Status now | Why / PR | Bring back? |
|---|---|---|---|---|---|
| E1 | Market insights for a produce (AI) | AI-made: prompt asked for Google Search that the key refused (`orig ai.ts:691-715,821`; #16, #18); numbers invented | REPLACED: official DAM bulletin card (1 tap Home > Market). AI note kept behind a closed "AI market note (estimate)" (`MarketConnect.tsx:516`) | #16, #18-#21, #38 | n/a |
| E2 | Official government price (DAM daily bulletin) | Missing | NEW: one dated Dhaka price range per item, last copy kept offline; only ~12 items (tomato, potato, brinjal not listed, PR #38) | #18-#21, #38, #42 A4 | yes-rebuilt-with-real-data: add TCB/other bulletins for missing crops |
| E3 | Wholesale vs supermarket cards; supermarket tracker (Shwapno, Meena Bazar, Agora, Chaldal) | Invented (`orig MarketConnect.tsx:538-660`, fallbacks "৳৬০","৳৪৮"; PR #38) | REMOVED | #38 | no (no data source) |
| E4 | Mainstream mandi hubs table (Kawran Bazar, Shyambazar, Khatunganj) and "live bids" | Invented per-market rows (`orig :661-715`; plan 1.1) | REMOVED | #38 | yes-rebuilt-with-real-data only if per-market feed exists; the local-price reports (E8) are the honest replacement |
| E5 | Value-chain margin spread | Invented | REMOVED | #38 | no |
| E6 | GPS / "nearest markets" chips and mandi selector | Cosmetic, tied to invented rows (`orig :353-405,796`) | REMOVED (no GPS or mandi chips in `MarketConnect.tsx` now) | #38 | no |
| E7 | Selling tips, price drivers, AI commentary, premium analysis toggle | Real AI text (but ungrounded) | REDUCED/HIDDEN: inside the AI note disclosure (`:516`, tips `:441`); premium toggle kept (`:611`) | #38 | n/a |
| E8 | Local price (area average) and "What price did you get today?" | Missing | NEW: `LocalPriceCard`, `ReportPriceForm`; shows only with 3+ farmers (1 tap Home > Market) | #40, #43 | n/a |
| E9 | Offline regional price table (Cox's Bazar mandis) | Invented estimates (`orig offlineCache.ts:61`) | REMOVED | #38 | no |
| E10 | Profit and loss calculator: 8 crops, land units, benchmark costs, yield, break-even per maund and kg, ROI | Real maths; costs/yields/prices are benchmarks (agronomist review pending: 1 bigha boro shows a loss); typed yield did not scale with land (#31) | IMPROVED: simple card (2 taps: Market > Profit or loss, or All), saved plans (up to 100), bulletin price shown for reference; full editor under More details | #31, #38, #45 | n/a (needs agronomist figures) |
| E11 | Voice entry of amounts | Added after original (519faef) | IMPROVED: Bangla number words fixed (#38, #42 A9) | #38, #42 | n/a |
| E12 | Itemised cost ledger and summary copy/share | Real | HIDDEN (More details in Simple); UNCHANGED in Full | #38 | n/a |
| E13 | Middleman bargaining guide ("do not sell below break-even") | Real text; "certainly a loss", "10-15% more" wording (#31) | REDUCED: wording removed | #31 | n/a |
| E14 | Expense notes through the season; saved seasons | Missing | NEW (`ExpenseNotes`, `useSeasonPlans`) | #38 | n/a |
| E15 | Produce grading (photo to Grade A/B/Reject, 10 products) | Real Gemini vision; price, shelf life, best market invented by the model (`orig ai.ts:640-690`) | IMPROVED: 2 taps (Market > Check my produce quality, or All); price labelled "AI estimate", bulletin price shown for chili only | #31, #39 | n/a |
| E16 | Grading "certificate" saved | Real write (`orig SmartGrade.tsx:87`); named "Quality Certificate" | REPLACED by "AI Quality Check" wording | #31 | n/a |
| E17 | Buyer connect: share graded lot to a buyer on WhatsApp with phone number | Real share only; no directory or listings (plan 1.1 "Missing") | UNCHANGED | - | yes-rebuilt-with-real-data: a buyer/wholesaler directory (parked by the owner) |
| E18 | Government schemes list (8 seed + 14 AI-synced = 22) with links | Curated, real links but dead hosts (`service.moa.gov.bd`) and "Verified/Trusted" wording (#29, #31) | IMPROVED (All > Schemes, 2 taps) | #29, #31 | n/a |
| E19 | Per-scheme AI chat | Real (`orig GovSchemes.tsx:156-210`) | IMPROVED: "AI answer, confirm at the office" + Listen (#45) | #45 | n/a |
| E20 | Admin AI sync of schemes (Google Search) | Admin only; search tool refused by key (#16) | UNCHANGED (still asks for Google Search, flagged in #36) | - | n/a |
| E21 | "Schemes for you" matching (crop, district, land, tenure), provider filter | Missing | NEW (`schemeMatch.ts`, 43 tests). 14 of 22 schemes carry no eligibility tags so "For you" shows 21 of 22 | #39 | yes-as-is after tagging the 14 |

### F. Records, people, admin

| # | Feature | Worked originally? | Status now | Why / PR | Bring back? |
|---|---|---|---|---|---|
| F1 | Smart Krishi Card (digital farmer ID) | Real card; ID `BD-KRISHI-<uid>`; signed-out "GUEST" fake ID | IMPROVED: fake guest ID removed (#45); 2 taps (All) | #45 | n/a |
| F2 | Credit readiness score (5 pillars), "bank-grade" labels | Calculated on the phone from user-editable data, writable by the owner (`orig FarmerDossier.tsx:184-196,462`) | REPLACED by a server-computed farm record score (`RecordScoreCard`, `record-facts.ts`), labelled not for lenders | #29, #41, #43 | n/a |
| F3 | Loan eligibility panels (BKB ceilings 50,000 / 150,000 taka, "pre-approved") and parametric insurance texts | Unbacked claims (`orig FarmerDossier.tsx:595-640`). Only the `insuranceRiskTier` label existed; there was no real insurance feature | REMOVED | #29 | no (until a lender partner exists) |
| F4 | Four evidence pillars (need, eligibility, intervention, data confidence) | Real text rules | UNCHANGED | - | n/a |
| F5 | Chronological timeline of AI sessions (diagnoses, grading, live calls) | Real (`fetchFarmerTimeline`) | UNCHANGED | - | n/a |
| F6 | Manual farm profile editor (land, crop) | Real | UNCHANGED | - | n/a |
| F7 | Appeal / correction request | Showed "Appeal submitted" with nothing sent | IMPROVED: now says appeals cannot be sent yet | #45 | yes-rebuilt-with-real-data: queue to an upazila officer or admin |
| F8 | Printable dossier | Real | REPLACED by one-page farm record print (`FarmRecordPrint`) | #41 | n/a |
| F9 | Farm record: plots, seasons (stage, sowing, harvest), sales | Missing | NEW (works signed out on the phone, syncs on sign-in) | #41, #42 A8 | n/a |
| F10 | Community Radar | Only the farmer's own severe diagnoses; admin "broadcast" sent nothing (`orig CommunityRadar.tsx:34-36`) | IMPROVED: "My area" tab with 3-farmer minimum; 2 taps (All) or the Home strip when a warning exists | #29, #40, #43 | n/a |
| F11 | Area warning strip on Home; admin broadcast to a district | Missing | NEW (`AreaWarningStrip`, `area-report`, `alerts`) | #40, #43 | n/a |
| F12 | Phone push (area warning, daily 7:00 tasks) | Missing | NEW; needs Firebase service account + VAPID keys + rules/index deploy (docs/PHASE6_SETUP.md); not verifiable from code whether live | #40, #45 | n/a |
| F13 | Profile: account, usage stats, histories (diagnoses, certificates, market queries, planting intents), device sync | Real (`orig Profile.tsx:229-540`) | UNCHANGED + notification switch, legal link, email-verify buttons; header pill, 1 tap | #33, #39, #40 | n/a |
| F14 | User guide | Static (300 lines) | UNCHANGED, 2 taps (All). Not updated for Simple mode | - | yes-as-is: add a Simple-mode first-use guide |
| F15 | Admin Operations Hub (5 tabs: command centre, outbreak hotspots, Rx registry, users, investor metrics, invite agronomist) | Mostly invented: user count `Math.max(users.length,128)`, random growth series, fake users, mock Rx rows (`orig AdminDashboard.tsx:276,324,349,366`) | IMPROVED: real counts, real growth, no synthesized rows, CSV injection guard (#43); real broadcast (#40). Admin sees Full by default. "Edge ping" still random (`:949`) | #29, #30, #39, #40, #43 | n/a |
| F16 | Admin emergency broadcast | Showed success, sent nothing | REPLACED: writes real `alerts` visible on Home strip | #40 | n/a |
| F17 | Investor / SaaS metrics tab ("$450M loss shield") | Demo numbers (`orig AdminDashboard.tsx:1716,1744`) | UNCHANGED in admin only; demo presets gated (#29, #30) | #30 | no |

### G. Human expert layer (added 21-23 Oct, after original but before refactor)

| # | Feature | Worked? | Status now | Why / PR | Bring back? |
|---|---|---|---|---|---|
| G1 | Expert hub: request an expert, consent-first wizard, active/past consultations | Real MVP (plan 1.1) but photos not shared (count only) and experts not alerted | IMPROVED: Home big button (1 tap) with unread badge; photos really shared with consent (#39) | #39, #35 | n/a |
| G2 | Consultation room: chat, voice notes, call link, ratings; reply to accepted case | Real; farmer could not reply (#3) | UNCHANGED (+ #3 fix) | #3 | n/a |
| G3 | Expert directory | Seeded demo experts shown as "available now" (`seedDemoExperts`, `ExpertHub.tsx:69-70`) | REDUCED: demo experts hidden from farmers; real count only | #29, #30 | yes-rebuilt-with-real-data: needs real onboarded experts, expert alert (push) on new request |
| G4 | Expert onboarding, workspace, admin approval | Real | UNCHANGED | - | n/a |
| G5 | "Emergency in 15 min / within 24 h" response promises | Unbacked | REPLACED by 16123 helpline text | #31 | no |

### H. NEW since original (added by the refactor)

| # | Feature | Where / evidence | PR |
|---|---|---|---|
| N1 | First-run welcome: language, area (GPS or district/upazila), main crop, spoken prompts | `Onboarding.tsx` | #35 |
| N2 | Home "Your farm today": Today card (temp, rain chance, spray/irrigate/fertilise signals, Listen), "Set your area" card | `HomeToday.tsx`, `todaySignals.ts` | #35 |
| N3 | Simple mode and Full mode switch (admin/expert default Full) | `useUiMode.ts`, drawer toggle | #34, #35 |
| N4 | One shared rule engine for spray/irrigate/fertilise (server, local server, phone) | `_shared/farm-actions.ts` | #37, #42 |
| N5 | 7-day "do / do not" strip | `weather/WeekStrip.tsx` | #37 |
| N6 | Crop calendar tasks on Home (this week, Done) | `HomeCalendarTasks.tsx` | #37, #42 A11 |
| N7 | "Remind me in 3 days" follow-up and "My tasks" on Home | `AgriCopilot.tsx:1012`, `farmTasks.ts` (signed-in only) | #36 |
| N8 | Saved recovery notes (farmer's own, per diagnosis) | `recoveryLog.ts` | #36 |
| N9 | Diagnosis saved with district, upazila, standard `diseaseKey` | `diseaseKey.ts`, `diseaseKb.ts` | #36 |
| N10 | Area warnings (3-farmer threshold) on Home and Radar | `area-report.ts`, `useAreaWarnings.ts` | #40, #43 |
| N11 | Local prices per upazila, "report your sale price" | `LocalPriceCard`, `ReportPriceForm` | #40 |
| N12 | Official DAM bulletin service (parsed, cached 1 h, stale up to 24 h) | `market-prices.ts` function, `market-bulletin.ts` | #18-#21, #38, #42 |
| N13 | Saved profit plans, expense notes, season records | `useSeasonPlans.ts`, `ExpenseNotes.tsx` | #38 |
| N14 | Schemes "For you" and provider filter | `schemes/ForYouSection.tsx` | #39 |
| N15 | Photos actually shared with experts under consent | `expertPhotos.ts` | #39 |
| N16 | Farm record: plots, seasons, sales, server-scored record, one-page print | `farmRecord/*`, `farm-record-score.ts` | #41 |
| N17 | Web push notifications (area warnings, daily tasks) | `pushNotifications.ts`, `push-daily.ts`, `NotificationSettings.tsx` | #40 |
| N18 | Admin broadcasts | `broadcasts.ts` | #40 |
| N19 | Shared read-aloud `ListenButton` / `speakChecked` with no-Bangla-voice warning | `ui/ListenButton.tsx`, `utils/speech.ts` | #34, #45 |
| N20 | Server-owned AI safety policy and moderation log | `_shared/safety-policy.ts` | #24 |
| N21 | Honest diagnosis: ranked candidates, confidence from gap, hi-res and focus-crop input | `diagnosisTypes.ts`, `imageCapture.ts` | #23 |
| N22 | AI call budget and limits: max 2 attempts, charge before call, guest limits, per-IP caps, App Check | `usage-quota.ts`, `ip-limit.ts`, `app-check.ts` | #12, #17, #33, #43, #44 |
| N23 | Data-provenance labels ("AI estimate", "saved copy", "updated at") | `DataStatusBadge`, various | #29, #31, #37, #38 |
| N24 | Test suite (902 tests) and CI | many `*.test.ts` | #34-#45 |

## Counts by primary status (original features only, sections A-G)

Rows in sections A-G: 110 (101 original or pre-refactor features, 9 of the rows are features that were missing originally and are new). Primary status:

- UNCHANGED: 31
- IMPROVED: 24 (same place, honest data or better UX)
- HIDDEN (only under a "More details / More options" disclosure, or only in Full mode): 18
- REPLACED (old thing gone, a different thing does the job): 12
- NEW (listed in A-G because the original tab promised it; also in section H): 9
- REMOVED (invented or unbacked content deleted): 7
- REDUCED (kept but with less than before): 6
- MOVED: 3

Original features whose content was invented, simulated or broken at 6fa2c78 (evidence in the table): ticker prices (A3), header stats (A4), Cox's Bazar weather fallback (A8), sample disease cards (B18), recovery tracker (B15), Rx QR (B8), radar simulator and consensus % (D5, D6), satellite scene metadata (D19), market insights, supermarket, mandi hubs, margins, offline table (E1, E3-E5, E9), grading price (E15), credit/loan panels (F2, F3), admin figures (F15), community radar claim (F10), demo experts (G3).

Features that were real at 6fa2c78 and still work as before: live video, follow-up chat, summarise, translate, share, rating, Smart Planting, planting intents, Climate Resilience Guide, Smart Krishi Card timeline, Profile histories, user guide, scheme chat.

## Notes on the list of original features not covered above
- `DualModelComparison`, `PrecipitationRiskCurve`, `GoogleWeatherMap`, `MicroclimateRadarSimulator` are all reached only through WeatherAdvisory's More details in Simple (rows D5-D8, D11).
- `LiveMandiTicker`, `FarmActionTrafficLight`, `ExpertHub` source files all still exist; none was deleted.

## Top 10 candidates to bring back (and the proper way)

1. **Personalised AI (rows C3, D14, B1, E7, E15).** Build one `buildFarmerContext` that adds main crop, current season stage (from the saved calendar plan), plots, last 3 diagnoses and saved profit plan to every AI prompt, reusing `utils/farmMemory.ts` and `services/farmRecord.ts`. Today only Live video has memory; every other AI call knows only district and season.
2. **AI that explains the rules on Home (row D13).** Revive `generateWeatherAdvisory`: input is the real `farm_actions`, today's calendar task and any area warning; output is one short Bangla sentence plus Listen. Rules still decide, AI only phrases it. Home currently has no AI.
3. **"Show live" door on Home (rows B5, C1).** Add a fifth big button that opens Live video directly (it was the primary mode originally and is now 2 taps deep). Keep Quick mode as default.
4. **What to plant next, simplified (row D14).** Simple card: pre-filled from main crop and plots, adds soil (SoilGrids, row D9), zone risk (`climateZones.ts`) and bulletin prices to the prompt; show the top pick in sowing season on Home.
5. **Soil and rain detail feeding the signals (rows D7-D9).** Use pH/N/SOC and hourly rain in the fertiliser and irrigation rules instead of leaving them under "More details".
6. **Satellite field health (row D19).** Only with real Sentinel credentials; add a field boundary, a 30-day trend and a "good / check / urgent" message with Listen. Hide it when the data is only the seasonal model.
7. **More real prices (rows E2-E4, E8).** Add tomato, potato, brinjal and other missing crops from a second official feed (TCB or DAM district pages); promote the local-price card ("what neighbours got") to Home. Do not rebuild supermarket or per-mandi tables without a feed.
8. **Climate-resilient varieties by upazila (row D18).** Use `getDistrictClimateRisks` to show 2-3 varieties for the farmer's area at sowing time, each with a BRRI/BINA source; remove unsourced claims.
9. **Buyer and wholesaler links (row E17).** The owner parked this; the original vision still names it. Smallest honest version: a directory of verified buyers per upazila with a "call/WhatsApp" button and the graded lot attached.
10. **Real experts with alerts (rows G1, G3, F7).** Push or SMS an expert on a new request, onboard real experts, and connect the appeal dialog to an officer queue. This makes the "human" half of the vision real.

Also cheap wins: show the top 2 other causes inline in the crop doctor result (B4); a visible tool grid on Home instead of only "See all services" (A1); a Simple-mode first-use guide (F14); tag the 14 untagged schemes so "For you" is meaningful (E21).
