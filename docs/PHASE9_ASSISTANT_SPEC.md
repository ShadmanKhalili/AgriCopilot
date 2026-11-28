# Phase 9 spec: the assistant, version 1 (talk and read)

Shared contract for every agent working on Phase 9. Read `docs/PLAN_ASSISTANT_FIRST.md` sections 3.2, 4 and 5 for the why.

**Done when:** "আজ কি স্প্রে করতে পারি?", "আলুতে এ পর্যন্ত কত খরচ হয়েছে?" and "আলুর দাম কত?" are each answered from tools, in Bangla, with numbers that match the screens.

## Defaults for the open decisions (owner can change later)
- **Name:** `ASSISTANT_NAME = { bn: 'কৃষি সাথী', en: 'Krishi Sathi' }` in `src/constants/assistant.ts`. Use this constant everywhere; never hard-code the name.
- **Guests:** get the assistant, under the existing guest daily AI limit (`usage-quota.ts`).
- **Budget:** each assistant turn counts as ONE `text` usage unit and one global call (`chargeGlobalAiCall`), however many tool rounds it takes.
- **Bottom bar:** "Ask" (জিজ্ঞাসা) replaces "Weather" in Simple mode. Weather stays reachable from Home's Today card and from the drawer.

## Rules (from the plan, section 4)
1. Rules decide, the AI explains: spray/irrigate/fertilise come from `farm-actions.ts`, never from the model.
2. Every number in an answer comes from a tool result or the farmer context. The system prompt must forbid inventing prices, yields, doses or dates, and say "I don't know" + suggest an expert / 16123 helpline.
3. Phase 9 is READ ONLY. No write tools. (Write tools are Phase 10.)
4. Label sources: each tool result carries `source: 'rules' | 'farmer_records' | 'govt_bulletin' | 'weather_forecast' | 'ai_estimate' | 'app_data'`. The response lists the sources used so the UI can show labels.
5. Bangla first: short sentences, Bangla numerals in Bangla answers.
6. Farmer text is data, not instructions (reuse `quoted()` style from `farmer-context.ts`).

## API: `POST /api/assistant`
Netlify v2 function `netlify/functions/assistant.ts`, `config = { path: '/api/assistant', rateLimit: {...} }`, same auth / App Check / quota / global-cap pattern as `ai-proxy.ts`. Mirrored in `server.ts`. Add to `netlify/functions/__tests__/function-surface.test.ts`.

Request (JSON, ≤ 32 KB):
```ts
interface AssistantRequest {
  message: string;                  // 1..2000 chars, the farmer's new message
  lang: 'bn' | 'en';
  channel: 'text' | 'voice' | 'photo';
  history?: { role: 'user' | 'assistant'; text: string }[]; // last ≤ 12 turns, each ≤ 4000 chars, oldest first
  location?: { lat: number; lon: number };                    // optional, server rounds to 2 decimals; else use farm_profile location
  attachment?: {                                              // e.g. from crop doctor
    kind: 'diagnosis';
    summary: string;                                          // ≤ 3000 chars, plain text of the diagnosis result
  };
  today?: {                                                   // the client's own weather reading (Home Today card), optional
    readingAt: string;                                        // ISO time the reading was fetched
    temp: number;                                             // °C
    humidity?: number; windSpeed?: number; rainChanceToday?: number; rainChanceNext12h?: number; soilMoisture?: number;
  };                                                          // = TodayConditions (farm-actions.ts) + readingAt; NEVER verdicts
}
```

