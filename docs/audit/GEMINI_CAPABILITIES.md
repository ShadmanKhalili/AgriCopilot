# AgriCopilot: Gemini audit and AI-first rebuild research (28 Nov 2026)

Legend: [V] verified on an official Google page fetched today; [P] from search-result snippet only; [U] could not verify / my inference.
Note: ai.google.dev/gemini-api/docs/* now 301-redirects to aistudio.google.com/docs/* (same content, official).

## 1. What the repo uses now

SDK: `@google/genai` declared `^1.29.0`, lockfile resolves 1.48.0 (package.json:16; package-lock.json:2846).

| Area | Model / feature | File refs |
|---|---|---|
| Standard text | `gemini-3.5-flash-lite` (STANDARD, BACKUP, CHAT) | src/services/ai.ts:277,305,321; ai.ts:760; LiveVideoCopilot.tsx:1321; server.ts:488 |
| Advanced + search | `gemini-3.6-flash` (ADVANCED, SEARCH) | src/services/ai.ts:278-279 |
| Allow-list / cascade | 3.8-flash -> 3.6-flash -> 3.5-flash-lite; 2.5-flash -> 3.5-flash-lite | netlify/functions/ai-proxy.ts:66-86,183-192; server.ts:332-355; .env.example:12 |
| Search grounding tool | `googleSearch` only attached to `gemini-3.6-flash`, `gemini-2.5-flash` | ai-proxy.ts:158,232; ai.ts:1198,1508 |
| TTS | `gemini-3.8-flash-lite-tts` (primary), `gemini-3.8-flash-tts` (backup); voice Kore | ai.ts:306-307, 889-891; ai-proxy.ts:85-86,740-744 |
| Live (video + voice) | `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`, voice Kore (bn) / Zephyr (en), `outputAudioTranscription`, `inputAudioTranscription`, `mediaResolution HIGH`, thinkingConfig only on extended model | ai.ts:319-320; live-token.ts:47-55,200-231; LiveVideoCopilot.tsx:932-947,1206; LiveExpertCall.tsx:274-282 |
| Ephemeral tokens | `authTokens.create`, `uses:1`, expireTime = 15 min (`AI_LIVE_SESSION_MINUTES`), 60 s new-session window, locks model + system instruction + speech config, `lockAdditionalFields:['tools']` = NO tools in Live | live-token.ts:200-231; gemini-live-token.ts:93-118; server.ts:358-401 |
| Config clamps | responseSchema/MimeType, thinkingLevel allowed, maxOutputTokens cap | _shared/ai-config.ts |
| Weather | Google Maps Platform Weather API (not Gemini) + Open-Meteo fallback | netlify/functions/weathernext-3.ts, config-status.ts |
| Memory today | client-side `farmContext` (<=4000 chars) injected into the Live system instruction | utils/farmMemory.ts; live-token.ts:70,131-145 |

Not used anywhere in src/ or netlify/functions/: function calling / `functionDeclarations`, `sessionResumption`, `contextWindowCompression`, GoAway handling, Google Maps grounding, URL context, File Search, context caching, Batch API, Interactions API.

Repo discrepancies worth knowing:
- ai.ts:257-265 and server.ts:323-328 say (measured 24 Oct 2026) `gemini-3.8-flash` and `gemini-2.5-flash` return 404 "no longer available to new users" on this project's key. Official docs today list 3.8 Flash as Stable and only 2.5 models as limited to existing users [V]. So the 3.8-flash 404 is either key/project specific or stale. Re-test before designing around 3.6.
- market-prices.ts:16 says `googleSearch` is refused on this key. Official docs show Search grounding is available on Flash models with 5,000 free/month shared [V]. Possibly a free-tier/billing/project issue [U]. Check.
- `gemini-2.5-flash` routes to `gemini-3.5-flash-lite` on 1 Dec 2026 [V]; remove it from allow-lists.
- Live has no sessionResumption/compression and no GoAway handling; see Live limits below (audio+video = 2 min without compression).
- Dev-facing: LiveVideoCopilot.tsx:2052 shows a hard-coded "~120ms" latency claim in the UI; not backed by any Google figure.

## 2. Current Google landscape (late Nov 2026)

### 2.1 Model family and recommendations [V: aistudio.google.com/docs/models, /docs/pricing]
Gemini 4 family (Carbon, Argon, Neon, Hydrogen), Gemini 3.x (3.8 Flash stable, 3.6 Flash stable, 3.5 Flash-Lite stable, 3.1 Flash-Lite stable), 3.8 Live + 3.8 Live Extended Thinking, 3.8 Flash TTS / Flash-Lite TTS, 3.5 Transcribe / Transcribe Live, 3.5 Live Translate (preview). Gemini 2.5 Flash/Pro deprecated, route to 3.5 Flash-Lite / 3.8 Flash on 1 Dec 2026; 2.5 Flash-Lite still served. Docs recommend Gemini 4 Hydrogen "for new projects" (coding/agentic), but it is $1.50/$7.50 per 1M: too pricey for high-volume farmer chat.

Prices, paid tier, USD per 1M tokens, Standard (in / out incl. thinking); "->" = change on 1 Jan 2027 [V]:
- 3.5 Flash-Lite: 0.30 / 2.50; cache 0.03 (+ $1.00/1M/hr storage); Batch 0.15 / 1.25; free tier yes. No Jan-2027 change shown.
- 3.1 Flash-Lite: 0.25 (audio 0.50) / 1.50; Batch 0.125 / 0.75.
- 3.8 Flash and 3.6 Flash: 0.75 -> 1.50 / 3.75 -> 7.50; cache 0.075 -> 0.15; Batch 0.375 -> 0.75 / 1.875 -> 3.75.
- 2.5 Flash-Lite: 0.10 / 0.40 (still served, legacy; limited to prior users).
- Gemini 4 Hydrogen 1.50 / 7.50 (free tier yes); Neon 3 / 15; Argon & Carbon 2 -> 4 / 10 -> 20 from 1 Dec 2026.
- Live 3.8 Live (+Extended): text 0.75 in / 4.50 out; audio 3.00 in (= $0.005/min) / 12.00 out (= $0.018/min); image/video 1.00 in (= $0.002/min). Free tier yes. Google Search grounding supported.
- TTS: 3.8 Flash-Lite TTS output audio $6.00 -> $12.00 per 1M (= $0.0015 -> $0.003 per 10 s), text in 0.50 -> 1.00; 3.8 Flash TTS output $9.00 -> $18.00 (= $0.00225 -> $0.0045 per 10 s). Batch/Flex listed at half.
- 3.5 Transcribe: $0.003/min in + $0.002/min out (~$0.005/min); Transcribe Live ~$0.009/min.
- Tools: Google Search grounding for Gemini 3+: 5,000 free requests/month (shared), then $14 per 1,000, capped 1,500 RPD per project; Maps grounding same 5,000 free then $14/1,000. URL context: charged as input tokens only. File Search: pay embeddings at indexing ($0.15/1M with gemini-embedding-001), storage and query embeddings free, retrieved chunks billed as input tokens.
- Batch: 50% of standard, 24 h target (expires after 48 h), supports structured output, tools incl. Search, caching, embeddings [V: /docs/batch-api]. TTS in batch: pricing page lists batch TTS rates, but Batch doc does not explicitly confirm TTS support [U].
- Context caching: implicit on by default for 2.5+; minimum 4,096 tokens for 3.8 Flash / 3.6 Flash; 3.5 Flash-Lite minimum not stated in the fetched text [U]. Put stable prefix (system prompt, farmer profile, tool schemas) first. Explicit caching needs generateContent (not Interactions, not Gemini 4). Live does NOT support caching [V].
- Free tier: data "used to improve products"; paid tier: not [V]. Do not send farmer data on the free tier. Numeric free-tier RPM/RPD for Flash and Live: not found on fetched pages [U]. Tier-up: Tier 1 on billing; Tier 2 ~$100 spend + 3 days; Tier 3 ~$1,000 + 30 days [V]. Concurrent Live session quota per tier: not found [U].
- Bangladesh is listed as an available region [V: /docs/available-regions] (matters mostly for any direct-from-browser Live sockets, not the Netlify proxy).

### 2.2 Function calling and best practice [V: /docs/function-calling]
- Modes: auto (default), any, none, validated. Parallel calls (independent) and compositional/chained calls supported. Thought signatures handled by SDK in stateful use; in stateless mode you must return model steps unchanged. Consider tool retrieval beyond ~20-30 tools; tool declarations are not stored, resend each request. Gemini 3/4 can combine built-in tools with function calling, File Search with function calling.
- Structured output + tools: preview, Gemini 4 and 3 series (e.g. 3.8 Flash). JSON Schema subset; minLength/maxLength/uniqueItems ignored (validate in code); too-complex schemas 400 [V: /docs/structured-output]. 3.5 Flash-Lite not named in the combo list [U].
- Interactions API: GA June 2026, "recommended interface for all new projects"; generateContent called legacy but fully supported. Batch API and Python automatic function calling not yet supported there [V: /docs/interactions-overview]. Whether the installed JS SDK (1.48.0) exposes it: [U], likely needs an upgrade.
- Live API function calling: NO automatic tool-response handling; client must receive tool calls and `sendToolResponse` [V: /docs/live-api/tools]. 3.8 Live: async (NON_BLOCKING) is default, sync via BLOCKING; scheduling INTERRUPT / WHEN_IDLE / SILENT. Extended Thinking: async only (per tools page). Google Search and function declarations can be combined. Google Maps, code execution, URL context, File Search, structured output, caching, Batch: NOT supported in Live [V]. Migration guide: return status fields in tool responses to avoid repeat calls; redundant tool calls raise time-to-first-audio [P/V].

### 2.3 Live API [V unless marked]
- Models: 3.8 Live (stable; 131,072 input / 65,536 output token limits), 3.8 Live Extended Thinking (thinkingLevel low/medium/high, thought summaries), 3.1 Flash Live Preview (legacy), 2.5 Flash native audio (legacy). Audio response only; use output transcription for text.
- Bangla: the Live language table lists Bengali `bn` among 99 languages, as one shared list, not per model; native audio picks language automatically and you cannot force a language code (steer via system instruction) [V]. Blog claims "97+ languages" and does not mention Bengali; no Google-published Bangla quality benchmark found [U]. Third-party Bangla voice-advisory research exists (arXiv KrishokBondhu, not Google) [P].
- Proactive audio permanently on for 3.8 Live (cannot disable, errors if false). Affective dialog removed in 3.8; only on 2.5 Flash Live [V]. Custom vocabulary up to 1,000 terms (best <=100) for input transcription [V].
- Limits: audio-only 15 min without compression; audio+video 2 min without compression; connection lifetime ~10 min then GoAway; `contextWindowCompression` (sliding window) extends sessions "to an unlimited amount of time"; `sessionResumption` handles valid 2 h after termination [V: /docs/live-api/session-management]. Video input is JPEG frames <=1 FPS, recommended 768x768; 3.8 Live sends all video frames by default so send only when needed [V].
- Ephemeral tokens (preview, v1beta, Live only): expireTime default 30 min; newSessionExpireTime default 1 min; `uses:1`; `liveConnectConstraints` can lock model + config; lockAdditionalFields supported; session resumption works with the same token even when uses=1 (reconnect ~every 10 min) [V: /docs/ephemeral-tokens]. Doc does not say whether tool declarations / system instruction can be locked in the token [U]; the repo already locks `tools` to empty and the system instruction via the SDK.
- Price per 2 minutes of mixed voice+video is about 3 cents (see section 4), but Live re-reads accumulated context each turn, so long sessions cost more [U: not confirmed on fetched pages].

### 2.4 Grounding, URL context, File Search
- Google Search grounding: Gemini 3+ shared 5,000 free/month then $14/1k; daily cap 1,500 RPD per project [V]. Treat as a scarce shared resource: run price/news lookups in a nightly job per district/crop and cache, not per farmer.
- Google Maps grounding: English-only prompts and responses; needs lat/lng; sources must be displayed and attributed to Google Maps; not in Live; Bangladesh coverage not stated [V]. Low value for Bangla farmers; use Places only if an English-side tool is needed [U].
- URL context: up to 20 URLs/request, 34 MB each, public pages, no paywalled/YouTube; free beyond input tokens; can combine with Search and function calling [V].
- File Search (managed RAG): 100 MB/file, free storage, embedding charge at indexing, supported on Flash/Flash-Lite 3.x, metadata filters, citations; cannot combine with Google Search or URL context; not in Live; Bangla support not stated [V/U]. Use it for a curated library (DAE/BARI/BRRI/BINA guides, schemes), exposed to Live as a server-side function tool.

### 2.5 TTS and STT for Bangla [V]
- Both 3.8 TTS models list "Bangla" as supported (130+ languages Flash, 100+ Flash-Lite), 30 prebuilt voices (Kore, Puck, Zephyr, Sulafat...), no Bangla-specific notes, no stated max input length. Unary returns WAV 24 kHz mono 16-bit (~2.9 MB/min!); streaming returns raw PCM; mulaw/alaw 8 kHz and `sample_rate` option exist. Style via `speech_metadata.style`; use one call per turn, split long text. Voice quality for Bangla: no official benchmark [U].
- STT: `gemini-3.5-transcribe` lists Bengali (Bangladesh) `bn-BD` and (India) `bn-IN`, auto language detect and code-switching, custom vocabulary up to 1,000 terms, avg WER 4.0% streaming / 2.6% non-streaming (Google's overall figure, not Bangla-specific) [V: blog 15 Sep 2026]. Good for turn-based "hold-to-talk" on weak links.

### 2.6 Google agriculture offerings relevant to Bangladesh
- Agricultural Landscape Understanding (ALU) and Agricultural Monitoring & Event Detection (AMED) APIs: vector GeoJSON (fields, crop type/season predictions, history), Sentinel-1/2 based, requires Cloud-project allowlisting; countries not listed on the docs page [V]. Google blog 24 Oct 2025: India first; APAC trusted testers in Malaysia, Vietnam, Indonesia, Japan; Bangladesh not mentioned [V]. Search snippet says AMED crop list is India-centric (rice yes, jute not listed) [P]. So: apply for allowlist, but plan without it.
- AlphaEarth Foundations / Satellite Embedding V1: annual 64-d, 10 m embeddings in Earth Engine and as COGs on GCS, CC-BY 4.0; coverage years ~2017-2024/25 (sources disagree) [P]. Developer-accessible via Earth Engine API (EE access/commercial terms [U]). Useful for custom paddy/jute classification only with ground labels; heavy lift for a PWA team.
- WeatherNext 3 (global, 15-day, 64-member ensemble, hourly init, 5 km station-calibrated surface) and WeatherNext 2, via GCS (Zarr), BigQuery, Earth Engine after a data-request form (5-7 business days; "anyone with a Google Account"); real-time data under experimental terms, historical CC BY 4.0; "not official severe weather warnings"; commercial-use terms and price not stated [V: developers.google.com/weathernext]. On-demand inference only WeatherNext 2 [P]. The repo already uses the Maps Platform Weather API; a WeatherNext BigQuery pipeline is optional.
- Field boundaries (e.g. Fields of the World) appear only in third-party papers; no official Google Bangladesh field-boundary dataset found [U].

### 2.7 Memory for assistants
- No managed memory in the Gemini Developer API [U: absence found]. Options in Google's stack: (1) Interactions API server-side history via `previous_interaction_id` (paid retention 55 days, configurable 7/14/28; free 1 day; carries only conversation history, tools/system instruction must be resent; `store=false` disables chaining) [V]; (2) Memory Bank on the Gemini Enterprise Agent Platform (Vertex) for long-term user facts and preferences; pricing, GA status and use from the plain Gemini API not stated [V/U]; (3) Google guidance: summarise multi-turn history periodically and keep structured state externally; long context + caching are the default optimisation, RAG still relevant [P].
- Recommendation: own the memory in Firestore (you already have farmMemory.ts and a 4,000-char farmContext cap): a typed "farm profile" (plots, crops, sowing dates, inputs, loans, buyers, language, literacy/voice preference) + rolling summary + last N turns; nightly Batch job extracts new facts with a JSON schema (Flash-Lite) and dedupes; inject a compact (<1.5k tokens) block at the top of the prompt for caching; give the farmer a "what I remember" screen to edit/delete (consent and correctness). Same block feeds the Live token's locked system instruction.

## 3. Recommended architecture per capability

(a) Assistant with memory + tools (text, voice, live video)
- Text: Gemini 3.5 Flash-Lite, thinking `minimal`/`low`, function calling mode auto; escalate hard planning turns (multi-step, uncertain) to 3.8 Flash `low`. Use generateContent now (Batch, auto function calling, explicit caching all work); plan an Interactions migration later.
- Tools (declare once, share across text and Live): read-only auto-run (get_weather, get_prices, get_farm_record, find_schemes via File Search/Firestore, get_reminders); write tools (log_expense, add_reminder, book_expert, start_diagnosis) return a structured "proposed action" card the farmer confirms with one tap (big-button Bangla card, voice "yes"); idempotency keys; server re-validates auth (Firebase ID token), amounts, dates; never let the model pass a user id. Return `status` fields in responses.
- Live: 3.8 Live (not Extended Thinking) default for voice/video; Extended Thinking only for an explicit "deep" diagnosis mode (async tools only). Put function declarations in the locked token config (verify SDK accepts `tools` in `liveConnectConstraints.config` [U]); client executes tool calls by calling your authenticated Netlify endpoints and sends `sendToolResponse`; use NON_BLOCKING with SILENT/WHEN_IDLE for slow lookups. Add `contextWindowCompression` + `sessionResumption` + GoAway reconnect; send video frames only on demand ("show me the leaf" button) to cut cost and the 2-minute video cap; keep `uses:1` and resume with the same token.
- Hold-to-talk fallback for 3G: record clip -> `gemini-3.5-transcribe` (bn-BD, custom vocabulary of crop/pesticide names) -> text agent -> TTS. More robust than a WebSocket on flaky links; cost is similar.

(b) Daily briefing in Bangla
- Nightly Batch job (50% off): inputs = farm profile, crop stage, next-7-day forecast, local price series, reminders. Flash-Lite 3.5 with JSON schema -> {headline, 3 actions, risk flags, price note, spoken_script_bn}; A/B Bangla quality against 3.8 Flash. Generate shared region+crop-stage scripts with a short personalised intro to cut TTS cost.
- TTS 3.8 Flash-Lite (A/B vs Flash for Bangla naturalness), 60-90 s. Do NOT ship 24 kHz WAV (~2.9 MB/min): request `audio/mulaw` or lower `sample_rate`, or transcode to Opus/AAC server side [U on transcode path], pre-fetch over Wi-Fi/overnight via service worker, cache offline, show text alongside. Fallback to Web Speech if TTS fails (already in DigitalPrescriptionModal).
- Schedule: generate after midnight Dhaka time; push notification via existing web-push.

(c) Season and money coaching
- Compute forecasts deterministically in code (cost-to-date from expense log, expected yield x forecast price range, break-even, sell-now vs wait spread, storage loss assumption); LLM only explains and asks questions. Use structured output for the numbers it reads back; validate ranges.
- Prices: nightly shared grounded lookup per district/crop (Search grounding, mind the 1,500 RPD cap) + official bulletin sources; always show source and date; never give a single-number "guarantee"; give ranges and a plain "this is a guess" label. Weather from existing Weather API/WeatherNext.
- Model: Flash-Lite for chat explanations, 3.8 Flash for the weekly "season plan" (Batch).

(d) Photo diagnosis
- 3.5 Flash-Lite first pass with `mediaResolution` high and a JSON schema: {crop, candidates[{name, confidence, evidence}], missing_info_questions, urgency, safe_first_steps, escalate:boolean}. Confidence low/escalate -> 3.8 Flash `low/medium`; still unsure -> book_expert tool. Compress image client-side (existing imageCapture.ts) before upload on 3G.
- Ground treatment advice in a curated, versioned library via File Search (DAE/BARI/BRRI/BINA/FAO IPM), with citations; do not use Search grounding together with File Search (not allowed). 
- Pesticide safety: no dose/mix numbers generated from model memory; doses only from a reviewed table in code; prefer IPM/cultural steps first; always surface PPE, re-entry/harvest interval, "read the label", "ask your Sub-Assistant Agriculture Officer / DAE"; refuse/redirect banned or highly hazardous products; log the diagnosis for audit. Run an adversarial test set in Bangla.

## 4. Cost per active farmer per day (my estimate; paid tier; prices after 1 Jan 2027 where they change)
Assumptions (all [U], mine): 1 briefing; 5 chat turns of ~4k input tokens (memory + tools + history, mostly uncached for cheapness) and ~500 output tokens incl. thinking, 1.5 model calls per turn for tool round trips; 1 photo at ~2.6k input tokens (image ~1.1k per repo note ai.ts:521) and ~800 output; 2 min live with ~1 min model speech, continuous mic and video for 2 min. Bangla text tokenises heavier than English, so token counts could be 1.5-3x higher.

| Item | Model | Estimate USD/day |
|---|---|---|
| Briefing text (Batch) | 3.5 Flash-Lite (3k in / 600 out) | 0.001 (3.8 Flash batch: 0.005) |
| Briefing TTS, ~75 s | 3.8 Flash-Lite TTS $0.003/10 s | 0.023 standard; ~0.011 if Batch TTS works [U]; 3.8 Flash TTS ~0.034 |
| 5 chat turns | 3.5 Flash-Lite | 0.015-0.025 (3.8 Flash for all turns: ~0.06) |
| 1 photo diagnosis | Flash-Lite 0.003; Flash 3.8 ~0.010 | 0.003-0.010 |
| 2 min Live voice+video | 3.8 Live: 2 x 0.005 + 1 x 0.018 + 2 x 0.002 | ~0.032 (range 0.03-0.08 if context re-billing) |
| Total | | about $0.08-0.12/day with Live; $0.04-0.07 without (~$1.2-3.6/month) |
Shared TTS per region+stage can cut the largest line item (briefing TTS) by ~10x. Search grounding at $14/1,000 adds $0.014 per grounded request if used per farmer; avoid. TTS price doubles from 1 Jan 2027 (included above); Flash-Lite 3.5 and Live prices show no scheduled change.

## 5. Risks
- Bangla quality: Live and TTS list Bangla, but no official Bangla benchmark; auto language selection (cannot force `bn`) can drift to Hindi/English; dialect (Rangpur, Noakhali, etc.) and numerals/units (bigha, katha, maund, mon) need testing. Build a 100-utterance Bangla eval set per capability before launch, with custom vocabulary for crop/pesticide/market names.
- Latency on 3G: Live WebSocket + 1 FPS video; no Google latency figure for Bangladesh (the "~120ms" in LiveVideoCopilot.tsx:2052 is unsupported). Use compression/resumption/GoAway, hold-to-talk fallback, low frame size, pre-generated audio, offline queue for tool writes.
- Live constraints: no structured output, caching, Maps, URL context, File Search or Batch in Live; thinking and proactive audio are model-dictated; audio+video sessions cap at 2 min unless compression is on; ephemeral token feature still labelled preview.
- Safety for pesticides: advice-liability and poisoning risk; see (d). Keep the locked server-side system instruction (as already done) and add post-response checks for dose/brand patterns.
- Cost/abuse: Live and TTS dominate; keep per-account daily caps (already in repo), App Check, and a global daily cap.
- Data: use paid tier only (free-tier data is used to improve Google products); memory contains financial/farm data, so give delete/export and minimise what goes in prompts.
- Platform churn: model routing on 1 Dec 2026, TTS/Flash price doubling 1 Jan 2027, preview models can be deprecated with 2 weeks notice; keep model IDs in env (already) and a fallback chain.
- Agri APIs: ALU/AMED access for Bangladesh unconfirmed; WeatherNext commercial terms unclear.
- Repo vs docs mismatch on 3.8 Flash availability (section 1) must be resolved on the actual project key.

## 6. Not verified from official sources
Numeric free-tier and per-tier RPM/RPD for Flash/Live; concurrent Live session quota; whether `tools` and system instruction can be locked in an ephemeral token beyond what the repo's SDK usage implies; Live re-billing of context per turn; Batch support for TTS; 3.5 Flash-Lite caching minimum; JS SDK Interactions support in v1.48; Bangla quality for Live/TTS/Transcribe; Bangladesh coverage for Maps grounding, ALU/AMED and WeatherNext commercial terms; AlphaEarth exact year coverage; Memory Bank pricing/status; why this project's key 404s on 3.8 Flash and refuses googleSearch.

## Sources
- https://aistudio.google.com/docs/pricing (from ai.google.dev/gemini-api/docs/pricing)
- https://aistudio.google.com/docs/models
- https://aistudio.google.com/docs/models/gemini-3.8-live
- https://aistudio.google.com/docs/live-api , /live-api/capabilities , /live-api/session-management , /live-api/tools
- https://aistudio.google.com/docs/ephemeral-tokens
- https://aistudio.google.com/docs/function-calling
- https://aistudio.google.com/docs/structured-output
- https://aistudio.google.com/docs/speech-generation
- https://aistudio.google.com/docs/speech-to-text
- https://aistudio.google.com/docs/caching , /batch-api , /file-search , /maps-grounding , /url-context , /image-understanding , /thinking , /rate-limits , /available-regions , /interactions-overview
- https://blog.google/innovation-and-ai/technology/developers-tools/build-real-time-voice-applications-gemini-audio/ (15 Sep 2026)
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-live
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale (Memory Bank mention)
- https://developers.google.com/agricultural-understanding/api
- https://blog.google/intl/en-in/company-news/technology/sowing-seeds-of-agri-ai-models-from-india-to-apac/ (24 Oct 2025)
- https://developers.google.com/weathernext and /weathernext/guides/access-forecast
- https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL (search snippet only)
- https://ai.google.dev/gemini-api/terms and /logs-policy (data-use, search snippet)