`today` rules (server, `validateTodayReading` in `_shared/assistant-core.ts`):
- Ranges: `temp` −30..60 °C, `humidity` 0..100 %, `windSpeed` 0..250 km/h (the `TodayConditions` unit), `rainChanceToday` / `rainChanceNext12h` 0..100 %, `soilMoisture` 0..1 m³/m³. Edges are inside.
- Optional values may be missing or `null` (= unknown, never 0). Unknown keys are dropped. The whole `today` object must be ≤ 1 KB as JSON.
- `readingAt` older than 60 min, or more than 5 min in the future, or unparseable: the reading is ignored.
- Any failure means the reading is **ignored** (as if not sent), never a 400.
- When valid, `get_today_farm_actions` runs `farmActions(todayActionInput(c))` on it (the Home card's rules), `source: 'rules'`, with no weather fetch. `get_week_forecast` still uses the feed.
Response 200:
```ts
interface AssistantResponse {
  text: string;                      // the answer, plain text (no markdown headings; short paragraphs/bullets ok)
  toolCalls: { name: string; status: 'done' | 'failed' }[]; // ≤ 10, matches ToolCallRecord in assistant-memory-model.ts
  sources: Array<'rules' | 'farmer_records' | 'govt_bulletin' | 'weather_forecast' | 'ai_estimate' | 'app_data'>;
  model: string;
}
```
Errors: JSON `{ error: string, code?: string }` with 400 (bad input), 401 (no/invalid token), 429 (`limit` field present when daily allowance spent; `code: 'daily_capacity'` for the global cap; `code: 'ip_limit'` for the per-IP ceiling), 500/502/503/504. Never leak the API key or raw upstream errors.
- **Safety block:** 400 with `code: 'SAFETY_BLOCK'` (`SAFETY_BLOCK_CODE` in `_shared/safety-policy.ts`) and the shared `SAFETY_BLOCK_MESSAGE`. The turn was already charged one unit; the client must recognise the code, show the message and NOT auto-retry the same text (a retry is a new, charged turn).

Server is stateless: it does NOT store the conversation. The client saves messages to Firestore (rules already exist in `firestore.rules`, `users/{uid}/assistant_threads/{threadId}/messages/{id}`).

## Server internals (one owner)
- `_shared/assistant-tools.ts`: tool declarations (Gemini `functionDeclarations`) and executors. Read tools, all scoped to the verified uid:
  - `get_today_farm_actions` → spray/irrigate/fertilise status + reasons from `farm-actions.ts`, using the same weather feed the Home card uses.
  - `get_week_forecast` → 7-day summary (rain chance, temps) + `weekActionsFromFeed`.
  - `get_my_season` → active season, crop, day N, stage and next calendar step (from farmer facts).
  - `get_my_money` → costs/sales/so-far totals for the active (or named) crop season.
  - `get_market_price` (crop) → government bulletin range + date, from the same source as `/api/market-prices`; say clearly when the crop is not in the bulletin.
  - `get_area_warnings` → area summaries for the farmer's upazila.
  - `get_open_tasks` → open/overdue tasks.
  - `lookup_disease` (name) → entry from the app's disease knowledge base if importable server-side; otherwise omit this tool.
- `_shared/assistant-core.ts`: pure parts (request validation, prompt building, tool-loop driver with injected `generate` fn, source collection, output cleaning) with thorough unit tests.
- Model: `gemini-3.5-flash-lite` by default; at most 4 tool rounds; overall budget under 9 s (8.5 s from handler start, Netlify default function timeout is 10 s) — if tools time out, answer with what is known.
- Cold-start speed: when no valid `today` is sent (or the question is about later days) and the message looks weather / spray / irrigate related (bn + en keywords, `messageTopics`), the weather feed fetch starts at handler start in parallel with `loadFarmerFacts` (request location; else right after the facts give the profile location). A message about price / দাম / বাজার prefetches the bulletin. The tools reuse these fetches (one per turn).
- Quota: the one `text` unit is charged before the loop decides remaining time / whether tools are allowed (the charge itself takes time). Nothing is charged when the budget is already spent.
- When the model cannot finish after tools ran (no time left, it failed, or its answer is empty or cut off at MAX_TOKENS), the answer is built without the model from the `get_today_farm_actions` result (the Home card's own sentences, `signalsSpeech(todaySignals(...))`) and/or the `get_market_price` result; else the honest fallback.
- Gemini shapes: no-argument tools omit `parameters`; the last call keeps the tool declarations with `toolConfig.functionCallingConfig.mode = NONE`; Gemini 3 models get `thinkingConfig.thinkingLevel = LOW` (dropped for the instance and retried once if the upstream rejects it); `maxOutputTokens` ≤ 2048.
- Market answers match the Market screen: the crop is mapped to the screen's commodity (`matchCommodities` / `COMMODITY_MATCHERS` in `_shared/market-prices.ts`), that item comes first with its `label`, other name hits after; crops in `NOT_IN_BULLETIN` (tomato, potato, brinjal) are reported as not in the bulletin with the same label.
- `get_my_money` with a crop: an open (not harvested) season of that crop first, then the newest.
- Farmer context: `loadFarmerFacts` + `formatFarmerContext` from `_shared/farmer-context.ts` in the system instruction.

## Client (`src/services/assistant.ts`, `src/services/assistantThreads.ts`)
```ts
// assistant.ts
export async function askAssistant(req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResponse>;
// throws AssistantError { kind: 'offline' | 'limit' | 'capacity' | 'auth' | 'server'; message: string }
// Uses ensureAiSession()/ID token + getAppCheckHeader() like callAiProxy in src/services/ai.ts, and the aiQueue slot limiter.

// assistantThreads.ts  (Firestore, owner-only rules already deployed with Phase 8)
export interface ThreadMessage { id: string; role: 'user' | 'assistant'; text: string; channel: 'text'|'voice'|'live'|'photo'; createdAt: string | null; toolCalls?: {name: string; status: string}[] }
export async function getOrCreateMainThread(uid: string, lang: 'bn'|'en'): Promise<string>; // one thread "main" per farmer for v1 (id 'main')
export async function listMessages(uid: string, threadId: string, limit?: number): Promise<ThreadMessage[]>; // oldest first, default last 50
export async function appendMessage(uid: string, threadId: string, msg: Omit<ThreadMessage, 'id'|'createdAt'>): Promise<string>; // also bumps thread updatedAt + messageCount
export async function clearThread(uid: string, threadId: string): Promise<void>;
```
Writes must satisfy the existing rules exactly (hasOnly keys, `createdAt/updatedAt == request.time` via serverTimestamp, `messageCount` int, text 1..4000, channel enum). Use `newMemoryFactData`-style helpers from `assistant-memory-model.ts` where they exist.

## UI
- `src/components/assistant/AssistantScreen.tsx` (default export) props `{ lang: 'bn'|'en'; initialQuestion?: string | null; onConsumedInitial?: () => void; onOpenTab?: (tab: Tab) => void }`. Full conversation screen: messages, Listen on each assistant answer (`ListenButton`), source labels under answers, AskBar at the bottom, "নতুন কথা" (clear) action, signed-out/guest handling, offline message, limit message.
- `src/components/assistant/AskBar.tsx` (named export `AskBar`) props `{ lang; onAsk: (text: string, channel: 'text'|'voice') => void; disabled?: boolean; compact?: boolean; placeholder?: string }`. Big mic button (hold-to-talk with `startListening` from `src/utils/speech.ts`, tap-to-toggle fallback), text box, send button. 48px+ targets, Bangla labels.
- Tab id `'assistant'` added to `src/nav/tabs.ts` (`TAB_IDS`, `TAB_LEVEL` simple, hash `#assistant`). Bottom bar in Simple mode: Home, Ask, Crop doctor, Market, All. Home gets a compact AskBar under the Today card that opens the Ask tab with the question.
- Crop doctor: the follow-up chat after a diagnosis goes through `askAssistant` with `attachment: { kind: 'diagnosis', summary }` and is saved to the same main thread.
